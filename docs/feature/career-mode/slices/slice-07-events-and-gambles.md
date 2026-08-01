# Slice 07 — Events and gambles

**Release:** v1 (committed — owner call, 2026-08-01) · **Effort:** ~1.5 days ·
**Stories:** US-007 · **job_id:** J1

> Promoted from v2 and widened. The owner's call: *"it needs to have a lot of fun and changing
> things — Copero have a great variety, not to copy but to make it fun, a bit like Anstoss."*
> A single 50/50 card is not that. This slice is the event **system** plus a catalogue with
> enough variety that two careers rarely tell the same story.

## Goal

Turn the decision stream from "pick a club, repeat" into a career with **texture**: stated-odds
gambles, off-pitch moments with real consequences, setbacks that are not the player's fault, and
peaks worth remembering. Every event has to *change something measurable* — never flavour text.

```
+--------------------------------------------+
|  COMPETITION FOR YOUR SPOT      Age 24     |
|  Sevilla have signed a 22-year-old.        |
|                                            |
|  | STAY AND COMPETE                     |  |
|  | 55% Starter · 45% Bench               |  |
|  |                                       |  |
|  | JOIN EMPOLI       [SERIE A] ★★☆☆☆     |  |
|  | Guaranteed minutes. Smaller stage.    |  |
+--------------------------------------------+
```

## Learning hypothesis

**We believe** variety is what makes a career worth replaying — that a run containing an injury,
a manager who never rated you and one brave 50/50 is a *story*, while a run of eleven transfer
menus is a spreadsheet.
**We will know we are wrong if** players finish and cannot recall a single moment, or if the
event copy reads as noise between the "real" decisions.

## Design rules

1. **Every event changes a number.** Growth rate, playing time, market value, injury risk,
   prestige band reachable next, or the trophy odds. If an event changes nothing, cut it.
2. **Odds are stated and true.** If the card says 55%, it is 55%. Never hide a probability.
3. **There is always an out.** Every gamble sits next to a safe option, so losing is a choice the
   player made, not something done to them.
4. **A loss is never a dead run.** Downside costs a band, never the career. A player who loses a
   50/50 at 26 must still have a playable, interesting decade.
5. **No fourth wall, no jokes about the game.** Anstoss's charm was situations that were funny
   *because they were plausible*, not winks at the player.
6. **Seeded, never random.** Outcomes derive from `hash(date + '|career|' + decisionPath)` (C4).
   Refreshing recomputes the identical result; the only way to change it is a different choice.

## Event catalogue (v1 target: ~24 events across 5 families)

**A · Sporting crossroads** — the spine, present in every run
- Competition for your spot: compete on stated odds vs guaranteed minutes a rung down
- Transfer window: bench at a giant vs starter at a mid table side
- Loan or stay: development vs stagnation
- Contract expiring: renew now vs run it down for a free transfer (bigger club, real risk)

**B · Stated-odds gambles** — 2–3 per career, ages ~20–32
- Play through the injury for the cup final — hero vs months out
- Move to a league you do not know — adapt vs never settle
- Switch position to extend your career — new lease vs lost edge
- The money move: a rich league, a smaller stage, a shorter shop window back to Europe

**C · Off-pitch, Anstoss-flavoured** — consequential, not decoration
- A new manager arrives who does not rate you: fight for it, ask to leave, or go on loan
- The agent brings an offer that is *too* good — and a club with a habit of not paying
- A bad interview becomes a media storm: apologise, stay silent, or double down
- The armband is offered: leadership lifts the squad, pressure costs your own form
- A veteran at the club takes you under his wing — accept the mentor or go your own way
- Homesick in your second season abroad: push through or engineer a move home

**D · Setbacks** — not your fault, and that is the point
- A serious injury at the wrong age
- Your club is relegated while you are its best player: go down with them or jump
- Ownership collapses and wages go unpaid
- The club sells you without asking

**E · Peaks** — the moments the share card should carry
- First senior international call-up
- A cup final
- The derby that defines a season at this club
- A testimonial, if you stayed somewhere long enough

## In scope

- An event engine: eligibility by age / prestige band / career state, weighted seeded selection,
  no repeats within a run unless the family allows it.
- The ~24-event catalogue above as data, not code, so adding events later costs nothing.
- Effects applied to the existing sim: growth, playing time, value, injury risk, reachable band.
- Honest odds rendering, and outcome copy that owns the result either way.

## Out of scope

- Hidden probabilities · any re-roll affordance · event chains spanning more than two decisions
- Trophies as a score component (Slice 08) · par (09)

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — new decision types inside the existing run |
| User-visible value? | Yes — this is the difference between a story and a menu |
| Shippable alone? | Yes — catalogue can ship partial; the engine is the slice |
| ≤1 day? | **No — ~1.5 days.** Flagged rather than pretended. The engine is a day; the catalogue and its balancing is the half. |
| Teaches something? | Yes — whether variety drives completion and replay |

## Done when

- Two careers from the same start with different choices contain **at least three different
  events** each, and their event sets are not identical.
- Stated odds match observed frequency across a large simulated sample, within sampling error.
- Reloading immediately after any gamble resolves shows the identical outcome, every time.
- Every event in the catalogue changes at least one number in the sim (asserted in tests).
- No gamble is ever presented without a safe alternative.
- A simulated career that loses every gamble still reaches retirement with a playable path.

## Open questions

- How many events per run is right? Too few and it is a menu; too many and the career stops
  feeling like football. Start at 3–4 non-crossroads events per run and tune.
- Should the share card name the biggest moment ("played the final on a broken foot")? It is a
  strong brag but the line is already tight.
