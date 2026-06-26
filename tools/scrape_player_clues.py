#!/usr/bin/env python3
"""PROTOTYPE: build "guess the mystery player" clue dossiers from Wikipedia.

Picks the top-N players by FIFA overall from data/squads.json, finds each one's Wikipedia
article (verified by matching the article's infobox clubs to the clubs we already know they
played), and parses the {{Infobox football biography}} career + Honours section into an
ordered clue dossier (hard -> easy), à la the Salah example:
   nationality+position -> an honour -> first senior club -> a club -> full club path.

Output: data/player-clues.json  (+ prints the dossiers so clue quality can be judged).
No difficulty levels (per request) — one ordered clue list per player.

Usage:  python3 tools/scrape_player_clues.py [N]      # default N=20
"""
import json, os, re, ssl, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
import certifi

HERE = os.path.dirname(__file__)
SSL_CTX = ssl.create_default_context(cafile=certifi.where())
UA = "OnzeBot/1.0 (https://onzedaily.com; petmyr67@gmail.com) player-clue prototype"
API = "https://en.wikipedia.org/w/api.php"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 20


def api(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    for a in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30, context=SSL_CTX) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (a + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(1.5 * (a + 1))
    return {}


def wikitext(title):
    d = api({"action": "parse", "page": title, "prop": "wikitext", "redirects": "1"})
    return d.get("parse", {}).get("wikitext", "") if "error" not in d else ""


def search(q):
    d = api({"action": "query", "list": "search", "srsearch": q, "srlimit": 6})
    return [h["title"] for h in d.get("query", {}).get("search", [])]


def ckey(name):  # club match key (≈ build-data matchClub): strip accents/affixes/punct
    n = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower()
    n = re.sub(r"[.'’]", "", n); n = re.sub(r"[^a-z0-9 ]", " ", n)
    drop = set("fc cf afc sc ssc ss as ac us uc rc cd ud sv sd vfl vfb tsg fsv bsc rcd acf cfc bc "
               "spvgg ogc fco hsc aj sco osc ca stade deportivo olympique balompie de del della di du "
               "da dos das club calcio 1 1846 04 05 1899 1909 1913".split())
    return " ".join(t for t in n.split() if t and not t.isdigit() and t not in drop)


def clean(s):  # wiki value -> plain text
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", s)   # [[A|B]] -> B, [[A]] -> A
    s = s.replace("→", "").replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", s).strip()


def infobox(w):
    """Parse {{Infobox football biography}} into {field: value}, respecting nested {{}}/[[]]."""
    i = w.lower().find("{{infobox football biography")
    if i < 0:
        return {}
    d, j = 0, i
    while j < len(w):
        if w[j:j + 2] == "{{": d += 1; j += 2
        elif w[j:j + 2] == "}}":
            d -= 1; j += 2
            if d == 0: break
        else: j += 1
    body, parts, buf, d1, d2, k = w[i + 2:j - 2], [], "", 0, 0, 0
    while k < len(body):
        two = body[k:k + 2]
        if two == "{{": d1 += 1; buf += two; k += 2
        elif two == "}}": d1 -= 1; buf += two; k += 2
        elif two == "[[": d2 += 1; buf += two; k += 2
        elif two == "]]": d2 -= 1; buf += two; k += 2
        elif body[k] == "|" and d1 == 0 and d2 == 0: parts.append(buf); buf = ""; k += 1
        else: buf += body[k]; k += 1
    parts.append(buf)
    f = {}
    for p in parts:
        m = re.match(r"\s*([a-z0-9_]+)\s*=\s*(.*)", p, re.S)
        if m and m.group(2).strip():
            f[m.group(1)] = m.group(2).strip()
    return f


def senior_career(f):
    """Ordered [(years, club, loan)] from clubsN/yearsN (skip youth/national)."""
    out = []
    for n in range(1, 12):
        c = f.get(f"clubs{n}")
        if not c: continue
        loan = "→" in c or "loan" in c.lower()
        out.append((clean(f.get(f"years{n}", "")), clean(c), loan))
    return out


def birth_year(f):
    m = re.search(r"\b(19[5-9]\d|20[01]\d)\b", f.get("birth_date", ""))
    return int(m.group(1)) if m else None


def honours(w):
    """Flat list of clean honour labels (text before the ':') from the ==Honours== section."""
    m = re.search(r"==\s*Honours\s*==(.*?)(?:\n==[^=]|\Z)", w, re.S)
    if not m:
        return []
    out = []
    for line in re.findall(r"^\s*\*\s*(.+)$", m.group(1), re.M):
        c = clean(line.split(":")[0])
        if c and 3 <= len(c) <= 60 and not c.lower().startswith("note"):
            out.append(c)
    return out


def resolve_article(name, our_clubs):
    """Find the Wikipedia article whose infobox clubs best overlap the clubs we know."""
    base = re.sub(r"^[A-Z]\.\s*", "", name)            # drop "M. " initial
    cand, seen = [], set()
    for q in (f"{name} footballer", f"{base} footballer", base):
        for t in search(q):
            if t not in seen:
                seen.add(t); cand.append(t)
        time.sleep(0.25)
    want = {ckey(c) for c in our_clubs}
    best, best_score, best_w = None, 0, ""
    for t in cand[:6]:
        w = wikitext(t); time.sleep(0.25)
        if "football biography" not in w.lower():
            continue
        clubs = {ckey(c) for _, c, _ in senior_career(infobox(w))}
        score = len(want & clubs)
        if score > best_score:
            best, best_score, best_w = t, score, w
    return (best, best_w) if best_score >= 2 else (None, "")


# position code (FIFA/our data) -> readable role
def position_word(p):
    p = (p or "").upper().strip()
    if p == "GK": return "goalkeeper"
    if p in ("CB", "LCB", "RCB"): return "centre-back"
    if p in ("RB", "LB", "RWB", "LWB"): return "full-back"
    if p in ("CDM", "DM"): return "defensive midfielder"
    if p in ("CM", "LCM", "RCM", "CAM", "LM", "RM", "MF"): return "midfielder"
    if p in ("LW", "RW"): return "winger"
    if p in ("ST", "CF", "RS", "LS", "SS", "LF", "RF", "FW"): return "forward"
    return "player"

def position_from_text(t):  # from the Wikipedia infobox 'position' words (more accurate than our code)
    t = (t or "").lower()
    if "goalkeeper" in t: return "goalkeeper"
    if "winger" in t or "wing" in t: return "winger"
    if "back" in t or "defender" in t: return "defender"
    if "midfield" in t: return "midfielder"
    if "forward" in t or "striker" in t: return "forward"
    return None

DEMONYM = {
    "Argentina": "Argentine", "Brazil": "Brazilian", "Portugal": "Portuguese", "Spain": "Spanish",
    "France": "French", "Germany": "German", "Italy": "Italian", "Netherlands": "Dutch",
    "Belgium": "Belgian", "England": "English", "Wales": "Welsh", "Scotland": "Scottish",
    "Croatia": "Croatian", "Sweden": "Swedish", "Norway": "Norwegian", "Denmark": "Danish",
    "Poland": "Polish", "Uruguay": "Uruguayan", "Colombia": "Colombian", "Egypt": "Egyptian",
    "Senegal": "Senegalese", "Ivory Coast": "Ivorian", "Morocco": "Moroccan", "Nigeria": "Nigerian",
    "Serbia": "Serbian", "Switzerland": "Swiss", "Austria": "Austrian", "Slovenia": "Slovenian",
    "Slovakia": "Slovak", "Czech Republic": "Czech", "Greece": "Greek", "Turkey": "Turkish",
    "Japan": "Japanese", "South Korea": "South Korean", "Mexico": "Mexican", "United States": "American",
    "Cameroon": "Cameroonian", "Ghana": "Ghanaian", "Algeria": "Algerian", "Ukraine": "Ukrainian",
}
# clue-worthy honours, most distinctive first
INDIV_AWARDS = ["Ballon d'Or", "The Best FIFA Men's Player", "FIFA World Player of the Year",
                "European Golden Shoe", "Premier League Golden Boot", "Pichichi", "Capocannoniere",
                "PFA Players' Player of the Year", "UEFA Men's Player of the Year",
                "UEFA Champions League top scorer", "Premier League Player of the Season"]
TEAM_TROPHIES = ["FIFA World Cup", "UEFA Champions League", "UEFA European Championship", "Copa América",
                 "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "UEFA Europa League"]

def is_reserve(name):  # B / C / II / III reserve sides
    return bool(re.search(r"\b(?:[BC]|I{2,3}|IV)$", name)) or "reserve" in name.lower() or name.endswith(" Castilla")

def pick_honour(bullets):
    # EXACT label match only — a substring would count "Ballon d'Or nominee" / "...Dream Team" /
    # "Gerd Müller Trophy (Ballon d'Or Striker...)" as winning the Ballon d'Or. It must be the award.
    low = [b.strip().lower() for b in bullets]
    for a in INDIV_AWARDS:
        if a.lower() in low:
            return f"Won {a}." if a.lower().startswith("the ") else f"Won the {a}."
    for t in TEAM_TROPHIES:
        if t.lower() in low:
            return f"Has won the {t}."
    return None

def make_clues(nat, role, by, career, bullets):
    """Ordered hard -> easy (no difficulty tiers). `role` is a readable position word.
    Clue 1 is deliberately BROAD — position + era only. Nationality is held back to clue 3, because
    'Belgian midfielder' / 'Argentine forward' gives the answer away on the very first clue."""
    clues = []
    seniors, prev = [], None
    for _, c, loan in career:                       # senior, non-loan, non-reserve, de-duped
        if loan or is_reserve(c) or c == prev: continue
        seniors.append(c); prev = c
    # 1) broadest: position + era, NO nationality
    c1 = f"A {role}"
    if by: c1 += f", born in the {by // 10 * 10}s"
    clues.append(c1 + ".")
    # 2) first senior club (specific, often non-obvious)
    if seniors:
        clues.append(f"Began his senior career at {seniors[0]}.")
    # 3) nationality, on its own and later in the reveal
    demo = DEMONYM.get(nat)
    if demo:
        clues.append(f"He's {demo}.")
    # 4) a major honour
    hon = pick_honour(bullets)
    if hon: clues.append(hon)
    # 5) the giveaway: full senior club path
    if len(seniors) >= 2:
        clues.append("Club path: " + " → ".join(seniors) + ".")
    return clues


def main():
    data = json.load(open(os.path.join(HERE, "..", "data", "squads.json"), encoding="utf-8"))
    cln = {i: c["name"] for i, c in enumerate(data["clubs"])}
    info = data["playerInfo"]
    clubs_of = {}
    for s in data["seasons"]:
        for cid, r in data["rosters"][s].items():
            for p in r["p"]:
                clubs_of.setdefault(p["d"], set()).add(cln[int(cid)])
    ranked = sorted((d for d in info if (info[d].get("o") or 0) >= 82 and d in clubs_of),
                    key=lambda d: -info[d]["o"])
    out, used = [], 0
    for disp in ranked:
        if used >= N:
            break
        title, w = resolve_article(disp, clubs_of[disp])
        if not title:
            print(f"  ⚠ no confident article for {disp} (o={info[disp]['o']}) — skipped")
            continue
        f = infobox(w); bullets = honours(w)
        nat = info[disp].get("nat") or clean(f.get("nationalteam1", ""))
        role = position_from_text(clean(f.get("position", ""))) or position_word(info[disp].get("pos") or "")
        clues = make_clues(nat, role, birth_year(f), senior_career(f), bullets)
        out.append({"answer": title, "ourName": disp, "overall": info[disp]["o"], "clues": clues})
        used += 1
        print(f"\n● {title}  (our: {disp}, ovr {info[disp]['o']})")
        for n, c in enumerate(clues, 1):
            print(f"   {n}. {c}")
        time.sleep(0.3)
    json.dump(out, open(os.path.join(HERE, "..", "data", "player-clues.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"\nwrote {len(out)} dossiers -> data/player-clues.json")


if __name__ == "__main__":
    main()
