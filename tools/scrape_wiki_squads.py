#!/usr/bin/env python3
"""
scrape_wiki_squads.py — pull season squads from English Wikipedia, zero deps.

Why this exists
---------------
Doing the scrape by hand through an LLM fetch tool is expensive and hits a
truncation wall on big clubs (Bayern, Real Madrid…) whose season pages are huge.
That truncation is a limitation of the *fetch tool*, not of Wikipedia: the
MediaWiki API returns the full page wikitext regardless of size. So a plain
script that talks to the API directly avoids the whole problem and costs nothing.

What it does
------------
For a (league, season):
  1. Fetch the league season page ("2014–15 Bundesliga") and read the
     participating clubs straight from the standings table — this gives the
     canonical club article titles (e.g. "Bayer 04 Leverkusen", not "Bayer
     Leverkusen"), so we never have to guess page titles.
  2. For each club, fetch its season page ("2014–15 Bayer 04 Leverkusen season")
     and extract every player from the {{fs player}} squad templates.
  3. Write data/wiki-seasons/<season>-<league>.json in the same shape the
     existing 2014-15-bundesliga.json test file uses.

Usage
-----
  python3 tools/scrape_wiki_squads.py --league bundesliga --season 2014/15
  python3 tools/scrape_wiki_squads.py --league premier-league --seasons 2006/07-2015/16
  python3 tools/scrape_wiki_squads.py --all --seasons 2006/07-2015/16   # all 5 leagues

Output goes to tools/wiki-seasons/ by default (override with --out).
"""

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

API = "https://en.wikipedia.org/w/api.php"
UA = "OnzeSquadScraper/1.0 (https://onzedaily.com; petmyr67@gmail.com)"

# macOS python.org builds don't trust the system cert store; prefer certifi's
# CA bundle when present so HTTPS verification works out of the box.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:  # pragma: no cover - falls back to system defaults
    SSL_CTX = ssl.create_default_context()

# league key -> (Wikipedia league-page suffix, league_id used by the Onze build)
LEAGUES = {
    "premier-league": ("Premier League", 13),
    "la-liga":        ("La Liga", 53),
    "bundesliga":     ("Bundesliga", 19),
    "serie-a":        ("Serie A", 31),
    "ligue-1":        ("Ligue 1", 16),
}

EN_DASH = "–"


def norm_season(s):
    """Accept 2014/15, 2014-15, 2014–15 -> canonical '2014–15' (en dash)."""
    s = s.strip().replace("/", "-").replace(EN_DASH, "-")
    m = re.match(r"^(\d{4})-(\d{2,4})$", s)
    if not m:
        raise ValueError(f"bad season: {s!r} (want e.g. 2014/15)")
    start, end = m.group(1), m.group(2)
    if len(end) == 4:  # 2014-2015 -> 15
        end = end[2:]
    return f"{start}{EN_DASH}{end}"


def season_range(spec):
    """'2006/07-2015/16' -> ['2006–07', ..., '2015–16']. Single season also ok."""
    if "-" in spec and spec.count("/") == 2:
        a, b = spec.split("-", 1) if spec.count("-") == 1 else (None, None)
    # support "2006/07-2015/16": split on the dash that sits between two slashed pairs
    parts = re.findall(r"\d{4}/\d{2,4}", spec)
    if len(parts) == 2:
        y0 = int(parts[0][:4])
        y1 = int(parts[1][:4])
        return [norm_season(f"{y}/{str(y+1)[2:]}") for y in range(y0, y1 + 1)]
    return [norm_season(spec)]


def api_get(params):
    params = dict(params)
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        return json.loads(r.read().decode("utf-8"))


def get_wikitext(page):
    """Full page wikitext, following redirects. None if the page doesn't exist."""
    data = api_get({
        "action": "parse",
        "page": page,
        "prop": "wikitext",
        "redirects": "1",
    })
    if "error" in data:
        return None
    return data.get("parse", {}).get("wikitext", "")


def clean_link(raw):
    """'[[Foo (footballer)|Foo]]' / '[[Foo]]' / 'Foo' -> display name."""
    raw = raw.strip()
    m = re.search(r"\[\[([^\]]+)\]\]", raw)
    if m:
        inner = m.group(1)
        name = inner.split("|", 1)[1] if "|" in inner else inner
    else:
        name = raw
    name = re.sub(r"\{\{[^}]*\}\}", "", name)        # stray templates
    name = name.split("{{")[0]                        # cut trailing cite/ref residue
    name = re.sub(r"<[^>]+>", "", name)              # html / refs
    name = re.sub(r"\([^)]*footballer[^)]*\)", "", name, flags=re.I)  # disambig
    name = re.sub(r"['\"]+", "", name)                # italic/bold quote marks
    name = re.sub(r"[\[\]{}]", "", name)              # residual brackets/braces
    return re.sub(r"\s+", " ", name).strip()


def extract_clubs(league_wikitext):
    """Club article titles from a season league page's standings table.

    MediaWiki standings use {{#invoke:sports table}} with one
    'name_XXX = [[Club article]]' line per team. That gives canonical titles.
    """
    titles = []
    seen = set()
    for m in re.finditer(r"\bname_[A-Za-z0-9]+\s*=\s*(\[\[[^\]]+\]\])", league_wikitext):
        title = clean_link(m.group(1))
        # link target (article title), not the display alias, so the season-page
        # title resolves; prefer the part before any '|'
        inner = re.search(r"\[\[([^\]]+)\]\]", m.group(1)).group(1)
        article = inner.split("|", 1)[0].strip()
        if article and article not in seen:
            seen.add(article)
            titles.append(article)
    return titles


HEADER_RE = re.compile(r"^(={2,})\s*(.*?)\s*\1\s*$", re.M)

# headers whose players are NOT the first-team squad
EXCLUDE_HDR = re.compile(r"loan|reserve|youth|amateur|\bii\b|\bb team\b|transfer|\bout\b",
                         re.I)
# template / table markers that indicate a player list lives in a section
PLAYER_TMPL = re.compile(r"\{\{\s*(?:nat\s+)?e?fs player|\{\{\s*fb si player", re.I)
TABLE_ROW = re.compile(r"\|\s*'{0,3}\s*\d+\s*'{0,3}\s*\|\|\s*\[\[")
# "Squad statistics" sortable tables (Man Utd, Liverpool, Chelsea, many SP/IT pages)
# list each player as  {{flagicon|XXX}} [[Player]]  in the Name cell.
FLAG_LINK = re.compile(r"\{\{\s*flag(?:icon|country)?[^}]*\}\}\s*'*\[\[([^\]]+?)\]\]", re.I)
FLAGICON = re.compile(r"\{\{\s*flag(?:icon|country)?\b[^}]*\}\}", re.I)
WIKITABLE = re.compile(r"\{\|\s*class=\"[^\"]*wikitable", re.I)


# Nationality columns leak country wikilinks ([[England]], [[United States]]);
# block the footballing nations so they can't be mistaken for players.
COUNTRIES = frozenset(c.lower() for c in (
    "England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland",
    "Ireland", "France", "Germany", "Spain", "Italy", "Portugal", "Netherlands",
    "Belgium", "Switzerland", "Austria", "Denmark", "Sweden", "Norway", "Finland",
    "Iceland", "Poland", "Czech Republic", "Slovakia", "Hungary", "Romania",
    "Bulgaria", "Greece", "Turkey", "Russia", "Ukraine", "Croatia", "Serbia",
    "Slovenia", "Bosnia and Herzegovina", "Montenegro", "North Macedonia",
    "Macedonia", "Albania", "Kosovo", "Georgia", "Armenia", "Azerbaijan",
    "Brazil", "Argentina", "Uruguay", "Paraguay", "Chile", "Colombia", "Peru",
    "Ecuador", "Venezuela", "Bolivia", "Mexico", "United States", "Canada",
    "Costa Rica", "Honduras", "Jamaica", "Trinidad and Tobago", "Japan",
    "South Korea", "Korea Republic", "China", "Australia", "New Zealand", "Iran",
    "Iraq", "Saudi Arabia", "Israel", "Egypt", "Morocco", "Algeria", "Tunisia",
    "Nigeria", "Ghana", "Cameroon", "Ivory Coast", "Senegal", "Mali",
    "Burkina Faso", "Togo", "Gabon", "DR Congo", "Congo", "Angola",
    "South Africa", "Zambia", "Guinea", "Cape Verde", "Curaçao", "Suriname",
    "Luxembourg", "Cyprus", "Malta", "Estonia", "Latvia", "Lithuania",
)) | {"united states", "south korea", "ivory coast"}


def is_player_name(n):
    """Reject the non-player junk that leaks from tables (positions, clubs,
    countries, file/image links, template residue, footers, numbers). Single-token
    names are allowed — mononyms (Amauri, Hulk, Pato) and surname-display links
    ([[Shay Given|Given]] -> 'Given') are real players."""
    if not n or not (2 <= len(n) <= 40):
        return False
    if re.search(r"[:/{}\[\]\d]", n) or re.fullmatch(r"[A-Z]{1,3}", n):
        return False
    if n.lower() in COUNTRIES:
        return False
    if re.search(r"\bcup\b|\bleague\b|national team|association football|"
                 r"\bF\.?C\.?\b|\bA\.?F\.?C\.?\b|\bU\.?S\.?\b|\bcalcio\b|"
                 r"goalkeeper|defender|midfielder|forward|winger|striker|"
                 r"\btotal\b|substitut|\bstart\b|\bsub\b|manager|head coach|"
                 r"captain|tactics|position", n, re.I):
        return False
    return True


def pick_squad_section(wikitext):
    """Return (slice, score) for the section most likely to be the first-team squad.

    Pages are wildly inconsistent: the canonical roster may sit under 'Squad',
    'First team squad', or 'Squad, appearances, and goals scored', while a bare
    'Squad' header sometimes holds a youth list (e.g. Bayern). We score sections
    by header and prefer the appearances/statistics table; loan/reserve/youth/II
    blocks are skipped entirely. The returned score lets the caller decide how
    much to trust table-based extraction — a low score means 'no real squad
    header found', so we must NOT mine arbitrary tables (they may be standings,
    which would emit club names as fake players).
    """
    headers = [(m.start(), m.end(), m.group(2).strip())
               for m in HEADER_RE.finditer(wikitext)]
    if not headers:
        return wikitext, 0
    candidates = []
    for i, (start, end, title) in enumerate(headers):
        body_end = headers[i + 1][0] if i + 1 < len(headers) else len(wikitext)
        body = wikitext[end:body_end]
        if EXCLUDE_HDR.search(title):
            continue
        has_players = (PLAYER_TMPL.search(body) or TABLE_ROW.search(body)
                       or FLAG_LINK.search(body)
                       or (WIKITABLE.search(body) and body.count("[[") >= 8))
        if not has_players:
            continue
        t = title.lower()
        score = 1
        if re.search(r"appearance|goals scored|squad statistic", t):
            score = 10
        elif "squad" in t or "first team" in t or "first-team" in t:
            score = 5
        elif "player" in t:
            score = 4
        candidates.append((score, len(body), body))
    if not candidates:
        return wikitext, 0
    candidates.sort(key=lambda c: (c[0], c[1]), reverse=True)
    return candidates[0][2], candidates[0][0]


def extract_squad(club_wikitext):
    """Player names from a club-season page's first-team squad section.

    Handles every markup seen across the 5 leagues:
      * {{fs player}} / {{nat fs player}} / {{Efs player}} with name=[[Player]]
      * {{fb si player |p={{sortname|First|Last}} }}
      * numbered wikitables  |'''N'''||[[Player]]||...
      * 'Squad statistics' tables  {{flagicon|XXX}} [[Player]]
      * bare wikitables (Liverpool-style) where each row's first link is the player
    Table/flag mining only runs in a section with a real squad header (score>=4),
    so standings tables can never leak club names in as players.
    """
    sec, score = pick_squad_section(club_wikitext)
    names, seen = [], set()

    def add(name):
        # single validation gate: every extraction path funnels through here, so
        # template residue / countries / positions can't leak from any of them.
        if name and is_player_name(name) and name.lower() not in seen:
            seen.add(name.lower())
            names.append(name)

    # 1. fs-family templates. Capture the FULL wikilink (incl. internal pipe) so
    #    'name=[[Article (footballer)|Display]]' resolves to 'Display'.
    for m in re.finditer(r"\|\s*name\s*=\s*(\[\[.*?\]\]|[^|}\n]+)", sec):
        ctx = sec[max(0, m.start() - 220):m.start()]
        if re.search(r"\{\{\s*(?:nat\s+)?e?fs player\b", ctx, re.I):
            add(clean_link(m.group(1)))

    # 2. {{fb si player |p={{sortname|First|Last}} }}
    if not names:
        for line in re.findall(r"\{\{\s*fb si player\b[^\n]*", sec, flags=re.I):
            sn = re.search(r"\{\{\s*sortname\s*\|\s*([^|}]+?)\s*\|\s*([^|}]+?)\s*[|}]",
                           line, flags=re.I)
            if sn:
                add(re.sub(r"\s+", " ", f"{sn.group(1)} {sn.group(2)}").strip())
                continue
            pm = re.search(r"\|\s*p\s*=\s*([^|]+)", line)
            if pm:
                add(clean_link(pm.group(1)))

    # 3. table-based extraction — ONLY inside a trusted squad section, so
    # standings/group tables can never leak club names in as players.
    #
    # Column order is wildly inconsistent across pages (Name may precede or
    # follow the position/flag/squad-no columns; some add a previous-club
    # column) and the Name cell is sometimes a [[wikilink]] and sometimes a
    # {{sortname|First|Last}} template. The invariant that holds: per row, the
    # player is the FIRST player-token — a passing wikilink OR a sortname —
    # since the Name cell precedes the previous-club/nationality cells, and
    # positions/files/numbers are filtered out. Split into rows, take the first
    # surviving token in each. The leading block is the table header — skip it.
    if not names and score >= 4:
        blocks = re.split(r"\n\s*\|-", sec)
        for block in (blocks[1:] if len(blocks) > 2 else blocks):
            # drop header cells (lines starting with '!') so colspan headers like
            # '!colspan=3|[[2010–11 Serie A]]' don't leak the competition name.
            block = "\n".join(ln for ln in block.splitlines()
                              if not ln.lstrip().startswith("!"))
            best, best_pos = None, len(block) + 1
            sn = re.search(r"\{\{\s*sortname\s*\|\s*([^|}]+?)\s*\|\s*([^|}]+?)\s*[|}]",
                           block, flags=re.I)
            if sn:
                best, best_pos = f"{sn.group(1)} {sn.group(2)}".strip(), sn.start()
            for lm in re.finditer(r"\[\[([^\]]+?)\]\]", block):
                name = clean_link("[[" + lm.group(1) + "]]")
                if is_player_name(name):
                    if lm.start() < best_pos:
                        best = name
                    break
            if best:
                add(best)

    return names


def scrape(league_key, season, sleep=0.4, min_squad=12):
    suffix, league_id = LEAGUES[league_key]
    league_page = f"{season} {suffix}"
    print(f"  league page: {league_page}", file=sys.stderr)
    lw = get_wikitext(league_page)
    if not lw:
        print(f"  !! league page not found: {league_page}", file=sys.stderr)
        return None
    clubs = extract_clubs(lw)
    print(f"  {len(clubs)} clubs found", file=sys.stderr)

    out = {}
    failures = []
    for club in clubs:
        time.sleep(sleep)
        page = f"{season} {club} season"
        cw = get_wikitext(page)
        squad = extract_squad(cw) if cw else []
        if len(squad) < min_squad:
            # missing page, or a partial parse too thin to be a real squad —
            # better dropped than polluting a puzzle with 1-3 "players".
            failures.append(club)
            why = "no squad" if not squad else f"partial ({len(squad)})"
            print(f"  !! {why}: {club} ({page})", file=sys.stderr)
            continue
        out[club] = squad
        print(f"  ok  {club}: {len(squad)} players", file=sys.stderr)

    return {
        "_source": "en.wikipedia.org via MediaWiki API (action=parse, full wikitext); "
                    "clubs from league standings, players from {{fs player}} templates",
        "league": suffix,
        "league_id": league_id,
        "season": season.replace(EN_DASH, "/")[:7].replace(EN_DASH, "/"),
        "clubs": out,
        "_failures": failures,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--league", choices=list(LEAGUES))
    ap.add_argument("--all", action="store_true", help="all five leagues")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--season", help="single season, e.g. 2014/15")
    g.add_argument("--seasons", help="range, e.g. 2006/07-2015/16")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "wiki-seasons"))
    ap.add_argument("--sleep", type=float, default=0.4, help="delay between requests (s)")
    ap.add_argument("--min", type=int, default=12,
                    help="min players to accept a club; fewer = treat as a failed "
                         "(partial) parse so it doesn't pollute puzzles")
    args = ap.parse_args()

    if not args.league and not args.all:
        ap.error("pass --league <key> or --all")

    seasons = season_range(args.seasons) if args.seasons else [norm_season(args.season)]
    leagues = list(LEAGUES) if args.all else [args.league]
    os.makedirs(args.out, exist_ok=True)

    grand_clubs = grand_players = grand_fail = 0
    for league_key in leagues:
        for season in seasons:
            print(f"\n=== {league_key} {season} ===", file=sys.stderr)
            data = scrape(league_key, season, sleep=args.sleep, min_squad=args.min)
            if not data:
                continue
            fn = f"{season.replace(EN_DASH, '-')}-{league_key}.json"
            path = os.path.join(args.out, fn)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            nclubs = len(data["clubs"])
            nplayers = sum(len(v) for v in data["clubs"].values())
            grand_clubs += nclubs
            grand_players += nplayers
            grand_fail += len(data["_failures"])
            print(f"  -> {path}  ({nclubs} clubs, {nplayers} players, "
                  f"{len(data['_failures'])} failed)", file=sys.stderr)

    print(f"\nTOTAL: {grand_clubs} clubs, {grand_players} players, "
          f"{grand_fail} club-pages with no squad parsed", file=sys.stderr)


if __name__ == "__main__":
    main()
