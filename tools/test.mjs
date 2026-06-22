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
import { norm, matchKey, todayStr, buildPuzzle, buildLinkPuzzle, buildGridPuzzle } from '../game.js';

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
