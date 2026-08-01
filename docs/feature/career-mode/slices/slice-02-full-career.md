# Slice 02 — A whole career

**Release:** v1 (committed) · **Effort:** ~1 day · **Stories:** US-002 · **job_id:** J1

## Goal

Extend the stub to the full arc: eleven decisions from age 16 to retirement, with a rating that
grows on playing time, peaks around 30, and then declines. Ends on a full career table.

## Learning hypothesis

**We believe** that choices visibly compound — that a run of thoughtful decisions produces a
career a player can point at and say "I did that", and a lazy run produces a visibly mediocre
one.
**We will know we are wrong if** two contrasting decision policies produce careers that look
roughly the same. That is the anxiety force in J1 ("is this a slot machine?") landing on the
wrong side, and it kills the feature outright.

## In scope

- 10–12 decisions spanning ages 16 to 33–38.
- Rating curve: growth as a function of playing time and prestige; peak between 28 and 31;
  decline thereafter on every path.
- Offer sampling from clubs within one prestige band of the player's current standing, using the
  fame weight `w`. Low-fame top-5 clubs are the journeyman rung — no synthetic lower leagues (C2).
- Career table filling row by row.
- Retirement screen with the full table.
- Decline copy that reads as melancholy, never as an error or a warning.

## Out of scope

- Resumability (03) · score (04) · sharing (05) · everything in v2.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — extends the existing path rather than branching it |
| User-visible value? | Yes — a complete career, the thing the feature promises |
| Shippable alone? | Yes — playable start to finish in one sitting |
| ≤1 day? | Borderline. The *building* is a day; the *tuning* is the risk (R3) |
| Teaches something? | Yes — the single most important thing we do not know |
| Reversible? | Yes — cap the decision count back to 1 |

## Done when

- A full run read once at phone reading speed completes in under 8 minutes.
- Two fixed policies — always-first-option and always-highest-prestige — produce careers
  differing by ≥8 peak rating and ≥80 appearances.
- No decision ever presents fewer than three distinct clubs, at either prestige extreme.
- Every offered club actually played in a top-5 league in the season referenced.
- Decline renders in neutral styling. No red, no warning icon, no blame.

## Evidence to collect

Completion rate in a single session, once TT-001 lands. Before that: does the founder finish it
without skimming? Does anyone in the group chat finish it?

## Risk note

This slice contains the feature's real work, and almost none of it is visible in the story text.
The rating curve, the prestige-band width and the playing-time model are tuning problems, not
build problems. `MEDIUM_BIAS` in `game.js` is the precedent for how to hold a tuning constant:
one named value with a written rationale, retuned when real data exists.

## Gate to Slice 03

The two fixed policies diverge by the stated thresholds, and a human reading both careers can
tell which player made better decisions without being told the scores.
