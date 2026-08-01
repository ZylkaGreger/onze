# Slice 08 — Honours

**Release:** v2 (NOT committed — gated on v1 evidence) · **Effort:** ~0.75 day ·
**Stories:** US-008 (draft, not DoR-validated) · **job_id:** J1, J4

> Draft. Written to keep the option open, deliberately not taken through Definition of Ready.
> Do not build until the Slice 05 gate passes.

## Goal

Trophies. An honours row on the results screen, and a fourth component in the Career Score that
rewards winning things rather than merely playing a lot at good clubs.

## Learning hypothesis

**We believe** that trophies are the reward half of the risk/reward loop — that "61 · CULT HERO"
becomes materially more shareable as "68 · STAR · 3 titles".
**We will know we are wrong if** the honours line is ignored in shares and the score change
produces only confusion about why numbers moved.

## In scope

- Trophies derived deterministically from club prestige, the player's rating relative to that
  club, and playing time in each two-season block. No new data source.
- An honours row on the results screen.
- Fourth score component: honours, rebalancing the formula to peak rating 40 / longevity 20 /
  best club 15 / honours 25.
- **Version marker on the share card** so a v1 `61` is never silently compared with a v2 `61`.

## Out of scope

- Real historical trophy data. We do not have it and are not sourcing it. Trophies are a
  plausible simulation output, not a factual claim about a real season, and the copy must not
  imply otherwise.
- Any trophy image, badge artwork or competition logo — trademarked, same rule as crests (C1).
  Text only.

## The wart this slice creates

Changing the formula changes what every score means. Anyone who shared a v1 card has a number
that no longer sits on the same scale. This was accepted knowingly at design time (D-1); the
mitigation is a visible version marker, not a pretence that nothing changed. Jonas Weber, the
one player who tracks the exact number, will notice within a day.

Consider shipping this on a clean date boundary and saying so plainly in the release note.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — extends resolution, results and share together |
| User-visible value? | Yes — the reward half of the loop |
| Shippable alone? | Yes |
| ≤1 day? | Yes |
| Teaches something? | Yes — whether reward or risk drives sharing |
| Free of side effects? | **No** — it changes the meaning of every previous score |

## Done when

- A high-prestige career with heavy playing time collects trophies; a journeyman career collects
  few or none, and zero trophies renders as a clean empty state rather than a blank gap.
- The four components sum exactly to the displayed score.
- The share card carries a version marker distinguishing it from v1 cards.
- No trophy image or competition logo is loaded anywhere.

## Open questions

- Is a national-team row worth adding here, or is it flavour that dilutes the honours line?
- Should the tier bands be recalibrated at the same time, or held constant to limit the number
  of things changing meaning at once?
