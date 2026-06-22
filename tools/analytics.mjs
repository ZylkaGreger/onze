#!/usr/bin/env node
// Onze analytics — pull Cloudflare Web Analytics (the cookieless RUM beacon) straight to the
// terminal, no dashboard/browser needed. Prints visits + pageviews for the last 24h and 7d,
// plus top pages / referrers / countries.
//
// Setup (one time):
//   1. Create a Cloudflare API token — https://dash.cloudflare.com/profile/api-tokens
//      "Create Token" → "Create Custom Token" → Permissions: Account · Account Analytics · Read.
//      (Read-only, single permission — safe to keep locally. Don't commit it.)
//   2. export CLOUDFLARE_API_TOKEN=<the token>
//        (optional) export CF_ACCOUNT_ID=<id>   # else the first account on the token is used
//        (optional) export ONZE_SITE_TAG=<tag>  # defaults to the onzedaily.com beacon below
//   3. node tools/analytics.mjs            # or:  node tools/analytics.mjs --days 30
//
// Exit 0 on success, 1 on any error (so CI can gate on it).

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SITE_TAG = process.env.ONZE_SITE_TAG || '31334058083a4b378fd80062bcd872f1'; // public onze beacon id
const API = 'https://api.cloudflare.com/client/v4';

const argDays = (() => { const i = process.argv.indexOf('--days'); return i > -1 ? +process.argv[i + 1] : null; })();

function die(msg, hint) {
  console.error('✖ ' + msg);
  if (hint) console.error('  ' + hint);
  process.exit(1);
}

if (!TOKEN) {
  die('CLOUDFLARE_API_TOKEN is not set.',
      'Create a read-only token (Account · Account Analytics · Read) and `export CLOUDFLARE_API_TOKEN=…`. See the header of this file.');
}

const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

async function accountTag() {
  if (process.env.CF_ACCOUNT_ID) return process.env.CF_ACCOUNT_ID;
  const r = await fetch(API + '/accounts', { headers: H }).then(r => r.json()).catch(() => null);
  if (!r || !r.success) die('Could not list accounts.', JSON.stringify(r && r.errors));
  if (!r.result.length) die('Token has no accounts.');
  return r.result[0].id;
}

// run one rumPageloadEventsAdaptiveGroups query; `group` is an optional dimension to break down by.
async function rum(accountTag, sinceISO, untilISO, { group, limit = 1 } = {}) {
  const dims = group ? `dimensions { ${group} }` : '';
  const order = group ? ', orderBy: [count_DESC]' : '';
  const q = `query($a:String!,$s:String!,$start:Time!,$end:Time!){
    viewer { accounts(filter:{accountTag:$a}) {
      rumPageloadEventsAdaptiveGroups(
        filter:{ datetime_geq:$start, datetime_leq:$end, siteTag:$s }, limit:${limit}${order}
      ) { count sum { visits } ${dims} }
    } }
  }`;
  const body = JSON.stringify({ query: q, variables: { a: accountTag, s: SITE_TAG, start: sinceISO, end: untilISO } });
  const r = await fetch(API + '/graphql', { method: 'POST', headers: H, body }).then(r => r.json());
  if (r.errors && r.errors.length) {
    const m = r.errors[0].message || JSON.stringify(r.errors[0]);
    if (/not authorized|authz/i.test(m))
      die('Token is not authorized for analytics.',
          'The token needs the "Account Analytics · Read" permission (and access to this account).');
    die('GraphQL error: ' + m);
  }
  return r.data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups || [];
}

const iso = d => d.toISOString();
const totals = rows => rows.reduce((a, r) => ({ views: a.views + r.count, visits: a.visits + (r.sum?.visits || 0) }), { views: 0, visits: 0 });

function table(title, rows, dim) {
  console.log('\n  ' + title);
  if (!rows.length) { console.log('    (no data)'); return; }
  const max = Math.max(...rows.map(r => r.count));
  for (const r of rows.slice(0, 5)) {
    const label = (r.dimensions?.[dim] || '(none)').slice(0, 34).padEnd(34);
    const bar = '█'.repeat(Math.max(1, Math.round((r.count / max) * 18)));
    console.log(`    ${label} ${String(r.count).padStart(5)}  ${bar}`);
  }
}

async function main() {
  const now = new Date();
  const a = await accountTag();
  const win = async (label, days) => {
    const start = new Date(now - days * 864e5);
    const t = totals(await rum(a, iso(start), iso(now)));
    console.log(`  ${label.padEnd(10)} ${String(t.visits).padStart(6)} visits   ${String(t.views).padStart(6)} pageviews`);
  };

  console.log(`\n📊 Onze analytics — ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC   (site ${SITE_TAG.slice(0, 8)}…)`);
  console.log('  ─────────────────────────────────────────────');
  await win('last 24h', 1);
  await win('last 7d', 7);
  if (argDays) await win(`last ${argDays}d`, argDays);

  // breakdowns over the last 7 days
  const start7 = iso(new Date(now - 7 * 864e5)), end = iso(now);
  const [pages, refs, countries] = await Promise.all([
    rum(a, start7, end, { group: 'requestPath', limit: 5 }),
    rum(a, start7, end, { group: 'refererHost', limit: 5 }),
    rum(a, start7, end, { group: 'countryName', limit: 5 }),
  ]);
  console.log('\n  ── last 7 days ──');
  table('Top pages', pages, 'requestPath');
  table('Top referrers', refs, 'refererHost');
  table('Top countries', countries, 'countryName');
  console.log('');
}

main().catch(e => die('Unexpected error: ' + (e.message || e)));
