# Slice 07 — The gamble

**Release:** v2 (NOT committed — gated on v1 evidence) · **Effort:** ~1 day ·
**Stories:** US-007 (draft, not DoR-validated) · **job_id:** J1

> Draft. Written to keep the option open, deliberately not taken through Definition of Ready.
> Do not build until the Slice 05 gate passes.

## Goal

Introduce the decision archetype that carries the most weight in the reference game: an explicit
probability gamble with stated odds, against a safe alternative.

```
+--------------------------------------------+
|  COMPETITION FOR YOUR SPOT                  |
|  Sevilla have signed a 22-year-old.         |
|                                             |
|  +---------------------------------------+  |
|  | STAY AND COMPETE                      |  |
|  | 50% Starter  ·  50% Low rotation      |  |
|  +---------------------------------------+  |
|  | TRANSFER TO EMPOLI     [SERIE A] ★★☆☆☆|  |
|  | Guaranteed minutes. Smaller stage.    |  |
|  +---------------------------------------+  |
+--------------------------------------------+
```

## Learning hypothesis

**We believe** that an explicit, stated-odds risk is what makes a decision *weigh* — that
choosing 50/50 over a safe transfer and then living with the result is the most memorable moment
in a run, and the one most likely to be shared.
**We will know we are wrong if** share rate does not move and players report the gamble as
feeling arbitrary rather than brave.

## In scope

- 2–3 gamble decisions per career, placed at the points where competition for a place is
  plausible (typically ages 22–30).
- Odds stated numerically and honestly on the card, before the choice.
- The resolved outcome derived from the seeded RNG streamed over the committed decision path.
- Outcome shown plainly, with copy that owns the result either way.

## Out of scope

- Any hidden or undisclosed probability. If the card says 50%, it is 50%.
- Any re-roll affordance.

## Critical constraint — C4, restated because this slice is where it bites

The gamble outcome **must be derived from the seeded stream, not drawn randomly and stored**.
`mulberry32(hashStr(date + '|career'))` advanced deterministically by decision index means the
outcome is *recomputed identically* on every reload, so refreshing to re-roll is structurally
impossible rather than merely discouraged.

Implementing this as `Math.random()` written to localStorage would make refresh-to-reroll trivial
and would hollow out the one decision in the game that is supposed to be irreversible. This is
the single most important implementation detail in the v2 set.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — a new decision type inside the existing run |
| User-visible value? | Yes — the most emotionally loaded moment in a career |
| Shippable alone? | Yes |
| ≤1 day? | Yes, if the outcome-branching model from Slice 02 generalises cleanly |
| Teaches something? | Yes — whether risk drives sharing |

## Done when

- Stated odds match observed frequency across a large simulated sample, to within sampling error.
- Reloading immediately after a gamble resolves shows the identical outcome, every time.
- A player who gambles and loses still has a playable, non-punishing remainder of a career.
- No gamble decision is presented without a safe alternative.

## Open questions

- Does losing a 50/50 at 26 make the rest of the run feel pointless? If so, the odds are wrong
  or the downside is too steep.
- Should the share card mention gambles taken? It would be a good brag ("took two 50/50s") but
  it lengthens a line that is already capped at 60 characters.
