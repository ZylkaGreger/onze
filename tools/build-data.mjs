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

// "big clubs" = genuinely recognisable sides (used for Easy difficulty AND to weight the
// pre-2016 Wikipedia seasons, which carry no player ratings — see ratingless weighting below).
const BIG_NAMES = [
  'Real Madrid', 'FC Barcelona', 'Atlético Madrid', 'Sevilla FC', 'Valencia CF',
  'Manchester United', 'Manchester City', 'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham Hotspur', 'Newcastle United',
  'Juventus', 'Inter', 'AC Milan', 'Napoli', 'Roma', 'Lazio',
  'FC Bayern München', 'Borussia Dortmund', 'RB Leipzig', 'Bayer 04 Leverkusen',
  'Paris Saint-Germain', 'Olympique de Marseille', 'Olympique Lyonnais', 'AS Monaco',
];
const FAMOUS = new Set(BIG_NAMES);
// Ratingless (pre-2016 Wikipedia) club-season draw weights — no overalls, so weightOf can't
// score them. Put them on the same scale as rated clubs so they actually surface in the
// easy/medium daily draw: a famous club's old season ~ a strong modern side, others ~ a solid mid one.
const RATELESS_FAME_W = 100;
const RATELESS_BASE_W = 38;

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
  'Stade Brestois 29': ['2016/17', '2017/18', '2018/19'],           // promoted to Ligue 1 in 2019/20 (name won't match Wikipedia "Brest")
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
// name suffixes that aren't part of the matchable name (Neymar Jr == Neymar, Vinícius Júnior == Vinícius)
const NAME_SUFFIX = new Set(['jr', 'junior', 'sr', 'snr', 'ii', 'iii', 'iv']);
// surname particles — many players are known by "particle + surname" (ter Stegen, de Gea, van Dijk,
// van der Sar). The trailing particle-run + last token forms the real surname people type.
const PARTICLES = new Set('de del della di du da dos das van von der den ter le la'.split(' '));
function dropSuffix(parts) {
  let p = parts.slice();
  while (p.length > 1 && NAME_SUFFIX.has(p[p.length - 1])) p.pop();
  return (p.length === 1 && p[0].length < 2) ? parts : p;   // don't strip down to a lone initial
}
// player match keys: surname token + ORDER-INDEPENDENT full name (tokens sorted), suffix-stripped,
// so "Nico Williams"=="Williams Nico" and "Neymar"=="Neymar Jr". Also the particle-surname phrase
// ("ter Stegen", "de Gea") so typing that common form matches. The browser normalises guesses the same way.
function keysFor(display, full) {
  const set = new Set();
  for (const name of [display, full]) {
    const n = normalize(name); if (!n) continue;
    const parts = dropSuffix(n.split(' ').filter(Boolean));
    set.add(parts.slice().sort().join(' '));            // order-independent full name
    if (parts.length > 1) {
      set.add(parts[parts.length - 1]);                 // surname
      let j = parts.length - 1;                          // particle-surname phrase (sorted)
      while (j - 1 >= 0 && PARTICLES.has(parts[j - 1])) j--;
      if (j < parts.length - 1) set.add(parts.slice(j).sort().join(' '));
    }
  }
  return [...set].filter(k => k.length >= 2);
}
// canonical club key for cross-edition matching: drop common affixes
const CLUB_AFFIX = /\b(fc|cf|afc|sc|ssc|ss|as|ac|us|rc|cd|ud|sv|sd|vfl|vfb|tsg|fsv|bsc|rcd|club|calcio|1)\b/g;
function clubKey(name) {
  return normalize(name).replace(CLUB_AFFIX, ' ').replace(/\s+/g, ' ').trim();
}
// match key for league lookups: drop club-type tokens + standalone numbers so EA names line up
// with Wikipedia names (AJ Auxerre→auxerre, CA Osasuna→osasuna, Deportivo Alavés→alaves, Schalke 04→schalke).
const MATCH_DROP = new Set('fc cf afc sc ssc ss as ac us uc rc cd ud sv sd vfl vfb tsg fsv bsc rcd acf cfc bc spvgg ogc fco hsc aj sco osc ca stade deportivo olympique alsace balompie de club calcio'.split(' '));
const matchClub = (name) => stripAccents(name).toLowerCase().replace(/[.'’]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !/^\d+$/.test(t) && !MATCH_DROP.has(t)).join(' ');

// authoritative per-(league, season) participant lists scraped from Wikipedia
const LEAGUE_SEASONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'league-seasons.json'), 'utf8'));
const allow = {}, universe = {};
for (const [lg, ss] of Object.entries(LEAGUE_SEASONS)) {
  allow[lg] = {}; universe[lg] = new Set();
  for (const [s, clubs] of Object.entries(ss)) {
    allow[lg][s] = new Set(clubs.map(matchClub));
    for (const c of clubs) universe[lg].add(matchClub(c));
  }
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

// 3) Wikipedia pre-2016 squads (tools/wiki-seasons/*.json) — seasons 2006/07..2015/16
// that the EA/FIFA editions don't cover. Players carry no overall/position (ovr=0), so
// they don't inflate the star-weight; they just add older club-seasons + connections.
// Club names come from Wikipedia and must fold into the EA canonical club (so Juventus
// keeps both eras and links across them) — match by matchClub key, with manual aliases
// for the few whose keys don't line up (EN/DE spelling, dropped tokens).
const WIKI_DIR = path.join(__dirname, 'wiki-seasons');
const WIKI_ALIAS = {
  'FC Bayern Munich': 'FC Bayern München',
  'Inter Milan': 'Inter',
  'Internazionale': 'Inter',
  // place-name variants matchClub can't reconcile (EA dropped the city / uses a different one)
  'Athletic Bilbao': 'Athletic Club',
  'Celta de Vigo': 'RC Celta',
  'RC Celta de Vigo': 'RC Celta',
};
if (fs.existsSync(WIKI_DIR)) {
  // index canonical clubs by their matchClub key for auto-resolution
  const canonByMatch = {};
  for (const k in canon) canonByMatch[matchClub(canon[k].name)] = canon[k].name;
  let wFiles = 0, wClubs = 0, wPlayers = 0, wNew = new Set();
  for (const f of fs.readdirSync(WIKI_DIR).filter(n => n.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(WIKI_DIR, f), 'utf8'));
    const league = LEAGUE_BY_ID[d.league_id] || d.league;
    const season = d.season;                                   // "2014/15"
    if (!league || !season) continue;
    wFiles++;
    for (const [wikiClub, players] of Object.entries(d.clubs || {})) {
      // resolve to the canonical club name: explicit alias → matchClub key → register new
      let name = WIKI_ALIAS[wikiClub] || canonByMatch[matchClub(wikiClub)] || wikiClub;
      const ck = clubKey(name);
      if (canon[ck]) name = canon[ck].name;                    // canonical casing
      else { canon[ck] = { name, league }; canonByMatch[matchClub(name)] = name; wNew.add(name); }
      wClubs++;
      for (const p of players) { add(season, name, league, p, '', 0, '', ''); wPlayers++; }
    }
  }
  console.log(`wiki: ${wFiles} files, ${wClubs} club-seasons, ${wPlayers} players, ${wNew.size} clubs new to the dataset`);
}

// --- canonical player identity ---
// The same player appears under different display strings across sources: a full Wikipedia name
// ("Zlatan Ibrahimović"), a FIFA short form ("Z. Ibrahimović"), or a bare surname ("Ibrahimovic").
// Left split, no single record holds the whole career, so connections (links/grid) break. Merge
// them onto one canonical (fullest) name. CONSERVATIVE: a short form "X. Surname" only auto-folds
// into a full name when that (surname,initial) is unique among full names; bare surnames are never
// auto-merged (a lone "Ronaldo" must not become "Cristiano Ronaldo"). PLAYER_ALIAS force-merges the
// famous cases the auto rule can't resolve (ambiguous initial, bare surname of a clear player).
// Curated force-merges, each vetted so the variant's club set belongs to ONE player (no collision):
//   - FIFA short forms whose (surname,initial) is shared by several full names, but whose clubs
//     clearly identify one famous player;
//   - bare surnames that are abbreviations of a full name (NOT a distinct mononym — "Pedro",
//     "Felipe", "Gabriel", "Sandro", "Pelé" are different one-name players and are left alone).
const PLAYER_ALIAS = {
  'K. Mbappé': 'Kylian Mbappé',
  'A. Sánchez': 'Alexis Sánchez',
  'L. Hernández': 'Lucas Hernández',
  'R. Rodríguez': 'Ricardo Rodríguez',
  'J. Rodríguez': 'James Rodríguez',
  'Morata': 'Álvaro Morata',
  'Coutinho': 'Philippe Coutinho',
};
{
  const allKeys = {}, dClubs = {};                     // display -> Set(match keys) / Set(club names)
  for (const s of Object.values(seasons)) for (const cname in s) for (const p of s[cname])
    { (allKeys[p.d] ??= new Set()); for (const k of p.k) allKeys[p.d].add(k); (dClubs[p.d] ??= new Set()).add(cname); }
  // surname PHRASE = last token + any preceding particle run, so "David de Gea" -> "de gea",
  // "Edwin van der Sar" -> "van der sar". This is what lets the FIFA short form "De Gea" /
  // "Van der Sar" (which look like 2-token names, not "X. Surname") fold into the full name.
  const splitName = (parts) => {
    let j = parts.length - 1;
    while (j - 1 >= 0 && PARTICLES.has(parts[j - 1])) j--;
    return [parts.slice(0, j), parts.slice(j).join(' ')];          // [given tokens, surname phrase]
  };
  const meta = {}, fullBySI = {}, fullBySur = {}, fullByTok = {};  // (surname,initial) / surname / any-token -> Set(full displays)
  for (const d in allKeys) {
    const toks = normalize(d).split(' ').filter(Boolean);
    const [given, surname] = splitName(toks);
    const isShort = given.length === 1 && given[0].length === 1;   // "Z. Ibrahimović", "D. de Gea"
    const isBare = given.length === 0;                              // "De Gea", "Van Dijk", "Ronaldo", "Abde"
    meta[d] = { surname, initial: given[0] ? given[0][0] : '', isShort, isBare };
    if (given.length >= 1 && !isShort) {                            // it's a full name
      (fullBySI[surname + '|' + given[0][0]] ??= new Set()).add(d);
      (fullBySur[surname] ??= new Set()).add(d);
      for (const t of toks) (fullByTok[t] ??= new Set()).add(d);    // index every token (incl. forename)
    }
  }
  const subset = (a, b) => { for (const x of a) if (!b.has(x)) return false; return true; };
  const canonName = {};
  for (const d in allKeys) {
    if (PLAYER_ALIAS[d]) { canonName[d] = PLAYER_ALIAS[d]; continue; }
    const m = meta[d]; let c = d;
    if (m.isShort) { const set = fullBySI[m.surname + '|' + m.initial]; if (set && set.size === 1) c = [...set][0]; }
    else if (m.isBare) {
      // a bare name folds into a full name ONLY when exactly one full name contains it (as surname
      // phrase, or — for a single word — as ANY token, so a forename nickname like "Abde" folds into
      // "Abde Ezzalzouli") AND the bare's clubs are a subset of it. Unique + subset keeps distinct
      // mononyms apart ("Pedro"/"Pelé"/"Ronaldo" have their own clubs, "David"/"Sergio" aren't unique).
      const cand = new Set(fullBySur[m.surname] || []);
      if (!m.surname.includes(' ')) for (const f of (fullByTok[m.surname] || [])) cand.add(f);
      // among the full names that contain this bare token, merge into the one whose clubs
      // actually contain the bare's clubs — disambiguates namesakes (bare "Abde" @ Betis ->
      // "Abde Ezzalzouli", not "Abde Raihani" @ Atlético) and still blocks mononyms (Ronaldo).
      const fit = [...cand].filter((f) => subset(dClubs[d], dClubs[f]));
      if (fit.length === 1) c = fit[0];
    }
    canonName[d] = c;
  }
  // rewrite every appearance: swap to the canonical name, add that name's match keys, dedup per squad
  let merged = 0;
  for (const s of Object.values(seasons)) for (const cname in s) {
    const out = [], byD = {};
    for (const p of s[cname]) {
      const c = canonName[p.d];
      if (c !== p.d) { merged++; for (const k of keysFor(c, '')) if (!p.k.includes(k)) p.k.push(k); p.d = c; }
      if (byD[p.d]) { const ex = byD[p.d]; for (const k of p.k) if (!ex.k.includes(k)) ex.k.push(k); ex.o = Math.max(ex.o, p.o); }
      else { byD[p.d] = p; out.push(p); }
    }
    s[cname] = out;
  }
  // Let a player be found by an UNCOMMON forename / one-word nickname (e.g. "Abde" ->
  // "Abde Ezzalzouli", "Ansu" -> "Ansu Fati"). Only when that forename is borne by <=2 players,
  // so common forenames ("David", "Sergio") never become keys that match everyone.
  const canonDisplays = new Set();
  for (const s of Object.values(seasons)) for (const cname in s) for (const p of s[cname]) canonDisplays.add(p.d);
  const firstOf = (d) => { const [g] = splitName(normalize(d).split(' ').filter(Boolean)); return (g.length && g[0].length >= 3) ? g[0] : ''; };
  const firstFreq = {};
  for (const d of canonDisplays) { const f = firstOf(d); if (f) (firstFreq[f] ??= new Set()).add(d); }
  let nick = 0;
  for (const s of Object.values(seasons)) for (const cname in s) for (const p of s[cname]) {
    const f = firstOf(p.d);
    if (f && firstFreq[f].size <= 2 && !p.k.includes(f)) { p.k.push(f); nick++; }
  }

  // canonicalise the hint info (position/nationality) onto the same names, keeping the richest record
  const pi2 = {};
  for (const d in pInfo) {
    const c = canonName[d] || d, v = pInfo[d], cur = pi2[c];
    if (!cur) pi2[c] = { ...v };
    else { if (v.o > cur.o) cur.o = v.o; if (!cur.pos && v.pos) cur.pos = v.pos; if (!cur.nat && v.nat) cur.nat = v.nat; }
  }
  for (const k in pInfo) delete pInfo[k];
  Object.assign(pInfo, pi2);
  console.log(`identity: merged ${merged} appearances onto canonical names`);
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
    const lg = canon[clubKey(name)]?.league, mk = matchClub(name);
    // drop seasons the club wasn't in its top flight. Fail-safe: only act when the club name
    // matches that league's known set, so a name mismatch never wrongly removes a real club.
    if (lg && universe[lg]?.has(mk) && allow[lg][season] && !allow[lg][season].has(mk)) continue;
    if (LOWER_DIVISION[name]?.includes(season)) continue;   // manual backstop
    // pre-2016 Wikipedia seasons have no ratings (all o===0) -> weightOf would floor them to 1
    // and they'd never surface in the weighted draw. Give them a fame-based baseline instead.
    const rated = players.some(p => p.o > 0);
    const w = rated ? weightOf(players) : (FAMOUS.has(name) ? RATELESS_FAME_W : RATELESS_BASE_W);
    rosters[season][idOf[name]] = { w, p: players.map(p => ({ d: p.d, k: p.k })) };
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

// --- grid puzzles (Immaculate-Grid style): 3 row clubs x 3 col clubs, every cell guaranteed solvable ---
const adj = {};
for (const [a, b] of links2) { (adj[a] ??= new Set()).add(b); (adj[b] ??= new Set()).add(a); }
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function genGrids(pool, maxN) {
  const ps = new Set(pool), set = new Map();
  for (let t = 0; t < 200000 && set.size < maxN; t++) {
    const rows = shuffle(pool.slice()).slice(0, 3);
    if (!rows.every(x => adj[x])) continue;
    const common = [...adj[rows[0]]].filter(x => ps.has(x) && adj[rows[1]].has(x) && adj[rows[2]].has(x) && !rows.includes(x));
    if (common.length < 3) continue;
    const cols = shuffle(common).slice(0, 3);
    const key = rows.slice().sort((a, b) => a - b).join(',') + '|' + cols.slice().sort((a, b) => a - b).join(',');
    if (!set.has(key)) set.set(key, [...rows, ...cols]);
  }
  return [...set.values()];
}
// general pool = best-connected clubs (medium/hard grids)
const cand = clubs.map(c => c.id).filter(id => adj[id]).sort((a, b) => adj[b].size - adj[a].size).slice(0, 46);
const grids = genGrids(cand, 300);
// "big clubs" = genuinely recognisable sides (Easy difficulty). BIG_NAMES defined up top.
const bigClubs = BIG_NAMES.map(n => idOf[n]).filter(x => x != null);
const gridsEasy = genGrids(bigClubs, 250);

fs.writeFileSync(OUT, JSON.stringify({ seasons: seasonList, clubs, rosters, links2, links3, grids, gridsEasy, bigClubs, playerInfo, meta: { ovrMin: OVR_MIN, minSquad: MIN_SQUAD, leagues: Object.values(LEAGUE_BY_ID) } }));

// report
const byLeague = {}; for (const c of clubs) byLeague[c.league] = (byLeague[c.league] || 0) + 1;
const cells = seasonList.reduce((n, s) => n + Object.keys(rosters[s]).length, 0);
console.log(`seasons: ${seasonList.join(', ')}`);
console.log(`clubs: ${clubs.length} | cells: ${cells} | size: ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB`);
console.log('clubs per league:', byLeague);
console.log(`link puzzles: ${links2.length} pairs, ${links3.length} triples | grids: ${grids.length} (easy: ${gridsEasy.length}, big clubs: ${bigClubs.length})`);
const unmatched = clubs.filter(c => c.league !== 'Other' && !universe[c.league]?.has(matchClub(c.name)));
console.log(`name-mismatch clubs (kept as-is, not season-filtered): ${unmatched.length ? unmatched.map(c => c.name).join(', ') : 'none'}`);
