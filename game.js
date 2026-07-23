// game.js — shared, DOM-free game logic for Onze.
//
// Imported by index.html (browser, <script type="module">) AND by tools/test.mjs +
// tools/health-check.mjs (Node, plain ESM). The browser is the source of truth, so the
// tests now exercise this exact code instead of regex-slicing it out of the HTML.
//
// Everything here is pure: all game state is passed in —
//   DATA    = the parsed data/squads.json object
//   PLAYERS = display-name -> { clubs:Set<clubId>, keys:Set<matchKey> }  (built by the caller)
// so there are no hidden globals and the same logic runs in both environments.

// --- name normalisation / match keys ---------------------------------------
export function norm(s){return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[.'’]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
// match key: tokens sorted (word order doesn't matter) + strip name suffixes (Neymar Jr == Neymar)
const NAME_SUFFIX=new Set(['jr','junior','sr','snr','ii','iii','iv']);
export function matchKey(s){let p=norm(s).split(' ').filter(Boolean);
  while(p.length>1&&NAME_SUFFIX.has(p[p.length-1]))p.pop();
  return p.sort().join(' ');}

// --- deterministic daily PRNG + UTC date ------------------------------------
export function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Daily puzzle is keyed to UTC so every player worldwide gets the SAME puzzle each day
// (otherwise friends in different time zones see different boards and shares don't match).
export function todayStr(){const d=new Date();return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
export function yesterdayStr(){const d=new Date(Date.now()-864e5);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
// Daily streak (game-wide, UTC), the retention/brag loop. s = {last, cur, best}.
// bumpStreak: call once when the day's puzzle is completed — consecutive day +1, a missed day resets to 1.
// liveStreak: the streak to display (0 once a day has been missed).
export function bumpStreak(s){
  const t = todayStr(); s = s || { last: '', cur: 0, best: 0 };
  if(s.last === t) return s;                                  // already counted today
  s.cur = (s.last === yesterdayStr()) ? (s.cur || 0) + 1 : 1;
  s.best = Math.max(s.best || 0, s.cur); s.last = t;
  return s;
}
export function liveStreak(s){ return (s && (s.last === todayStr() || s.last === yesterdayStr())) ? (s.cur || 0) : 0; }

// --- puzzle builders (DATA passed in) ---------------------------------------
// weighted pick without replacement; difficulty reshapes the pool/weights:
//   easy  = only star-studded club-seasons (top 30% by weight), still weighted to giants
//   medium= full pool, weighted toward bigger clubs (default)
//   hard  = full pool, uniform weight (any top-5 club equally likely -> more deep cuts)
// MEDIUM_BIAS: medium is the only live difficulty. Raising the club-fame weight to this power tunes
// how many hard-to-name ("deep cut") clubs land in the daily five. Target ≈ ONE deep cut per board:
// a casual fan finds a path into ~four clubs, with one spicy club as the "did you get all five?" flex.
// That keeps the original challenge + club variety while trimming the brutal days that used to throw
// 2–3 unguessable clubs at once (the #1 cold-visitor churn driver). Roughly: 1.0 = original (~1.7 deep
// cuts/board, no help), 1.3 = ~1 deep cut/board, 1.8 = mostly all-giants (too soft). Tune with real
// win-rate data when it exists.
const MEDIUM_BIAS = 1.3;
export function buildPuzzle(DATA, league, diff){
  const date = todayStr();
  const rnd = mulberry32(hashStr(date+'|'+league+'|'+diff));
  let pool = [];
  for(const season of DATA.seasons){
    const r = DATA.rosters[season];
    for(const cid in r){
      const club = DATA.clubs[cid];
      if(league!=='WORLD' && club.league!==league) continue;
      pool.push({season, cid:+cid, club, players:r[cid].p, w:r[cid].w});
    }
  }
  if(diff==='easy'){
    // restrict to genuinely big clubs; fall back to top-weight if a single league lacks 5 of them
    const big=new Set(DATA.bigClubs||[]);
    const bigPool=pool.filter(p=>big.has(p.cid));
    if(new Set(bigPool.map(p=>p.cid)).size>=5){ pool=bigPool; }
    else { const ws=pool.map(p=>p.w).sort((a,b)=>a-b); const cut=ws[Math.floor(ws.length*0.70)]||0; pool=pool.filter(p=>p.w>=cut); }
  } else if(diff==='hard'){
    pool.forEach(p=>p.w=1);
  } else {                                    // medium (the live difficulty): bias harder toward recognisable clubs
    pool.forEach(p=>p.w=Math.pow(p.w, MEDIUM_BIAS));
  }
  // weighted sample of 5 distinct clubs
  const chosen=[]; const usedClub=new Set(); let guard=0;
  while(chosen.length<5 && pool.length && guard++<5000){
    let tot=0; for(const p of pool) tot+= usedClub.has(p.cid)?0:p.w;
    if(tot<=0) break;
    let x=rnd()*tot, pick=null;
    for(const p of pool){ if(usedClub.has(p.cid)) continue; x-=p.w; if(x<=0){pick=p;break;} }
    if(!pick) break;
    usedClub.add(pick.cid); chosen.push(pick);
  }
  // build matchable key-set per cell
  for(const c of chosen){
    c.keys = new Set();
    for(const pl of c.players) for(const k of pl.k) c.keys.add(k);
  }
  return {date, league, cells: chosen};
}

// "find the link" — pick one club-combo whose squads share a player.
//   easy = links where every club is a big club, medium = any triple, hard = uniform-weight triples
export function buildLinkPuzzle(DATA, diff){
  const date=todayStr();
  const rnd=mulberry32(hashStr(date+'|link|'+diff));
  let pool = DATA.links3.slice();                     // always 3 clubs. l = [id,id,id, clubFame, connectorFame]
  if(diff==='easy'){
    // easy = recognisable clubs AND a recognisable ANSWER. Famous clubs alone aren't enough —
    // three giants often share only a deep-cut connector (Monaco×Lyon×Real Madrid → M. Diarra).
    // connectorFame (l[4]) = best FIFA overall of any player linking all three (0 if unrated).
    const big=new Set(DATA.bigClubs||[]);
    const allBig=pool.filter(l=>l.slice(0,3).every(id=>big.has(id)));
    const famous=allBig.filter(l=>(l[4]||0)>=80);     // a star connects them
    if(famous.length>=20) pool=famous;
    else if(allBig.length>=20) pool=allBig;
    else { const ws=pool.map(l=>l[3]).sort((a,b)=>a-b); const cut=ws[Math.floor(ws.length*0.55)]||0; pool=pool.filter(l=>l[3]>=cut); }
  }
  // easy: uniform over the already-famous pool (more day-to-day variety, every answer still a
  // star); medium: weight by club fame; hard: uniform over everything (deep cuts).
  const wOf = l => (diff==='medium') ? l[3] : 1;
  let tot=0; for(const l of pool) tot+=wOf(l);
  let x=rnd()*tot, pick=pool[0];
  for(const l of pool){ x-=wOf(l); if(x<=0){pick=l;break;} }
  const reqIds=pick.slice(0,3);
  return {date, clubs:reqIds.map(id=>DATA.clubs[id]), reqIds, sig:reqIds.join('|')};
}

// grid: 3 row clubs x 3 col clubs; each cell needs a player who played for both
export function buildGridPuzzle(DATA, diff){
  const rnd=mulberry32(hashStr(todayStr()+'|grid|'+diff));
  const pool=(diff==='easy' && DATA.gridsEasy && DATA.gridsEasy.length) ? DATA.gridsEasy : DATA.grids;
  const g=pool[Math.floor(rnd()*pool.length)];
  const rowIds=g.slice(0,3), colIds=g.slice(3,6);
  return {date:todayStr(), rowIds, colIds, rows:rowIds.map(id=>DATA.clubs[id]), cols:colIds.map(id=>DATA.clubs[id]), sig:g.join('|')};
}

// Editorial overrides: force a specific player on a given UTC date, no matter the seeded pick.
// Used to spotlight a name for an occasion (World Cup Final day → Messi). name must exist in the pool.
// Optional `opener` is pinned as the FIRST clue that day only — a one-off flourish, not in the dossier.
export const FEATURED_PLAYER = {
  '2026-07-19': { name: 'Lionel Messi', opener: 'HE IS THE GOAT 🐐' },
};

// Mystery player: one player a day, clues revealed one at a time (no difficulty tiers). CLUES is the
// data/player-clues.json array [{answer, clues:[…]}]. Deterministic daily pick like the other modes.
// The clue ORDER is shuffled per day (seeded by the date, so everyone gets the same order) to keep
// the reveal from feeling formulaic — except the club path, which stays LAST: it's the giveaway,
// and the difficulty curve collapses if it can appear early.
// forceDate: optional override so a preview (?wc) can show a future day's featured player early.
export function buildPlayerPuzzle(CLUES, forceDate){
  const date = forceDate || todayStr();
  if(!CLUES || !CLUES.length) return {date, answer:'', clues:[], sig:''};
  const rnd = mulberry32(hashStr(date + '|player'));
  const want = FEATURED_PLAYER[date];
  const pick = want && CLUES.find(c => (c.answer || c.a || '') === want.name);
  const p = pick || CLUES[Math.floor(rnd() * CLUES.length)];
  const answer = (p.answer || p.a || '').replace(/\s*\(.*\)$/, '');   // strip wiki disambiguation suffix
  const raw = p.clues || p.c || [];
  const path = raw.filter(c => /^Club path:/i.test(c));
  const rest = raw.filter(c => !/^Club path:/i.test(c));
  for(let i = rest.length - 1; i > 0; i--){                          // seeded Fisher–Yates
    const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const opener = (pick && want.opener) ? [want.opener] : [];        // featured-day flourish, pinned first
  return { date, answer, clues: [...opener, ...rest, ...path], sig: 'player|' + answer };
}
// acceptable guesses for a mystery answer: full name, surname, particle-surname phrase, surname-only.
// All routed through matchKey (token-sorted) so word order and accents don't matter.
export function answerKeys(name){
  const k = new Set([matchKey(name)]);
  const t = norm(name).split(' ').filter(Boolean);
  if(t.length > 1){ k.add(matchKey(t[t.length-1])); k.add(matchKey(t.slice(-2).join(' '))); k.add(matchKey(t.slice(1).join(' '))); }
  return k;
}

// proxy "rarity" (0–99): how non-obvious a grid pick is. Among players who fit the cell, famous
// ones get picked by most people, so a low-fame pick — or a pick in a thin/old cell — scores higher.
// Fame = sofifa overall where known (DATA.playerInfo), else 0 (treated as a deep cut). No backend.
export function cellRarity(DATA, PLAYERS, rowId, colId, pick){
  const fameOf=d=>(DATA.playerInfo[d]&&DATA.playerInfo[d].o)||0, E=6;
  let sum=0,n=0;
  for(const d in PLAYERS){const c=PLAYERS[d].clubs; if(c.has(rowId)&&c.has(colId)){sum+=Math.pow(fameOf(d),E);n++;}}
  const share = sum>0 ? Math.pow(fameOf(pick),E)/sum : 1/Math.max(n,1);
  return Math.max(1, Math.min(99, Math.round((1-share)*100)));
}
