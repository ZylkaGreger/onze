#!/usr/bin/env python3
"""
Add the second generation of Mystery clues to every player already in the pool.

New clue types, all read from the player's {{Infobox football biography}}:
  - later managed     "Went into management — his first job was Derby County."
  - youth academy     "Came through the youth ranks at Ajax." / "Came through Barcelona's academy."
  - league goals      "Scored 200+ league goals in his career."  (rounded down to a 50; never for keepers)
  - birthplace        "Born in Marseille, France."
  - shirt number      "Currently wears the number 9 shirt."     (active players only)
Height and international caps are deliberately absent: Peter ruled both out.

The guess budget in Mystery equals the number of clues, so the new types cannot simply be added
on top — every puzzle would get easier. Each player gets `clues2`: the role/era clue first, the club
path last (the giveaway), and at most five in between, alternating new and existing kinds so every
puzzle keeps a mix. game.js switches to clues2 from CLUES2_FROM, so a puzzle already in play never
changes under anyone.

Also marks `legend` for Legends Sunday: born 1983 or earlier (or retired by 2021) AND covered by at
least LEGEND_LANGS Wikipedia language editions. Stores `born` and `langs`.
Never adds, removes or reorders entries: the daily rotation depends on both.

    python3 tools/enrich_mystery_clues.py --dry-run     # samples + counts, writes nothing
    python3 tools/enrich_mystery_clues.py               # writes clues2/legend/born in place
"""
import importlib.util, json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("clues", os.path.join(HERE, "scrape_player_clues.py"))
C = importlib.util.module_from_spec(spec); sys.argv, _argv = ["x", "0"], sys.argv; spec.loader.exec_module(C); sys.argv = _argv

POOL = os.path.join(HERE, "..", "data", "player-clues.json")
NOT_A_FIRST_JOB = re.compile(r"assistant|caretaker|interim|youth|reserve|academy|\bu-?\d\d\b|under-?\d\d|\bii\b|\bb\b|women|player-coach", re.I)
MIDDLE = 5
LEGEND_LANGS = 55          # Wikipedia language editions; Beckham 117, Totti 116, Matuidi 56, Crouch 54


def numbered(f, key):
    return [(n, C.field(f, f"{key}{n}")) for n in range(1, 40) if C.field(f, f"{key}{n}")]


def first_job(f):
    for n, raw in numbered(f, "managerclubs"):
        txt = C.clean(raw)
        # A permanent first-team job is written as a plain club name. Any qualifier — assistant,
        # caretaker, "technical trainer" (which put Wosz in charge of Bochum) — means it was not one.
        if "(" in raw or "(" in txt:
            continue
        if txt and not NOT_A_FIRST_JOB.search(raw + " " + txt):
            return re.sub(r"\s*\(.*?\)\s*", "", txt).strip()
    return None


def academy(f):
    ys = [C.clean(v) for _, v in numbered(f, "youthclubs")]
    ys = [re.sub(r"\s*\(.*?\)\s*", "", y).strip() for y in ys if y]
    return ys[-1] if ys else None


def league_goals(f):
    total, any_num = 0, False
    for n, _ in numbered(f, "clubs"):
        g = re.match(r"\s*(\d+)", C.clean(f.get(f"goals{n}", "")))
        if g:
            total += int(g.group(1)); any_num = True
    return total if any_num else None


def birthplace(f):
    p = C.clean(f.get("birth_place", ""))
    p = re.sub(r"\s*\(.*?\)\s*", " ", p).strip(" ,")
    parts = [x.strip() for x in p.split(",") if x.strip()]
    if not parts:
        return None
    p = ", ".join([parts[0], parts[-1]] if len(parts) > 1 else parts)
    return p if 2 < len(p) <= 45 else None


def shirt(f):
    if not C.field(f, "currentclub"):
        return None
    m = re.fullmatch(r"\d{1,2}", C.clean(C.field(f, "clubnumber")))
    return m.group(0) if m else None


def years_open(career):
    last = 0
    for yrs, _, _ in career:
        ys = [int(y) for y in re.findall(r"\b(19\d\d|20\d\d)\b", yrs)]
        if not ys:
            continue
        if len(ys) == 1 and re.search(r"[–-]\s*(present)?\s*$", yrs):
            return True, 9999
        last = max(last, ys[-1])
    return False, last


def kind(c):
    for k, pat in (("path", r"^Club path:"), ("began", r"^Began his senior career at "), ("nat", r"^He's "),
                   ("two", r"^Played for two national teams"), ("shape", r"^(A one-club man|Well-travelled)"),
                   ("mid", r"^Also had a spell at "), ("honour", r"^(Has won|Won) "), ("role", r"^An? .*\.$")):
        if re.search(pat, c):
            return k
    return "other"


def build(entry, f, career):
    old = entry["clues"]
    by_kind = {}
    for c in old:
        by_kind.setdefault(kind(c), []).append(c)
    role = (by_kind.get("role") or [None])[0]
    path = (by_kind.get("path") or [None])[0]
    one_club = any(c == "A one-club man." for c in old)
    seniors = [c for _, c, loan in career if not loan]
    first = seniors[0] if seniors else None

    new = []
    job = first_job(f)
    if job:
        new.append(f"Went into management — his first job was {job}.")
    acad = academy(f)
    began = (by_kind.get("began") or [None])[0]
    if acad and not (one_club and C.ckey(acad) == C.ckey(first or "")):     # would name a one-club man's club
        if first and C.ckey(acad) == C.ckey(first):
            new.append(f"Came through {acad}'s academy.")
            began = None                                                     # same fact, said better
        else:
            new.append(f"Came through the youth ranks at {acad}.")
    goals = league_goals(f)
    if goals and goals >= 100 and not (role or "").startswith("A goalkeeper"):
        new.append(f"Scored {goals // 50 * 50}+ league goals in his career.")
    bp = birthplace(f)
    if bp:
        new.append(f"Born in {bp}.")
    num = shirt(f)
    if num:
        new.append(f"Currently wears the number {num} shirt.")

    ns = C.senior_nations(f)
    if ns:
        demo = C.DEMONYM.get(ns[0]) or (C.DEMONYM.get(ns[1]) if len(ns) > 1 else None)
        by_kind["nat"] = [f"He's {demo}."] if demo else by_kind.get("nat", [])
        by_kind["two"] = [f"Played for two national teams: {ns[0]}, then {ns[1]}."] if len(ns) > 1 else []
    else:
        by_kind["two"] = []                      # the old clue may name youth sides only
    existing = [c for k in ("honour", "nat", "began", "mid", "shape", "two")
                for c in ([began] if k == "began" else by_kind.get(k, [])) if c]
    middle, ni, ei = [], 0, 0
    while len(middle) < MIDDLE and (ni < len(new) or ei < len(existing)):
        if ni < len(new) and (len(middle) % 2 == 0 or ei >= len(existing)):
            middle.append(new[ni]); ni += 1
        elif ei < len(existing):
            middle.append(existing[ei]); ei += 1
    return [c for c in [role, *middle, path] if c], new


def main():
    dry = "--dry-run" in sys.argv
    pool = json.load(open(POOL, encoding="utf-8"))
    stats, samples, failed = {}, {}, []
    for i, e in enumerate(pool):
        try:
            d = C.api({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                       "redirects": 1, "titles": e["answer"]})
            w = d["query"]["pages"][0]["revisions"][0]["slots"]["main"]["content"]
        except Exception:
            failed.append(e["answer"]); e["clues2"] = e["clues"]; continue
        f = C.infobox(w)
        career = C.senior_career(f)
        e["clues2"], new = build(e, f, career)
        by = C.birth_year(f)
        active, last = years_open(career)
        e["born"] = by or None
        of_age = bool(by and (by <= 1983 or (not active and not C.field(f, "currentclub") and last and last <= 2021)))
        e["legend"] = False
        if of_age:
            # Age makes a player eligible; stature makes him a legend. Pageviews were the wrong
            # ruler (they kept TV pundits and current managers and dropped Vieira and Seedorf).
            # How many Wikipedia language editions cover him tracks lasting international fame.
            ll = C.api({"action": "query", "prop": "langlinks", "lllimit": "max", "redirects": 1, "titles": e["answer"]})
            e["langs"] = len(ll["query"]["pages"][0].get("langlinks") or [])
            e["legend"] = e["langs"] >= LEGEND_LANGS
        for c in new:
            k = c.split(" ")[0] + " " + c.split(" ")[1]
            stats[k] = stats.get(k, 0) + 1
        if e["answer"] in ("Frank Lampard", "Thierry Henry", "Francesco Totti", "Lionel Messi", "Harry Kane", "Dariusz Wosz", "Bukayo Saka"):
            samples[e["answer"]] = e["clues2"]
        if i % 50 == 0:
            print(f"  {i}/{len(pool)}", file=sys.stderr)
        time.sleep(0.15)
    print(json.dumps({"new clue kinds added": stats, "legends": sum(1 for e in pool if e.get("legend")),
                      "clue counts": {n: sum(1 for e in pool if len(e["clues2"]) == n) for n in range(2, 9)},
                      "fetch failures": failed}, ensure_ascii=False, indent=1))
    for k, v in samples.items():
        print(f"\n{k}:"); [print("  -", c) for c in v]
    if not dry:
        json.dump(pool, open(POOL, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"\nwrote clues2/legend/born for {len(pool)} entries", file=sys.stderr)


if __name__ == "__main__":
    main()
