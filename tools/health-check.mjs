// Onze live health check — is onzedaily.com up and is TODAY's puzzle playable everywhere?
// Run: node tools/health-check.mjs   (exit 0 = healthy, exit 1 = problem)
// Used by the daily CI cron so a broken/missing puzzle is caught every morning.
// Mirrors the daily-draw logic in index.html (hashStr / mulberry32 / buildPuzzle).

const SITE = process.env.ONZE_URL || 'https://onzedaily.com';
const LEAGUES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'WORLD'];
const DIFFS = ['easy', 'medium', 'hard'];

const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const todayStr = () => { const d = new Date(); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// how many distinct clubs does today's squad draw actually place? (must be 5)
function drawSquadCount(D, league, diff, date) {
  const rnd = mulberry32(hashStr(date + '|' + league + '|' + diff));
  let pool = [];
  for (const s of D.seasons) { const r = D.rosters[s]; for (const cid in r) { const club = D.clubs[cid]; if (league !== 'WORLD' && club.league !== league) continue; pool.push({ cid: +cid, w: r[cid].w }); } }
  if (diff === 'easy') {
    const big = new Set(D.bigClubs || []); const bp = pool.filter(p => big.has(p.cid));
    if (new Set(bp.map(p => p.cid)).size >= 5) pool = bp;
    else { const ws = pool.map(p => p.w).sort((a, b) => a - b); const cut = ws[Math.floor(ws.length * 0.70)] || 0; pool = pool.filter(p => p.w >= cut); }
  } else if (diff === 'hard') pool.forEach(p => p.w = 1);
  const used = new Set(); let n = 0, guard = 0;
  while (n < 5 && pool.length && guard++ < 5000) {
    let tot = 0; for (const p of pool) tot += used.has(p.cid) ? 0 : p.w;
    if (tot <= 0) break;
    let x = rnd() * tot, pick = null;
    for (const p of pool) { if (used.has(p.cid)) continue; x -= p.w; if (x <= 0) { pick = p; break; } }
    if (!pick) break; used.add(pick.cid); n++;
  }
  return n;
}

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
    const n = drawSquadCount(D, lg, diff, date);
    ok(n === 5, `squad ${lg} / ${diff}: only ${n}/5 clubs drawable today`);
  }
  for (const diff of DIFFS) {
    const gpool = (diff === 'easy' ? D.gridsEasy : D.grids);
    ok(gpool?.length, `grid / ${diff}: no grid available today`);
    ok((diff === 'hard' ? D.links3 : D.links2)?.length, `link / ${diff}: no link available today`);
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
