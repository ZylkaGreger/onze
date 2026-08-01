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
  '2026-07-26': { name: 'Scott McTominay' },   // pin the day the no-repeat cycle shipped — no mid-day player flip
};

// Mystery player: one player a day, clues revealed one at a time (no difficulty tiers). CLUES is the
// data/player-clues.json array [{answer, clues:[…]}]. Deterministic daily pick like the other modes.
// The clue ORDER is shuffled per day (seeded by the date, so everyone gets the same order) to keep
// the reveal from feeling formulaic — except the club path, which stays LAST: it's the giveaway,
// and the difficulty curve collapses if it can appear early.
// forceDate: optional override so a preview (?wc) can show a future day's featured player early.
// Fixed epoch for the no-repeat rotation (any past UTC date works; never change it once live).
const PLAYER_EPOCH = Date.parse('2026-06-18T00:00:00Z');
export function buildPlayerPuzzle(CLUES, forceDate){
  const date = forceDate || todayStr();
  if(!CLUES || !CLUES.length) return {date, answer:'', clues:[], sig:''};
  const rnd = mulberry32(hashStr(date + '|player'));
  const want = FEATURED_PLAYER[date];
  const pick = want && CLUES.find(c => (c.answer || c.a || '') === want.name);
  // No-repeat rotation instead of an independent daily draw (which repeated players within weeks —
  // birthday paradox): shuffle the pool ONCE with a fixed seed, then step through it one player per
  // day. No repeats until the whole pool has run (~10 months at 300), then the cycle restarts.
  // NOTE: the order depends on pool size — changing the pool reshuffles the schedule, so bump
  // DATA_V *and* pin that day via FEATURED_PLAYER when deploying pool changes mid-day.
  let p = pick;
  if(!p){
    const idx = CLUES.map((_, i) => i);
    const prng = mulberry32(hashStr('onze|player|cycle|v1'));
    for(let i = idx.length - 1; i > 0; i--){ const j = Math.floor(prng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const day = Math.round((Date.parse(date + 'T00:00:00Z') - PLAYER_EPOCH) / 864e5);
    p = CLUES[idx[((day % idx.length) + idx.length) % idx.length]];
  }
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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CAREER MODE — a daily seeded football career.
//
// Everyone starts the same 16-year-old at the same club on a given UTC date; the careers then
// FORK on decisions alone. Nothing here is stored: a career is a pure function of
// (date, decision path, clubs, events), so the same choices always reproduce the same career and
// a reload can never re-roll an outcome. See feature-delta.md "Wave: DESIGN".
//
// Uses data/clubs.json (96 KB) ONLY — never data/squads.json (4 MB).
// ═══════════════════════════════════════════════════════════════════════════════════════════

// All tables indexed by BLOCK INDEX k (0..10) = start ages 16,18,…,36.
export const CAREER = Object.freeze({
  BLOCKS: 11,
  APPS_PER_BLOCK: 82,                    // ~41 games/season incl. cups, over two seasons
  // playing time
  DEMAND_A: 30, DEMAND_B: 0.55,          // demand(P) = 30 + 0.55*P
  AGE_ALLOW: [+12, +8, +6, +4, +2, 0, 0, -2, -5, -9, -14],
  PT_BONUS: { loan: +8, guaranteed: +6, rotation: +2, stay: 0, prospect: -4 },
  PT_NOISE: 2.5,                         // small on purpose: divergence must be STRUCTURAL, not lucky
  K_POS: 5.0, K_NEG: 9.0,                // asymmetric logistic — the bench is a slope, not a cliff
  M_FLOOR: 0.06, M_CAP: 0.92,
  // growth
  GROWTH_AGE: [5.5, 5.0, 4.2, 3.2, 2.2, 1.3, 0.5, -1.5, -3.5, -5.5, -7.5],
  GAIN_A: 0.12, GAIN_B: 1.25, GAIN_E: 0.9,
  ENV_A: 0.92, ENV_B: 0.0025,
  CHALLENGE_DIV: 12, CHALLENGE_LO: -0.35, CHALLENGE_HI: +0.25,
  GROWTH_CAP: 1.55,
  DECLINE_A: 1.15, DECLINE_B: 0.30,
  GROWTH_JITTER: 0.8,
  OVR_MIN: 40, OVR_MAX: 94,
  // retirement
  RETIRE_DROP: 10, RETIRE_MIN_MINUTES: 0.20,
  RETIRE_P: { 8: 0.20, 9: 0.45, 10: 1.0 },
  // market value — display only, never scored
  VAL_A: 0.045, VAL_E: 11.5,
  AGE_VAL: [1.15, 1.15, 1.30, 1.25, 1.25, 1.05, 0.85, 0.60, 0.38, 0.20, 0.08],
  // offers
  PROMISE: [+8, +8, +7, +5, +3, +1, 0, -3, -6, -10, -10],
  BAND_UP: [+18, +18, +18, +15, +15, +11, +11, +8, +8, +8, +8],
  BAND_DOWN: 30,
  P_MIN: 34, P_MAX: 99,                  // the REAL range in clubs.json (not 5..99)
  MAX_LOANS: 2,
  SQUEEZE_M: 0.15,                       // two blocks under this and your club drops you
  REP_WEIGHT: 0,                         // reputation drag: designed, shipped OFF (see O-1)
});

export const POS_MOD = Object.freeze({
  GK: { peakShift: +1, growth: 0.85, ptBonus: -1, g: 0.000, a: 0.004, cs: 0.30 },
  DF: { peakShift: +1, growth: 0.95, ptBonus: 0, g: 0.050, a: 0.045 },
  MF: { peakShift: 0, growth: 1.00, ptBonus: 0, g: 0.150, a: 0.120 },
  FW: { peakShift: -1, growth: 1.05, ptBonus: 0, g: 0.420, a: 0.130 },
});

export const CAREER_TIERS = [[0, 'JOURNEYMAN'], [30, 'SOLID PRO'], [48, 'CULT HERO'], [64, 'STAR'], [80, 'ICON']];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function demand(prestige){ return CAREER.DEMAND_A + CAREER.DEMAND_B * prestige; }

// Share of available minutes, 0.06..0.92. The one number the whole sim turns on.
export function minutesShare(ovr, k, prestige, status, pos, rnd){
  const pm = POS_MOD[pos] || POS_MOD.MF;
  const s = ovr + CAREER.AGE_ALLOW[k] + (CAREER.PT_BONUS[status] || 0) + pm.ptBonus
          - demand(prestige) + ((rnd ? rnd() : 0.5) * 2 - 1) * CAREER.PT_NOISE;
  const K = s >= 0 ? CAREER.K_POS : CAREER.K_NEG;
  return clamp(1 / (1 + Math.exp(-s / K)), CAREER.M_FLOOR, CAREER.M_CAP);
}

// Resolve one 2-season block. st={ovr,k,pos}, offer={prestige,status}.
export function blockOutcome(st, offer, rnd){
  const pm = POS_MOD[st.pos] || POS_MOD.MF;
  const P = offer.prestige;
  const m = minutesShare(st.ovr, st.k, P, offer.status, st.pos, rnd);
  const apps = Math.round(m * CAREER.APPS_PER_BLOCK);

  const gi = clamp(st.k + pm.peakShift, 0, CAREER.BLOCKS - 1);
  const ageGrowth = CAREER.GROWTH_AGE[gi];
  let delta;
  if(ageGrowth >= 0){
    const gain = CAREER.GAIN_A + CAREER.GAIN_B * Math.pow(m, CAREER.GAIN_E);
    const env = CAREER.ENV_A + CAREER.ENV_B * P;
    const challenge = clamp((demand(P) - st.ovr) / CAREER.CHALLENGE_DIV, CAREER.CHALLENGE_LO, CAREER.CHALLENGE_HI);
    const stretch = 1 + challenge * Math.min(1, m / 0.45);   // a stretch move only pays if you PLAY
    delta = ageGrowth * Math.min(CAREER.GROWTH_CAP, gain * env * stretch) * pm.growth;
  } else {
    // Decline deliberately ignores growthMult: playing a lot slows it, nothing stops it.
    delta = ageGrowth * (CAREER.DECLINE_A - CAREER.DECLINE_B * m);
  }
  delta += ((rnd ? rnd() : 0.5) * 2 - 1) * CAREER.GROWTH_JITTER;
  const ovrNext = clamp(st.ovr + delta, CAREER.OVR_MIN, CAREER.OVR_MAX);

  const q = clamp((st.ovr - 50) / 35, 0, 1.2);
  const gr = pm.g * (0.55 + 0.85 * q), ar = pm.a * (0.60 + 0.75 * q);
  const goals = Math.round(apps * gr * (0.85 + 0.30 * (rnd ? rnd() : 0.5)));
  const assists = Math.round(apps * ar * (0.85 + 0.30 * (rnd ? rnd() : 0.5)));
  const cs = st.pos === 'GK' ? Math.round(apps * (pm.cs || 0) * (0.50 + 0.70 * q)) : 0;
  const value = CAREER.VAL_A * Math.exp(st.ovr / CAREER.VAL_E) * CAREER.AGE_VAL[st.k];
  return { m, apps, goals, assists, cs, ovrNext, value };
}

// The prestige band a player of this rating and age can plausibly reach.
export function reachBand(ovr, k){
  const fit = (ovr + CAREER.PROMISE[k] - CAREER.DEMAND_A) / CAREER.DEMAND_B;
  return {
    fit,
    hi: clamp(fit + CAREER.BAND_UP[k], CAREER.P_MIN, CAREER.P_MAX),
    lo: clamp(fit - CAREER.BAND_DOWN, CAREER.P_MIN, CAREER.P_MAX),
  };
}

// Triangular weight around a target prestige — the band filters, the weight adds realism.
export function sampleClub(CLUBS, target, rnd, ctx){
  ctx = ctx || {};
  const played = ctx.played || new Set();
  let tau = 5, pool = [];
  while(pool.length < 8 && tau <= 25){
    pool = CLUBS.filter(c => c.prestige >= target - tau && c.prestige <= target + tau && !played.has(c.name));
    tau += 4;
  }
  if(!pool.length) pool = CLUBS.filter(c => !played.has(c.name));
  if(!pool.length) return null;
  // Continuity matters more than variety. Without a same-country pull the sampler produces a
  // world tour — Israel → Scotland → Argentina → Portugal — which reads as noise, not a career.
  // A mild home bias keeps paths believable; the stuck penalty only bites after a third straight
  // block in one country, which is where "ten Italian clubs" would actually start to show.
  const w = c => (1 / (1 + Math.abs(c.prestige - target)))
               * (ctx.loanCountry && c.country === ctx.loanCountry ? 3 : 1)
               * (ctx.curCountry && c.country === ctx.curCountry ? 2.6 : 1)
               * (ctx.homeCountry && c.country === ctx.homeCountry ? 1.8 : 1)
               * (ctx.stuckCountry === c.country ? 0.65 : 1);
  let tot = 0; for(const c of pool) tot += w(c);
  let x = rnd() * tot;
  for(const c of pool){ x -= w(c); if(x <= 0) return c; }
  return pool[pool.length - 1];
}

// Three differentiated offers: ambition / minutes / balance.
export function buildOffers(CLUBS, st, rnd){
  const band = reachBand(st.ovr, st.k);
  const cur = st.club;
  const played = new Set(st.played || []);
  const ctx = { played, stuckCountry: st.stuckCountry, homeCountry: st.homeCountry,
                curCountry: st.club ? st.club.country : null };

  // Does the current club still want you?
  // Block 0 is exempt: you are AT the day's club as a 16-year-old academy player, and the first
  // decision is about your future FROM there. Without the exemption a 50-rated kid is instantly
  // "outgrown" by his own academy, so the day's starting club never appears in the career at all
  // — which breaks the one promise this mode makes ("we all started at X").
  const squeezed = st.k > 0 && (st.lowBlocks || 0) >= 2;
  const outgrown = st.k > 0 && cur && cur.prestige > band.hi + 8;
  const keepCur = cur && !squeezed && !outgrown;

  const offers = [];
  // A — ambition: the biggest thing available
  const aTarget = Math.max(cur ? cur.prestige : 0, band.hi);
  if(keepCur && (st.k === 0 || cur.prestige >= band.hi - 2)){
    offers.push({ club: cur, status: 'stay', kind: 'ambition' });
  } else {
    const c = sampleClub(CLUBS, aTarget, rnd, ctx);
    if(c){ played.add(c.name); offers.push({ club: c, status: c.prestige > band.fit + 10 ? 'prospect' : 'rotation', kind: 'ambition' }); }
  }
  // B — minutes: guaranteed football, or a loan while young and stuck at a giant
  const canLoan = st.k <= 2 && cur && cur.prestige >= band.fit + 10 && (st.loans || 0) < CAREER.MAX_LOANS;
  const bTarget = canLoan ? band.fit - 6 : Math.max(band.lo, band.fit - 12);
  const bClub = sampleClub(CLUBS, bTarget, rnd, canLoan ? { ...ctx, loanCountry: cur.country } : ctx);
  if(bClub){ played.add(bClub.name); offers.push({ club: bClub, status: canLoan ? 'loan' : 'guaranteed', kind: 'minutes', loan: canLoan, parent: canLoan ? cur : null }); }
  // C — balance: your level; the current club is pinned here when it fits
  if(keepCur && Math.abs(cur.prestige - band.fit) <= 12 && !offers.some(o => o.club.name === cur.name)){
    offers.push({ club: cur, status: 'stay', kind: 'balance' });
  } else {
    const c = sampleClub(CLUBS, band.fit, rnd, ctx);
    if(c) offers.push({ club: c, status: 'rotation', kind: 'balance' });
  }
  return offers.filter(Boolean).slice(0, 3);
}

// The day's seeded 16-year-old. Identical for every player worldwide (D-2).
export function careerStart(CLUBS, date){
  const d = date || todayStr();
  const rnd = mulberry32(hashStr(d + '|career|flavour'));
  // Start club: a recognisable side, so "we all began at X" means something.
  const pool = CLUBS.filter(c => c.tier === 1 && c.prestige >= 70 && c.prestige <= 92);
  const club = pool.length ? pool[Math.floor(rnd() * pool.length)] : CLUBS[0];
  const POS = ['GK', 'DF', 'MF', 'FW'];
  const pos = POS[Math.floor(rnd() * POS.length)];
  const NAMES = ['Ferreira','Novak','Lindqvist','Adeyemi','Costa','Moreau','Halbert','Vasquez','Okafor','Dimitrov','Rossi','Keane'];
  return {
    date: d, club, pos,
    surname: NAMES[Math.floor(rnd() * NAMES.length)],
    number: 2 + Math.floor(rnd() * 28),
    foot: rnd() < 0.78 ? 'Right' : 'Left',
    ovr: 50, age: 16,
  };
}

// THE entry point the UI calls. A career is a projection of (date, path) — never stored state.
export function simulateCareer(CLUBS, date, path){
  const start = careerStart(CLUBS, date);
  const tokens = (path || []).slice();
  const sub = (tag, upto) => mulberry32(hashStr(date + '|career|' + tokens.slice(0, upto).join('|') + '|' + tag));

  const st = {
    ovr: start.ovr, k: 0, pos: start.pos, club: start.club,
    played: [start.club.name], loans: 0, lowBlocks: 0, stuckCountry: null, sameCountry: 1,
    homeCountry: start.club.country,
  };
  const rows = [];
  let peak = start.ovr, done = false, retireAge = null;

  for(let k = 0; k < CAREER.BLOCKS; k++){
    st.k = k;
    // Offers are drawn over the path WITHOUT the choice about to be made, so the option set can
    // never depend on which option you pick.
    const offers = buildOffers(CLUBS, st, sub('offers', k));
    const tok = tokens[k];
    if(tok === undefined) return { start, rows, offers, st: { ...st }, done: false, peak, score: null };

    const slot = { A: 0, B: 1, C: 2 }[String(tok).slice(-1)] ?? 0;
    const pick = offers[Math.min(slot, offers.length - 1)];
    if(!pick) break;

    const r = sub('sim', k + 1);
    const out = blockOutcome(st, { prestige: pick.club.prestige, status: pick.status }, r);
    rows.push({
      age: 16 + 2 * k, club: pick.club, loan: !!pick.loan,
      ovr: Math.round(st.ovr), apps: out.apps, goals: out.goals, assists: out.assists,
      cs: out.cs, value: out.value, m: out.m,
    });
    // advance
    st.ovr = out.ovrNext;
    peak = Math.max(peak, st.ovr);
    st.lowBlocks = out.m < CAREER.SQUEEZE_M ? st.lowBlocks + 1 : 0;
    st.sameCountry = st.club && st.club.country === pick.club.country ? (st.sameCountry || 1) + 1 : 1;
    st.stuckCountry = st.sameCountry >= 3 ? pick.club.country : null;
    st.club = pick.loan ? pick.parent : pick.club;          // a loan returns you to the parent
    if(pick.loan) st.loans++;
    if(!st.played.includes(pick.club.name)) st.played.push(pick.club.name);

    // retirement — from block 8, on rating drop / low minutes / a seeded coin
    if(k >= 8){
      const p = CAREER.RETIRE_P[k] ?? 1;
      const worn = (peak - st.ovr) >= CAREER.RETIRE_DROP || out.m < CAREER.RETIRE_MIN_MINUTES;
      if(k >= 10 || (worn && r() < p + 0.35) || r() < p){
        done = true; retireAge = 18 + 2 * k - (r() < 0.5 ? 1 : 0); break;
      }
    }
  }
  const career = { start, rows, done, peak, retireAge: retireAge || (16 + 2 * rows.length) };
  career.score = done ? scoreCareer(career) : null;
  career.offers = [];
  return career;
}

export function scoreCareer(career){
  const rows = career.rows || [];
  const peakOvr = career.peak || 50;
  const totalApps = rows.reduce((s, r) => s + r.apps, 0);
  const bestPrestige = rows.reduce((s, r) => Math.max(s, r.club.prestige), 0);
  const peakPts = clamp(Math.round(50 * (peakOvr - 50) / 45), 0, 50);
  const lonPts = clamp(Math.round(25 * totalApps / 720), 0, 25);
  const clubPts = clamp(Math.round(25 * Math.pow((bestPrestige - 40) / 55, 2)), 0, 25);
  const total = peakPts + lonPts + clubPts;
  let tier = CAREER_TIERS[0][1];
  for(const [min, label] of CAREER_TIERS) if(total >= min) tier = label;
  return { total, peakPts, lonPts, clubPts, tier, peakOvr: Math.round(peakOvr), totalApps, bestPrestige };
}

// Reference policies — regression fixtures, and the basis for "par" (Slice 09).
export const POLICY_BIGGEST = (offers) => 0;
export const POLICY_MINUTES = (offers) => Math.min(1, offers.length - 1);
