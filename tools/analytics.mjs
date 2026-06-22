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
//        (optional) export ONZE_SITE_TAG=<tag>  # defaults to onzedaily.com's site_tag below
//   3. node tools/analytics.mjs            # or:  node tools/analytics.mjs --days 30
//
// Exit 0 on success, 1 on any error (so CI can gate on it).

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
// NOTE: Cloudflare uses TWO ids for a Web Analytics site. The page's data-cf-beacon token
// (31334058… for onze) is the public beacon id; the GraphQL API identifies the SAME site by an
// internal "site_tag" — the value below. They differ by design. Override with ONZE_SITE_TAG;
// run `node tools/analytics.mjs --discover` to list the site_tags that have data in your account.
const SITE_TAG = process.env.ONZE_SITE_TAG || '4ba149f2f8d147d399666a10a50dd90b'; // onzedaily.com RUM site_tag
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
  // Prefer GraphQL viewer.accounts: a token scoped only to "Account Analytics · Read" can see
  // its account here even when the REST /accounts list comes back empty (different permission).
  const g = await fetch(API + '/graphql', {
    method: 'POST', headers: H,
    body: JSON.stringify({ query: 'query { viewer { accounts(limit: 10) { accountTag } } }' }),
  }).then(r => r.json()).catch(() => null);
  const accts = g?.data?.viewer?.accounts;
  if (accts && accts.length) return accts[0].accountTag;
  // fall back to the REST account list
  const r = await fetch(API + '/accounts', { headers: H }).then(r => r.json()).catch(() => null);
  if (r && r.success && r.result.length) return r.result[0].id;
  die('Token can see no account.',
      'Find your Account ID (dashboard right sidebar, or the dash.cloudflare.com/<ACCOUNT_ID>/… URL) and run:  export CF_ACCOUNT_ID=<id>  then re-run. ' +
      'If it then says "not authorized", recreate the token with Account Resources → Include → your account.');
}

// run one rumPageloadEventsAdaptiveGroups query; `group` breaks down by a dimension,
// `allSites` drops the siteTag filter (used by --discover to find which tags have data).
async function rum(accountTag, sinceISO, untilISO, { group, limit = 1, allSites = false } = {}) {
  const dims = group ? `dimensions { ${group} }` : '';
  const order = group ? ', orderBy: [count_DESC]' : '';
  const siteFilter = allSites ? '' : ', siteTag:$s';
  const siteVar = allSites ? '' : ', $s:String!';
  const q = `query($a:String!${siteVar}, $start:Time!, $end:Time!){
    viewer { accounts(filter:{accountTag:$a}) {
      rumPageloadEventsAdaptiveGroups(
        filter:{ datetime_geq:$start, datetime_leq:$end${siteFilter} }, limit:${limit}${order}
      ) { count sum { visits } ${dims} }
    } }
  }`;
  const variables = { a: accountTag, start: sinceISO, end: untilISO };
  if (!allSites) variables.s = SITE_TAG;
  const body = JSON.stringify({ query: q, variables });
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

  // --discover: which site tags have RUM data in this account over the last 30 days?
  if (process.argv.includes('--discover')) {
    const rows = await rum(a, iso(new Date(now - 30 * 864e5)), iso(now),
                           { group: 'siteTag', limit: 50, allSites: true });
    console.log(`\n🔎 RUM sites with pageloads in account ${a.slice(0, 8)}… (last 30 days):`);
    if (!rows.length) {
      console.log('  (none — this account has no Web Analytics data. Wrong account, or the site is under another one.)');
    } else {
      for (const r of rows) {
        const mark = r.dimensions.siteTag === SITE_TAG ? '  ← configured ONZE_SITE_TAG' : '';
        console.log(`  ${r.dimensions.siteTag}   ${String(r.count).padStart(6)} pageviews${mark}`);
      }
      console.log('\n  If the tag with data differs from the configured one, run with:  ONZE_SITE_TAG=<that-tag> node tools/analytics.mjs');
    }
    process.exit(0);
  }
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
