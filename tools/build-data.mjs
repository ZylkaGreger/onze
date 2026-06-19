// Build Squadle puzzle data from the unschlagbar squad CSVs — TOP-5 LEAGUES ONLY.
// Sources:
//   ../unschlagbar/data-src/eafc.csv            -> EA FC 26  => season 2025/26 (has league info)
//   ../unschlagbar/tools/.fifa_cache/FIFA17..23 -> seasons 2016/17 .. 2022/23 (no league info)
// Output: ../data/squads.json
//
// Strategy: EA FC 26 gives the canonical set of top-5-league clubs + their league.
// Older editions carry no league, so we match their clubs to that canonical set by a
// normalized club key (strips FC/CF/AC/accents/etc.) — this both (a) filters to the big-5
// and (b) unifies naming so a club keeps all its seasons (e.g. Real Madrid 21/22).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNS = path.resolve(__dirname, '../../unschlagbar');
const OUT = path.resolve(__dirname, '../data/squads.json');

// Big-5 keyed by EA FC league_id — names are ambiguous (Bundesliga=DE id19 / AT id80,
// "Serie A"=IT id31 / Ecuador id2018, "Premier League"=EN id13 / Ukraine id332).
const LEAGUE_BY_ID = { 13: 'Premier League', 53: 'La Liga', 19: 'Bundesliga', 31: 'Serie A', 16: 'Ligue 1' };
const OVR_MIN = 60;
const MIN_SQUAD = 11;

// Club league = its CURRENT (EA FC 26) top flight, applied to all seasons. For clubs that
// were actually in the 2nd tier some seasons (promoted/relegated/yo-yo), those club-seasons
// are mislabelled, so we drop them. Keyed by canonical club name -> seasons NOT in the top flight.
// NOTE: only the Bundesliga has been audited so far — the other four leagues still need the same pass.
const LOWER_DIVISION = {
  '1. FC Union Berlin': ['2016/17', '2017/18', '2018/19'],          // promoted to BL 2019/20
  '1. FC Heidenheim 1846': ['2016/17', '2017/18', '2018/19', '2019/20', '2020/21', '2021/22', '2022/23'], // BL from 2023/24
  'FC St. Pauli': ['2016/17', '2017/18', '2018/19', '2019/20', '2020/21', '2021/22', '2022/23'],          // BL from 2024/25
  'Hamburger SV': ['2018/19', '2019/20', '2020/21', '2021/22', '2022/23'],  // relegated after 2017/18, back 2024/25
  'VfB Stuttgart': ['2016/17', '2019/20'],                          // 2.BL those seasons
  'SV Werder Bremen': ['2021/22'],                                  // relegated after 2020/21, back 2022/23
  '1. FC Köln': ['2018/19'],                                        // relegated after 2017/18, back 2019/20
};

function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /*skip*/ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// FIFA23 scrape leaked a leading jersey number into some names ("22 Fernandinho"); strip it.
const cleanName = (s) => (s || '').replace(/^\s*\d{1,2}\s+/, '').trim();

function normalize(s) {
  return stripAccents(s).toLowerCase().replace(/[.'’]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
// player match keys: surname token + ORDER-INDEPENDENT full name (tokens sorted),
// so "Nico Williams" and "Williams Nico" both match. The browser sorts the guess the same way.
function keysFor(display, full) {
  const set = new Set();
  for (const name of [display, full]) {
    const n = normalize(name); if (!n) continue;
    const parts = n.split(' ').filter(Boolean);
    set.add(parts.slice().sort().join(' '));            // order-independent full name
    if (parts.length > 1) set.add(parts[parts.length - 1]); // surname
  }
  return [...set].filter(k => k.length >= 2);
}
// canonical club key for cross-edition matching: drop common affixes
const CLUB_AFFIX = /\b(fc|cf|afc|sc|ssc|ss|as|ac|us|rc|cd|ud|sv|sd|vfl|vfb|tsg|fsv|bsc|rcd|club|calcio|1)\b/g;
function clubKey(name) {
  return normalize(name).replace(CLUB_AFFIX, ' ').replace(/\s+/g, ' ').trim();
}

// 1) EA FC 26 -> canonical big-5 club map + 2025/26 rosters
const canon = {};                 // clubKey -> { name, league }
const seasons = {};               // season -> canonicalName -> [ {d,k,o} ]
const pInfo = {};                 // display -> { o, pos, nat } for hints (best/most-famous record)
// FIFA caches wrap Position in HTML (<span class="pos pos28">SUB); strip tags, drop bench roles.
const cleanPos = (p) => { p = (p || '').replace(/<[^>]*>/g, '').split(',')[0].trim().toUpperCase(); return (p && p !== 'SUB' && p !== 'RES') ? p : ''; };
function add(season, name, league, display, full, ovr, pos, nat) {
  if (ovr && ovr < OVR_MIN) return;
  display = cleanName(display); full = cleanName(full);
  (seasons[season] ??= {});
  (seasons[season][name] ??= []).push({ d: display, k: keysFor(display, full), o: ovr });
  const np = cleanPos(pos), nn = (nat || '').trim(), cur = pInfo[display];
  if (!cur) pInfo[display] = { o: ovr, pos: np, nat: nn };
  else if (ovr > cur.o) { cur.o = ovr; if (np) cur.pos = np; if (nn) cur.nat = nn; }
  else if (!cur.pos && np) cur.pos = np;
}
{
  const rows = parseCSV(fs.readFileSync(path.join(UNS, 'data-src/eafc.csv'), 'utf8'));
  const h = rows[0], ci = n => h.indexOf(n);
  const C = { short: ci('short_name'), long: ci('long_name'), club: ci('club_name'), lid: ci('league_id'), ovr: ci('overall'), pos: ci('player_positions'), nat: ci('nationality_name') };
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.length < h.length) continue;
    const league = LEAGUE_BY_ID[parseInt(r[C.lid])]; const club = r[C.club]?.trim();
    if (!league || !club) continue;
    canon[clubKey(club)] = { name: club, league };
    add('2025/26', club, league, r[C.short]?.trim(), r[C.long]?.trim(), +r[C.ovr] || 0, r[C.pos], r[C.nat]);
  }
}

// 2) FIFA17..23 -> match clubs to canonical big-5 set
const fifaMap = { FIFA17: '2016/17', FIFA18: '2017/18', FIFA19: '2018/19', FIFA20: '2019/20', FIFA21: '2020/21', FIFA22: '2021/22', FIFA23: '2022/23' };
for (const [ed, season] of Object.entries(fifaMap)) {
  const fp = path.join(UNS, 'tools/.fifa_cache', `${ed}_official_data.csv`);
  if (!fs.existsSync(fp)) continue;
  const rows = parseCSV(fs.readFileSync(fp, 'utf8'));
  const h = rows[0], C = { name: h.indexOf('Name'), club: h.indexOf('Club'), ovr: h.indexOf('Overall'), pos: h.indexOf('Position'), nat: h.indexOf('Nationality') };
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.length < h.length) continue;
    const club = r[C.club]?.trim(); if (!club) continue;
    const cc = canon[clubKey(club)]; if (!cc) continue;          // not a big-5 club -> skip
    add(season, cc.name, cc.league, r[C.name]?.trim(), '', +r[C.ovr] || 0, r[C.pos], r[C.nat]);
  }
}

// assemble
const clubNames = new Set();
for (const s of Object.values(seasons)) for (const n of Object.keys(s)) clubNames.add(n);
const clubs = [...clubNames].sort().map((name, id) => ({ id, name, league: canon[clubKey(name)]?.league || 'Other' }));
const idOf = Object.fromEntries(clubs.map(c => [c.name, c.id]));

// per-cell pick weight: bias the daily draw toward star-studded (recognisable) clubs.
// stars (>=82) count most; strong (>=78) a little; +1 floor so mid clubs still appear.
function weightOf(players) {
  let stars = 0, strong = 0;
  for (const p of players) { if (p.o >= 82) stars++; else if (p.o >= 78) strong++; }
  return 1 + stars * stars * 3 + strong;
}

const seasonList = Object.keys(seasons).sort();
const rosters = {};
for (const season of seasonList) {
  rosters[season] = {};
  for (const [name, players] of Object.entries(seasons[season])) {
    if (players.length < MIN_SQUAD) continue;
    if (LOWER_DIVISION[name]?.includes(season)) continue;   // club was in the 2nd tier that season
    rosters[season][idOf[name]] = { w: weightOf(players), p: players.map(p => ({ d: p.d, k: p.k })) };
  }
}

// --- "find the link" connections ---
// Per player (by display name): the set of distinct clubs they appear in, and their fame.
const pClubs = {};   // display -> Set(clubId)
const pMaxO = {};    // display -> max overall (fame proxy)
for (const season of seasonList) {
  for (const [name, players] of Object.entries(seasons[season])) {
    const cid = idOf[name];
    if (rosters[season][cid] === undefined) continue;   // club-season dropped (<MIN_SQUAD)
    for (const p of players) {
      (pClubs[p.d] ??= new Set()).add(cid);
      pMaxO[p.d] = Math.max(pMaxO[p.d] || 0, p.o);
    }
  }
}
// Dedup combos by club-set; keep the most famous connector's weight (=> easy puzzles solvable).
const link2 = new Map(), link3 = new Map();
const combo = (arr) => arr.slice().sort((a, b) => a - b);
for (const d in pClubs) {
  const cids = [...pClubs[d]];
  if (cids.length < 2) continue;
  const w = Math.max(1, (pMaxO[d] || 0) - 70);          // famous connector => higher weight
  for (let i = 0; i < cids.length; i++) for (let j = i + 1; j < cids.length; j++) {
    const key = combo([cids[i], cids[j]]).join('|');
    if (!link2.has(key) || w > link2.get(key).w) link2.set(key, { c: combo([cids[i], cids[j]]), w });
  }
  if (cids.length >= 3) {
    const cap = cids.slice(0, 6);                        // limit triple explosion for journeymen
    for (let i = 0; i < cap.length; i++) for (let j = i + 1; j < cap.length; j++) for (let k = j + 1; k < cap.length; k++) {
      const key = combo([cap[i], cap[j], cap[k]]).join('|');
      if (!link3.has(key) || w > link3.get(key).w) link3.set(key, { c: combo([cap[i], cap[j], cap[k]]), w });
    }
  }
}
const links2 = [...link2.values()].map(o => [...o.c, o.w]);
const links3 = [...link3.values()].map(o => [...o.c, o.w]);

// player info (position/nationality) — only for connectors (>=2 clubs), used for link hints
const playerInfo = {};
for (const d in pClubs) { if (pClubs[d].size >= 2 && pInfo[d]) playerInfo[d] = pInfo[d]; }

fs.writeFileSync(OUT, JSON.stringify({ seasons: seasonList, clubs, rosters, links2, links3, playerInfo, meta: { ovrMin: OVR_MIN, minSquad: MIN_SQUAD, leagues: Object.values(LEAGUE_BY_ID) } }));

// report
const byLeague = {}; for (const c of clubs) byLeague[c.league] = (byLeague[c.league] || 0) + 1;
const cells = seasonList.reduce((n, s) => n + Object.keys(rosters[s]).length, 0);
console.log(`seasons: ${seasonList.join(', ')}`);
console.log(`clubs: ${clubs.length} | cells: ${cells} | size: ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB`);
console.log('clubs per league:', byLeague);
console.log(`link puzzles: ${links2.length} pairs, ${links3.length} triples`);
