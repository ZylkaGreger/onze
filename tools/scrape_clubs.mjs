#!/usr/bin/env node
// Build data/clubs.json — the club universe for Career mode.
//
// Career mode needs CLUBS ONLY (name, country, league, tier, prestige) — no rosters — so this is
// a small standalone file, independent of the 4 MB data/squads.json.
//
// Divisions are scraped from the CURRENT season's Wikipedia article, never from memory: clubs get
// promoted and relegated every year (Schalke and Elversberg are 2026/27 Bundesliga sides, which a
// model trained earlier would get wrong). SEASON below is the single knob to re-run this yearly.
//
// Prestige (5..99) = league base + club stature bonus, so the ladder is globally comparable:
// a fallen giant in a second division still outranks a mid-table side in that same division.
//
// Usage:  node tools/scrape_clubs.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'OnzeBot/1.0 (https://onzedaily.com; petmyr67@gmail.com) club-dataset' };
const DRY = process.argv.includes('--dry');

// European seasons span two years; single-year leagues (Brazil, MLS…) use CAL_YEAR.
const SEASON = '2026–27';        // en-dash, as Wikipedia titles use
const CAL_YEAR = '2026';

// ── League table ────────────────────────────────────────────────────────────────────────────
// base = the league's own standing in world football (the floor every club in it inherits).
// expect = squad size, used only to warn on a bad scrape — never to silently pad or truncate.
const LEAGUES = [
  // country, league label, tier, base, wiki page, expected clubs
  ['England','Premier League',1,72,`${SEASON} Premier League`,20],
  ['England','Championship',2,52,`${SEASON} EFL Championship`,24],
  ['Spain','La Liga',1,70,`${SEASON} La Liga`,20],
  ['Spain','Segunda División',2,46,`${SEASON} Segunda División`,22],
  ['Germany','Bundesliga',1,68,`${SEASON} Bundesliga`,18],
  ['Germany','2. Bundesliga',2,48,`${SEASON} 2. Bundesliga`,18],
  ['Italy','Serie A',1,68,`${SEASON} Serie A`,20],
  ['Italy','Serie B',2,47,`${SEASON} Serie B`,20],
  ['France','Ligue 1',1,63,`${SEASON} Ligue 1`,18],
  ['France','Ligue 2',2,44,`${SEASON} Ligue 2`,18],
  ['Netherlands','Eredivisie',1,56,`${SEASON} Eredivisie`,18],
  ['Netherlands','Eerste Divisie',2,40,`2025–26 Eerste Divisie`,20],
  ['Portugal','Primeira Liga',1,56,`${SEASON} Primeira Liga`,18],
  ['Portugal','Liga Portugal 2',2,40,`${SEASON} Liga Portugal 2`,18],
  ['Belgium','Belgian Pro League',1,53,`${SEASON} Belgian Pro League`,16],
  ['Belgium','Challenger Pro League',2,38,`${SEASON} Challenger Pro League`,16],
  ['Turkey','Süper Lig',1,52,`${SEASON} Süper Lig`,18],
  ['Turkey','1. Lig',2,38,`${SEASON} TFF 1. Lig`,20],
  ['Scotland','Scottish Premiership',1,49,`${SEASON} Scottish Premiership`,12],
  ['Scotland','Scottish Championship',2,35,`${SEASON} Scottish Championship`,10],
  ['Austria','Austrian Bundesliga',1,48,`${SEASON} Austrian Football Bundesliga`,12],
  ['Switzerland','Swiss Super League',1,48,`${SEASON} Swiss Super League`,12],
  ['Greece','Super League Greece',1,48,`${SEASON} Super League Greece`,14],
  ['Denmark','Danish Superliga',1,47,`${SEASON} Danish Superliga`,12],
  ['Czechia','Czech First League',1,45,`${SEASON} Czech First League`,16],
  ['Croatia','HNL',1,45,`${SEASON} Croatian Football League`,10],
  ['Ukraine','Ukrainian Premier League',1,45,`${SEASON} Ukrainian Premier League`,16],
  ['Serbia','Serbian SuperLiga',1,43,`${SEASON} Serbian SuperLiga`,16],
  ['Poland','Ekstraklasa',1,44,`${SEASON} Ekstraklasa`,18],
  ['Norway','Eliteserien',1,43,`${CAL_YEAR} Eliteserien`,16],
  ['Sweden','Allsvenskan',1,43,`${CAL_YEAR} Allsvenskan`,16],
  ['Russia','Russian Premier League',1,44,`${SEASON} Russian Premier League`,16],
  ['Romania','Liga I',1,41,`${SEASON} Liga I`,16],
  ['Hungary','Nemzeti Bajnokság I',1,40,`${SEASON} Nemzeti Bajnokság I`,12],
  ['Bulgaria','First League',1,39,`${SEASON} First Professional Football League (Bulgaria)`,16],
  ['Israel','Israeli Premier League',1,42,`2025–26 Israeli Premier League`,14],
  ['Cyprus','Cypriot First Division',1,39,`${SEASON} Cypriot First Division`,14],
  ['Brazil','Campeonato Brasileiro Série A',1,58,`${CAL_YEAR} Campeonato Brasileiro Série A`,20],
  ['Brazil','Série B',2,42,`${CAL_YEAR} Campeonato Brasileiro Série B`,20],
  ['Argentina','Primera División',1,55,`${CAL_YEAR} AFA Liga Profesional de Fútbol`,28],
  ['Mexico','Liga MX',1,52,`${CAL_YEAR}–27 Liga MX season`,18],
  ['USA','Major League Soccer',1,50,`${CAL_YEAR} Major League Soccer season`,30],
  ['Saudi Arabia','Saudi Pro League',1,52,`${SEASON} Saudi Pro League`,18],
  ['Japan','J1 League',1,48,`${SEASON} J1 League`,20],
  ['South Korea','K League 1',1,45,`${CAL_YEAR} K League 1`,12],
  ['Uruguay','Primera División',1,45,`${CAL_YEAR} Liga AUF Uruguaya`,16],
  ['Colombia','Categoría Primera A',1,45,`${CAL_YEAR} Categoría Primera A season`,20],
  ['Chile','Primera División',1,43,`${CAL_YEAR} Liga de Primera`,16],
  ['Australia','A-League Men',1,42,`${SEASON} A-League Men`,13],
  ['Qatar','Qatar Stars League',1,42,`2025–26 Qatar Stars League`,12],
  ['UAE','UAE Pro League',1,41,`2025–26 UAE Pro League`,14],
  ['Egypt','Egyptian Premier League',1,41,`2025–26 Egyptian Premier League`,18],
  ['Morocco','Botola',1,41,`2025–26 Botola Pro`,16],
  ['South Africa','Premier Division',1,40,`${SEASON} South African Premiership`,16],
];

// ELITE — absolute prestige, not a bonus. These ~130 clubs are the ones players actually
// recognise, so their ordering IS the ladder and is set by hand rather than derived. Two reasons
// it must be absolute: (a) a league base would put Liverpool above Real Madrid purely because the
// Premier League scores higher, and (b) stature outlives division — Schalke and Hamburg have to
// outrank a mid-table side in whatever league they are currently in.
const ELITE = {
  'Real Madrid':99,'FC Barcelona':98,'Manchester City':97,'FC Bayern Munich':97,'Bayern Munich':97,
  'Liverpool':96,'Paris Saint-Germain':96,'Arsenal':95,'Inter Milan':94,'Manchester United':94,
  'Chelsea':94,'Atlético Madrid':93,'Juventus':93,'A.C. Milan':92,'Borussia Dortmund':92,
  'S.S.C. Napoli':91,'Tottenham Hotspur':89,'Bayer 04 Leverkusen':89,'AS Roma':88,'Newcastle United':88,
  'Aston Villa':86,'RB Leipzig':86,'Atalanta BC':85,'Sevilla FC':84,'Real Sociedad':83,'Villarreal CF':83,
  'S.S. Lazio':83,'ACF Fiorentina':82,'Real Betis':82,'Athletic Bilbao':83,'AFC Ajax':82,'S.L. Benfica':82,
  'FC Porto':82,'AS Monaco':81,'Olympique de Marseille':81,'West Ham United':80,'Sporting CP':81,
  'Valencia CF':79,'Olympique Lyonnais':79,'PSV Eindhoven':79,'Eintracht Frankfurt':79,'VfB Stuttgart':78,
  'Everton':77,'Nottingham Forest':77,'Crystal Palace':76,'Brighton & Hove Albion':77,'Brentford':75,
  'Fulham':75,'LOSC Lille':76,'OGC Nice':74,'RC Lens':74,'Feyenoord':77,'Celtic F.C.':76,'Rangers F.C.':74,
  'Galatasaray S.K.':76,'Fenerbahçe S.K.':75,'Beşiktaş J.K.':72,'Olympiacos F.C.':73,'Club Brugge KV':73,
  'SV Werder Bremen':72,'Borussia Mönchengladbach':72,'SC Freiburg':72,'TSG 1899 Hoffenheim':71,
  'VfL Wolfsburg':72,'1. FSV Mainz 05':71,'FC Augsburg':70,'1. FC Union Berlin':70,'Torino F.C.':71,
  'Bologna FC 1909':73,'Udinese Calcio':70,'Genoa C.F.C.':69,'Celta de Vigo':71,'Rayo Vallecano':70,
  'RCD Mallorca':69,'Getafe CF':69,'CA Osasuna':69,'RC Strasbourg':70,'Stade Rennais':70,'FC Nantes':68,
  'Toulouse FC':68,'Stade Brestois 29':68,'AJ Auxerre':66,'RSC Anderlecht':70,'Red Bull Salzburg':70,
  'FC Basel':68,'Shakhtar Donetsk':70,'Dynamo Kyiv':68,'Dinamo Zagreb':68,'Red Star Belgrade':68,
  'Partizan':64,'Panathinaikos F.C.':68,'AEK Athens F.C.':66,'PAOK FC':67,'Sparta Prague':66,
  'Slavia Prague':67,'Legia Warsaw':64,'Ferencváros':63,'Zenit Saint Petersburg':70,'Spartak Moscow':67,
  'CSKA Moscow':66,'F.C. Copenhagen':67,'Rosenborg BK':62,'Malmö FF':63,'Young Boys':66,
  // Fallen giants — stature that must survive relegation
  'FC Schalke 04':70,'Hamburger SV':71,'1. FC Köln':69,'Hertha BSC':67,'1. FC Kaiserslautern':60,
  '1. FC Nürnberg':60,'Leeds United':73,'Sunderland':70,'Southampton':68,'Sheffield Wednesday':58,
  'U.C. Sampdoria':62,'Parma Calcio 1913':66,'Palermo F.C.':58,'Deportivo de La Coruña':60,
  'Real Zaragoza':58,'Girondins de Bordeaux':58,'AS Saint-Étienne':64,'Racing Club de Santander':60,
  // Americas
  'CR Flamengo':82,'SE Palmeiras':81,'Sport Club Corinthians Paulista':78,'São Paulo FC':77,
  'Fluminense FC':76,'Botafogo':77,'Clube Atlético Mineiro':76,'Grêmio':75,'Sport Club Internacional':74,
  'Cruzeiro EC':75,'Santos FC':74,'Vasco da Gama':72,'Club Athletico Paranaense':71,
  'Boca Juniors':80,'River Plate':81,'Racing Club':74,'Independiente':71,'San Lorenzo':69,
  'Club Nacional de Football':70,'Peñarol':70,'Atlético Nacional':70,'Millonarios':66,
  'Colo-Colo':68,'Universidad de Chile':66,'Club América':74,'Guadalajara':71,'Cruz Azul':72,
  'Tigres UANL':73,'Monterrey':73,'Inter Miami CF':72,'LA Galaxy':66,'Los Angeles FC':69,
  'Seattle Sounders FC':66,
  // Asia / Africa
  'Al Hilal SFC':78,'Al Nassr FC':76,'Al-Ittihad Club':74,'Al-Ahli Saudi FC':73,'Al-Qadsiah FC':66,
  'Urawa Red Diamonds':66,'Kashima Antlers':66,'Vissel Kobe':66,'Jeonbuk Hyundai Motors':64,
  'Ulsan HD FC':64,'Al Ahly SC':70,'Zamalek SC':68,'Wydad AC':66,'Raja CA':66,'Esperance de Tunis':64,
  'Mamelodi Sundowns':66,'Kaizer Chiefs':62,'Orlando Pirates':62,
};

const wikitext = async (title) => {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'parse', page: title, prop: 'wikitext', redirects: '1', format: 'json', formatversion: '2',
  });
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
      const d = await r.json();
      return d.parse ? d.parse.wikitext : '';
    } catch { await sleep(1000 * (a + 1)); }
  }
  return '';
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Union of the two layouts Wikipedia season articles use. Neither alone covers every league:
// the sports-table module misses German pages, the location map misses most others.
function extractClubs(w) {
  const out = new Set();
  let m;
  const reName = /name_[A-Za-z0-9]{2,6}\s*=\s*\[\[([^\]|#]+)/g;
  while ((m = reName.exec(w))) out.add(m[1].trim());
  const reMap = /\{\{Location map~[^}]*?label\s*=\s*\[\[([^\]|#]+)/g;
  while ((m = reMap.exec(w))) out.add(m[1].trim());
  if (out.size >= 6) return [...out].filter(isClubName);
  // 3) Teams/Clubs section wikitable — first link of each row (A-League, MLS, several others)
  const sec = w.search(/==+\s*(Teams|Clubs)[^=\n]*==+/i);
  if (sec >= 0) {
    for (const row of w.slice(sec, sec + 14000).split(/\n\|-/)) {
      const link = row.match(/\|\s*(?:rowspan="?\d+"?\s*\|\s*)?\[\[([^\]|#]+)/);
      if (link) out.add(link[1].trim());
    }
  }
  return [...out].filter(isClubName);
}

// Season pages link plenty of non-clubs (stadiums, cities, other seasons, references).
const NON_CLUB = /^(19|20)\d\d|League|Cup|Championship|Division|Stadium|Arena|Category:|File:|List of|Football|Season|UEFA|FIFA|Premier|Liga$|Serie [ABC]$/i;
function isClubName(n) {
  if (!n || n.length < 3 || n.length > 60) return false;
  if (NON_CLUB.test(n)) return false;
  return true;
}

// Wikipedia titles carry legal suffixes nobody says out loud: "Arsenal F.C." → "Arsenal".
function displayName(title) {
  let n = title.replace(/\s*\([^)]*\)\s*$/, '');            // drop "(football club)" disambiguators
  n = n.replace(/\s+(F\.?C\.?|A\.?F\.?C\.?|S\.?C\.?|C\.?F\.?|B\.?K\.?|F\.?K\.?|S\.?K\.?)$/i, '');
  return n.trim();
}

function eliteOf(clubName, display) {
  return ELITE[clubName] ?? ELITE[display] ?? null;
}

async function main() {
  // Historic fame from the existing dataset: any club that spent time in a top-5 league over the
  // last 20 seasons has a measured weight, which beats guessing at its stature.
  let famew = {};
  try {
    const sq = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/squads.json'), 'utf8'));
    const best = {};
    for (const s of sq.seasons) {
      const r = sq.rosters[s];
      for (const cid in r) {
        const nm = sq.clubs[cid].name;
        best[nm] = Math.max(best[nm] || 0, r[cid].w || 0);
      }
    }
    const max = Math.max(...Object.values(best), 1);
    for (const nm in best) famew[nm] = best[nm] / max;     // 0..1
    console.log(`historic fame loaded for ${Object.keys(famew).length} clubs`);
  } catch { console.log('! squads.json unreadable — stature falls back to the curated table only'); }

  const clubs = [];
  const warnings = [];
  const seen = new Map();

  for (const [country, league, tier, base, page, expect] of LEAGUES) {
    const w = await wikitext(page);
    const found = w ? extractClubs(w) : [];
    if (!found.length) { warnings.push(`✗ ${country} / ${league}: no clubs from "${page}"`); await sleep(250); continue; }
    if (Math.abs(found.length - expect) > Math.max(4, expect * 0.35))
      warnings.push(`? ${country} / ${league}: got ${found.length}, expected ~${expect} ("${page}")`);

    for (const title of found) {
      const display = displayName(title);
      const key = display.toLowerCase();
      if (seen.has(key)) continue;                          // a club plays in exactly one division

      // Prestige, in priority order:
      //  1. hand-set absolute value for the clubs players recognise (the ladder proper)
      //  2. measured historic top-5 fame — a real signal for anyone who has been up there
      //  3. the league's own base, nudged by name recognition so a division is not perfectly flat
      let prestige, src;
      const elite = eliteOf(title, display);
      // A hand-set value is a club's standing at full height. Currently in the second division,
      // it takes a fixed drop — otherwise a relegated Wolfsburg outranks Schalke in the division
      // above it, and moving there would read as a step up while actually being a step down.
      // The drop is small enough that a fallen giant still towers over its anonymous rivals.
      if (elite !== null) { prestige = tier === 1 ? elite : elite - 8; src = 'elite'; }
      else {
        const f = famew[title] ?? famew[display];
        if (f !== undefined) { prestige = Math.round(base + f * 20); src = 'historic'; }
        else {
          // Deterministic ±3 jitter keyed off the club name. Not a claim about the club — it just
          // stops every anonymous side in a league sharing one number, which would make the ladder
          // read as a staircase of identical steps.
          let h = 0; for (const ch of display) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
          prestige = base + (tier === 1 ? 4 : 1) + (h % 7) - 3;
          src = 'league';
        }
      }
      prestige = Math.max(5, Math.min(99, prestige));
      const rec = { name: display, wiki: title !== display ? title : undefined, country, league, tier, prestige, src };
      seen.set(key, rec);
      clubs.push(rec);
    }
    console.log(`${String(found.length).padStart(3)}  ${country} / ${league}`);
    await sleep(250);
  }

  clubs.sort((a, b) => b.prestige - a.prestige || a.name.localeCompare(b.name));

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    season: SEASON,
    note: 'Career-mode club universe. Divisions reflect the CURRENT season and must be re-scraped yearly.',
    leagues: LEAGUES.map(([country, league, tier, base]) => ({ country, league, tier, base })),
    clubs: clubs.map(({ src, ...c }) => c),
  };

  if (warnings.length) { console.log('\n--- warnings ---'); warnings.forEach((x) => console.log(x)); }
  console.log(`\n${clubs.length} clubs · ${new Set(clubs.map((c) => c.country)).size} countries`);
  const bySrc = clubs.reduce((a, c) => ((a[c.src] = (a[c.src] || 0) + 1), a), {});
  console.log('stature source:', JSON.stringify(bySrc));
  console.log('top 12:', clubs.slice(0, 12).map((c) => `${c.name} ${c.prestige}`).join(', '));

  if (DRY) { console.log('\n(--dry: nothing written)'); return; }
  fs.writeFileSync(path.join(ROOT, 'data/clubs.json'), JSON.stringify(out));
  console.log(`\nwrote data/clubs.json (${(fs.statSync(path.join(ROOT, 'data/clubs.json')).size / 1024).toFixed(0)} KB)`);
}

main();
