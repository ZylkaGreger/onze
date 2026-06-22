// Onze live health check — is onzedaily.com up and is TODAY's puzzle playable everywhere?
// Run: node tools/health-check.mjs   (exit 0 = healthy, exit 1 = problem)
// Used by the daily CI cron so a broken/missing puzzle is caught every morning.
// Draws today's puzzles with the SAME code the browser runs — ../game.js (no duplication).

import { todayStr, buildPuzzle, buildLinkPuzzle, buildGridPuzzle } from '../game.js';

const SITE = process.env.ONZE_URL || 'https://onzedaily.com';
const LEAGUES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'WORLD'];
const DIFFS = ['easy', 'medium', 'hard'];

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

async function main() {
  const date = todayStr();

  let home;
  try { home = await fetch(SITE, { redirect: 'follow' }); } catch (e) { fails.push(`site unreachable: ${e}`); }
  ok(home && home.ok, `site not reachable (status ${home && home.status})`);

  let D;
  try { D = await (await fetch(SITE + '/data/squads.json?cb=' + Date.now())).json(); }
  catch (e) { fails.push(`squads.json unreachable/invalid: ${e}`); return report(date); }

  ok(Array.isArray(D.seasons) && D.seasons.length >= 18, 'seasons missing or too few');
  ok(Array.isArray(D.clubs) && D.clubs.length >= 150, 'clubs missing or too few');
  ok(D.grids?.length && D.gridsEasy?.length, 'grid pools empty');
  ok(D.links2?.length && D.links3?.length, 'link pools empty');
  if (!D.seasons || !D.rosters) return report(date);

  for (const lg of LEAGUES) for (const diff of DIFFS) {
    const n = buildPuzzle(D, lg, diff).cells.length;   // draws TODAY's board with the shipped builder
    ok(n === 5, `squad ${lg} / ${diff}: only ${n}/5 clubs drawable today`);
  }
  for (const diff of DIFFS) {
    ok(buildGridPuzzle(D, diff).rowIds?.length === 3, `grid / ${diff}: no grid drawable today`);
    ok(buildLinkPuzzle(D, diff).reqIds?.length === 3, `link / ${diff}: no link drawable today`);
  }
  report(date, D);
}

function report(date, D) {
  if (fails.length) {
    console.error(`❌ Onze health check FAILED (${date}) — ${fails.length} issue(s):`);
    for (const f of fails) console.error('   • ' + f);
    process.exit(1);
  }
  console.log(`✅ Onze healthy (${date}). Site up · ${D.seasons.length} seasons · ${D.clubs.length} clubs · all squad/grid/link puzzles drawable across every league & difficulty.`);
}

main().catch(e => { console.error('❌ health check crashed:', e); process.exit(1); });
