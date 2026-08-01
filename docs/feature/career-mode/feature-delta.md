<!-- markdownlint-disable MD024 -->

# Feature Delta: career-mode

**Feature ID:** `career-mode`
**Wave:** DISCUSS (lean density)
**Date:** 2026-08-01
**Owner:** Peter (solo founder)
**Product:** Onze — onzedaily.com, static site on GitHub Pages, no backend

**One line:** a third daily mode where every player in the world starts the same 16-year-old at
the same club on a given day, and the careers diverge completely from there on decisions alone.

---

## Wave: DISCUSS / [REF] Jobs and Forces

Jobs registry bootstrapped at `docs/product/jobs.yaml`. Career mode exists to serve **J1**.

| Job | Name | Imp | Gap | Opp | Strength | Career mode role |
|-----|------|-----|-----|-----|----------|------------------|
| J1 | Live out the football career I never had | 7 | 9 | **63** | `assumed` | **Primary** |
| J3 | Give my group chat something to react to | 7 | 6 | 42 | `stated` | Secondary |
| J2 | Have a small daily football ritual | 8 | 5 | 40 | `observed` | Secondary |
| J4 | Settle who actually knows football | 6 | 6 | 36 | `stated` | Not served — see R8 |
| J5 | Keep the streak alive | 5 | 4 | 20 | `stated` | Secondary |

**The uncomfortable fact:** J1 has the highest opportunity score and the weakest evidence. It is
`assumed` — derived from the founder playing a competitor's game once and enjoying it. Every
other job in the registry has at least a behavioural trace. This feature is a bet on one
person's experience of a different product.

That is not a reason to stop. It is a reason to make Slice 01 almost embarrassingly small.

### Four forces on J1

- **Push** — Football Manager wants forty hours. Onze's two existing modes test recall but never
  let the player *author* anything. There is no product between "guess a name" and "run a club".
- **Pull** — Eleven decisions. A table that fills row by row. An ending you caused.
- **Anxiety** — *"Is this a slot machine?"* If two visibly different choices produce similar
  careers, the fantasy collapses on the second run and the player never comes back. This is the
  force that decides whether the feature works.
- **Habit** — Onze players already arrive daily, tap a toggle, spend ~5 minutes, share. Career
  mode changes nothing about that ritual except what happens between tap and share.

### The differentiator

The reference game (Copero) has no daily mode. Careers there are private and incomparable —
you can post yours, but nobody knows what you were offered, so "I got 61" is unfalsifiable.
A shared daily seed turns the same content into an argument. That is the entire bet.

---

## Wave: DISCUSS / [REF] Scope Assessment

Elephant Carpaccio gate, run before journey work.

| Signal | Threshold | Actual | Fires? |
|--------|-----------|--------|--------|
| Story count | >10 | 9 stories + 1 technical task | **Yes** |
| Bounded contexts | >3 | 1 (a single static page) | No |
| Integration points | >5 | 3 (mode toggle, localStorage, share) | No |
| Estimated effort | >2 weeks | ~9 days across all slices | **Yes** |
| Independent user outcomes | multiple | Yes — "play a career" and "compare careers" ship apart | **Yes** |

Three signals fire. **Scope assessment: FLAGGED — oversized as a single delivery.**

### Resolution: sequenced into two releases inside one feature

Not two feature directories — the narrative is one thing and splitting the docs would fragment
it. Instead the slice list is cut at a hard line.

- **v1 — Slices 01–05. Committed.** ~5 days. A playable, resumable, shareable daily career.
  Six stories, one technical task. This is the release.
- **v2 — Slices 06–09. Not committed.** ~4 days. Position choice, the gamble, honours, par.
  Every one of these is a good idea. None of them ship until v1 produces evidence that anyone
  finishes a career at all.

**This split needs Peter's confirmation before DESIGN begins.** The v2 slice briefs are written
so the option stays open, but they are drafts and are deliberately not DoR-validated.

Rationale: at ~5 daily players, the cost of building the wrong four days of polish is much
higher than the cost of shipping a thin thing and watching it. The reference game's own
richness is not evidence that Onze's five players want it.

---

## Wave: DISCUSS / [REF] Locked Constraints

These are settled. DESIGN may choose how, not whether.

**C1 — No club crests, ever.** Crests are trademarked, we hold zero crest assets, and the owner
has a standing rule against real trademarks in artwork. The PATH visual is **type only**:
league-tinted chips carrying club names. Club *names* are facts and are already used throughout
the existing game; that is fine. Do not plan for, source, or generate crest images.

**C2 — Top-5 leagues only; the fame weight is the prestige ladder.** `data/squads.json` carries
a per-club-season weight `w` (`DATA.rosters[season][cid].w`) that already ranks Real Madrid far
above Crotone. Low-fame top-5 clubs — Crotone, Heidenheim, Osasuna, Empoli — play the journeyman
rung. **No synthetic lower-league data is created for v1.** Offers are sampled from clubs near
the player's current prestige band.

**C3 — No backend.** No database, no accounts, no server code, no API keys. Seed, simulation,
state, score and share text are all computed client-side. Persistence is localStorage, keyed to
the UTC date, exactly like the existing modes.

**C4 — A reload can never re-roll an outcome.** Every stochastic result is derived from the
seeded RNG streamed over the committed decision path — `mulberry32(hashStr(date + '|career'))`
advanced deterministically by decision index. Outcomes are therefore *recomputed identically*
on reload rather than *restored from storage*. This makes re-rolling structurally impossible
rather than merely discouraged. Do not implement gambles as `Math.random()` results written to
localStorage.

**C5 — No invented population statistics.** We have no backend and cannot measure what other
players scored. The results screen and share card may never say "top 3% of players" or anything
like it. The only legitimate comparison anchors are (a) the shared seed itself, and (b) "par" —
a deterministic reference bot on the same seed — which is a v2 slice.

**C6 — `DATA_V` must be bumped on any data change.** `DATA_V` in `index.html` is the data
cache-buster. Career offers are drawn from `data/squads.json`, so a data change without a
`DATA_V` bump puts players on **different daily careers while the share card claims they were
comparable**. This has already happened once, when the mystery-player pool grew from 150 to 300
and split users onto two different daily players. For career mode the failure is worse: it is
silent and it invalidates the feature's entire premise.

**C7 — v1 seeds everything except the surname.** Nationality, starting position, shirt number
and preferred foot are all seeded from the day. The player types a surname (pre-filled with a
seeded default, so Start is a single tap) and nothing else. Rationale in Design Decision D-3.

**C8 — Mobile-first, one-handed, 5–8 minutes.** Marco plays on a tram. The whole run has to fit
between two stops or survive being interrupted.

---

## Wave: DISCUSS / [REF] Design Decisions

### D-1: The headline outcome is a Career Score out of 100, shown with its parts

Share cards need one number — Wordle taught everyone that. But an opaque number computed by a
simulation nobody can inspect reads as arbitrary, and arbitrary numbers do not survive contact
with Jonas, who will compare his against his brother's and want to know why.

**v1 Career Score = three components, always displayed as a breakdown:**

| Component | Max | Derived from |
|-----------|-----|--------------|
| Peak rating | 50 | Highest OVR reached, scaled from 50 (0 pts) to 95 (50 pts) |
| Longevity | 25 | Total career appearances, scaled to a cap |
| Best club | 25 | Fame weight `w` of the highest-prestige club played for |

The results screen shows all three lines with their contributions. The share card shows only the
total plus the tier.

**Tier bands** (v1-calibrated, single constant table): Journeyman / Solid Pro / Cult Hero /
Star / Icon.

**Known wart, stated out loud:** when honours ship in Slice 08 the formula gains a fourth
component and every score shifts meaning. Share cards must then carry a version marker so a v1
"61" is not silently compared against a v2 "61". Jonas *will* notice. Deciding this now is
cheaper than apologising later.

### D-2: Comparability comes from a shared STARTING POINT, and paths then diverge

Rejected: computing a percentile. We cannot measure the population (C3, C5).

Rejected for v1: enumerating the day's full decision tree to report "you got 61 of a possible
78". 3^11 ≈ 177k paths is borderline feasible client-side but the gamble makes outcomes a
distribution rather than a single value, and it is a lot of compute to put on a phone.

**Rejected (owner call, 2026-08-01): fixing the offers at every step.** An earlier draft had two
players who made identical choices walking an identical tree the whole way down. That is fair but
lifeless — it makes the day feel like one puzzle with a hidden best answer, and it throws away
the thing that makes a career sim fun, which is that *your* career is nobody else's.

**Chosen:** the seed fixes only the **starting point** — the same club, position, nationality and
starting rating for everyone on a given UTC date. Every offer after that is generated from
`(current career state, seed)`, so the moment two players choose differently their careers
genuinely fork: different clubs, different leagues, different events, different endings.

Comparability survives because the start is identical and public: "we all began as a 16-year-old
at {club}". The share card's PATH row *is* the story, precisely because the reader knows where it
started. This is a strictly better social hook than comparing two walks of the same tree, and it
is the thing the reference game cannot claim.

**Determinism is preserved along a path.** Every draw — offers, event outcomes, gamble
resolutions — is seeded by `hash(date + '|career|' + decisionPath)`, where `decisionPath` is the
sequence of choices made so far. Consequences:

- The same choices always produce the same career. The sim is never a slot machine, and a player
  who reloads mid-run cannot reroll a bad two-season block.
- The only way to change your outcome is to genuinely change a decision — which is just playing
  the game. This meaningfully defuses R8: replay stops being a way to farm luck and becomes a way
  to explore the tree, which is a feature, not an exploit.

In v2 (Slice 09), "par" — the score a deterministic reference bot achieves from the same starting
point — gives a target without inventing a population. Par is the only percentile-shaped claim we
are ever allowed to make.

### D-3: v1 creation is one optional text field

Character creation is the scope driver. The reference game asks for nationality, surname, shirt
number, preferred foot and position from a twelve-option pitch map — five screens before the
first decision. Marco abandons at three.

What actually changes the game is **position**. What creates identity is **the name**. Everything
else is flavour.

- **Position is seeded in v1.** "Today everyone starts as a central midfielder." Zero UI, a
  genuine daily-variety hook, and — the real win — one sim archetype to tune per day instead of
  four. Position choice becomes the first real decision in Slice 06, and unlocking the archetypes
  is most of that slice's cost.
- **Surname is a single pre-filled field.** Tap Start to accept the seeded default.
- **Nationality, number, foot are seeded and shown as given.** Cosmetic.

If position ever becomes player-chosen it must not change *what is offered* — only how the
simulation reads — or comparability breaks.

### D-4: One run per day, and the honest version of what that means

A run is locked in. No retry. Reopening the tab resumes at the exact decision index; reopening
after retirement shows the finished career and a countdown.

What we cannot do, and will not pretend to: **stop someone clearing localStorage.** With no
backend and a fixed public seed, a determined player can replay today's career repeatedly until
the numbers are good, then share the best one. Unlike Wordle — where the secret is the answer —
here nothing is secret, so replay is a genuine optimisation exploit. See R8. Comparability is
social, not enforced, and the copy should never claim otherwise.

### D-5: Career sharing is spoiler-free, and that is a real advantage

The two existing modes have a sharing tax: post your result and you risk spoiling the day's
answer. A career path spoils nothing — it is a record of the sharer's own decisions, not the
day's solution. Marco can post it in both his group chats at 07:48 and everyone else's challenge
is fully intact.

This is the one place where career mode is straightforwardly better than what Onze already has,
and it should be leaned on. Nothing in the share text may reveal which offers existed.

---

## Wave: DISCUSS / [REF] Journey

Full journey at `docs/product/journeys/daily-career.yaml` (8 steps, mockups, shared artifacts,
integration checkpoints, failure modes).

**Happy path:** toggle to Career → meet your seeded 16-year-old → ~11 decisions, each resolving
two seasons and adding a row to the career table → OVR peaks around 30 and declines → retirement
→ Career Score, tier, breakdown, PATH, full table → share → locked until tomorrow.

**Emotional arc:** curious → invested → tense → melancholy → proud-or-rueful → competitive.

The peak-then-decline curve is the emotional spine. The run has to feel like it is going well and
then stop going well *without a new mistake* — that is what makes the early decisions land
retroactively. Decline is designed melancholy, never a failure state: no red text, no warnings,
no "your rating is dropping" copy.

### Shared artifacts

| Artifact | Source of truth | Consumers | Risk |
|----------|-----------------|-----------|------|
| `DATA_V` | `index.html` | offer pool, all daily determinism | **HIGH** — see C6 |
| daily seed | `hashStr(todayStr() + '\|career')` | offers, events, outcomes | HIGH |
| club fame `w` | `DATA.rosters[season][cid].w` | offer sampling, ★ display, Best-club score | HIGH |
| club league | `DATA.clubs[cid].league` | chip tint, PATH, share | LOW |
| `career_score` | `scoreCareer()` in `game.js` | results badge, breakdown, share | HIGH |
| tier bands | `CAREER_TIERS` constant | results screen, share text | MEDIUM |
| streak | `onze:streak` via `bumpStreak` | header, results, share — **all three modes** | MEDIUM |
| career state | `onze:<date>:career:*` | resume, results, share | HIGH |

Two of these deserve naming again. **`DATA_V`** is the highest-consequence item in the feature:
get it wrong and players silently play different games while comparing scores. **Streak** is
game-wide — finishing a career must bump it at most once per UTC day even if the player also
finished Squads and Mystery player. The existing `STREAK.last !== todayStr()` guard already
handles this; do not bypass it.

---

## Wave: DISCUSS / [REF] Story Map and Slices

### Backbone

| Discover | Create | Decide | Resolve | Conclude | Share | Return |
|----------|--------|--------|---------|----------|-------|--------|
| Tap Career | Meet your player | Pick 1 of 3 | Two seasons | Retire | Post path | Locked / tomorrow |
| | Name him | Read the offers | Career row | Career Score | Streak tag | Resume mid-run |
| | *Pick position (v2)* | *Take the gamble (v2)* | *Win a trophy (v2)* | *Compare to par (v2)* | | |

### Walking skeleton

None. **Locked decision D2: Onze already ships a working shell** — `index.html`, `game.js`,
`data/*.json`, two live modes, seeded RNG, UTC day boundary, localStorage daily state, streaks
and share plumbing all exist and work. Slice 01 *is* the thin end-to-end slice; it rides
existing infrastructure end to end and needs no skeleton built beneath it.

### Slices

Each is ≤1 day, end-to-end shippable, and carries a named learning hypothesis. Briefs in
`docs/feature/career-mode/slices/`.

| # | Slice | Goal in one line | Stories | Release |
|---|-------|------------------|---------|---------|
| 01 | First decision | Career appears in the toggle; one offer, one choice, one career row | US-001 | v1 |
| 02 | A whole career | Eleven decisions, growth then decline, retirement at ~38 | US-002 | v1 |
| 03 | Resume | The run survives a closed tab; one run per day, locked | US-003 | v1 |
| 04 | The number | Career Score, tier and visible breakdown on the results screen | US-004 | v1 |
| 05 | The share | Spoiler-free path card into the existing share plumbing | US-005, TT-001 | v1 |
| 06 | Your position | Position becomes the first real decision; four sim archetypes | US-006 | v2 |
| 07 | The gamble | Explicit stated-odds decisions with path-derived outcomes | US-007 | v2 |
| 08 | Honours | Trophies, honours row, fourth score component | US-008 | v2 |
| 09 | Par | A deterministic reference-bot score for the day, beside yours | US-009 | v2 |

### Priority rationale

Ordered by *what could kill the feature*, not by what is easiest or most complete.

1. **Slice 01** first because J1 is `assumed`. The cheapest possible test of "does a decision
   followed by a simulated outcome feel good?" comes before anything is built on top of it. If
   the answer is no, one day is spent, not nine.
2. **Slice 02** next because the anxiety force lives here. Compounding is the whole product; if
   choices do not visibly diverge over eleven decisions, nothing downstream rescues it. This is
   also where the real hidden effort is (R3).
3. **Slice 03** before the score, because Marco's tram journey is eight minutes and a career is
   five-to-eight. Losing runs to a closed tab would corrupt every completion number Slices 04
   and 05 are supposed to teach us.
4. **Slice 04** before **Slice 05** because there is nothing worth sharing until there is a
   number worth arguing about.
5. **Slice 05** last in v1 because it is the growth bet and it needs everything above it to be
   true first. TT-001 (instrumentation) must land with it or v1 teaches us nothing.
6. **Slices 06–09** are gated on v1 evidence and are ordered by how much each adds to the
   *decision* rather than to the *decoration*: agency, then risk, then reward, then a target.

---

## Wave: DISCUSS / [REF] User Stories

Six stories and one technical task for v1, all DoR-validated. Four v2 stories are drafts held
in the slice briefs and are explicitly not DoR-validated.

### System Constraints

Apply to every story below. Not repeated per story.

- Static site. No backend, no accounts, no server code, no API keys (C3).
- All state in localStorage, keyed to the UTC date via the existing `todayStr()`.
- Vanilla ES modules. Game logic in `game.js` so `tools/test.mjs` exercises the same code the
  browser runs. Rendering in `index.html`.
- Mobile-first, one-handed, 360px viewport is the design target.
- Touch targets ≥44×44px; text contrast ≥4.5:1; full keyboard operation on desktop.
- No club crests (C1). Club names as type only.
- Any change to `data/squads.json` requires a `DATA_V` bump (C6).

---

### US-001: The first decision of a career

**Slice:** 01 · **job_id:** J1 · **Size:** ~1 day · **State:** Ready

#### Elevator Pitch

- **Before:** Marco opens onzedaily.com and can guess players. He cannot make anything.
- **After:** Marco taps `🎽 Career` in the mode toggle, sees a seeded 16-year-old with his
  surname, picks one of three named clubs, and sees a career row appear reading
  `16-18 · Crotone · OVR 58 · 68 apps · 9 goals · 4 assists`.
- **Decision enabled:** whether the safe club with guaranteed minutes or the famous club with
  no guarantees is the better opening move — and, for us, whether that decision feels like
  anything at all.

#### Problem

Marco Bianchi is a 29-year-old Milanese who played Football Manager obsessively until his
daughter was born and has not opened it since. He gets his football fantasy nowhere now — the
games that offer it want forty hours, and the games that fit his eight-minute tram ride only
ask him to remember things. He has no way to *author* a football story in the time he has.

#### Who

Daily Onze player · phone, one-handed, on a commute · has played the existing modes before ·
will not read instructions and taps the first thing that looks tappable.

#### Solution

A third segment in the existing mode toggle. Tapping it shows a seeded starting player and one
academy offer of three clubs drawn from the day's seed. Choosing one resolves two seasons and
renders the first career row. The run stops there with an honest "more seasons coming soon".

#### Domain Examples

1. **Happy path** — Marco taps `🎽 Career` on 1 August, sees `🇧🇷 Ferreira · Age 16 · OVR 50 ·
   CM`, taps Start, is offered Milan (★★★★★), Sassuolo (★★★☆☆) and Crotone (★★☆☆☆), picks
   Crotone, and reads `Age 16 → 18 · OVR 50 → 58 (+8) · 68 apps · 9 goals · 4 assists`.
2. **Same day, different choice** — Aisha Osei opens the same day on her laptop in London and
   is offered the identical three clubs. She picks Milan and reads `Age 16 → 18 · OVR 50 → 53
   (+3) · 11 apps · 0 goals · 1 assist`. The two outcomes are visibly, arguably different.
3. **Boundary** — Jonas Weber leaves the surname field empty and taps Start. His player is
   called Ferreira, the seeded default, and nothing blocks him.
4. **Returning-mode boundary** — Aisha's browser has `onze:lastMode` set to `grid`, a mode
   removed in July. She lands on Squads, not on a blank screen, and Career is still visible in
   the toggle.

#### UAT Scenarios

```gherkin
Scenario: A first career row appears from a first decision
  Given Marco opens onzedaily.com on 1 August
  When he taps "🎽 Career", taps "Start career", and picks Crotone
  Then he sees two seasons resolve from age 16 to 18
  And a career row shows Crotone with an OVR, appearances, goals and assists
  And the OVR shown is higher than the 50 he started with

Scenario: Two players in different countries start from the same point
  Given Marco in Milan and Aisha in London both open Career on 1 August
  When each meets their 16-year-old
  Then both start at the same club, position, nationality and rating
  And both are offered the same first decision

Scenario: The careers fork as soon as the choices differ
  Given Marco and Aisha have both taken their first decision on 1 August
  When Marco stays at his club and Aisha goes on loan
  Then the offers each is shown at the next decision are not the same set
  And by retirement the two PATH rows differ by at least three clubs

Scenario: The same choices always produce the same career
  Given Marco finishes a career on 1 August with a recorded sequence of choices
  When that identical sequence of choices is replayed on the same date
  Then every career row, the final rating and the Career Score are identical
  And no outcome along the path was re-rolled

Scenario: Different choices produce visibly different outcomes
  Given the academy offer contains a top-prestige club and a low-prestige club
  When one player picks the top-prestige club and another picks the low-prestige club
  Then the two resulting career rows differ in appearances by at least 30
  And the two resulting OVR gains differ by at least 3

Scenario: Starting a career needs no input
  Given Marco is on the "Meet your player" screen
  When he taps "Start career" without typing anything
  Then his player carries the seeded default surname
  And he reaches the academy offer

Scenario: A retired mode in storage does not break the toggle
  Given Aisha's browser has "onze:lastMode" set to a mode that no longer exists
  When she opens onzedaily.com
  Then she lands on Squads
  And "🎽 Career" is available in the mode toggle
```

#### Acceptance Criteria

- [ ] A third segment `🎽 Career` appears in the mode toggle and fits a 360px viewport without
      horizontal scroll or wrapping.
- [ ] The starting player's nationality, age (16), rating (50), position and default surname are
      derived from `hashStr(todayStr() + '|career')` and are identical for all players on a
      given UTC date.
- [ ] The academy offer presents exactly three distinct top-5-league clubs, each labelled with
      its club name, its league, and a prestige indicator derived from the fame weight `w`.
- [ ] No crest image is loaded or referenced anywhere in the offer UI.
- [ ] Choosing an offer advances the player two seasons and appends exactly one career row
      showing age range, club, OVR, appearances, goals and assists.
- [ ] Resolved OVR change and appearance count differ measurably between a top-prestige and a
      low-prestige choice, per the thresholds in the UAT scenario above.
- [ ] Selecting `🎽 Career` writes `career` to `onze:lastMode`; an unrecognised stored mode
      falls back to `squad`.
- [ ] The run ends after the first resolution with copy stating more seasons are coming.

#### Outcome KPIs

- **Who:** daily Onze players who open the site
- **Does what:** open Career mode at least once
- **By how much:** ≥60% within 14 days of release
- **Measured by:** mode-selection event (TT-001); until then, direct report from the founder's
  own group chats
- **Baseline:** 0% — the mode does not exist

#### Technical Notes

- Reuses `mulberry32`, `hashStr`, `todayStr` from `game.js` unchanged.
- New `buildCareer(DATA, date)` belongs in `game.js` so `tools/test.mjs` covers it.
- Offer sampling reads `DATA.rosters[season][cid].w` — the same weight the Squads builder uses.
- The mode toggle currently holds two segments; three must be verified at 360px.
- Outcomes derived from the seeded stream, never `Math.random()` (C4) — even here, where there
  is only one decision, because Slice 02 depends on the pattern being right from the start.

#### Dependencies

None. Rides existing infrastructure.

---

### US-002: A career that runs all the way to retirement

**Slice:** 02 · **job_id:** J1 · **Size:** ~1 day · **State:** Ready

#### Elevator Pitch

- **Before:** Marco makes one decision and the run stops, which proves nothing about whether
  decisions compound.
- **After:** Marco makes eleven decisions from age 16 to ~38, watches his rating climb into the
  seventies, peak around 30, then decline, and lands on a screen reading `CAREER OVER · retired
  at 34` above a six-row career table.
- **Decision enabled:** whether to chase prestige early and risk the bench, or bank minutes
  early and climb later — the trade-off that defines the whole run.

#### Problem

A single decision cannot show compounding, and compounding is the entire proposition. Marco has
no way to find out whether his choice at 16 mattered by the time he is 30, which is the only
question the fantasy is actually about.

#### Who

Daily Onze player who completed a Slice 01 stub run · has ~5–8 minutes · expects the arc to end.

#### Solution

Extend to the full arc: eleven decisions, each resolving two seasons, with an OVR curve that
grows with playing time, peaks around age 30 and then declines regardless of choices. Offers are
sampled from the prestige band the player has actually reached. The run ends in retirement with
a full career table.

#### Domain Examples

1. **Compounding pays off** — Marco banks minutes at Crotone and Sassuolo, is offered Sevilla at
   24 where he would not have been at 18, peaks at OVR 78 aged 29, and retires at 34 with 512
   appearances.
2. **The lazy run stagnates** — Aisha takes the first option at every decision, never leaves the
   lower half of the prestige ladder, peaks at OVR 64 aged 30, and retires at 33 with 388
   appearances. Her career is visibly mediocre and visibly her own fault.
3. **Prestige without minutes** — Jonas takes Milan at 16 and Real Madrid at 20, plays 11 and 19
   appearances in those blocks, peaks at OVR 69, and drops to Empoli at 28 to get on a pitch.
4. **The decline** — at age 30→32 Marco's row reads `OVR 78 → 74 (−4)` with 54 appearances. No
   new mistake caused it. The copy reads *"Still the first name on the team sheet. Not for much
   longer."* — never as a warning or an error.

#### UAT Scenarios

```gherkin
Scenario: A career runs from sixteen to retirement
  Given Marco has started a career on 1 August
  When he makes every decision presented to him
  Then he is presented with between 10 and 12 decisions
  And the final screen states that his career is over and gives his retirement age
  And the career table holds one row per resolved decision

Scenario: Rating peaks and then declines
  Given Marco has reached age 30 with a rating in the seventies
  When he continues making decisions
  Then his rating declines in at least the final two resolved blocks
  And no decline is presented as an error, warning or failure

Scenario: Offers track the prestige the player has earned
  Given Marco has spent four seasons at low-prestige clubs and his rating is 58
  When he reaches his next transfer decision
  Then no club is offered whose fame weight is more than one prestige band above his own
  And at least one offer is at or below his current band

Scenario: A lazy run produces a visibly worse career
  Given Aisha always picks the first offer presented
  And Marco weighs prestige against playing time at every decision
  When both careers reach retirement on the same date
  Then Aisha's peak rating is lower than Marco's by at least 8
  And Aisha's total appearances are lower by at least 80

Scenario: The whole run fits a tram journey
  Given Marco is playing on a mid-range phone with no deliberate delays
  When he plays from the academy offer to retirement without pausing
  Then the run completes in under 8 minutes of wall-clock time

Scenario: The whole career is playable by keyboard alone
  Given Aisha is on a desktop browser using only Tab and Enter
  When she plays from the academy offer to retirement
  Then every offer, every Continue and the Share control is reachable by keyboard
  And a visible focus indicator is shown on each
  And all text meets a contrast ratio of at least 4.5 to 1
```

#### Acceptance Criteria

- [ ] A career comprises 10–12 decisions spanning ages 16 to between 33 and 38.
- [ ] Each resolution advances exactly two seasons and appends exactly one career table row.
- [ ] Rating grows as a function of playing time and prestige, peaks between ages 28 and 31, and
      declines in at least the final two resolved blocks for **both** reference policies
      (always-first-option and always-highest-prestige) — demonstrating that decline is inevitable
      across contrasting strategies. Exhaustive enumeration of all ~177k decision paths is
      explicitly not the test strategy.
- [ ] Decline is rendered in neutral styling — no error colour, no warning icon, no copy framing
      it as the player's failure.
- [ ] Offers are sampled from clubs within one prestige band of the player's current standing,
      using the fame weight `w`; a player never receives an offer more than one band above.
- [ ] All offered clubs existed in a top-5 league in the season referenced.
- [ ] No decision presents fewer than three options or the same club twice.
- [ ] Two contrasting decision policies produce careers differing by the thresholds stated in the
      UAT scenarios.
- [ ] A complete run from academy offer to retirement, with UI render pauses and no deliberate
      delays, measures under 8 minutes of wall-clock time across three independent runs on a
      mid-range phone (baseline device: iPhone SE).
- [ ] The entire run — every offer, every Continue, the Share control — is operable by keyboard
      alone with a visible focus indicator, and all text meets a 4.5:1 contrast ratio.

#### Outcome KPIs

- **Who:** players who start a career
- **Does what:** reach retirement in the same session
- **By how much:** ≥40% (rising to ≥50% once Slice 03 ships)
- **Measured by:** career-completed event (TT-001)
- **Baseline:** none — no career has ever been completed

#### Technical Notes

- The rating curve and the offer-band mapping are the real work in this feature and are largely
  invisible in this story's text. Budget for tuning, not just for building (R3).
- The `MEDIUM_BIAS` tuning comment in `game.js` is the precedent: a named constant with a written
  rationale, tuned against real data when it exists.
- The decision-to-outcome mapping must be pure and live in `game.js` for `tools/test.mjs`.
- Two contrasting fixed policies (always-first, always-highest-prestige) make good regression
  fixtures and are reused as "par" in Slice 09.

#### Dependencies

US-001.

---

### US-003: Pick up the career I left on the tram

**Slice:** 03 · **job_id:** J1, J2 · **Size:** ~0.5 day · **State:** Ready

#### Elevator Pitch

- **Before:** Marco's tram reaches Cadorna at decision 7, he closes the tab, and the career is
  gone.
- **After:** Marco reopens onzedaily.com at lunchtime and lands back on decision 7 with his six
  completed rows intact; reopening after retirement shows `You already lived today's career ·
  61 · CULT HERO` and a countdown.
- **Decision enabled:** whether to finish the run now or later — without that being the same as
  deciding whether to abandon it.

#### Problem

A career takes five to eight minutes. Marco's tram journey is eight. Aisha leaves tabs open for
hours next to her work. If a closed tab destroys a run, most runs die, and every completion
number the next two slices depend on would be measuring tab survival rather than engagement.

#### Who

Commuter on a phone, or a desktop user with a long-lived tab · interruption is the normal case,
not the edge case.

#### Solution

Persist career state to localStorage after every committed decision, keyed to the UTC date like
the existing modes. Reopening resumes at the exact decision index. Reopening after retirement
shows the completed career and a countdown to the next one. One run per day, locked.

#### Domain Examples

1. **Mid-run resume** — Marco is at decision 7 of 11 when he closes the tab at 07:48. At 12:30
   he reopens and sees decision 7, his six rows, and his current rating of 71.
2. **Completed-run reopen** — Aisha finishes at 12:15 and reopens at 16:00. She sees her final
   score, her table, a Share button and a countdown, and no way to start again.
3. **UTC rollover mid-run** — Jonas is at decision 6 at 01:55 CET on 2 August, which is 23:55
   UTC on 1 August. At 02:05 CET the UTC date rolls to 2 August. He is offered 2 August's fresh
   career; 1 August's unfinished run is not resumable and is not presented as an error.
4. **Storage unavailable** — Aisha opens the site in Safari private browsing where localStorage
   throws. The career is playable start to finish in one sitting and simply does not persist.
   Nothing crashes and no misleading "your progress is saved" copy appears.

#### UAT Scenarios

```gherkin
Scenario: A closed tab does not cost the career
  Given Marco has committed 6 of 11 decisions
  When he closes the tab and reopens onzedaily.com later the same UTC day
  Then he is returned to decision 7
  And all 6 completed career rows are shown unchanged
  And his current rating matches the value before he closed the tab

Scenario: A reload cannot re-roll an outcome
  Given Marco has just committed a decision and seen the resolved outcome
  When he reloads the page before continuing
  Then the same outcome is shown with identical rating, appearances, goals and assists

Scenario: The day's career cannot be replayed
  Given Aisha has retired on 1 August with a completed career
  When she reopens Career mode the same UTC day
  Then she sees her completed career and her score
  And no control exists to start another career that day
  And a countdown to the next career is shown

Scenario: A new UTC day offers a new career
  Given Jonas has an unfinished career from 1 August in storage
  When he opens Career mode after the UTC date has rolled to 2 August
  Then he is offered the fresh 2 August career
  And the unfinished run is not presented as an error or a loss

Scenario: Storage failure degrades quietly
  Given Aisha is browsing in a mode where localStorage cannot be written
  When she plays a career from the academy offer to retirement in one session
  Then the career plays through without error
  And no message claims her progress has been saved
```

#### Acceptance Criteria

- [ ] Career state persists to a date-keyed localStorage entry following the existing
      `onze:<date>:<mode>:…` convention, written after every committed decision.
- [ ] Reopening the same UTC day mid-run restores the exact decision index, every completed row
      and the current rating.
- [ ] Reopening the same UTC day after retirement shows the completed career, the score, a Share
      control and a countdown — and no control that starts a new run.
- [ ] Stored state carries a signature; if it does not match the day's regenerated scenario the
      state is discarded and a fresh career is offered rather than a corrupt one resumed.
- [ ] All stochastic outcomes are recomputed from the seeded stream over the committed decision
      path, so a reload cannot alter a resolved outcome (C4).
- [ ] A UTC date change offers the new day's career; the previous day's unfinished run is not
      surfaced as an error.
- [ ] Every localStorage read and write is guarded; a throwing storage API leaves the career
      fully playable in-session with no false persistence messaging.

#### Outcome KPIs

- **Who:** players who start a career and are interrupted
- **Does what:** return and complete the run in a later session
- **By how much:** ≥25% of all completions occur in a session after the one that started the run
- **Measured by:** session-spanning completion event (TT-001)
- **Baseline:** 0% — impossible today

#### Technical Notes

- Mirror the existing `loadState`/`save` signature-guard pattern in `index.html`; do not invent
  a second persistence idiom.
- The signature must include whatever makes the day's scenario unique, so a `data/squads.json`
  change invalidates stored runs rather than resuming them against different offers (C6).
- `visibilitychange` already handles date rollover for the existing modes — reuse it.

#### Dependencies

US-002.

---

### US-004: One number worth arguing about

**Slice:** 04 · **job_id:** J1, J4 · **Size:** ~0.5 day · **State:** Ready

#### Elevator Pitch

- **Before:** Marco retires with a table of numbers and no idea whether the career was good.
- **After:** Marco's results screen leads with `61` in a badge above `CULT HERO`, followed by
  three lines — `Peak rating 78 at 29 · 31/50`, `Longevity 512 apps · 21/25`, `Best club
  Sevilla · 9/25`.
- **Decision enabled:** whether that career was worth sharing — and which of his three
  decisions-worth-of-levers he would pull differently tomorrow.

#### Problem

A career table is a record, not a verdict. Marco cannot tell whether 512 appearances at a peak
of 78 is good, and Jonas cannot compare his run against his brother's without one comparable
figure. A raw table is unshareable and unarguable.

#### Who

Any player reaching retirement · Jonas in particular, who cares about the exact number and will
interrogate it.

#### Solution

A Career Score out of 100 from three transparent components — peak rating (50), longevity (25),
best club prestige (25) — displayed on the results screen with each component's contribution
visible, plus a tier label from a single constant band table.

#### Domain Examples

1. **The balanced career** — Marco: peak 78 at 29, 512 appearances, best club Sevilla. Scores
   31 + 21 + 9 = **61 · CULT HERO**.
2. **The lazy career** — Aisha: peak 64 at 30, 388 appearances, best club Sassuolo. Scores
   16 + 16 + 5 = **37 · SOLID PRO**. Lower on every component; visibly her own doing.
3. **The bench-warmer** — Jonas: peak 69, only 194 appearances, but best club Real Madrid.
   Scores 21 + 8 + 24 = **53 · CULT HERO**. Prestige carried a career that barely happened —
   exactly the trade-off the game is about, and legible from the breakdown.
4. **Boundary** — a run that never leaves rating 50 and plays 60 appearances scores
   0 + 3 + 2 = **5 · JOURNEYMAN**. The floor is reachable and is not an error.

#### UAT Scenarios

```gherkin
Scenario: The verdict leads with one number and shows its parts
  Given Marco has retired with a peak rating of 78, 512 appearances and Sevilla as his best club
  When the results screen renders
  Then a single Career Score out of 100 is shown as the headline
  And a tier label is shown beneath it
  And three component lines are shown, each with its own contribution

Scenario: The components sum to the headline
  Given any completed career
  When the results screen renders
  Then the three displayed component contributions sum exactly to the displayed Career Score

Scenario: Prestige and longevity are genuinely different routes
  Given Jonas peaked at 69 with 194 appearances at Real Madrid
  And Aisha peaked at 64 with 388 appearances at Sassuolo
  When both results screens render
  Then Jonas scores higher on the best-club component
  And Aisha scores higher on the longevity component

Scenario: No claim is made about other players
  Given any completed career
  When the results screen renders
  Then no percentile, ranking or population comparison is shown
  And no text implies how the player did relative to anyone else

Scenario: The floor is a real score, not an error
  Given a career that never rose above its starting rating and played 60 appearances
  When the results screen renders
  Then a low Career Score is shown with its tier label
  And no error or failure state is presented
```

#### Acceptance Criteria

- [ ] Career Score is an integer 0–100 computed by a single function in `game.js` from peak
      rating (max 50), total appearances (max 25) and best-club fame weight (max 25).
- [ ] The results screen displays the score, the tier label, and all three component
      contributions, and the contributions sum exactly to the score.
- [ ] Tier labels come from one `CAREER_TIERS` constant and are calibrated to the score range
      actually reachable in v1.
- [ ] The best-club component reads the same fame weight `w` that produced the ★ rating shown on
      the offer card, so the club presented as most prestigious scores highest.
- [ ] No percentile, rank, population claim or "top N%" text appears anywhere (C5).
- [ ] A minimum-outcome career renders a low score in neutral styling, not as a failure state.

#### Outcome KPIs

- **Who:** players who complete a career
- **Does what:** proceed to share it
- **By how much:** ≥25% of completions reach the share action
- **Measured by:** share-tapped / career-completed ratio (TT-001)
- **Baseline:** unknown — existing modes' share rate has never been measured

#### Technical Notes

- `scoreCareer(state)` and `CAREER_TIERS` in `game.js`; single source for screen and share (D-1).
- Component caps are tuning constants and should carry a written rationale comment in the
  `MEDIUM_BIAS` style.
- When honours ship in Slice 08 the formula gains a fourth component; the share card will need a
  version marker so v1 and v2 scores are not silently compared (D-1).

#### Dependencies

US-002.

---

### US-005: Post my career in the group chat

**Slice:** 05 · **job_id:** J3, J5 · **Size:** ~0.5 day · **State:** Ready

#### Elevator Pitch

- **Before:** Marco finishes a career worth talking about and has nothing to paste.
- **After:** Marco taps `Share your career`, the iOS share sheet opens, and he drops five lines
  into his group chat: `🎽 Onze Career — 1 Aug` / `61 · CULT HERO` / `Crotone › Sassuolo ›
  Sevilla › Lorient › Empoli` / `Peak 78 · 512 apps · 🔥 12d` / the URL.
- **Decision enabled:** whether to challenge the group — and, for whoever reads it, whether to
  play today, knowing nothing has been spoiled for them.

#### Problem

Marco's football group chat goes quiet between matchdays. Sharing a puzzle result risks spoiling
the answer for people who have not played yet, so he mostly does not. A career path spoils
nothing — it is a record of his own choices — but there is currently no way to post one.

#### Who

Player who has just retired · mobile via native share sheet, desktop via clipboard · in at least
one football group chat.

#### Solution

A career share card wired into the existing share plumbing: native sheet on touch devices,
async clipboard then legacy `execCommand` fallback on desktop. Score, tier, type-only club path,
peak rating, appearances, streak, URL. No crests. Nothing about which offers existed.

#### Domain Examples

1. **Mobile** — Marco taps Share on his iPhone; the iOS sheet opens; he picks WhatsApp; five
   lines land in the chat, no image, no crest, nothing spoiled.
2. **Desktop** — Aisha taps Share in Chrome on her laptop. The text is copied and a toast reads
   `Copied to clipboard!`. The native OS dialog does not open — the existing `MOBILE_SHARE`
   touch check already prevents the behaviour desktop users reported as broken.
3. **The comparison lands** — Jonas posts `53 · CULT HERO · Milan › Real Madrid › Empoli`. His
   brother posts `61 · CULT HERO · Crotone › Sassuolo › Sevilla`. Same tier, opposite routes,
   and the argument runs for an hour.
4. **Long path** — a career with eleven distinct clubs would produce a path line that overflows
   a WhatsApp preview. The path collapses to first, best and last with a count:
   `Crotone › … › Sevilla › … › Empoli (11 clubs)`.
5. **Streak** — Marco is on a 12-day streak across all modes; the card carries `🔥 12d`.
   Finishing Squads earlier the same day does not make it read `13d`.

#### UAT Scenarios

```gherkin
Scenario: A career shares in one tap on a phone
  Given Marco has retired on 1 August with a score of 61
  When he taps "Share your career" on his iPhone
  Then the native share sheet opens with text containing the date, the score, the tier and his club path
  And no image or crest is attached

Scenario: Desktop copies rather than opening an OS dialog
  Given Aisha has retired and is using a laptop with no touch input
  When she taps "Share your career"
  Then the share text is placed on the clipboard
  And a confirmation is shown
  And no native OS share dialog opens

Scenario: The share text spoils nothing
  Given any completed career
  When the share text is generated
  Then it contains only clubs the player actually joined
  And it contains no club that was offered and declined
  And it reveals nothing about the day's other two puzzle modes

Scenario: A long path stays inside a chat preview
  Given a career that passed through 11 distinct clubs
  When the share text is generated
  Then the club path line is at most 60 characters
  And it names the first club, the highest-prestige club and the final club

Scenario: The streak counts once across all modes
  Given Marco completed Squads earlier on 1 August and his streak read 12 days
  When he retires from his career the same UTC day and shares it
  Then the share text shows a 12-day streak
```

#### Acceptance Criteria

- [ ] Share text follows the existing house format: emoji-prefixed title with UTC date, result
      line, detail line, streak tag when the streak exceeds 1, URL on its own line.
- [ ] Share URL is `https://onzedaily.com/?m=career`, matching the `?m=player` precedent.
- [ ] Share is routed through the existing native-sheet-then-clipboard-then-legacy chain, and the
      existing touch-device check still gates the native sheet.
- [ ] An aborted native share sheet produces no "copied" confirmation.
- [ ] The club path line never exceeds 60 characters; longer paths collapse to first, best and
      last with a club count.
- [ ] The path is text only — club names, no crest images, no trademarked artwork (C1).
- [ ] Share text contains no club that was offered and declined, and nothing about the day's
      other modes.
- [ ] Score and tier in the share text come from the same functions that render the results
      screen; the two can never disagree.
- [ ] Completing a career bumps the game-wide streak at most once per UTC day.

#### Outcome KPIs

- **Who:** players who complete a career
- **Does what:** send a share
- **By how much:** ≥25% of completions produce a share action, exceeding the puzzle modes' rate
- **Measured by:** share-tapped event and `?m=career` inbound referrals (TT-001)
- **Baseline:** unmeasured for existing modes — TT-001 must establish it in parallel

#### Technical Notes

- `shareText()` in `index.html` already branches per mode; add a `career` branch, do not fork
  the function.
- `shareUrl()` needs a `career` case.
- `recordPlay()` on retirement reuses the existing `STREAK.last !== todayStr()` guard.
- Path chips on the results screen are league-tinted type; the share text is plain text with
  `›` separators, since chat clients strip styling.

#### Dependencies

US-004, TT-001.

---

### TT-001: Aggregate play instrumentation

**Slice:** 05 · **job_id:** `infrastructure-only` · **Size:** ~0.25 day · **State:** Ready

**infrastructure_rationale:** This task produces no user-visible behaviour and enables no user
decision. It exists because **every outcome KPI in this document is currently unmeasurable**.
Onze is a static site on GitHub Pages with no backend and no analytics; there is no way today to
know whether one person or fifty completed a career. Shipping v1 without this means shipping
five slices and learning nothing, which defeats the entire evidence-gated rationale for holding
Slices 06–09. It is attached to Slice 05 rather than standing alone precisely because an
all-infrastructure slice has no release value.

#### Acceptance Criteria

- [ ] A privacy-respecting, script-tag-only analytics provider (Cloudflare Web Analytics,
      Plausible or equivalent) is in place, requiring no backend of ours and **no API key held
      in any deployed artifact**. Provider selection must satisfy the standing hard rule about
      never exposing a paid-API-key proxy on a public URL: a plain script tag carries zero risk
      because there is no key to expose. **Any option requiring an API key is disqualified.**
- [ ] Events are recorded for: mode selected, career started, decision committed, career
      completed, share tapped.
- [ ] No personally identifying data, no cookies requiring consent, no cross-site identifiers.
- [ ] Existing-mode plays are instrumented at the same time, so career share rate has a baseline
      to be compared against.
- [ ] The site functions identically with the analytics script blocked.

#### Technical Notes

Deliberately not a backend (C3). A script tag with no secret satisfies the global hard rule about
never exposing a paid API key: there is no key to expose. If any option under consideration
requires a key, it is the wrong option.

#### Dependencies

None. Should land before or with US-005.

---

## Wave: DISCUSS / [REF] Outcome KPIs

### Objective

By the end of August, know whether five people want to author a football career daily — or know,
cheaply, that they do not.

### North Star

**Completed careers shared per day.** It is the only single number that captures both halves of
the bet: the fantasy landed (completed) *and* it was worth telling someone about (shared).

### KPI table

| # | Who | Does what | By how much | Baseline | Measured by | Type |
|---|-----|-----------|-------------|----------|-------------|------|
| 1 | Daily players | Open Career mode | ≥60% within 14 days | 0% | mode-selected | Leading (secondary) |
| 2 | Career starters | Reach retirement | ≥50% after Slice 03 | none | completed/started | **Leading (primary)** |
| 3 | Career completers | Send a share | ≥25% | unmeasured | share/completed | Leading (primary) |
| 4 | Interrupted players | Finish in a later session | ≥25% of completions | 0% | session-spanning | Leading (secondary) |
| 5 | Career players | Play on ≥4 of any 7 days | ≥40% | n/a | repeat sessions | Leading (retention) |

### Guardrails — must not degrade

| Guardrail | Threshold | Why |
|-----------|-----------|-----|
| Squads + Mystery daily plays | drop no more than 20% | Cannibalisation would trade a working ritual for an unproven one |
| Median run duration | ≤8 minutes | Longer than a tram journey means Marco never finishes |
| Streak continuity | no reduction in median live streak | Career must join the ritual, not fracture it |
| Page weight | no more than +50KB over today | Static site on a phone on mobile data |

### The measurement problem, stated plainly

**Every number above is unmeasurable today.** Onze has no backend, no analytics, no logs and no
accounts. The founder cannot currently tell whether one person or fifty played yesterday.

This makes TT-001 a hard prerequisite for v1 delivering any learning at all, and it means the
targets above are *pre-registered guesses* rather than calibrated goals. With ~5 daily players,
even once instrumented, every rate has a denominator of about five and is directional at best.
Treat the numbers as tripwires that trigger a conversation, not as statistics.

### Hypothesis

We believe that a shared-seed daily career for daily football fans will produce a share rate
above the puzzle modes'. We will know this is true when at least a quarter of completed careers
produce a share, and when career players return on four days out of seven.

---

## Wave: DISCUSS / [REF] Risks

| ID | Risk | P | I | Response |
|----|------|---|---|----------|
| R1 | J1 is `assumed`. The feature rests on the founder enjoying a competitor's game once. Nobody has asked an Onze player whether they want this. | High | High | Mitigate — Slice 01 is deliberately one day. Kill after Slice 02 if completion is poor. |
| R2 | Every KPI is unmeasurable without TT-001. v1 could ship and teach nothing. | High | High | Mitigate — TT-001 blocks US-005. |
| R3 | The rating curve and offer-band tuning are the real work and are nearly invisible in the story text. If choices do not visibly compound, no amount of UI rescues it. | High | High | Mitigate — US-002 carries explicit numeric divergence thresholds; two fixed policies as regression fixtures. |
| R4 | A `data/squads.json` change without a `DATA_V` bump silently splits players onto different daily careers while share cards claim comparability. Already happened once. | Medium | High | Avoid — C6; the state signature invalidates stored runs on data change. |
| R5 | Cannibalisation. Five daily players is a fragile base; a third mode may fracture the ritual rather than extend it. | Medium | Medium | Monitor — guardrail on existing-mode plays. |
| R6 | The score formula changes between v1 and v2 when honours land, making old shares incomparable. Jonas will notice. | High | Low | Accept — D-1; version marker on the share card. |
| R7 | Genre mismatch. Onze is a guessing game; this is a management sim in the same toggle. It may read as two products sharing a URL. | Medium | Medium | Monitor — the seeded-daily framing and shared streak are the connective tissue; revisit if Squads players ignore it. |
| R8 | **Replay exploit.** Fixed public seed + no backend means anyone can clear localStorage, replay today's career until the numbers are good, and share the best run. Unlike Wordle there is no secret to protect, so replay is a genuine optimisation. This breaks J4 (settle who knows football) outright. | Medium | Medium | Accept and be honest — D-4. Comparability is social, not enforced. Copy must never claim otherwise. Do not spend engineering effort on obfuscation that a devtools console defeats in a minute. |
| R9 | Sim tuning at the extremes leaves fewer than three viable offers for a very low or very high prestige player. | Medium | Low | Mitigate — US-002 AC requires three distinct offers at every decision. |

**The two that would actually kill it:** R1 and R3. R1 says we may be building for nobody. R3
says that even if we are building for someone, the thing that makes it work is the least visible
part of the plan. Both are addressed the same way — ship Slice 01, then Slice 02, then look.

---

## Wave: DISCUSS / [REF] Definition of Ready

Validated against the 9-item hard gate. v1 stories only; v2 drafts are explicitly out of scope
for this gate.

| Story | Problem | Persona | 3+ examples | UAT 3–7 | AC from UAT | Right-sized | Tech notes | Deps | KPIs |
|-------|---------|---------|-------------|---------|-------------|-------------|-----------|------|------|
| US-001 | PASS | PASS | PASS (4) | PASS (5) | PASS | PASS (~1d, 5) | PASS | PASS | PASS |
| US-002 | PASS | PASS | PASS (4) | PASS (6) | PASS | PASS (~1d, 6) | PASS | PASS | PASS |
| US-003 | PASS | PASS | PASS (4) | PASS (5) | PASS | PASS (~0.5d, 5) | PASS | PASS | PASS |
| US-004 | PASS | PASS | PASS (4) | PASS (5) | PASS | PASS (~0.5d, 5) | PASS | PASS | PASS |
| US-005 | PASS | PASS | PASS (5) | PASS (5) | PASS | PASS (~0.5d, 5) | PASS | PASS | PASS |
| TT-001 | n/a — technical task | n/a | n/a | n/a | PASS (AC present) | PASS (~0.25d) | PASS | PASS | n/a |

**JTBD traceability:** every story carries a `job_id` referencing `docs/product/jobs.yaml`.
TT-001 carries `infrastructure-only` with a written rationale.

**Elevator Pitch:** present on all five user stories, each naming a real user-visible entry
point, a concrete observable output, and a decision the player makes with it. TT-001 is
`@infrastructure` and exempt; it is attached to Slice 05 so that slice retains release value.

### DoR Status: PASSED for v1 (US-001 … US-005, TT-001)

### Open items carried into DESIGN

1. **Confirm the v1/v2 split.** Slices 06–09 are drafted, not committed. Peter's call.
2. **Choose the analytics provider** for TT-001. Constraint: script tag only, no key, no backend.
3. **Tuning constants are undefined.** The rating curve shape, prestige-band width and score
   component caps are named but not numbered. That is deliberate — they need a working
   simulation to tune against — but DESIGN should expect them to be the bulk of the work.
