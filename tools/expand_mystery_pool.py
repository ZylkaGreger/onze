#!/usr/bin/env python3
"""
Grow the Mystery-player pool without disturbing the daily rotation.

scrape_player_clues.py draws the pool from players with an EA rating of 82+, and EA ratings only
exist from FIFA 17 on — so the whole 2006-2016 generation (Ronaldinho, Kaká, Henry, Totti,
Gerrard, Pirlo…) could never be a Mystery player, although every one of them is in squads.json.

This ranks EVERY player in squads.json by a rating-free fame signal, English Wikipedia pageviews
over the last 60 days; verifies each candidate's article is the same person (its infobox clubs must
overlap the clubs we actually have him at, which is what stops "Pedro" resolving to the wrong one);
builds clues through the very same make_clues() as the rest of the pool; and APPENDS the new entries
with `added`, so game.js folds them in at POOL_CUTOVER instead of reshuffling every future day.

    python3 tools/expand_mystery_pool.py 150 --dry-run     # show who would be added
    python3 tools/expand_mystery_pool.py 150               # append them to data/player-clues.json
"""
import importlib.util, json, os, re, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("clues", os.path.join(HERE, "scrape_player_clues.py"))
C = importlib.util.module_from_spec(spec); sys.argv, _argv = ["x", "0"], sys.argv; spec.loader.exec_module(C); sys.argv = _argv

CUTOVER = "2026-11-02"          # keep in step with POOL_CUTOVER in game.js
RANK_CACHE = os.path.join(HERE, ".mystery-ranking.json")   # the slow part; gitignored, reuse with --reuse-ranking

# Pageviews measure notoriety as well as fame. These players rank on criminal cases or on a family
# name rather than on football, and a daily guessing game is no place for them. Extend by hand.
EXCLUDE = {"Ched Evans", "Adam Johnson (footballer)", "Al-Saadi Gaddafi", "Joey Barton", "Mason Greenwood",
           "Benjamin Mendy", "Thomas Partey", "Marlon King", "Lee Hughes", "Luke McCormick"}


def pageviews(titles):
    """{requested title: (final title, 60-day views, is_disambiguation)} for up to 50 titles."""
    # The API fills pageviews for only part of a batch (pages come back title-sorted) and returns a
    # continuation for the rest. Ignoring it scored every later title zero, which ranked the whole
    # pool alphabetically: Anthony, Bradley, Ainsley — and no Ronaldinho, Henry or Totti.
    params = {"action": "query", "prop": "pageviews|pageprops", "ppprop": "disambiguation",
              "redirects": 1, "titles": "|".join(titles), "formatversion": 2}
    q, views = {}, {}
    while True:
        d = C.api(params)
        part = d.get("query", {})
        for k in ("normalized", "redirects"):
            q.setdefault(k, []).extend(part.get(k, []))
        for p in part.get("pages", []):
            q.setdefault("pages_by", {}).setdefault(p["title"], p)
            if p.get("pageviews"):
                views[p["title"]] = sum(v or 0 for v in p["pageviews"].values())
        if "continue" not in d:
            break
        params = {**params, **d["continue"]}
        time.sleep(0.1)
    q["pages"] = list(q.get("pages_by", {}).values())
    final = {t: t for t in titles}
    for k in ("normalized", "redirects"):
        for r in q.get(k, []):
            for t, f in final.items():
                if f == r["from"]: final[t] = r["to"]
    pages = {p["title"]: p for p in q.get("pages", [])}
    out = {}
    for t, f in final.items():
        p = pages.get(f)
        if not p or p.get("missing") or p.get("invalid"):
            continue
        out[t] = (f, views.get(f, 0), "disambiguation" in (p.get("pageprops") or {}))
    return out


def main():
    want = int(next((a for a in sys.argv[1:] if a.isdigit()), "150"))
    dry = "--dry-run" in sys.argv
    data = json.load(open(os.path.join(HERE, "..", "data", "squads.json"), encoding="utf-8"))
    pool_path = os.path.join(HERE, "..", "data", "player-clues.json")
    pool = json.load(open(pool_path, encoding="utf-8"))
    have_titles = {e["answer"] for e in pool}
    have_names = {e.get("ourName") for e in pool}
    info = data.get("playerInfo", {})
    cln = {i: c["name"] for i, c in enumerate(data["clubs"])}
    clubs_of, stints_of = {}, {}
    for s in data["seasons"]:
        for cid, r in data["rosters"][s].items():
            for p in r["p"]:
                clubs_of.setdefault(p["d"], set()).add(cln[int(cid)])
                stints_of.setdefault(p["d"], set()).add((C.ckey(cln[int(cid)]), int(s[:4])))

    cands = [n for n in clubs_of if n not in have_names]
    base = {n: n.split(" (")[0].strip() for n in cands}           # "João Pedro (Chelsea)" -> "João Pedro"
    if "--reuse-ranking" in sys.argv and os.path.exists(RANK_CACHE):
        ranked = [(n, tuple(v)) for n, v in json.load(open(RANK_CACHE, encoding="utf-8")) if n in clubs_of]
        print(f"reusing ranking of {len(ranked)} from {RANK_CACHE}", file=sys.stderr)
    else:
        ranked = rank(cands, base)
    return build(ranked, want, dry, pool, pool_path, have_titles, info, clubs_of, stints_of)


def rank(cands, base):
    print(f"{len(cands)} candidates not yet in the pool; ranking by pageviews…", file=sys.stderr)
    best = {}
    variants = [(n, t) for n in cands for t in (base[n], base[n] + " (footballer)")]
    for i in range(0, len(variants), 50):
        chunk = variants[i:i + 50]
        try:
            pv = pageviews(list(dict.fromkeys(t for _, t in chunk)))
        except Exception as e:                                    # one bad batch must not sink the run
            print(f"  ! batch {i // 50}: {e}", file=sys.stderr); continue
        for n, t in chunk:
            if t in pv and not pv[t][2]:
                f, v, _ = pv[t]
                if v > best.get(n, ("", -1))[1]:
                    best[n] = (f, v)
        time.sleep(0.15)
    ranked = sorted(best.items(), key=lambda kv: -kv[1][1])
    json.dump(ranked, open(RANK_CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{len(ranked)} resolvable", file=sys.stderr)
    return ranked


def years_of(y):
    """'1987–1992' -> (1987, 1992); '2019–' / '2019–present' -> (2019, 9999); '2010' -> (2010, 2010)."""
    ys = [int(v) for v in re.findall(r"\b(1[89]\d\d|20\d\d)\b", y or "")]
    if not ys:
        return None
    open_ended = len(ys) == 1 and re.search(r"[–-]\s*(present)?\s*$", y or "")
    return ys[0], (9999 if open_ended else ys[-1])


def same_era(career, stints):
    """True if some infobox stint covers a season we actually have him at that club. Club names
    alone are not enough: "Ancelotti" listed in a 2007-08 Milan table resolved to Carlo Ancelotti,
    whose Milan was 1987-92, and passed."""
    for yrs, club, _ in career:
        span = years_of(yrs)
        if not span:
            continue
        k = C.ckey(club)
        if any(ck == k and span[0] - 1 <= y <= span[1] + 1 for ck, y in stints):
            return True
    return False


def build(ranked, want, dry, pool, pool_path, have_titles, info, clubs_of, stints_of):
    print("verifying and building clues…", file=sys.stderr)
    added, seen = [], set()
    for name, (title, views) in ranked:
        if len(added) >= want:
            break
        if title in have_titles or title in seen or title in EXCLUDE:
            continue
        # Pageviews reward hype as well as a career: academy prospects with one season in our data
        # ranked next to Totti. A Mystery player has to be guessable by an engaged fan.
        if len({y for _, y in stints_of[name]}) < 3:
            continue
        try:
            d = C.api({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                       "redirects": 1, "titles": title, "formatversion": 2})
            w = d["query"]["pages"][0]["revisions"][0]["slots"]["main"]["content"]
        except Exception:
            continue
        f = C.infobox(w)
        career = C.senior_career(f)
        theirs = {C.ckey(c) for _, c, _ in career}
        ours = {C.ckey(c) for c in clubs_of[name]}
        if not career or not (theirs & ours):
            print(f"  ✗ {name} → {title}: infobox clubs don't match ours — skipped", file=sys.stderr)
            continue
        if not same_era(career, stints_of[name]):
            print(f"  ✗ {name} → {title}: right clubs, wrong years — skipped", file=sys.stderr)
            continue
        ns = C.senior_nations(f)
        nat = ns[0] if ns else ((info.get(name) or {}).get("nat") or "")
        role = C.position_from_text(C.clean(f.get("position", ""))) or C.position_word((info.get(name) or {}).get("pos") or "")
        clues = C.make_clues(nat, role, C.birth_year(f), career, C.honours(w), ns[1] if len(ns) > 1 else None)
        if not any(c.startswith("Club path:") for c in clues) or len(clues) < 4:
            print(f"  ✗ {title}: too few clues to be fair ({len(clues)}) — skipped", file=sys.stderr)
            continue
        seen.add(title)
        added.append({"answer": title, "ourName": name, "overall": (info.get(name) or {}).get("o") or None,
                      "clues": clues, "added": CUTOVER, "fame": views})
        print(f"  ✓ {title:32} {views:>9,} views/60d", file=sys.stderr)
        time.sleep(0.3)

    if dry:
        json.dump(added, sys.stdout, ensure_ascii=False, indent=1)
        return
    json.dump(pool + added, open(pool_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"appended {len(added)} -> {len(pool) + len(added)} in data/player-clues.json", file=sys.stderr)


if __name__ == "__main__":
    main()
