import fs from 'node:fs';
const clubs = JSON.parse(fs.readFileSync('/Users/peter/onze/data/clubs.json','utf8')).clubs;
const titleOf = c => c.wiki || c.name;
const UA = { 'User-Agent': 'onze-club-colours/1.0 (petmyr67@gmail.com)' };
const out = {};
const chunks = [];
for (let i = 0; i < clubs.length; i += 40) chunks.push(clubs.slice(i, i + 40));
let done = 0;
for (const ch of chunks) {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main'
            + '&format=json&formatversion=2&redirects=1&titles=' + encodeURIComponent(ch.map(titleOf).join('|'));
  let j;
  try { j = await (await fetch(url, { headers: UA })).json(); }
  catch (e) { console.error('FEHLER', e.message); continue; }
  const byTitle = {};
  for (const p of (j.query?.pages || [])) byTitle[p.title] = p.revisions?.[0]?.slots?.main?.content || '';
  // map redirects back
  for (const r of (j.query?.redirects || [])) if (byTitle[r.to]) byTitle[r.from] = byTitle[r.to];
  for (const r of (j.query?.normalized || [])) if (byTitle[r.to]) byTitle[r.from] = byTitle[r.to];
  for (const c of ch) {
    const wt = byTitle[titleOf(c)] || '';
    if (!wt) continue;
    const grab = k => (wt.match(new RegExp('\\|\\s*' + k + '\\s*=\\s*([0-9A-Fa-f]{6})\\s*(?:\\||\\n)')) || [])[1];
    const body = grab('body1'), arm = grab('leftarm1'), shorts = grab('shorts1'), socks = grab('socks1');
    const prim = body || arm || socks || shorts;
    if (!prim) continue;
    const alt = [arm, socks, shorts, body].find(x => x && x.toLowerCase() !== prim.toLowerCase());
    out[c.name] = alt ? [prim.toUpperCase(), alt.toUpperCase()] : [prim.toUpperCase()];
  }
  done += ch.length;
  process.stderr.write('\r' + done + '/' + clubs.length);
  await new Promise(r => setTimeout(r, 120));
}
console.error('');
fs.writeFileSync('colours-raw.json', JSON.stringify(out, null, 0));
const n = Object.keys(out).length;
console.log('Farbe gefunden für ' + n + ' von ' + clubs.length + ' Vereinen (' + Math.round(100*n/clubs.length) + '%)');
const top = clubs.slice().sort((a,b)=>b.prestige-a.prestige).slice(0,40);
console.log('\nTop-40 nach Prestige:');
for (const c of top) console.log('  ' + (out[c.name] ? '✓ ' + out[c.name].join(' / ') : '✗ —————').padEnd(22) + c.name);
