# Slice 09 — Par

**Release:** v2 (NOT committed — gated on v1 evidence) · **Effort:** ~0.5 day ·
**Stories:** US-009 (draft, not DoR-validated) · **job_id:** J4, J1

> Draft. Written to keep the option open, deliberately not taken through Definition of Ready.
> Do not build until the Slice 05 gate passes.

## Goal

Give the day's score a target without inventing a population: **par** — the Career Score a
deterministic reference bot achieves playing the same seed.

```
            ┌───────────┐
            │    61     │   CAREER SCORE
            └───────────┘
               CULT HERO
            Par today: 54
```

## Learning hypothesis

**We believe** that a target number is what turns a solo run into a contest on days when nobody
in the group chat is playing — golf's insight, that par makes a lonely round competitive.
**We will know we are wrong if** repeat play does not move, or if beating par turns out to be so
routine that the number reads as flattery.

## Why this is the only percentile-shaped claim we are permitted

Constraint C5: no backend, therefore no ability to measure what other players scored, therefore
no honest "top 3% of players". Par is different — it is not a measurement of a population, it is
a **defined, published, reproducible opponent**. Anyone can verify it by playing the same seed
with the same policy. It is honest in a way a fabricated percentile never could be.

## In scope

- A deterministic reference policy — the "always take the highest-prestige offer" bot from
  Slice 02's regression fixtures is the obvious candidate — simulated client-side against the
  day's seed at results time.
- Par shown on the results screen beside the player's score.
- Par optionally on the share card, if it fits the line budget.
- A plain-language explanation of what par is, reachable from the results screen. Par must never
  read as "the average player", because it is not.

## Out of scope

- Full decision-tree enumeration to find the day's theoretical maximum. 3^11 ≈ 177k paths is
  borderline feasible on a phone, but gambles make each path a distribution rather than a value,
  and the compute is disproportionate. Rejected at design time — see D-2.
- Any claim about other human players.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — extends the results screen and the share card |
| User-visible value? | Yes — a target on days when nobody else is playing |
| Shippable alone? | Yes |
| ≤1 day? | Yes — the bot policy already exists as a test fixture |
| Teaches something? | Yes — whether a target drives repeat play |

## Done when

- Par is computed client-side in well under a second on a mid-range phone.
- Par is identical for every player on a given UTC date.
- Par is beatable roughly half the time by a thoughtful run — if almost everyone beats it, the
  reference policy is too weak and the number is flattery, not a target.
- The explanation names par as a fixed strategy, never as an average of other players.

## Open questions

- Which reference policy? Always-highest-prestige is simple and legible but may be genuinely
  bad, making par too easy. A hand-tuned "sensible" policy is a better opponent but harder to
  explain in one line.
- Does par belong on the share card, or does it make the card about the bot rather than about
  the player?
