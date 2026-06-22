#!/usr/bin/env python3
"""Fill La Liga squads from es.wikipedia's season-wide roster pages.

English Wikipedia has no season article for most smaller La Liga clubs (Sevilla,
Getafe, Osasuna, … in the late-2000s), so those clubs were missing entirely. The
Spanish Wikipedia instead has a single page per season listing EVERY club's squad:

    Anexo:Plantillas de la Primera División de España YYYY-YY

Only three of these exist and are populated: 2008-09 (stub — only Barça/Madrid),
2009-10 and 2010-11 (full, all 20 clubs). This tool parses those pages and MERGES
the clubs/players into tools/wiki-seasons/<season>-la-liga.json (union with the
en.wikipedia data already there), so build-data.mjs picks them up unchanged.

Usage:  python3 tools/scrape_es_laliga.py            # 2009-10 + 2010-11 (the full pages)
        python3 tools/scrape_es_laliga.py --season 2010-11

Reuses clean_link / is_player_name from scrape_wiki_squads.py for one validation gate.
"""
import argparse
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import importlib.util

import certifi

HERE = os.path.dirname(__file__)
SSL_CTX = ssl.create_default_context(cafile=certifi.where())
UA = "OnzeBot/1.0 (https://onzedaily.com; petmyr67@gmail.com) squad-data research"
API = "https://es.wikipedia.org/w/api.php"

# borrow the player-name gate + link cleaner from the en scraper (single source of truth)
_spec = importlib.util.spec_from_file_location("sw", os.path.join(HERE, "scrape_wiki_squads.py"))
sw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sw)

# es.wikipedia club link-target -> the canonical name our dataset already uses, for the
# clubs whose Spanish spelling wouldn't match the en./EA name (else they'd split into two).
CLUB_ALIAS = {
    "Athletic Club": "Athletic Bilbao",
    "RCD Español": "RCD Espanyol",
    "Real Sporting de Gijón": "Sporting de Gijón",
    "Real Madrid": "Real Madrid C.F.",
    "Real Sociedad de Fútbol": "Real Sociedad",
    "Atlético de Madrid": "Atlético Madrid",
}
SEASONS_WITH_FULL_PAGE = ["2009-10", "2010-11"]   # 2008-09 page is a 2-club stub

# club-name normaliser faithful to build-data.mjs matchClub (strip dots/accents, drop club-type
# tokens + bare numbers) so es names union into the en club already in the file instead of
# splitting (e.g. "Real Madrid C.F." <-> "Real Madrid CF"). "real" is kept, matching the build.
_CLUB_DROP = set("fc cf afc sc ssc ss as ac us uc rc cd ud sv sd vfl vfb tsg fsv bsc rcd acf "
                 "cfc bc spvgg ogc fco hsc aj sco osc ca stade deportivo olympique alsace "
                 "balompie de club calcio".split())


def _match_club(name):
    import unicodedata
    n = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower()
    n = re.sub(r"[.'’]", "", n)
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    return " ".join(t for t in n.split() if t and not t.isdigit() and t not in _CLUB_DROP)


def es_wikitext(title):
    url = API + "?" + urllib.parse.urlencode({
        "action": "parse", "page": title, "prop": "wikitext",
        "redirects": "1", "format": "json", "formatversion": "2"})
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
                data = json.loads(r.read().decode("utf-8"))
            if "error" in data:
                return None
            return data.get("parse", {}).get("wikitext", "")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise last


def parse_anexo(wikitext):
    """{canonical_club_name: [player display names]} from one Anexo page.

    Clubs are level-2 headers '== [[Club|Disp]] =='. Each club's squad is a wikitable
    whose player cell is '{{Bandera|País}} [[Player|Disp]]' — one player per table row.
    """
    out = {}
    hdrs = list(re.finditer(r"^==\s*\[\[([^\]]+?)\]\]\s*==\s*$", wikitext, re.M))
    for k, h in enumerate(hdrs):
        club = h.group(1).split("|")[0].strip()
        club = CLUB_ALIAS.get(club, club)
        body = wikitext[h.end(): hdrs[k + 1].start() if k + 1 < len(hdrs) else len(wikitext)]
        players, seen = [], set()
        for line in body.splitlines():
            if not line.lstrip().startswith("|"):
                continue
            m = re.search(r"\{\{\s*[Bb]andera[^}]*\}\}\s*'*\[\[([^\]]+?)\]\]", line)
            if not m:
                continue
            name = sw.clean_link("[[" + m.group(1) + "]]")
            if sw.is_player_name(name) and name.lower() not in seen:
                seen.add(name.lower())
                players.append(name)
        if len(players) >= 11:                       # ignore stub/partial club sections
            out[club] = players
    return out


def _dedupe_clubs(clubs):
    """Collapse club entries that normalise to the same club (e.g. the en scraper sometimes
    emits both 'Real Madrid CF' and 'Real Madrid C.F.' from the standings). Keep the cleaner
    name (fewest punctuation chars, then shorter) and union the players."""
    groups = {}
    for name in clubs:
        groups.setdefault(_match_club(name), []).append(name)
    out, collapsed = {}, []
    for variants in groups.values():
        keep = min(variants, key=lambda n: (len(re.findall(r"[^a-z0-9 ]", n.lower())), len(n)))
        players, seen = [], set()
        for v in variants:
            for p in clubs[v]:
                if p.lower() not in seen:
                    seen.add(p.lower()); players.append(p)
        out[keep] = players
        if len(variants) > 1:
            collapsed.append(f"{'+'.join(variants)} -> {keep}")
    return out, collapsed


def merge_into_season_file(season_dash, squads, min_squad=11):
    """Union the es squads into tools/wiki-seasons/<season>-la-liga.json."""
    season_slash = season_dash.replace("-", "/")
    # the file is named with the slash-season turned into dashes for both parts:
    fname = f"{season_dash}-la-liga.json"
    path = os.path.join(HERE, "wiki-seasons", fname)
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    clubs = doc["clubs"]
    by_norm = {_match_club(k): k for k in clubs}        # canonical-key -> existing file key
    added, enriched = [], []
    for club, players in squads.items():
        existing = by_norm.get(_match_club(club))
        if existing:                                    # union into the club already in the file
            before = len(clubs[existing])
            have = {p.lower() for p in clubs[existing]}
            clubs[existing].extend(p for p in players if p.lower() not in have)
            if len(clubs[existing]) > before:
                enriched.append(f"{existing} +{len(clubs[existing]) - before}")
        else:
            clubs[club] = players
            by_norm[_match_club(club)] = club
            added.append(club)
    doc["clubs"], collapsed = _dedupe_clubs(clubs)
    note = (" + es.wikipedia 'Anexo:Plantillas de la Primera División' "
            "(full-season squad page) merged for missing/partial clubs")
    if note not in doc.get("_source", ""):
        doc["_source"] = doc.get("_source", "") + note
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False)
    return len(doc["clubs"]), added, enriched, collapsed


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", help="single season e.g. 2010-11 (default: the full pages)")
    args = ap.parse_args()
    seasons = [args.season] if args.season else SEASONS_WITH_FULL_PAGE
    for yy in seasons:
        w = es_wikitext(f"Anexo:Plantillas de la Primera División de España {yy}")
        if not w:
            print(f"{yy}: page not found"); continue
        squads = parse_anexo(w)
        total, added, enriched, collapsed = merge_into_season_file(yy, squads)
        print(f"{yy}: parsed {len(squads)} clubs from es.wiki -> file now {total} clubs")
        if added:     print(f"   ADDED ({len(added)}): {', '.join(sorted(added))}")
        if enriched:  print(f"   enriched: {', '.join(sorted(enriched))}")
        if collapsed: print(f"   deduped: {', '.join(collapsed)}")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
