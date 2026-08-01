# Slice 06 — Your position

**Release:** v1 (committed — owner call, 2026-08-01) · **Effort:** ~1 day ·
**Stories:** US-006 · **job_id:** J1

> Promoted to v1 by the owner: Copero gets strong feedback on position choice, and picking
> where you play is the moment a run becomes *yours* rather than the day's.

## Goal

Position stops being seeded and becomes the player's first real decision: four positions offered
from the day's seed, chosen before the academy offer, each simulating differently.

## Learning hypothesis

**We believe** that agency at the very start increases completion — that a player who chose to
be a striker is more invested in that striker's career than one who was handed a midfielder.
**We will know we are wrong if** completion rate does not move, in which case v1's seeded
position was the right call all along and the four archetypes were wasted effort.

## Why it was cut from v1

Character creation is the scope driver. The reference game asks for nationality, surname, shirt
number, foot and a twelve-option pitch map before the first decision — five screens Marco would
abandon at the third. Seeding position costs zero UI, gives a genuine daily-variety hook
("today everyone is a central midfielder"), and — the real saving — leaves **one** simulation
archetype to tune per day instead of four. Building four archetypes before knowing whether
anyone finishes one career would be building the expensive part first. See D-3.

## In scope

- Four seeded position options (not twelve — Hick's Law, and four archetypes is the tuning
  budget), presented on the creation screen.
- Four simulation archetypes: goalkeeper, defender, midfielder, forward — differing in how
  appearances, goals and assists accumulate and how the rating curve is shaped.
- Position shown in the run header, on the results screen and in the share text.

## Out of scope

- Shirt number, preferred foot, player-chosen nationality. Still seeded, still cosmetic.
- Any position choice that changes **what is offered**. Position may change how the simulation
  reads, never the option set — otherwise players no longer face the same day and comparability,
  the entire premise, breaks.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — adds a decision at the front of the existing path |
| User-visible value? | Yes — the first choice the player makes is now theirs |
| Shippable alone? | Yes |
| ≤1 day? | Borderline — four archetypes is four tuning problems |
| Teaches something? | Yes — whether opening agency drives completion |

## Done when

- Four positions are offered, identical for every player on a given UTC date.
- A goalkeeper career and a forward career produce visibly different stat shapes.
- The club offer set for a given date is identical regardless of position chosen.
- Share text carries the position.

## Open questions

- Does a goalkeeper career read as interesting, or as a table of zeroes in the goals column?
- Do four archetypes need four sets of tuning constants, or one set with per-position modifiers?
