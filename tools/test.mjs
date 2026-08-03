// Onze test suite — run with:  node --test tools/test.mjs
// Validates the built dataset (data/squads.json) and the shipped matching logic:
//   • structure / integrity (no junk names, no thin squads, ids consistent)
//   • puzzle solvability (every pre-generated grid & link is actually solvable)
//   • daily-draw feasibility (each league × difficulty can draw a squad puzzle)
//   • name matching + the player-identity fixes from the Wikipedia migration
// No dependencies — uses Node's built-in test runner + assert.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The shipped game logic — the SAME module the browser imports (index.html). No more
// regex-slicing functions out of the HTML; tests track behaviour by importing it directly.
import { mulberry32, hashStr, norm, matchKey, todayStr, yesterdayStr, bumpStreak, liveStreak, buildPuzzle, buildLinkPuzzle, buildGridPuzzle, buildPlayerPuzzle, answerKeys, FEATURED_PLAYER,
         careerStart, simulateCareer, scoreCareer, reachBand, demand, CAREER, CAREER_TIERS, buildOffers,
         validateCatalogue, pickEvent, resolveEvent, applyMods, eligible, titleOdds, SCORE_VERSION, EFFECT_KEYS,
         nationStrength, blockCaps, parScore, POS_MOD, roadNotTaken, sharePath, careerBadges } from '../game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/squads.json'), 'utf8'));

// --- reconstruct the in-browser PLAYERS index (group appearances by display name) ---
const PLAYERS = {};
for (const s of D.seasons) for (const cid in D.rosters[s]) for (const pl of D.rosters[s][cid].p) {
  const e = PLAYERS[pl.d] || (PLAYERS[pl.d] = { clubs: new Set(), keys: new Set() });
  e.clubs.add(+cid); for (const k of pl.k) e.keys.add(k);
}
const nameOf = id => (D.clubs[id] || {}).name;
const idOf = name => { const c = D.clubs.find(c => c.name === name); return c ? c.id : null; };
const clubsOf = name => [...(PLAYERS[name]?.clubs || [])].map(nameOf);
const hasClubs = (name, ...cs) => { const s = new Set(clubsOf(name)); return cs.every(c => s.has(c)); };

// pair-connectivity + club→players index, derived independently from PLAYERS
const conn = new Set();
const clubPlayers = new Map();                 // clubId -> [player names]
const pk = (a, b) => a < b ? a + ',' + b : b + ',' + a;
for (const name in PLAYERS) {
  const ids = [...PLAYERS[name].clubs];
  for (const id of ids) (clubPlayers.get(id) || clubPlayers.set(id, []).get(id)).push(name);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) conn.add(pk(ids[i], ids[j]));
}
// is there one player who played for ALL given clubs? scan the rarest club's players.
const oneConnects = (...cids) => {
  const probe = cids.slice().sort((a, b) => (clubPlayers.get(a)?.length || 0) - (clubPlayers.get(b)?.length || 0))[0];
  return (clubPlayers.get(probe) || []).some(n => cids.every(c => PLAYERS[n].clubs.has(c)));
};

test('structure & meta', () => {
  for (const k of ['seasons', 'clubs', 'rosters', 'links2', 'links3', 'grids', 'gridsEasy', 'bigClubs'])
    assert.ok(D[k], `missing ${k}`);
  assert.ok(D.seasons.length >= 18, 'expected ≥18 seasons');
  assert.ok(D.clubs.length >= 150, 'expected ≥150 clubs');
});

test('club ids are array-index aligned & leagues present', () => {
  D.clubs.forEach((c, i) => assert.equal(c.id, i, `club ${c.name} id≠index`));
  const leagues = new Set(D.clubs.map(c => c.league));
  for (const lg of ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'])
    assert.ok(leagues.has(lg), `league missing: ${lg}`);
});

test('no junk player names', () => {
  const bad = [];
  for (const name in PLAYERS) if (/[[\]{}:/]/.test(name) || name.length < 2) bad.push(name);
  assert.deepEqual(bad, [], `junk names: ${bad.slice(0, 10).join(', ')}`);
});

test('no thin squads (≥ meta.minSquad players each)', () => {
  const min = (D.meta && D.meta.minSquad) || 11;
  const thin = [];
  for (const s of D.seasons) for (const cid in D.rosters[s])
    if (D.rosters[s][cid].p.length < min) thin.push(`${nameOf(+cid)} ${s}=${D.rosters[s][cid].p.length}`);
  assert.deepEqual(thin, [], `thin squads: ${thin.slice(0, 10).join(', ')}`);
});

test('bigClubs all resolve to real clubs', () => {
  for (const id of D.bigClubs) assert.ok(D.clubs[id], `bigClub id ${id} has no club`);
});

test('playerInfo present (powers grid rarity score)', () => {
  assert.ok(D.playerInfo && Object.keys(D.playerInfo).length > 500, 'playerInfo missing/sparse');
});

test('daily seed is UTC-based (same puzzle worldwide)', () => {
  assert.equal(todayStr(), new Date().toISOString().slice(0, 10), 'todayStr() must be the UTC date');
});

test('Find-the-Link easy has enough all-big-club triples', () => {
  const big = new Set(D.bigClubs);
  const allBig = D.links3.filter(l => l.slice(0, 3).every(id => big.has(id)));
  assert.ok(allBig.length >= 20, `only ${allBig.length} all-big link3s (need ≥20 for easy)`);
});

test('every pre-generated grid is fully solvable', () => {
  const check = (grids, label) => {
    for (const g of grids) {
      const rows = g.slice(0, 3), cols = g.slice(3, 6);
      for (const r of rows) for (const c of cols)
        assert.ok(conn.has(pk(r, c)), `${label}: ${nameOf(r)} × ${nameOf(c)} has no connecting player`);
    }
  };
  check(D.grids, 'grids');
  check(D.gridsEasy, 'gridsEasy');
});

test('every link puzzle is a real connection', () => {
  for (const l of D.links2) assert.ok(conn.has(pk(l[0], l[1])), `link2 ${nameOf(l[0])}–${nameOf(l[1])} not connectable`);
  for (const l of D.links3) assert.ok(oneConnects(l[0], l[1], l[2]), `link3 ${l.slice(0, 3).map(nameOf).join('–')} has no player for all three`);
});

test('each league × difficulty can draw a 5-club squad puzzle', () => {
  const big = new Set(D.bigClubs);
  for (const lg of ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'WORLD']) {
    const ids = new Set();
    for (const s of D.seasons) for (const cid in D.rosters[s])
      if (lg === 'WORLD' || D.clubs[+cid].league === lg) ids.add(+cid);
    assert.ok(ids.size >= 5, `${lg}: only ${ids.size} clubs (need ≥5)`);
    // easy mode needs ≥5 big clubs OR it falls back to top-weight (which the ≥5 above guarantees)
    const bigN = [...ids].filter(id => big.has(id)).length;
    assert.ok(bigN >= 5 || ids.size >= 5, `${lg}: easy mode unsatisfiable`);
  }
});

test('matching: accents, suffixes, surnames', () => {
  assert.equal(matchKey('Ibrahimović'), matchKey('Ibrahimovic'), 'accent-insensitive');
  assert.equal(matchKey('Neymar Jr'), matchKey('Neymar'), 'suffix Jr stripped');
  assert.equal(matchKey('Nico Williams'), matchKey('Williams Nico'), 'word-order independent');
});

test('matching: particle surnames are typable (ter Stegen, van Dijk…)', () => {
  const typable = (typed, disp) => PLAYERS[disp] && PLAYERS[disp].keys.has(matchKey(typed));
  for (const [typed, disp] of [['ter Stegen', 'Marc-André ter Stegen'], ['van Dijk', 'Virgil van Dijk'],
    ['de Bruyne', 'Kevin De Bruyne'], ['van der Sar', 'Edwin van der Sar']]) {
    if (PLAYERS[disp]) assert.ok(typable(typed, disp), `typing "${typed}" should match ${disp}`);
  }
});

test('identity: Zlatan unified (PSG + Man Utd)', () => {
  assert.ok(PLAYERS['Zlatan Ibrahimović'], 'Zlatan missing');
  assert.ok(hasClubs('Zlatan Ibrahimović', 'Paris Saint-Germain', 'Manchester United'),
    `Zlatan clubs: ${clubsOf('Zlatan Ibrahimović')}`);
});

test('identity: De Gea unified, matchable as "de Gea"', () => {
  assert.ok(hasClubs('David de Gea', 'Atlético Madrid', 'Manchester United'),
    `de Gea clubs: ${clubsOf('David de Gea')}`);
  assert.ok(!PLAYERS['De Gea'], '"De Gea" should have merged into "David de Gea"');
  assert.ok(PLAYERS['David de Gea'].keys.has(matchKey('de Gea')), 'typing "de Gea" should match');
});

test('identity: Abde matchable by forename, namesakes separate', () => {
  assert.ok(PLAYERS['Abde Ezzalzouli'], 'Abde Ezzalzouli missing');
  assert.ok(PLAYERS['Abde Ezzalzouli'].keys.has(matchKey('Abde')), 'typing "Abde" should match');
  assert.ok(hasClubs('Abde Ezzalzouli', 'Real Betis Balompié'), 'Abde should have Betis');
  // distinct namesakes must NOT be folded in
  assert.ok(PLAYERS['Abde Raihani'] && PLAYERS['Abde Rebbach'], 'Abde namesakes should stay separate');
});

test('identity: Soldado has Valencia + Real Madrid', () => {
  assert.ok(hasClubs('Roberto Soldado', 'Valencia CF', 'Real Madrid'),
    `Soldado clubs: ${clubsOf('Roberto Soldado')}`);
});

test('identity: no false mononym merges (Ronaldo / Pedro stay distinct)', () => {
  // Cristiano must not absorb the Brazilian Ronaldo's clubs
  assert.ok(!hasClubs('Cristiano Ronaldo', 'AC Milan'), 'Cristiano wrongly has AC Milan');
  assert.ok(PLAYERS['Ronaldo'] && [...PLAYERS['Ronaldo'].clubs].length >= 1, 'Brazilian Ronaldo missing');
  assert.ok(PLAYERS['Pedro'], 'mononym Pedro should stay its own player');
});

test('identity: same-name players split by sofifa id (no phantom links)', () => {
  // "Gabriel" is ~6 different real players — none played AC Milan + Arsenal + Napoli
  assert.ok(!hasClubs('Gabriel', 'AC Milan', 'Arsenal', 'Napoli'), 'phantom "Gabriel" spans Milan+Arsenal+Napoli');
  // the two Luis Suárez are distinct: the Uruguayan never played Marseille
  assert.ok(!hasClubs('Luis Suárez', 'Olympique de Marseille'), 'Uruguayan Suárez wrongly at Marseille');
  assert.ok(hasClubs('Luis Suárez', 'FC Barcelona', 'Atlético Madrid'), 'Uruguayan Suárez should have Barça + Atlético');
  // and his real rating attached (under-merge of the short/full form fixed)
  assert.equal(D.playerInfo['Luis Suárez']?.o, 92, 'Uruguayan Suárez should carry his real overall (92)');
});

test('daily streak: consecutive days build, a gap resets, display goes stale', () => {
  const s = bumpStreak(null);
  assert.equal(s.cur, 1); assert.equal(s.best, 1); assert.equal(s.last, todayStr());
  assert.equal(bumpStreak(s).cur, 1, 'same day must not double-count');
  const grew = bumpStreak({ last: yesterdayStr(), cur: 4, best: 4 });
  assert.equal(grew.cur, 5); assert.equal(grew.best, 5);
  const reset = bumpStreak({ last: '2000-01-01', cur: 9, best: 9 });
  assert.equal(reset.cur, 1); assert.equal(reset.best, 9, 'best is preserved across a broken streak');
  assert.equal(liveStreak({ last: todayStr(), cur: 3 }), 3, 'alive today');
  assert.equal(liveStreak({ last: yesterdayStr(), cur: 3 }), 3, 'still alive the next day');
  assert.equal(liveStreak({ last: '2000-01-01', cur: 3 }), 0, 'stale streak shows 0');
});

test('mystery-player mode: deterministic daily pick + lenient answer matching', () => {
  const CLUES = [
    { answer: 'Mohamed Salah', clues: ['An Egyptian winger.', 'Club path: Basel → Chelsea → Roma → Liverpool.'] },
    { answer: 'Kevin De Bruyne', clues: ['A Belgian midfielder.', 'Genk → Chelsea → Manchester City.'] },
    { answer: 'Rodri (footballer, born 1996)', clues: ['A Spanish midfielder.', 'Villarreal → Atlético → Man City.'] },
  ];
  const p1 = buildPlayerPuzzle(CLUES), p2 = buildPlayerPuzzle(CLUES);
  assert.equal(p1.answer, p2.answer, 'same day must give the same player');
  assert.deepEqual(p1.clues, p2.clues, 'same day must give the same clue ORDER (seeded shuffle)');
  assert.ok(CLUES.some(c => c.answer.replace(/\s*\(.*\)$/, '') === p1.answer), 'answer comes from the pool');
  assert.ok(p1.clues.length >= 1 && p1.sig, 'puzzle has clues + a sig');
  // clue order is mixed daily, but the giveaway club path must stay LAST, and no clue lost
  const src = CLUES.find(c => c.answer.replace(/\s*\(.*\)$/, '') === p1.answer);
  assert.equal(p1.clues.length, src.clues.length, 'shuffle must not drop or duplicate clues');
  assert.deepEqual([...p1.clues].sort(), [...src.clues].sort(), 'shuffle preserves the clue set');
  const pathIdx = p1.clues.findIndex(c => /^Club path:/i.test(c));
  if (pathIdx >= 0) assert.equal(pathIdx, p1.clues.length - 1, 'club path must be the final clue');
  // editorial override: every featured date must resolve to a real dossier in the SHIPPED pool, and force that pick
  const REAL_CLUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/player-clues.json'), 'utf8'));
  for(const [date, spec] of Object.entries(FEATURED_PLAYER)){
    const name = spec.name;
    assert.ok(REAL_CLUES.some(c => (c.answer||c.a) === name), `featured "${name}" (${date}) must exist in the shipped pool`);
    const forced = buildPlayerPuzzle(REAL_CLUES, date);
    assert.equal(forced.answer, name.replace(/\s*\(.*\)$/, ''), `${date} must force ${name} as the mystery player`);
    const fpath = forced.clues.findIndex(c => /^Club path:/i.test(c));
    if (fpath >= 0) assert.equal(fpath, forced.clues.length - 1, 'forced pick keeps club path last');
    if (spec.opener){                                               // one-off opener is pinned first, only that day
      assert.equal(forced.clues[0], spec.opener, `${date} opener must be the first clue`);
      assert.ok(!buildPlayerPuzzle(REAL_CLUES, '2026-07-18').clues.includes(spec.opener), 'opener must not leak to other days');
    }
    // (no "other days differ" check: with the rotation, every pool player legitimately appears on
    // their own cycle day — the featured mechanism pins a date, it doesn't ban the player elsewhere)
  }
  // no-repeat rotation: across a full pool-length run of consecutive days, every non-featured
  // day must produce a DIFFERENT player (the cycle only restarts after the whole pool has run)
  const seen = new Map();
  for(let i = 0; i < REAL_CLUES.length; i++){
    const d = new Date(Date.UTC(2026, 7, 1) + i * 864e5).toISOString().slice(0, 10);
    if (FEATURED_PLAYER[d]) continue;                          // featured days interrupt the cycle by design
    const a = buildPlayerPuzzle(REAL_CLUES, d).answer;
    assert.ok(!seen.has(a), `player "${a}" repeats on ${d} (already on ${seen.get(a)})`);
    seen.set(a, d);
  }
  assert.equal(buildPlayerPuzzle([]).answer, '', 'empty clue set degrades gracefully');
  // wiki disambiguation suffix stripped, and surname / full / accent-insensitive guesses all match
  const k = answerKeys('Rodri (footballer, born 1996)'.replace(/\s*\(.*\)$/, ''));
  assert.ok(k.has(matchKey('Rodri')), 'surname "Rodri" matches');
  const ks = answerKeys('Mohamed Salah');
  assert.ok(ks.has(matchKey('Salah')) && ks.has(matchKey('mohamed salah')), 'surname and full name match');
  assert.ok(!answerKeys('Kevin De Bruyne').has(matchKey('Messi')), 'a wrong guess does not match');
});

test("shipped builders produce valid puzzles for today (real game.js code)", () => {
  // squad: every league × difficulty draws 5 distinct clubs
  for (const lg of ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'WORLD'])
    for (const diff of ['easy', 'medium', 'hard']) {
      const p = buildPuzzle(D, lg, diff);
      assert.equal(p.cells.length, 5, `squad ${lg}/${diff}: drew ${p.cells.length}/5 clubs`);
      assert.equal(new Set(p.cells.map(c => c.cid)).size, 5, `squad ${lg}/${diff}: clubs not distinct`);
    }
  // grid: each difficulty yields a fully-connected 3×3
  for (const diff of ['easy', 'medium', 'hard']) {
    const g = buildGridPuzzle(D, diff);
    for (const r of g.rowIds) for (const c of g.colIds)
      assert.ok(conn.has(pk(r, c)), `grid ${diff}: ${nameOf(r)} × ${nameOf(c)} unconnected`);
  }
  // link: each difficulty yields a triple with a real connector
  for (const diff of ['easy', 'medium', 'hard']) {
    const l = buildLinkPuzzle(D, diff);
    assert.equal(l.reqIds.length, 3, `link ${diff}: expected 3 clubs`);
    assert.ok(oneConnects(...l.reqIds), `link ${diff}: ${l.reqIds.map(nameOf).join('–')} has no common player`);
  }
});

// ── career mode ─────────────────────────────────────────────────────────────────────────────
const CLUBS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clubs.json'), 'utf8')).clubs;
const EVENTS_FOR_POLICY = null;   // policy fixtures run WITHOUT events: divergence must be structural
const playPolicy = (date, slot, pos = 'MF') => {
  const p = ['P:' + pos];
  for (let k = 0; k < CAREER.BLOCKS; k++) {
    const c = simulateCareer(CLUBS, date, p, EVENTS_FOR_POLICY);
    if (c.done || !c.offers.length) break;
    p.push(k + slot);
  }
  return simulateCareer(CLUBS, date, p);
};

test('career: club universe is usable as a prestige ladder', () => {
  assert.ok(CLUBS.length > 800, 'enough clubs for a whole career');
  assert.ok(CLUBS.every(c => c.prestige >= 5 && c.prestige <= 99), 'prestige in range');
  assert.ok(new Set(CLUBS.map(c => c.country)).size >= 30, 'genuinely international');
  // second divisions must exist — the loan/climb arc depends on somewhere to drop TO
  assert.ok(CLUBS.filter(c => c.tier === 2).length > 100, 'second divisions present');
  // the canary that caught stale training data: promotions must be current
  const schalke = CLUBS.find(c => /Schalke/.test(c.name));
  assert.ok(schalke, 'Schalke present');
  assert.equal(schalke.tier, 1, 'Schalke is a top-flight side this season');
});

test('career: everyone starts the same day at the same club, and it is stable', () => {
  const a = careerStart(CLUBS, '2026-08-02'), b = careerStart(CLUBS, '2026-08-02');
  assert.equal(a.club.name, b.club.name, 'same club for every player worldwide');
  assert.equal(a.pos, b.pos);
  assert.equal(a.ovr, 50); assert.equal(a.age, 16);
  const other = careerStart(CLUBS, '2026-09-15');
  assert.ok(a.club.name !== other.club.name || a.pos !== other.pos, 'different days differ');
});

test('career: the same choices always reproduce the same career (no re-roll on reload)', () => {
  const p = ['P:MF', '0A', '1B', '2C', '3A'];
  const a = simulateCareer(CLUBS, '2026-08-02', p);
  const b = simulateCareer(CLUBS, '2026-08-02', p);
  assert.deepEqual(a.rows, b.rows, 'recomputed identically — results are never stored');
});

test('career: different policies produce visibly different careers (R2, the core risk)', () => {
  for (const date of ['2026-08-02', '2026-08-03', '2026-08-04']) {
    const big = playPolicy(date, 'A'), mins = playPolicy(date, 'B');
    const sb = big.score || scoreCareer(big), sm = mins.score || scoreCareer(mins);
    assert.ok(Math.abs(sb.total - sm.total) >= 10,
      `${date}: policies must diverge, got ${sb.total} vs ${sm.total}`);
    assert.ok(Math.abs(sb.totalApps - sm.totalApps) >= 100, `${date}: appearances must diverge`);
  }
});

test('career: ratings grow, peak, then decline — the emotional spine', () => {
  const c = playPolicy('2026-08-03', 'B');
  const ovrs = c.rows.map(r => r.ovr);
  const peakAt = ovrs.indexOf(Math.max(...ovrs));
  assert.ok(peakAt >= 3, 'peak is not at the very start');
  assert.ok(ovrs[ovrs.length - 1] < Math.max(...ovrs), 'decline is inevitable on every path');
  assert.ok(c.rows.length >= 9 && c.rows.length <= 11, 'career runs 9-11 blocks');
});

test('career: a 16-year-old is never offered a club far beyond him', () => {
  const band = reachBand(50, 0);
  assert.ok(band.hi < 95, 'Real Madrid is unreachable at 16 — structurally, not as a special case');
  assert.ok(demand(99) > demand(50), 'bigger clubs demand more');
  // and the band opens up as he grows
  assert.ok(reachBand(78, 6).hi > band.hi, 'a good 28-year-old can reach further');
});

test('career: score is its four components and never exceeds 100', () => {
  for (const date of ['2026-08-02', '2026-08-05', '2026-08-09']) {
    for (const slot of ['A', 'B', 'C']) {
      const s = scoreCareer(playPolicy(date, slot));
      assert.equal(s.total, s.peakPts + s.lonPts + s.clubPts + s.honPts, 'total is the sum of its parts');
      assert.ok(s.total >= 0 && s.total <= 100);
      assert.ok(CAREER_TIERS.some(([, label]) => label === s.tier), 'tier from the constant table');
    }
  }
});

// ── career events ───────────────────────────────────────────────────────────────────────────
const EVENTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/career-events.json'), 'utf8')).events;

test('events: the catalogue is well-formed and every gamble has a safe way out', () => {
  const v = validateCatalogue(EVENTS);
  assert.ok(v.ok, 'catalogue errors:\n' + v.errors.join('\n'));
  assert.ok(EVENTS.length >= 12, 'enough events that two careers tell different stories');
  const fams = new Set(EVENTS.map(e => e.family));
  for (const f of ['gamble', 'offpitch', 'setback', 'peak'])
    assert.ok(fams.has(f), `family "${f}" missing — variety is the point of this slice`);
});

test('events: every event changes at least one number (no decoration)', () => {
  for (const ev of EVENTS) {
    const touches = ev.options.some(o =>
      Object.values(o.outcomes || {}).some(x => (x.effects || []).length > 0));
    assert.ok(touches, `${ev.id}: changes nothing — cut it or give it an effect`);
  }
});

test('events: stated odds are the odds actually rolled', () => {
  const ev = EVENTS.find(e => e.options.some(o => (o.odds || []).length > 1));
  const opt = ev.options.findIndex(o => (o.odds || []).length > 1);
  const target = ev.options[opt].odds[0];
  let hits = 0, N = 4000;
  for (let i = 0; i < N; i++) {
    const r = resolveEvent(ev, opt, mulberry32(hashStr('odds' + i)));
    if (r.key === target[0]) hits++;
  }
  const observed = hits / N;
  assert.ok(Math.abs(observed - target[1]) < 0.04,
    `${ev.id}: stated ${target[1]}, observed ${observed.toFixed(3)} — the card must not lie`);
});

test('events: effects compose, and expire when they should', () => {
  const mods = [{ k: 'ptBonus', v: 5, until: 3 }, { k: 'ptBonus', v: -2, until: 0 }];
  assert.equal(applyMods(0, 'ptBonus', mods, 2), 3, 'additive keys sum while active');
  assert.equal(applyMods(0, 'ptBonus', mods, 9), -2, 'expired mods drop out, permanent ones stay');
  assert.equal(applyMods(1, 'growthMult', [{ k: 'growthMult', v: 1.2, until: 0 },
                                           { k: 'growthMult', v: 0.5, until: 0 }], 1), 0.6,
    'multiplicative keys multiply');
});

test('events: a career with events stays deterministic and reproducible', () => {
  const p = ['P:MF', '0B', 'E0', '1B', '2A', 'E1', '3B'];
  const a = simulateCareer(CLUBS, '2026-08-05', p, EVENTS);
  const b = simulateCareer(CLUBS, '2026-08-05', p, EVENTS);
  assert.deepEqual(a.rows, b.rows, 'same path, same career — events included');
  assert.deepEqual(a.tags, b.tags);
});

test('events: fire often enough to matter, rarely enough to stay special', () => {
  const counts = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(Date.UTC(2026, 7, 2 + i)).toISOString().slice(0, 10);
    const p = ['P:MF']; let n = 0, guard = 0;
    while (guard++ < 40) {
      const c = simulateCareer(CLUBS, date, p, EVENTS);
      if (c.done) break;
      if (c.event) { p.push('E1'); n++; continue; }
      if (!c.offers.length) break;
      p.push(c.rows.length + 'B');
    }
    counts.push(n);
  }
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  assert.ok(avg >= 2 && avg <= 7, `average ${avg.toFixed(1)} events per career is outside 2-7`);
});

test('career: position is the first decision and genuinely changes the game', () => {
  const c0 = simulateCareer(CLUBS, '2026-08-06', [], EVENTS);
  assert.ok(c0.needsPosition, 'a career cannot start until a position is chosen');
  assert.equal(c0.positions.length, 4, 'four positions offered');
  const gk = playPolicy('2026-08-06', 'B', 'GK'), fw = playPolicy('2026-08-06', 'B', 'FW');
  // a keeper's output is clean sheets, a forward's is goals — Slice 06's "table of zeroes" worry
  assert.ok(gk.rows.some(r => r.cs > 0), 'keepers record clean sheets');
  assert.ok(fw.rows.reduce((s, r) => s + r.goals, 0) > gk.rows.reduce((s, r) => s + r.goals, 0) * 3,
    'a forward scores far more than a keeper');
});

test('honours & caps: you are only credited for what you took part in', () => {
  // a career of bench-warming wins nothing and is never capped — medals need minutes
  const bench = playPolicy('2026-08-06', 'A', 'FW');
  const played = playPolicy('2026-08-06', 'B', 'FW');
  const sb = scoreCareer(bench), sp = scoreCareer(played);
  assert.ok(sp.totalApps > sb.totalApps * 2, 'the played career actually played');
  assert.ok(sp.caps >= sb.caps, 'caps follow minutes and quality, never the reverse');
  // trophies are club-plausible: nobody wins a league from a club that cannot contend
  for (const h of (played.honours || [])) {
    const club = CLUBS.find(c => c.name === h.club);
    if (h.kind === 'league' && club) assert.ok(titleOdds(club, CLUBS) > 0, `${h.club} cannot win ${h.comp}`);
  }
});

test('honours: a continental cup is worth more than a domestic one', () => {
  const base = { rows: [], peak: 60, caps: {} };
  const cont = scoreCareer({ ...base, honours: [{ kind: 'continental' }] });
  const cup = scoreCareer({ ...base, honours: [{ kind: 'cup' }] });
  assert.ok(cont.honPts > cup.honPts, 'winning Europe must outrank a domestic cup');
});

test('internationals: a strong nation is a much harder squad to break into', () => {
  const rnd = () => 0.5;
  const ovr = 72, m = 0.8;
  const cyprus = blockCaps(ovr, m, 'MF', rnd, 'Cyprus');
  const portugal = blockCaps(ovr, m, 'MF', rnd, 'Portugal');
  assert.ok(cyprus.caps > 0, 'a 72-rated player is a fixture for Cyprus');
  assert.equal(portugal.caps, 0, 'the same player is nowhere near the Portugal squad');
  // and a genuinely elite player gets in anywhere
  assert.ok(blockCaps(85, m, 'MF', rnd, 'Portugal').caps > 0, 'an 85 plays for anyone');
  assert.ok(nationStrength('Brazil') > nationStrength('Cyprus'));
  assert.ok(nationStrength('Nowhereland') === 70, 'unknown countries take a sane default');
});

test('career table reads year by year, and the seasons add up', () => {
  const c = playPolicy('2026-08-06', 'B', 'FW');
  for (const r of c.rows) {
    assert.equal(r.seasons.length, 2, 'a two-season block renders as two years');
    assert.equal(r.seasons[0].age + 1, r.seasons[1].age, 'consecutive years');
    assert.equal(r.seasons.reduce((s, x) => s + x.apps, 0), r.apps, 'seasons sum to the block');
    assert.equal(r.seasons.reduce((s, x) => s + x.goals, 0), r.goals, 'no goals invented or lost');
  }
});

test('par: reproducible, and a fair bar for every position', () => {
  const a = parScore(CLUBS, '2026-08-06', EVENTS, 'MF');
  const b = parScore(CLUBS, '2026-08-06', EVENTS, 'MF');
  assert.equal(a.score, b.score, 'par must be reproducible — it is the only comparison we publish');
  assert.ok(a.score > 20 && a.score < 100, 'par is a real career, not a degenerate one');
  // no position may be a scoring decision dressed up as a style choice
  const pars = ['GK', 'DF', 'MF', 'FW'].map(p => {
    let t = 0;
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.UTC(2026, 7, 2 + i)).toISOString().slice(0, 10);
      t += parScore(CLUBS, d, EVENTS, p).score;
    }
    return t / 5;
  });
  const spread = Math.max(...pars) - Math.min(...pars);
  assert.ok(spread <= 12, `positions differ by ${spread.toFixed(0)} points of par — should be a style choice, not a scoring one`);
});

test('positions differ in how they AGE, not in how much they grow', () => {
  // peakShift must only move the decline half of the curve
  const young = CAREER.GROWTH_AGE.findIndex(v => v < 0);
  assert.ok(young > 0, 'there is a growth phase and a decline phase');
  for (const p of ['GK', 'DF', 'MF', 'FW'])
    assert.ok(Math.abs(POS_MOD[p].growth - 1) <= 0.08, `${p}: growth modifier is a nudge, not a multiplier`);
});

test('strategy depth: well-timed ambition beats simply chasing minutes', () => {
  // The mode's whole premise is that decisions matter and no single rule is optimal. This test
  // fails if the sim ever collapses into "always take the minutes" — the R2/O-1 failure mode.
  const timed = (date, pos) => {
    const p = ['P:' + pos];
    let guard = 0;
    while (guard++ < 40) {
      const c = simulateCareer(CLUBS, date, p, EVENTS);
      if (c.done) break;
      if (c.event) { p.push('E' + (c.event.options.length - 1)); continue; }
      if (!c.offers.length) break;
      const band = reachBand(c.st.ovr, c.st.k);
      const amb = c.offers[0];
      const slot = amb && amb.club.prestige <= band.fit + 6 ? 0 : 1;   // step up only when playable
      p.push(c.rows.length + 'ABC'[Math.min(slot, c.offers.length - 1)]);
    }
    return scoreCareer(simulateCareer(CLUBS, date, p, EVENTS)).total;
  };
  let smart = 0, mins = 0, n = 0;
  for (let i = 0; i < 8; i++) {
    const date = new Date(Date.UTC(2026, 7, 2 + i)).toISOString().slice(0, 10);
    for (const pos of ['MF', 'FW']) {
      smart += timed(date, pos);
      mins += scoreCareer(playPolicy(date, 'B', pos)).total;
      n++;
    }
  }
  assert.ok(smart / n > mins / n,
    `timed ambition (${(smart/n).toFixed(1)}) must beat pure minutes (${(mins/n).toFixed(1)}) — otherwise the mode has one right answer`);
});

test('road not taken: an exact counterfactual, not a guess', () => {
  const date = '2026-08-03';
  const p = ['P:FW'];
  let guard = 0;
  while (guard++ < 40) {
    const c = simulateCareer(CLUBS, date, p, EVENTS, 'normal');
    if (c.done) break;
    if (c.event) { p.push('E0'); continue; }
    if (!c.offers.length) break;
    p.push(c.rows.length + 'B');
  }
  const actual = scoreCareer(simulateCareer(CLUBS, date, p, EVENTS, 'normal')).total;
  const rd = roadNotTaken(CLUBS, date, p, EVENTS, 'normal');
  assert.ok(rd, 'a pivotal decision is always found');
  assert.equal(rd.actualScore, actual, 'it compares against the career actually played');
  assert.ok(rd.instead && rd.instead !== '?', 'the alternative club is named');
  assert.ok(rd.altScore >= 0 && rd.altScore <= 100, 'the alternative is a real career');
  assert.equal(rd.altScore - rd.actualScore, rd.delta, 'the delta is arithmetic, not narrative');
  // and it must be reproducible — it is a claim about a specific alternative life
  const again = roadNotTaken(CLUBS, date, p, EVENTS, 'normal');
  assert.equal(again.altScore, rd.altScore);
  assert.equal(again.age, rd.age);
});

test('offers follow FORM, not just rating — a bench-warmer is not called by giants', () => {
  // The owner's case: "if I barely played at Juventus, why would Barcelona offer me a contract?"
  const starter = reachBand(78, 5, undefined, 0.85);
  const benched = reachBand(78, 5, undefined, 0.12);
  assert.ok(starter.hi > benched.hi + 10,
    `playing must open doors that benching closes (${starter.hi.toFixed(0)} vs ${benched.hi.toFixed(0)})`);
  assert.ok(starter.hi >= 95, 'an ever-present 78 at 26 can reach the very top');
  assert.ok(benched.hi < 90, 'a benched 78 cannot');
  // but you can ALWAYS drop a rung — form must never trap a player with no way down
  assert.ok(benched.lo <= starter.lo + 1, 'the floor is not raised by poor form');
  // and with no history at all (the very first decision) nothing is penalised
  assert.equal(reachBand(50, 0, undefined, undefined).hi, reachBand(50, 0).hi);
});

test('a chained event cannot fire before the one that sets it up', () => {
  // when.requires was supported by eligible() from the start and never used, so no event could
  // ever refer back to an earlier one. These two arcs are how a career remembers its own cast.
  const chained = EVENTS.filter(e => e.when && e.when.requires);
  assert.ok(chained.length >= 2, `expected chained events, found ${chained.length}`);

  for(const ev of chained){
    for(const need of ev.when.requires){
      // something must actually AWARD the tag, or the event is unreachable content
      const awards = EVENTS.some(e => e.id !== ev.id && e.options.some(o =>
        Object.values(o.outcomes).some(out =>
          (out.effects || []).some(f => f.k === 'tag' && f.v === need))));
      assert.ok(awards, `${ev.id} requires "${need}" but no event ever awards it`);
    }
    const base = { age: 30, ovr: 78, prestige: 80, minutes: 0.7, k: 7, blocksAtClub: 2, tier: 1,
                   pos: 'MF', seen: [], seenFamilies: [], lastSeen: {} };
    assert.equal(eligible(ev.when, { ...base, tags: [] }), false,
      `${ev.id} fired without ${ev.when.requires}`);
    assert.equal(eligible(ev.when, { ...base, tags: ev.when.requires.slice() }), true,
      `${ev.id} did not fire with ${ev.when.requires}`);
  }

  // and end to end: the payoff never appears in a career that did not set it up
  const CL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clubs.json'), 'utf8')).clubs;
  let setups = 0, payoffs = 0;
  for(let i = 0; i < 30; i++){
    const date = new Date(Date.UTC(2026, 7, 3 + i)).toISOString().slice(0, 10);
    for(const pos of ['GK','MF','FW']){
      const route = ['P:' + pos];
      let c;
      for(let guard = 0; guard < 40; guard++){
        c = simulateCareer(CL, date, route, EVENTS, 'story');
        if(c.done) break;
        if(c.event){ route.push('E0'); continue; }
        if(!c.offers.length) break;
        route.push(c.rows.length + 'B');
      }
      const ids = (c.log || []).map(l => l.id), tags = c.tags || [];
      for(const ev of chained){
        if(!ids.includes(ev.id)) continue;
        payoffs++;
        for(const need of ev.when.requires)
          assert.ok(tags.includes(need), `${ev.id} fired on ${date}/${pos} without the tag "${need}"`);
      }
      if(tags.includes('His player') || tags.includes('A rival made')) setups++;
    }
  }
  assert.ok(setups > 0, 'no arc was ever set up — the chain is unreachable in practice');
  assert.ok(payoffs > 0, 'no arc ever paid off — the second act is dead content');
});

test('career badges are earned by the shape of a career, and stay rare', () => {
  const mk = rows => ({ start:{pos:'MF'}, rows, honours:[], caps:{total:0,goals:0}, peak:70 });
  const R = (name,country,tier,prestige,apps,ovrEnd) =>
    ({ club:{name,country,tier,prestige}, apps, goals:0, assists:0, cs:0, ovrEnd });

  // one-club: every block at the same club
  const one = mk(Array.from({length:9}, () => R('Ajax','Netherlands',1,80,40,70)));
  assert.ok(careerBadges(one).some(b => b.id === 'one-club'), 'a one-club career must earn it');
  // ...and a career that moved must not
  const moved = mk([R('Ajax','Netherlands',1,80,40,70), R('Porto','Portugal',1,80,40,70)]);
  assert.ok(!careerBadges(moved).some(b => b.id === 'one-club'), 'two clubs is not one club');

  // homecoming needs the LAST spell to be the first club, with real clubs in between
  const home = mk([R('Ajax','Netherlands',1,80,40,70), R('Porto','Portugal',1,80,40,70),
                   R('Lyon','France',1,78,40,70), R('Ajax','Netherlands',1,80,40,70)]);
  assert.ok(careerBadges(home).some(b => b.id === 'homecoming'), 'returning to your first club is a homecoming');

  // an empty career earns nothing rather than throwing
  assert.deepEqual(careerBadges({ start:{pos:'MF'}, rows:[] }), []);
  assert.deepEqual(careerBadges(null), []);

  // and over real careers they must stay uncommon — a badge everyone gets is not a badge
  const CL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clubs.json'), 'utf8')).clubs;
  const freq = {}; let runs = 0, none = 0;
  for(let i = 0; i < 25; i++){
    const date = new Date(Date.UTC(2026, 7, 3 + i)).toISOString().slice(0, 10);
    for(const pos of ['GK','DF','MF','FW']){
      const route = ['P:' + pos];
      let c;
      for(let guard = 0; guard < 40; guard++){
        c = simulateCareer(CL, date, route, EVENTS, 'normal');
        if(c.done) break;
        if(c.event){ route.push('E' + (c.event.options.length - 1)); continue; }
        if(!c.offers.length) break;
        route.push(c.rows.length + 'B');
      }
      runs++;
      const b = careerBadges(c);
      if(!b.length) none++;
      b.forEach(x => freq[x.id] = (freq[x.id] || 0) + 1);
    }
  }
  for(const id in freq)
    assert.ok(freq[id] / runs < 0.55, `badge "${id}" fires in ${Math.round(100*freq[id]/runs)}% of careers — not a badge`);
  assert.ok(none / runs < 0.45, `${Math.round(100*none/runs)}% of careers earned nothing at all`);
});

test('a position-gated event is only ever drawn by that position', () => {
  // positionIn was supported by eligible() from the start and the catalogue never used it, so a
  // goalkeeper's career read identically to a striker's. Gating is also close to free: pickEvent
  // filters by eligibility BEFORE weighting, so these compete only inside their own pool.
  const gated = EVENTS.filter(e => e.when && e.when.positionIn);
  assert.ok(gated.length >= 12, `expected position-gated events, found ${gated.length}`);
  for(const pos of ['GK','DF','MF','FW'])
    assert.ok(gated.some(e => e.when.positionIn.includes(pos)), `no events gated to ${pos}`);

  const ctx = p => ({ age: 26, ovr: 72, prestige: 70, minutes: 0.7, k: 5, blocksAtClub: 2,
                      tier: 1, pos: p, tags: [], seen: [], seenFamilies: [], lastSeen: {} });
  for(const ev of gated)
    for(const pos of ['GK','DF','MF','FW'])
      assert.equal(eligible(ev.when, ctx(pos)), ev.when.positionIn.includes(pos),
        `${ev.id} eligibility for ${pos} does not match its positionIn ${ev.when.positionIn}`);

  // and over real draws, nobody ever sees another position's event
  const byPos = { GK:new Set(), DF:new Set(), MF:new Set(), FW:new Set() };
  const CL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clubs.json'), 'utf8')).clubs;
  for(const pos of ['GK','DF','MF','FW']){
    for(const date of ['2026-08-04','2026-08-09','2026-08-15']){
      const route = ['P:' + pos];
      let c;
      for(let guard = 0; guard < 40; guard++){
        c = simulateCareer(CL, date, route, EVENTS, 'story');
        if(c.done) break;
        if(c.event){ route.push('E' + (c.event.options.length - 1)); continue; }
        if(!c.offers.length) break;
        route.push(c.rows.length + 'A');
      }
      (c.log || []).forEach(l => l.id && byPos[pos].add(l.id));
    }
  }
  for(const pos in byPos)
    for(const id of byPos[pos]){
      const ev = EVENTS.find(e => e.id === id);
      if(ev && ev.when && ev.when.positionIn)
        assert.ok(ev.when.positionIn.includes(pos), `${pos} drew ${id}, gated to ${ev.when.positionIn}`);
    }
});

test('the shared path never lies about where a career went', () => {
  const mk = a => a.map(([name, prestige]) => ({ club: { name, prestige } }));
  // Peter's actual career: the old code sliced the first five DISTINCT names, so a run that went
  // on to Juventus and finished at Korona Kielce shared a career that appeared to end at Bayern.
  const real = mk([['Atromitos',55],['Lincoln City',52],['Tottenham Hotspur',88],['Tottenham Hotspur',88],
    ['Bayer 04 Leverkusen',86],['Bayer 04 Leverkusen',86],['FC Bayern Munich',97],['Juventus',93],
    ['Al Shabab Club',62],['Korona Kielce',45],['Korona Kielce',45]]);
  const line = sharePath(real, 5);
  assert.ok(line.startsWith('Atromitos'), `must start where the career started: ${line}`);
  assert.ok(/Korona Kielce · 8 clubs$/.test(line), `must end where the career ended: ${line}`);
  assert.ok(line.includes('FC Bayern Munich'), `must keep the biggest club: ${line}`);
  assert.equal(line.split(' → ').length, 5, `at most 5 names: ${line}`);

  // a short career is printed whole, with no count and nothing dropped
  assert.equal(sharePath(mk([['Ajax',80],['Ajax',80],['Porto',84],['Lyon',78]]), 5), 'Ajax → Porto → Lyon');
  // consecutive blocks at one club are ONE spell; a genuine return years later is two
  assert.equal(sharePath(mk([['Ajax',80],['Ajax',80],['Ajax',80]]), 5), 'Ajax');
  assert.equal(sharePath(mk([['Ajax',80],['Porto',84],['Ajax',80]]), 5), 'Ajax → Porto → Ajax');

  // and the invariant that actually matters, over real careers
  const CL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clubs.json'), 'utf8')).clubs;
  const EVS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/career-events.json'), 'utf8')).events;
  for(const date of ['2026-08-03','2026-08-07','2026-08-11']){
    const route = ['P:MF'];
    let c;
    for(let guard = 0; guard < 40; guard++){
      c = simulateCareer(CL, date, route, EVS, 'normal');
      if(c.done) break;
      if(c.event){ route.push('E' + (c.event.options.length - 1)); continue; }
      if(!c.offers.length) break;
      route.push(c.rows.length + 'A');
    }
    if(!c.rows.length) continue;
    const out = sharePath(c.rows, 5);
    const first = c.rows[0].club.name, last = c.rows[c.rows.length-1].club.name;
    assert.ok(out.startsWith(first), `${date}: path must start at ${first} — got "${out}"`);
    assert.ok(out.includes(last), `${date}: path must include the final club ${last} — got "${out}"`);
  }
});

test('an event that says you left must not then offer you your old club', () => {
  // The owner's report: "the text says the club does not want me, and yet I can choose to stay."
  // Four outcomes state a departure as fact and the engine had no way to know, because the effect
  // meant to carry it (forceOffer) was declared, authored, and never implemented.
  const DEPART = [['newboss','Ask to leave now'], ['relegation','Jump'],
                  ['sold','Go, and go well'], ['homesick','Engineer a move home'], ['abroad','Go']];
  for(const [id, label] of DEPART){
    const ev = EVENTS.find(e => e.id === id);
    assert.ok(ev, `event ${id} missing`);
    const o = ev.options.find(x => x.label === label);
    assert.ok(o, `${id}: option "${label}" missing`);
    for(const key in o.outcomes){
      const eff = (o.outcomes[key].effects || []).map(e => e.k);
      assert.ok(eff.includes('mustLeave'),
        `${id} / "${label}" / ${key} says you left ("${o.outcomes[key].copy}") but carries no mustLeave`);
    }
  }
  // and the engine must honour it: with mustLeave active, the current club cannot be offered
  const st = { k: 4, ovr: 72, rep: 70, repPeak: 74, lastM: 0.7, played: ['Old Club'], loans: 0,
               lowBlocks: 0, club: CLUBS.find(c => c.prestige >= 68 && c.prestige <= 76),
               homeCountry: 'Germany', mods: [{ k: 'mustLeave', v: 1, until: 4 }] };
  const rnd = mulberry32(1234);
  const offers = buildOffers(CLUBS, st, rnd);
  assert.ok(offers.length, 'expected offers');
  assert.ok(!offers.some(o => o.club.name === st.club.name),
    `mustLeave was active and ${st.club.name} was still offered`);
  // without the mod, staying is available again (so the guard is the mod, not an accident)
  const stay = buildOffers(CLUBS, { ...st, mods: [] }, mulberry32(1234));
  assert.ok(stay.some(o => o.status === 'stay'), 'without mustLeave a stay should be possible here');
});

test('a move the story calls "home" or "abroad" actually goes there', () => {
  const base = { k: 4, ovr: 72, rep: 70, repPeak: 74, lastM: 0.7, played: [], loans: 0, lowBlocks: 0,
                 club: CLUBS.find(c => c.country === 'Italy' && c.prestige >= 66 && c.prestige <= 76),
                 homeCountry: 'Germany' };
  const home = buildOffers(CLUBS, { ...base, mods: [
    { k:'mustLeave', v:1, until:4 }, { k:'moveTo', v:'home', until:4 }] }, mulberry32(7));
  assert.ok(home.some(o => o.club.country === 'Germany'),
    `"you went home" must offer a club at home, got ${home.map(o => o.club.country).join(', ')}`);
  const away = buildOffers(CLUBS, { ...base, mods: [
    { k:'mustLeave', v:1, until:4 }, { k:'moveTo', v:'abroad', until:4 }] }, mulberry32(7));
  assert.ok(away.every(o => o.club.country !== base.club.country),
    `"you went abroad" must not offer a club in the country you left (${base.club.country})`);
});

test('a forced event has one option, and you are never made to roll dice you did not choose', () => {
  const forced = EVENTS.filter(e => e.forced);
  assert.ok(forced.length >= 3, `expected forced setbacks in the catalogue, found ${forced.length}`);
  for(const ev of forced){
    assert.equal(ev.options.length, 1, `${ev.id}: a forced event has exactly one option`);
    const o = ev.options[0];
    assert.equal(o.odds.length, 1, `${ev.id}: a forced option must be certain`);
    assert.equal(o.odds[0][1], 1, `${ev.id}: a forced option must be certain`);
    assert.ok(o.note, `${ev.id}: a forced option must state its cost on the button`);
  }
  // and the validator must still reject a forced event that is secretly a gamble
  const bad = [{ id:'x', family:'setback', weight:1, forced:true, title:'t', body:'b', options:[
    { label:'l', odds:[['a',0.5],['b',0.5]], outcomes:{ a:{copy:'a',effects:[]}, b:{copy:'b',effects:[]} } }]}];
  const v = validateCatalogue(bad);
  assert.ok(!v.ok, 'a forced 50/50 must not validate');
  assert.ok(v.errors.some(e => /no certain option/.test(e)),
    `expected the existing certainty check to catch it, got: ${v.errors.join('; ')}`);
});

test('every effect the catalogue authors is one the engine actually reads', () => {
  // bandUp, bandDown and valueMult were authored 13 times between them and read nowhere, and
  // forceOffer/forceTier were never implemented at all. An effect that validates and does
  // nothing is the worst kind: the catalogue promises a consequence that never arrives.
  const used = new Set();
  for(const ev of EVENTS) for(const o of ev.options)
    for(const key in (o.outcomes||{})) for(const e of (o.outcomes[key].effects||[])) used.add(e.k);
  for(const k of used) assert.ok(EFFECT_KEYS.includes(k), `catalogue uses unknown effect "${k}"`);
  for(const dead of ['forceOffer','forceTier'])
    assert.ok(!EFFECT_KEYS.includes(dead), `"${dead}" was never implemented and must not validate`);
  // and the wired ones must MOVE something
  const base = reachBand(70, 4, undefined, 0.8);
  const up = reachBand(70, 4, undefined, 0.8);
  assert.ok(applyMods(0, 'bandUp', [{k:'bandUp', v:9, until:0}], 4) === 9, 'bandUp must accumulate');
  assert.ok(applyMods(1, 'valueMult', [{k:'valueMult', v:1.2, until:0}], 4) === 1.2, 'valueMult must multiply');
  assert.ok(base.hi === up.hi, 'sanity: the band itself is unchanged without mods');
});

test('a paused turn is still the same career — caps and honours survive an event', () => {
  // simulateCareer returns early in two places: waiting on a club decision, and waiting on an
  // event answer. The event return used to omit honours and caps, so the national row printed
  // "uncapped" on every event turn and recovered on the next tap. The invariant is not that the
  // totals are unchanged since the last turn — a block IS played before the event fires, so they
  // legitimately grow — but that what the pause reports still equals the sum of the rows behind it.
  let checked = 0;
  for(const date of ['2026-08-02', '2026-08-05', '2026-08-09', '2026-08-14']){
    const route = ['P:MF'];
    for(let guard = 0; guard < 40; guard++){
      const c = simulateCareer(CLUBS, date, route, EVENTS, 'story');
      if(c.done) break;
      if(c.event){
        assert.ok(c.caps, `caps must survive the event turn on ${date}`);
        assert.ok(Array.isArray(c.honours), `honours must survive the event turn on ${date}`);
        const rowCaps = c.rows.reduce((n, r) => n + (r.caps || 0), 0);
        const rowHon  = c.rows.reduce((n, r) => n + ((r.honours || []).length), 0);
        assert.equal(c.caps.total, rowCaps,
          `a paused turn must report the caps its own rows earned on ${date}`);
        assert.equal(c.honours.length, rowHon,
          `a paused turn must report the honours its own rows earned on ${date}`);
        checked++;
        route.push('E' + (c.event.options.length - 1));
        continue;
      }
      if(!c.offers.length) break;
      route.push(c.rows.length + 'B');
    }
  }
  assert.ok(checked >= 4, `expected several event pauses to inspect, saw ${checked}`);
});
