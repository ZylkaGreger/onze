# Slice 04 — The number

**Release:** v1 (committed) · **Effort:** ~0.5 day · **Stories:** US-004 · **job_id:** J1, J4

## Goal

Turn a career table into a verdict: one Career Score out of 100, a tier label, and three visible
component lines that sum to it.

## Learning hypothesis

**We believe** that a single headline number is what turns a private career into a comparison —
that "512 appearances, peak 78" is a record while "61 · CULT HERO" is an argument.
**We will know we are wrong if** players read the score, shrug, and do not proceed to share.

## In scope

- `scoreCareer()` in `game.js`: peak rating (max 50) + total appearances (max 25) + best-club
  fame weight (max 25), integer 0–100.
- `CAREER_TIERS` — one constant band table, v1-calibrated: Journeyman / Solid Pro / Cult Hero /
  Star / Icon.
- Results screen: score badge, tier label, three component lines each showing its contribution,
  the PATH as league-tinted type chips, and the full career table.
- Components must sum exactly to the headline.

## Out of scope

- Sharing (05) · honours component (08) · par comparison (09).
- Any percentile, ranking or population claim. Forbidden by C5 — we have no backend and cannot
  measure other players, so we may not imply that we can.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — the run now has a conclusion, not just an ending |
| User-visible value? | Yes — the verdict is the point of the run |
| Shippable alone? | Yes |
| ≤1 day? | Yes — one pure function plus a render pass |
| Teaches something? | Yes — whether a number creates the urge to compare |
| Reversible? | Yes — hide the badge, keep the table |

## Done when

- The three displayed contributions sum exactly to the displayed score, on every path.
- A prestige-heavy, low-minutes career and a minutes-heavy, low-prestige career score
  differently on the components in the expected directions.
- The club shown as most prestigious on an offer card is the club that scores highest on the
  best-club component — both read the same fame weight `w`.
- A floor career (never rose above 50, ~60 appearances) renders a low score in neutral styling,
  not as a failure.
- No percentile or "top N%" text exists anywhere in the codebase.

## Evidence to collect

Share rate: completions that proceed to the share action. This is the number Slice 05 is built
to move, and this slice establishes its baseline.

## Design note carried forward

When honours ship in Slice 08 the formula gains a fourth component and every score shifts
meaning. The share card will need a version marker so a v1 `61` is not silently compared against
a v2 `61`. Jonas Weber — the one player who cares about the exact number — will notice.
Deciding this now is cheaper than apologising later. See D-1.

## Gate to Slice 05

There is a number worth arguing about.
