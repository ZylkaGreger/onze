# Slice 01 — First decision

**Release:** v1 (committed) · **Effort:** ~1 day · **Stories:** US-001 · **job_id:** J1

## Goal

Career mode appears as a third segment in the mode toggle. A player meets a seeded 16-year-old
**already at the day's club — the same club for everyone in the world** — takes the first real
decision about that player's future, and sees a single career row appear.

## Learning hypothesis

**We believe** that the beat of *decide → two seasons resolve → a row appears* is satisfying on
its own.
**We will know we are wrong if** players open Career once, make the single decision, and never
open it again — or if the founder's own group chat reaction to the loop is a shrug.

This is the cheapest possible test of J1, the highest-opportunity and least-evidenced job in the
registry. One day spent, not nine.

## In scope

- Third segment `🎽 Career` in the existing mode toggle, fitting a 360px viewport.
- Seeded identity screen: **the day's starting club**, nationality, age 16, OVR 50, position,
  pre-filled surname, Start. The club is the same for every player worldwide on that date.
- The first decision — the fork. Three options derived from the starting club's prestige, e.g.
  stay and fight for minutes, go on loan for game time, or drop a rung for guaranteed football.
  Each option labelled with club, league and ★ prestige from the existing fame weight `w`.
- Every draw seeded by `hash(date + '|career|' + decisionPath)` so the same choices always give
  the same career, and no outcome can be re-rolled by reloading (D-2).
- One resolution: two seasons, an OVR change, appearances, goals, assists.
- One career row rendered.
- Honest stop: "More seasons coming soon."

## Out of scope

- More than one decision (Slice 02) · resumability (03) · any score (04) · sharing (05)
- Position choice (06) · gambles (07) · trophies (08) · par (09)
- Any crest, image or logo. Type only, always (C1).

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — toggle → identity → decision → outcome → visible result |
| User-visible value? | Yes — the player's first career row is a thing they made |
| Shippable alone? | Yes — the honest stop message makes the stub legitimate |
| ≤1 day? | Yes — rides `mulberry32`, `hashStr`, `todayStr`, the toggle and the renderer |
| Teaches something? | Yes — whether the core beat is worth anything |
| Reversible? | Yes — remove one entry from `MODES` and the mode disappears |

## Done when

- A player on 1 August in Milan and a player in London start at the identical club with the
  identical 16-year-old, and see the identical first decision.
- Choosing game time over prestige produces visibly more appearances and more OVR growth than
  staying to fight for minutes, per the thresholds in US-001.
- Replaying the same choice on the same date reproduces the career row exactly.
- `onze:lastMode` handles `career` and still falls back to `squad` for retired modes.
- `buildCareer()` lives in `game.js` and is covered by `tools/test.mjs`.

## Evidence to collect

Founder plays it for three consecutive days and answers one question honestly: *did I want to
make a second decision?* If the answer is no, stop here.

## Gate to Slice 02

The beat feels like something. If it does not, the correct outcome of this slice is deleting it.
