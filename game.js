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

// --- puzzle builders (DATA passed in) ---------------------------------------
// weighted pick without replacement; difficulty reshapes the pool/weights:
//   easy  = only star-studded club-seasons (top 30% by weight), still weighted to giants
//   medium= full pool, weighted toward bigger clubs (default)
//   hard  = full pool, uniform weight (any top-5 club equally likely -> more deep cuts)
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
  let pool = DATA.links3.slice();                     // always 3 clubs
  if(diff==='easy'){                                  // easy = links where EVERY club is a big club
    const big=new Set(DATA.bigClubs||[]);
    const allBig=pool.filter(l=>l.slice(0,3).every(id=>big.has(id)));
    if(allBig.length>=20) pool=allBig;
    else { const ws=pool.map(l=>l[3]).sort((a,b)=>a-b); const cut=ws[Math.floor(ws.length*0.55)]||0; pool=pool.filter(l=>l[3]>=cut); }
  }
  const wOf = l => (diff==='hard') ? 1 : l[3];        // hard = uniform weight -> deeper cuts
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
