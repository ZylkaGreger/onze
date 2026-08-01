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

**Owner decision, 2026-08-01.** The original cut was 01–05, with position choice and the gamble
held back for evidence. The owner moved both into v1 and widened the gamble, on the grounds that
they are not polish — they are what makes the thing fun, and Copero gets its strongest feedback
on exactly these two. Slice 00 was added ahead of everything, because the loan-and-climb arc has
nowhere to happen while the club universe is 192 top-flight sides.

- **Slice 00 — Club universe. Done.** 916 clubs, 43 countries, 54 leagues, first and second
  divisions, prestige 5–99. Scraped from the current season, so promotions are real.
- **v1 — Slices 01–07. Committed.** ~7.5 days. A playable, resumable, shareable daily career
  with a chosen position and an event system with genuine variety.
- **v2 — Slices 08–09. Not committed.** ~1.25 days. Honours, and par. Both are score-model
  changes and both are cheaper once v1 shows how careers actually distribute.

Rationale for the remaining hold: honours adds a fourth score component and would silently
change what a given number means, and par is meaningless until there is evidence about the
spread of real scores. Neither is a fun problem; both are calibration.

Trade accepted: v1 grew from ~5 days to ~7.5. The counterweight is that Copero is a live trend
right now, and shipping a thin-but-dull version into that window would waste the window.

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

**C4 — A reload can never re-roll an outcome.** Every stochastic result — which offers appear,
how two seasons resolve, and later how a gamble lands — is derived from an RNG seeded by the
**decision path**, not by a global counter:
`mulberry32(hashStr(date + '|career|' + decisionPath))`, where `decisionPath` is the sequence of
choices committed so far. Outcomes are therefore *recomputed identically* on reload rather than
*restored from storage*, and two players who diverge at decision 3 draw from genuinely
independent streams from that point on (D-2). This makes re-rolling structurally impossible
rather than merely discouraged: the only way to see a different outcome is to make a different
choice. Do not implement gambles as `Math.random()` results written to localStorage.

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

A third segment in the existing mode toggle. Tapping it shows a seeded starting player **already
at the day's club — the same club for every player in the world** — and one first decision about
that player's future. Choosing resolves two seasons and renders the first career row. The run
stops there with an honest "more seasons coming soon".

#### Domain Examples

1. **Happy path** — Marco taps `🎽 Career` on 1 August, sees `🇧🇷 Ferreira · Age 16 · OVR 50 ·
   CM · AC Milan (★★★★★)`, taps Start, and is asked whether to stay and fight for minutes, go on
   loan to Sassuolo (★★★☆☆) or drop to Crotone (★★☆☆☆) for guaranteed football. He takes Crotone
   and reads `Age 16 → 18 · OVR 50 → 58 (+8) · 68 apps · 9 goals · 4 assists`.
2. **Same start, forked path** — Aisha Osei opens the same day on her laptop in London and starts
   at the identical club with the identical player. She stays at Milan and reads `Age 16 → 18 ·
   OVR 50 → 53 (+3) · 11 apps · 0 goals · 1 assist`. Same start, visibly different careers — and
   from here the two players are offered different clubs entirely.
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
  Given the first decision offers a stay-and-fight option and a guaranteed-football option
  When one player picks the top-prestige club and another picks the low-prestige club
  Then the two resulting career rows differ in appearances by at least 30
  And the two resulting OVR gains differ by at least 3

Scenario: Starting a career needs no input
  Given Marco is on the "Meet your player" screen
  When he taps "Start career" without typing anything
  Then his player carries the seeded default surname
  And he reaches the first decision

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
- [ ] The first decision presents exactly three distinct options, each labelled with club,
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
  When he plays from the first decision to retirement without pausing
  Then the run completes in under 8 minutes of wall-clock time

Scenario: The whole career is playable by keyboard alone
  Given Aisha is on a desktop browser using only Tab and Enter
  When she plays from the first decision to retirement
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
- [ ] A complete run from the first decision to retirement, with UI render pauses and no deliberate
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
  When she plays a career from the first decision to retirement in one session
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

---

## Wave: DESIGN / [REF] Simulation Model

Lean density, Tier-1. Scope: application design only. No C4, no container/context diagrams, no
infrastructure, no technology selection — the stack is settled (vanilla ES module, no build,
static site). Those success criteria are explicitly out of scope and are not attempted.

### Block structure

A career is a sequence of **blocks**. Block `k` (k = 0…10) spans ages `16+2k → 18+2k`. Every
resolution advances exactly two seasons and appends exactly one career row.

| k | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|----|
| ages | 16–18 | 18–20 | 20–22 | 22–24 | 24–26 | 26–28 | 28–30 | 30–32 | 32–34 | 34–36 | 36–38 |

Retirement fires at the end of block 8, 9 or 10 → **9, 10 or 11 career rows**.

> **Reconciliation with US-002 ("10–12 decisions").** Rows are 9–11. *Player decisions* are
> 1 (position, Slice 06) + 9–11 (club) = **10–12**, which is what the AC counts. Event decisions
> (Slice 07) are additional taps, not career rows. See O-6.

Reported retirement age = end age − (seeded coin) → **33–38**, satisfying US-002.

### Constants — `CAREER` in `game.js`

One frozen object, one place to tune, `MEDIUM_BIAS` comment convention (a named value with a
written rationale, retuned when real data exists).

```js
// All tables indexed by BLOCK INDEX k (0..10) = start ages 16,18,…,36.
export const CAREER = Object.freeze({
  BLOCKS: 11,
  APPS_PER_BLOCK: 82,          // ~41 games/season incl. cups over two seasons

  // --- playing time ---------------------------------------------------------
  DEMAND_A: 30, DEMAND_B: 0.55,          // demand(P) = 30 + 0.55*P  → P34→48.7, P50→57.5, P99→84.5
  AGE_ALLOW:  [ +12, +8, +6, +4, +2,  0,  0, -2, -5, -9, -14 ],
  PT_BONUS: { loan:+8, guaranteed:+6, rotation:+2, stay:0, prospect:-4 },
  PT_NOISE: 2.5,               // deliberately small: divergence must be STRUCTURAL, not lucky
  K_POS: 5.0, K_NEG: 9.0,      // logistic width; asymmetric so the bench is a slope, not a cliff
  M_FLOOR: 0.06, M_CAP: 0.92,

  // --- growth ---------------------------------------------------------------
  GROWTH_AGE: [ 5.5, 5.0, 4.2, 3.2, 2.2, 1.3, 0.5, -1.5, -3.5, -5.5, -7.5 ],
  GAIN_A: 0.12, GAIN_B: 1.25, GAIN_E: 0.9,     // gainMult(m) = 0.12 + 1.25*m^0.9
  ENV_A: 0.92, ENV_B: 0.0025,                  // envMult(P) = 0.92 + 0.0025*P
  CHALLENGE_DIV: 12, CHALLENGE_LO: -0.35, CHALLENGE_HI: +0.25,
  GROWTH_CAP: 1.55,            // caps the positive-growth product; 5.5*1.55 = +8.5 max at 16→18
  DECLINE_A: 1.15, DECLINE_B: 0.30,            // declineMult(m) = 1.15 - 0.30*m
  GROWTH_JITTER: 0.8,
  OVR_MIN: 40, OVR_MAX: 94,

  // --- retirement -----------------------------------------------------------
  RETIRE_DROP: 10,             // retire once ovr is this far below peak (from block 8 on)
  RETIRE_MIN_MINUTES: 0.20,
  RETIRE_P: { 8: 0.20, 9: 0.45, 10: 1.0 },

  // --- market value (display + event triggers only; NOT scored) --------------
  VAL_A: 0.045, VAL_E: 11.5,   // €m = 0.045 * exp(ovr/11.5) * AGE_VAL[k]
  AGE_VAL: [1.15,1.15,1.30,1.25,1.25,1.05,0.85,0.60,0.38,0.20,0.08],
});
```

### Formulas

```
demand(P)        = 30 + 0.55 * P
surplus s        = ovr + AGE_ALLOW[k] + PT_BONUS[status] - demand(P) + (r*2-1)*PT_NOISE
minutes m        = clamp( 1 / (1 + exp(-s / K)), M_FLOOR, M_CAP )    K = s>=0 ? K_POS : K_NEG
apps             = round(m * 82)

gainMult(m)      = 0.12 + 1.25 * m^0.9
envMult(P)       = 0.92 + 0.0025 * P
challenge        = clamp( (demand(P) - ovr) / 12, -0.35, +0.25 )
stretch          = 1 + challenge * min(1, m / 0.45)
growthMult       = min( GROWTH_CAP, gainMult(m) * envMult(P) * stretch ) * POS_MOD[pos].growth
declineMult(m)   = 1.15 - 0.30 * m

delta            = GROWTH_AGE[k] >= 0 ? GROWTH_AGE[k] * growthMult
                                      : GROWTH_AGE[k] * declineMult(m)
                   + (r2*2-1) * GROWTH_JITTER
ovr'             = clamp(ovr + delta, 40, 94)          // carried as a FLOAT, displayed rounded
value            = 0.045 * exp(ovr/11.5) * AGE_VAL[k]  // €m, 1dp
```

**Why this shape.**

- `AGE_ALLOW` is the youth allowance: a club plays a 16-year-old on promise, not on rating, and
  stops doing so at 30. It is the single term that makes *the same rating* mean bench at one age
  and starter at another.
- `challenge` is the design's whole tension. Positive when the club is above you *and you play*
  → fastest growth. Negative when you are above the club → you coast. The lower clamp (−0.35) is
  wider than the upper (+0.25) deliberately: coasting costs more than stretching pays. Without
  the asymmetry "always take guaranteed minutes" is strictly dominant (see O-1).
- `stretch` scales the challenge bonus by `m/0.45`, so a stretch move only pays **if you actually
  play**. Riding the bench at a giant gets neither the bonus nor the minutes. This is the
  bench-warmer trap, and it is structural, not a die roll.
- **Decline ignores growthMult entirely.** `GROWTH_AGE[k] < 0` routes through `declineMult`, which
  ranges 0.87…1.13. Playing a lot slows decline slightly; nothing stops it. Decline is therefore
  inevitable on *every* path, which is what US-002's AC demands and what the emotional arc needs.
- `PT_NOISE = 2.5` and `GROWTH_JITTER = 0.8` are the only randomness in the sim. They are small
  on purpose: R2 says the feature dies if the outcome feels like a slot machine. Everything
  visible comes from the decision.

### Position

One constant set with per-position modifiers, not four archetypes — this answers Slice 06's open
question ("four sets of tuning constants, or one set with modifiers?").

```js
export const POS_MOD = {
  GK: { peakShift:+1, growth:0.85, ptBonus:-1, g:0.000, a:0.004, cs:0.30 },
  DF: { peakShift:+1, growth:0.95, ptBonus: 0, g:0.050, a:0.045 },
  MF: { peakShift: 0, growth:1.00, ptBonus: 0, g:0.150, a:0.120 },
  FW: { peakShift:-1, growth:1.05, ptBonus: 0, g:0.420, a:0.130 },
};
q          = clamp((ovr - 50) / 35, 0, 1.2)          // 50→0, 85→1.0, 94→1.2
goalRate   = POS_MOD[pos].g * (0.55 + 0.85*q)
assistRate = POS_MOD[pos].a * (0.60 + 0.75*q)
goals      = round(apps * goalRate   * (0.85 + 0.30*r3))
assists    = round(apps * assistRate * (0.85 + 0.30*r4))
cleanSheets= round(apps * 0.30 * (0.50 + 0.70*q))    // GK only, replaces the goals column
```

`peakShift` shifts the `GROWTH_AGE` lookup by ±1 block (keepers peak later, forwards earlier):
`GROWTH_AGE[clamp(k + peakShift, 0, 10)]`. `ptBonus:-1` for GK because there is one goalkeeper
shirt — competition is structurally fiercer. **The GK career table shows `CS` instead of `G`**,
which is the concrete answer to Slice 06's "table of zeroes" worry.

Sanity: FW at OVR 80 with 60 apps → 0.42×(0.55+0.73) = 0.54/app → 32 goals per two seasons.
MF at OVR 58 with 68 apps → 7 goals, 6 assists. GK at OVR 70 with 70 apps → 25 clean sheets.

### Career Score (D-1, three components)

```js
peakPts = clamp(round(50 * (peakOvr - 50) / 45), 0, 50)              // 50→0, 95→50
lonPts  = clamp(round(25 * totalApps / 720), 0, 25)                  // LONGEVITY_FULL = 720
clubPts = clamp(round(25 * ((bestPrestige - 40)/55)**2), 0, 25)      // squared: only giants score
export const CAREER_TIERS = [[0,'JOURNEYMAN'],[30,'SOLID PRO'],[48,'CULT HERO'],[64,'STAR'],[80,'ICON']];
```

`clubPts` is squared because 68% of `clubs.json` sits in prestige 35–54; a linear map would hand
20/25 to a Sevilla-level career. Squared: Sevilla(84)→16, Roma(88)→19, Real Madrid(99)→25,
Wolfsburg(64)→5, a Serie B side(50)→1. `bestPrestige` = max prestige over **career rows**, so loan
clubs count and a parent club you never played for does not.

The DISCUSS worked examples land on their stated tiers under these constants: Marco 61 → CULT
HERO, Jonas 53 → CULT HERO, Aisha 37 → SOLID PRO. Point totals shift (see O-4) because the
prestige source changed; the labels do not.

---

## Wave: DESIGN / [REF] Divergence Proof

R2 is the risk that kills the feature: *if two clearly different decision policies produce similar
careers, the fantasy collapses into a slot machine.* This section hand-simulates two contrasting
policies from an identical start, block by block, with the constants above.

**Method note, and it matters:** both runs are computed with **`PT_NOISE = 0` and
`GROWTH_JITTER = 0`** — the median draw. Every difference below is produced by the decision
policy alone. None of it is luck. That is the strongest form the proof can take.

**Shared start (seeded day):** `AS Roma (Serie A, prestige 88) · MF · Age 16 · OVR 50`.

### Policy A — always take the biggest club offered

| k | Ages | Club | Status | m | Apps | OVR | G | A |
|---|------|------|--------|---|------|-----|---|---|
| 0 | 16–18 | AS Roma (Serie A, 88) | prospect | .094 | 8 | 50 → 52 | 1 | 1 |
| 1 | 18–20 | AS Roma | prospect | .075 | 6 | 52 → 53 | 1 | 0 |
| 2 | 20–22 | Legia Warsaw (Ekstraklasa, 64) | prospect | .248 | 20 | 53 → 56 | 2 | 2 |
| 3 | 22–24 | Genoa CFC (Serie A, 74) | prospect | .158 | 13 | 56 → 57 | 1 | 1 |
| 4 | 24–26 | Genoa CFC | stay | .215 | 18 | 57 → 58 | 2 | 2 |
| 5 | 26–28 | Angers SCO (Ligue 1, 64) | prospect | .228 | 19 | 58 → 59 | 2 | 2 |
| 6 | 28–30 | Angers SCO | stay | .333 | 27 | 59 → **59** | 3 | 3 |
| 7 | 30–32 | Cardiff City (Championship, 54) | rotation | .489 | 40 | 59 → 58 | 5 | 4 |
| 8 | 32–34 | Cardiff City | stay | .317 | 26 | 58 → 54 | 3 | 2 |
| 9 | 34–36 | Beerschot (Challenger Pro, 38) | rotation | .396 | 32 | 54 → 48 | 3 | 3 |

Retires at 35 (block 9 end, OVR 48.4 is 10.9 below peak → `RETIRE_DROP` fires).
**10 rows · 209 apps · 23 g · 20 a · peak OVR 59 at 30 · best club Roma (88) · peak value ~€8m.**

Score: peak `50×(59−50)/45` = **10** · longevity `25×209/720` = **7** · club `25×((88−40)/55)²` =
**19** → **36 · SOLID PRO**.

### Policy B — always chase minutes

| k | Ages | Club | Status | m | Apps | OVR | G | A |
|---|------|------|--------|---|------|-----|---|---|
| 0 | 16–18 | Südtirol (Serie B, 47) | **loan** | .920 | 75 | 50 → 59 | 6 | 5 |
| 1 | 18–20 | KAA Gent (Belgian Pro, 61) | **loan** | .900 | 74 | 59 → 66 | 8 | 7 |
| 2 | 20–22 | Torino (Serie A, 68) | guaranteed | .898 | 74 | 66 → 73 | 10 | 8 |
| 3 | 22–24 | OGC Nice (Ligue 1, 74) | guaranteed | .920 | 75 | 73 → 76 | 12 | 10 |
| 4 | 24–26 | AFC Ajax (Eredivisie, 82) | guaranteed | .866 | 71 | 76 → 79 | 13 | 10 |
| 5 | 26–28 | Sevilla (La Liga, 84) | guaranteed | .856 | 70 | 79 → 80 | 13 | 10 |
| 6 | 28–30 | Atalanta BC (Serie A, 85) | guaranteed | .878 | 72 | 80 → **81** | 14 | 11 |
| 7 | 30–32 | FC Porto (Primeira Liga, 82) | guaranteed | .883 | 72 | 81 → 80 | 14 | 11 |
| 8 | 32–34 | Legia Warsaw (Ekstraklasa, 64) | guaranteed | .920 | 75 | 80 → 77 | 14 | 11 |
| 9 | 34–36 | Cardiff City (Championship, 54) | guaranteed | .920 | 75 | 77 → 72 | 14 | 11 |
| 10 | 36–38 | Sampdoria (Serie B, 46) | guaranteed | .851 | 70 | 72 → 65 | 11 | 9 |

Retires at 38 (block 10 is the last block).
**11 rows · 803 apps · 129 g · 103 a · peak OVR 81 at 30 · best club Atalanta (85) · peak value
~€46m.**

Score: peak `50×(81−50)/45` = **34** · longevity `25×803/720` → clamped **25** · club
`25×((85−40)/55)²` = **17** → **76 · STAR**.

### Verdict

| | A — biggest club | B — chase minutes | Δ | US-002 threshold |
|---|---|---|---|---|
| Peak OVR | 59 (age 30) | 81 (age 30) | **+22** | ≥8 ✅ |
| Total apps | 209 | 803 | **+594** | ≥80 ✅ |
| Goals | 23 | 129 | +106 | — |
| Best club | Roma (88) | Atalanta (85) | **−3** | — |
| Retired | 35 | 38 | +3 | 33–38 ✅ |
| Peak value | ~€8m | ~€46m | ×5.8 | — |
| **Career Score** | **36 · SOLID PRO** | **76 · STAR** | **+40** | — |

Block-0 divergence, which US-001 also gates: **8 apps vs 75** (≥30 required ✅) and
**+2 OVR vs +9** (≥3 required ✅).

**The policies diverge, and they diverge structurally.** With all noise zeroed the gap is still
40 points and two tiers. The mechanism is legible: A never plays, so `gainMult` sits near its
0.27 floor for a decade; B plays 90% of available minutes, so `gainMult` sits near its 1.28
ceiling, and the `stretch` term pays out because he is repeatedly one rung below his club's
demand while still starting.

**A's one win is best-club (19 vs 17)** — and that is the design working. D-1's three components
are genuinely three different routes, so the prestige-chaser is not simply dominated on every
axis. That is what makes the results-screen breakdown an argument rather than a verdict.

**What the proof also exposes:** Policy B is close to *optimal*, not merely different — chasing
minutes wins the two components worth 75 of the 100 points. The counterweights in v1 are the
`CHALLENGE_LO = −0.35` coasting penalty (already tuned to make pure-minutes non-trivial), the
best-club component, and Slice 07's events. This is a real residual risk, tracked as O-1 with a
named fix and a named trigger. It is a *lesser* failure than R2 — "solved" beats "slot machine" —
but it should not survive v2.

**Two fixed policies as regression fixtures.** `tools/test.mjs` asserts these exact tables. The
policies are `POLICY_BIGGEST` and `POLICY_MINUTES`, both pure functions
`(offers, state) => slotIndex`, reused as the "par" bot in Slice 09.

---

## Wave: DESIGN / [REF] Offer Generation

### The data, as it actually is

`data/clubs.json` was profiled before designing against it. The brief says prestige 5–99; **the
file's real range is 34–99**, mean 53.1, median 50.

| Bucket | 25–34 | 35–44 | 45–54 | 55–64 | 65–74 | 75–84 | 85–99 |
|---|---|---|---|---|---|---|---|
| Tier 1 (715) | 0 | 86 | 342 | 150 | 81 | 37 | 19 |
| Tier 2 (201) | 1 | 93 | 100 | 6 | 1 | 0 | 0 |

Consequences the design must respect:

1. **Bands must be expressed in the 34–99 space, not 5–99.** Any formula written against the
   brief's stated range would push half the offer targets below the floor and jam every low-band
   draw into the same 40 clubs.
2. **Prestige is stratified by league, not global.** Within a country, tier is almost perfectly
   recoverable from prestige (only England 70–72 and Spain 60–61 overlap, one club each side).
   Globally they overlap heavily: an English Championship club (mean 53.8) outranks the whole of
   the Dutch second tier and the floor of the Scottish top flight.
3. **Therefore the tier-1/tier-2 climb needs no separate mechanic.** It falls out of a rising
   `P_fit`. What it needs is *legibility* — see the display rule below.

### Reachable band

```
P_fit(ovr, age)  = (ovr + PROMISE[k] - 30) / 0.55            // inverse of demand()
P_hi             = clamp(P_fit + BAND_UP[k], 34, 99)
P_lo             = clamp(P_fit - BAND_DOWN,  34, 99)

PROMISE:   [ +8, +8, +7, +5, +3, +1,  0, -3, -6, -10, -10 ]
BAND_UP:   [ +18, +18, +18, +15, +15, +11, +11, +8, +8, +8, +8 ]
BAND_DOWN: 30 (constant — you can always drop)
```

`PROMISE` is the age-shaped premium a club pays for a future; it goes negative at 30 and is the
term that makes the giants stop calling. `BAND_UP` narrows with age for the same reason: the band
is widest at 16–20 (a prodigy can jump anywhere) and tightest after 30.

Worked checks against real clubs:

| Player | P_fit | P_hi | Reachable? |
|---|---|---|---|
| OVR 50, age 16 | 50.9 | 68.9 | Real Madrid (99) **no** ✅ · Wolfsburg (64) yes |
| OVR 55, age 18 | 60.0 | 78.0 | Sevilla (84) no · OGC Nice (74) yes |
| OVR 65, age 22 | 72.7 | 87.7 | Newcastle (88) no · Atalanta (85) yes |
| OVR 78, age 28 | 87.3 | 98.3 | Barcelona (98) yes · Real Madrid (99) no |
| OVR 78, age 32 | 76.4 | 84.4 | Sevilla (84) yes · Roma (88) **no** — the melancholy |
| OVR 70, age 34 | 54.5 | 62.5 | top flights closing |

The explicit anti-absurdity guarantee US-001 asks for — *a 50-rated 16-year-old is not offered
Real Madrid* — is the first row, and it is structural rather than a special case.

### The three offers

Exactly three slots, always distinct, always ≥6 prestige apart.

| Slot | Archetype | Target prestige | Status | PT |
|---|---|---|---|---|
| **A** | **Ambition** | `max(currentP, P_hi)` — the biggest thing available | `prospect` if target > `P_fit+10`, else `rotation`; `stay` if it *is* the current club | −4 / +2 / 0 |
| **B** | **Minutes** | `P_fit − 12`, clamped to `P_lo` | `guaranteed` (+6) — or **`loan`** (+8), see below | +6 / +8 |
| **C** | **Balance** | `P_fit`; **the current club is pinned here if `abs(currentP − P_fit) ≤ 12`** | `stay` or `rotation` | 0 / +2 |

Three rules that make this behave:

- **`stay` is always status `stay` (0), never `prospect`.** Staying put cannot change your standing
  at a club you are already at. Without this rule the sim produces an artefact where a player's
  minutes drop on a block where nothing changed.
- **Squeeze-out.** If `m < 0.15` for two consecutive blocks, the current club is removed from the
  offer set entirely, rendered as *"{Club} have told you to find regular football."* Without this,
  "always take the biggest club" is a dead end: an academy player who never plays never grows,
  so his band never rises, so his own club stays the biggest offer forever, so he plays eleven
  blocks of six appearances. The rule is realistic, it prevents a degenerate run, and it is what
  turns Policy A above into a plausible career instead of a flat line.
- **Current-club expiry.** The current club also drops off when `currentP > P_hi + 8` — a 32-year-old
  squad player is not renewed by a club two bands above him. This is the mechanic that produces
  the slow descent in both worked careers.

### Sampling

```js
// CLUBS is data/clubs.json.clubs, indexed once at load, sorted ascending by prestige.
function sampleClub(CLUBS, target, rnd, ctx){
  let tau = 5, pool = [];
  while(pool.length < 8 && tau <= 25){ pool = inRange(CLUBS, target-tau, target+tau)
       .filter(c => !ctx.played.has(c.name)); tau += 4; }
  const w = c => (1 / (1 + Math.abs(c.prestige - target)))
               * (ctx.loanCountry && c.country === ctx.loanCountry ? 3 : 1)
               * (ctx.stuckCountry === c.country ? 0.5 : 1);
  return weightedPick(pool, w, rnd);          // same running-total loop as buildPuzzle()
}
```

- **Triangular weight** around the target: the band is a plausibility filter, the weight is the
  realism. Extremes of the band are reachable but rare.
- **`played` exclusion** — never offered a club already in the career (except the pinned current
  club). Keeps the PATH row worth reading.
- **`loanCountry` ×3** — loan destinations are biased toward the parent club's country. Without
  it a Roma academy graduate gets loaned to a Dutch second-division side, which reads wrong.
- **`stuckCountry` ×0.5** — after two consecutive blocks in one country, halve that country's
  weight. Cheap texture; keeps the PATH from being ten Italian clubs.
- τ widens 5 → 9 → 13 … until ≥8 candidates exist, which is the guarantee behind US-002's AC
  *"no decision presents fewer than three options"* and closes R9 at both prestige extremes.

### Loan and climb arc

Loans are offered in Slot B when **all** of: `age ≤ 21`, `currentP ≥ P_fit + 10`, and fewer than
`MAX_LOANS = 2` taken.

- Loan target is `P_fit − 6` (not −12): a loan from a giant goes to a real club, and the +8 loan
  bonus already guarantees the minutes. This is what makes block 0 of Policy B a Serie B side
  rather than a Dutch second-tier club.
- `state.parent` holds the registered club for the loan's duration. A loan lasts exactly one
  block. On return, Slot A becomes *"Return to {parent}"* with status `stay`.
- The loan club **counts** for apps, goals, best-club prestige and the PATH; the parent club during
  a loan does not.
- PATH renders `Südtirol (loan)`.

**Climb legibility.** The offer card carries club, league and tier: `SÜDTIROL · SERIE B · 2nd tier
· ★★☆☆☆`. Stars are `ceil((prestige−34)/13)` clamped 1–5, type only, **no crests, ever (C1)**.
Because tier is near-perfectly recoverable from prestige within a country, dropping a tier and
climbing back is visible without any extra mechanic.

### Reputation drag — designed, shipped OFF

```
P_fit = 0.75 * ratingFit + 0.25 * rep,   rep' = 0.65*rep + 0.35*P_block,   rep0 = startClub.prestige
REP_WEIGHT = 0        // v1 ships at 0. The lever exists; it is not pulled yet.
```

A player who spends his twenties in the Championship should not be offered Real Madrid at 30 on
rating alone. This is the named fix for O-1 (chase-minutes near-dominance): it drags the
minutes-chaser's band down and holds the prestige-chaser's band up. It is **deliberately shipped
at 0** so v1 validates the simplest model that demonstrably diverges — the proof above stands on
constants a reader can check by hand. Trigger for enabling it is written into O-1.

---

## Wave: DESIGN / [REF] Event Engine

Slice 07's hard requirement: **events are data, not code.** Adding an event must mean adding a
JSON object to `data/career-events.json` and nothing else. The only thing that requires a code
change is inventing a *new kind of condition* or a *new kind of effect* — and that boundary is
made explicit below rather than left to erode.

### Schema — `data/career-events.json`

```json
{
  "version": 1,
  "events": [ { /* Event */ } ]
}
```

```
Event {
  id       : string            // stable, unique; appears in the decision path
  family   : "crossroads" | "gamble" | "offpitch" | "setback" | "peak"
  weight   : number            // relative selection weight within the eligible pool
  repeat   : "once" | "family-once" | "cooldown:N" | "always"
  when     : Predicate
  title    : string
  body     : string            // {club} {league} {name} {age} {ovr} interpolated
  options  : Option[]          // >= 2, and >= 1 must be certain (single outcome, p = 1.0)
}

Predicate {                    // every key optional; ALL present keys must hold (AND)
  ageMin, ageMax               : number
  ovrMin, ovrMax               : number
  prestigeMin, prestigeMax     : number
  minutesMin, minutesMax       : number     // last block's m
  blockMin, blockMax           : number     // block index
  blocksAtClubMin              : number
  valueMin                     : number     // €m
  tierIn                       : number[]
  positionIn                   : string[]
  requires                     : string[]   // tags the career must already carry
  excludes                     : string[]   // event ids or tags that block this one
}

Option {
  label    : string
  note     : string            // the stated-odds line, e.g. "55% Starter · 45% Bench"
  outcomes : { <key>: Outcome }
  odds     : [ [key, p], ... ] // p must sum to 1.0 +/- 1e-6; a single [key,1.0] = the safe out
}

Outcome { copy: string, effects: Effect[] }

Effect { k: EffectKey, v: number|string, for: number }   // for = blocks; 0 = permanent
```

### Effect vocabulary — the closed set

This table *is* the contract between the catalogue and the simulation. Every key maps onto a
named input of the sim above. Nothing else is expressible, which is what keeps events from
becoming code.

| `k` | Applies to | Composition | Typical `v` |
|---|---|---|---|
| `ptBonus` | surplus `s` | additive (rating points) | −10 … +8 |
| `growthMult` | positive-growth product | multiplicative | 0.6 … 1.4 |
| `declineMult` | decline multiplier | multiplicative | 0.85 … 1.3 |
| `ovrDelta` | `ovr`, one-shot at apply time | additive | −4 … +3 |
| `appsMult` | block appearances | multiplicative | 0.25 … 1.0 |
| `bandUp` | `BAND_UP[k]` | additive prestige | −10 … +12 |
| `bandDown` | `BAND_DOWN` | additive prestige | 0 … +20 |
| `valueMult` | market value | multiplicative | 0.5 … 1.6 |
| `forceOffer` | offer generation | pins one slot to an archetype (`"minutes"`, `"ambition"`) | string |
| `forceTier` | offer generation | restricts the sampled tier | 1 \| 2 |
| `tag` | career record | adds a permanent badge to the row, results screen and share | string |

**Composition rule.** Active effects live in `state.mods = [{k, v, until}]`. `applyMods(base, k)`
folds them: additive keys sum onto the base, multiplicative keys multiply. `until` is a block
index; `for: 0` means permanent. **`state.mods` is never persisted** — it is re-derived from the
decision path on every replay (see Determinism below), so an event's effects cannot drift between
a live run and a resumed one.

Ordering is fixed and documented so it is testable: `ovrDelta` applies immediately at the event;
`ptBonus` folds into `s` *before* the logistic; `growthMult`/`declineMult` fold in *after*
`GROWTH_CAP`; `appsMult` applies after `round(m*82)`.

### Selection

```js
const EVENT_RATE = [0.15,0.30,0.45,0.50,0.50,0.50,0.45,0.40,0.35,0.30,0.20];  // per block index
// sums to ~3.9 expected events per run -> Slice 07's "start at 3-4 and tune"

function pickEvent(EVENTS, ctx, rnd){
  if(rnd() > EVENT_RATE[ctx.k]) return null;
  const pool = EVENTS.events.filter(e => repeatOK(e, ctx) && eligible(e.when, ctx));
  if(!pool.length) return null;
  const w = e => e.weight * (e.family === ctx.lastFamily ? 0.35 : 1);   // family cooldown
  return weightedPick(pool, w, rnd);
}
```

Fired **after** the club decision resolves and **before** the next offer set is built, so an event
can legitimately shape what comes next via `forceOffer` / `bandUp`.

`repeatOK` implements the four repeat modes: `once` (id in `ctx.seenIds` → blocked),
`family-once` (family in `ctx.seenFamilies` → blocked), `cooldown:N` (id fired within N blocks →
blocked), `always`.

The `rnd() > EVENT_RATE` gate is drawn from the **`event.pick` sub-stream** and consumes exactly
one value whether or not an event fires, so the presence of an event never shifts any other draw.

### Three worked events, three families

```json
{
  "id": "new-manager-doesnt-rate-you",
  "family": "offpitch", "weight": 10, "repeat": "once",
  "when": { "ageMin": 20, "ageMax": 33, "prestigeMin": 55, "minutesMax": 0.55, "blocksAtClubMin": 1 },
  "title": "A new manager",
  "body": "{club} have appointed a coach who watched you twice and picked someone else both times.",
  "options": [
    { "label": "Fight for your place", "note": "45% win him over · 55% frozen out",
      "odds": [["won",0.45],["frozen",0.55]],
      "outcomes": {
        "won":    { "copy": "Two goals in a fortnight. He never mentions it again.",
                    "effects": [ {"k":"ptBonus","v":6,"for":1} ] },
        "frozen": { "copy": "You train with the group and travel with nobody.",
                    "effects": [ {"k":"ptBonus","v":-9,"for":1}, {"k":"valueMult","v":0.8,"for":1} ] } } },
    { "label": "Ask to leave", "note": "Certain — a move, a rung down",
      "odds": [["sure",1.0]],
      "outcomes": {
        "sure": { "copy": "The club does not fight to keep you. That stings more than the bench.",
                  "effects": [ {"k":"forceOffer","v":"minutes","for":1}, {"k":"bandUp","v":-6,"for":1} ] } } }
  ]
}
```

```json
{
  "id": "cup-final-on-a-broken-foot",
  "family": "gamble", "weight": 8, "repeat": "once",
  "when": { "ageMin": 22, "ageMax": 32, "prestigeMin": 60, "minutesMin": 0.45 },
  "title": "The final",
  "body": "A stress fracture, four days out. The specialist says six weeks. The manager says nothing.",
  "options": [
    { "label": "Play the final", "note": "40% hero · 60% out for months",
      "odds": [["hero",0.40],["broken",0.60]],
      "outcomes": {
        "hero":   { "copy": "You lasted 63 minutes and you will never buy a drink in this city again.",
                    "effects": [ {"k":"ovrDelta","v":2,"for":0}, {"k":"tag","v":"final","for":0},
                                 {"k":"valueMult","v":1.25,"for":1} ] },
        "broken": { "copy": "You came off at 31 minutes. The rest of the year happens without you.",
                    "effects": [ {"k":"appsMult","v":0.35,"for":1}, {"k":"growthMult","v":0.7,"for":1} ] } } },
    { "label": "Sit it out", "note": "Certain — you watch it in a suit",
      "odds": [["sure",1.0]],
      "outcomes": {
        "sure": { "copy": "They win it. You are in the photograph, at the edge.",
                  "effects": [ {"k":"growthMult","v":1.08,"for":1} ] } } }
  ]
}
```

```json
{
  "id": "relegated-as-best-player",
  "family": "setback", "weight": 9, "repeat": "cooldown:4",
  "when": { "ageMin": 21, "prestigeMin": 45, "prestigeMax": 78, "minutesMin": 0.5, "blocksAtClubMin": 1 },
  "title": "Down",
  "body": "{club} go down on the last day. You were their best player all season.",
  "options": [
    { "label": "Go down with them", "note": "Certain — a division lower, and loved",
      "odds": [["sure",1.0]],
      "outcomes": {
        "sure": { "copy": "The captain's armband, a smaller stage, and a stand that sings your name.",
                  "effects": [ {"k":"forceTier","v":2,"for":1}, {"k":"ptBonus","v":5,"for":1},
                               {"k":"bandUp","v":-4,"for":2} ] } } },
    { "label": "Take the release clause", "note": "65% a good move · 35% a bad one",
      "odds": [["good",0.65],["bad",0.35]],
      "outcomes": {
        "good": { "copy": "Three clubs called within an hour. You picked the one that plays.",
                  "effects": [ {"k":"forceOffer","v":"ambition","for":1}, {"k":"bandUp","v":6,"for":1} ] },
        "bad":  { "copy": "You are a squad player somewhere warmer and nobody sings anything.",
                  "effects": [ {"k":"ptBonus","v":-6,"for":1} ] } } }
  ]
}
```

### Catalogue validation — run in `tools/test.mjs`

The catalogue is a dependency the sim trusts. It must prove it can honour the contract rather than
be assumed to. `validateCatalogue(EVENTS)` asserts, and CI fails on any breach:

- every `id` unique; every `family` in the closed set
- every event has ≥2 options, and **≥1 option whose `odds` is a single `[key, 1.0]`** — Slice 07's
  *"there is always an out"*, enforced rather than reviewed
- every `odds` array sums to 1.0 ± 1e-6, every key present in `outcomes`
- every `Outcome` has ≥1 effect with a non-zero, non-identity `v` — Slice 07's *"every event
  changes a number"*, asserted rather than hoped
- every `k` in the effect vocabulary; every `v` inside that key's stated range
- every `when` key in the predicate vocabulary (catches typos that would silently make an event
  universally eligible)
- the catalogue is *reachable*: for each event, at least one point in a coarse state grid
  (age × prestige × minutes × block) satisfies its `when` — catches dead events
- a losing-every-gamble simulated career still reaches retirement with ≥3 offers at every decision
  (Slice 07's *"a loss is never a dead run"*)

---

## Wave: DESIGN / [REF] Determinism and State

### Seeding contract

```js
const path   = tokens.join('|');                       // committed choices, in order
const sub    = tag => mulberry32(hashStr(DATE + '|career|' + path + '|' + tag));
```

**Four independent sub-streams, not four reads off one stream.** Each `tag` produces a *different
FNV-1a input*, therefore a different `mulberry32` seed, therefore an uncorrelated sequence. This is
deliberately stronger than pulling successive values off a single generator, where changing how
many values one consumer takes silently shifts every downstream draw — a re-roll bug that would
be invisible until someone compared two runs.

| Tag | Consumes | Drawn over |
|---|---|---|
| `offers` | 3 club samples + status assignment | `path(k)` — decisions 0…k−1 only |
| `sim` | `PT_NOISE`, `GROWTH_JITTER`, goal/assist variance, retirement coin | `path(k+1)` — includes the choice just made |
| `event.pick` | the `EVENT_RATE` gate + weighted event selection | `path(k+1)` |
| `event.roll` | the stated-odds outcome | `path(k+1) + '|E' + optionIndex` |
| `flavour` | surname default, nationality, shirt number, foot | `DATE` only — identical worldwide |

The `path(k)` / `path(k+1)` split is the load-bearing detail: **offers for block k are drawn before
the block-k choice is in the path**, so the option set cannot depend on which option you are about
to pick. Everything after it does.

### Path grammar

One token per committed decision, appended in order. The path *is* the save file.

| Token | Meaning |
|---|---|
| `P:MF` | position choice (Slice 06) |
| `3B` | block 3, slot B taken |
| `E1` | event option index 1 taken |

Example: `P:MF|0B|1B|E1|2B|3A|4C`

Consequences, exactly as C4 and D-2 require:

- **Same choices ⇒ same career.** Every value is a pure function of `(DATE, path, CLUBS, EVENTS)`.
- **A reload cannot re-roll.** Outcomes are *recomputed*, never *restored*. There is no stored
  result to differ from a recomputation, because results are not stored.
- **Divergence at decision *j* is total.** A different token at position *j* changes the hash input
  for every draw from *j* onward, so two players who fork at decision 3 draw from genuinely
  independent streams thereafter.
- **Re-rolling is structurally impossible**, not merely discouraged. The only way to see a
  different outcome is to make a different choice — which is playing the game (defuses R8's
  engineering half; its social half remains accepted, per D-4).

### Persisted state

```js
// key: 'onze:' + todayStr() + ':career'      — matches the existing onze:<date>:<mode>:… convention
{
  v:    1,                                     // state schema version
  sig:  '2026-08-01|916|1|AS Roma',            // DATA_V | clubs.generated | events.version | startClub
  path: ['P:MF','0B','1B','E1','2B'],
  name: 'Ferreira'
}
```

**~150 bytes.** Nothing computed is stored — no career rows, no ratings, no `mods`, no `done`.
`done` is derivable (replay reaches retirement) and is therefore omitted rather than duplicated.
Everything is re-derived by `simulateCareer(CLUBS, EVENTS, date, path)`.

This is the smallest possible surface for the class of bug that C6 and R4 describe: there is no
stored value that can disagree with a recomputation, because there is no stored value.

**Signature guard.** `sig` includes `DATA_V`, `clubs.json.generated`, `career-events.json.version`
and the day's starting club. A mismatch discards the state and offers a fresh career rather than
resuming a corrupt one (US-003 AC). A replay that throws — an unknown slot letter after a
catalogue change, a path longer than the block table — is caught and treated identically.

### Resume contract

```js
const career = simulateCareer(CLUBS, EVENTS, date, path);
// -> { rows[], ovr, peakOvr, age, k, pending, retired, retireAge, path, bestClub, totals }
```

`pending` is either `{kind:'offer', offers:[a,b,c]}` or `{kind:'event', event, options}` or `null`
when retired. The UI renders `pending`; that *is* the resume. Reopening mid-run lands on the exact
decision index with every completed row intact, because the rows were never separately stored.
Reopening after retirement renders the finished career, the score, Share and a countdown, with no
control that starts a new run (D-4, US-003).

UTC rollover is already handled: the key contains `todayStr()`, and the existing
`visibilitychange` handler that serves the other two modes is reused unchanged.

### Storage that lies — `probeStorage()`

localStorage is a substrate that lies. Safari private browsing throws on write; quota can be
exhausted; the API can be present and non-functional. US-003 requires the career to remain fully
playable in that case with **no false "your progress is saved" copy** — which means the failure
must be *detected*, not assumed away.

```js
function probeStorage(){                       // called once at boot, before any career render
  try{
    const k = 'onze:probe';
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return ok;
  }catch(e){ return false; }
}
const PERSIST = probeStorage();
```

A write-read-delete canary, not a feature check — `typeof localStorage !== 'undefined'` is true in
exactly the browsers where writing throws. When `PERSIST` is false the mode plays start-to-finish
in memory and every persistence affordance and message is suppressed. Every individual read and
write remains guarded regardless.

The same principle applies to the two data files: `clubs.json` and `career-events.json` are
validated on load (`validateCatalogue`, plus a clubs shape check for `prestige ∈ [1,99]` and a
non-empty pool in each band). A failed validation hides the Career segment from `MODES` rather
than shipping a mode that produces nonsense — the mode refuses to start rather than start wrong.

---

## Wave: DESIGN / [REF] Component Decomposition

Same split the codebase already uses: **all game logic in `game.js` so `tools/test.mjs` exercises
the exact code the browser runs; all DOM in `index.html`.** Small pure functions, no classes, no
framework, no build step.

### `game.js` — new exports

```js
export const CAREER;                                     // frozen constants object (above)
export const POS_MOD;                                     // per-position modifiers
export const CAREER_TIERS;                                // [[min, label], ...]

// --- pure primitives -------------------------------------------------------
export function demand(prestige);                                       // -> number
export function minutesShare(ovr, k, prestige, status, pos, rnd);       // -> m in [0.06, 0.92]
export function blockOutcome(st, offer, rnd);                           // -> {apps,goals,assists,cs,ovrNext,value}
export function reachBand(ovr, k);                                      // -> {fit, hi, lo}
export function sampleClub(CLUBS, target, rnd, ctx);                    // -> club
export function buildOffers(CLUBS, st, rnd);                            // -> [offerA, offerB, offerC]

// --- events ----------------------------------------------------------------
export function eligible(when, ctx);                                    // -> boolean
export function pickEvent(EVENTS, ctx, rnd);                            // -> event | null
export function resolveEvent(ev, optIdx, rnd);                          // -> {key, copy, effects}
export function applyMods(base, key, mods, k);                          // -> number
export function validateCatalogue(EVENTS);                              // -> {ok, errors[]}  (test + boot)

// --- the one entry point the UI needs --------------------------------------
export function careerStart(CLUBS, date);                               // -> seeded 16-year-old
export function simulateCareer(CLUBS, EVENTS, date, path);              // -> full career projection
export function scoreCareer(career);                                    // -> {total, peakPts, lonPts, clubPts, tier}
export function careerShareText(career, streak, date);                  // -> string

// --- regression fixtures (also Slice 09 "par") -----------------------------
export const POLICY_BIGGEST;                                            // (offers, st) => slotIndex
export const POLICY_MINUTES;                                            // (offers, st) => slotIndex
```

**`simulateCareer` is the only function the UI calls to advance state.** Every render is a
projection of its return value; committing a decision is `path.push(token)` followed by a re-run.
This keeps `index.html` free of game logic and means the entire simulation is testable in Node
without a DOM — the same property that made `buildPuzzle` testable.

### `index.html` — changes

| Location | Change |
|---|---|
| `MODES` | add `['career','🎽 Career']` — verify three segments at 360px |
| `DATA_V` | bump; add `fetch('data/clubs.json?v=')` + `fetch('data/career-events.json?v=')` |
| `loadState(mode,…)` | add a `career` branch using the same signature-guard idiom; **do not invent a second persistence idiom** |
| `save()` | add a `career` branch writing `{v, sig, path, name}` |
| `render()` | add `renderCareer()` → dispatches to identity / offer / event / table / results views |
| `shareText()` | add a `career` branch (not a fork) delegating to `careerShareText()` |
| `shareUrl()` | add `case 'career': return 'https://onzedaily.com/?m=career'` |
| retirement | call existing `recordPlay()` — the `STREAK.last !== todayStr()` guard already makes it once-per-UTC-day across all three modes |
| boot | `PERSIST = probeStorage()`; hide the Career segment if `validateCatalogue` fails |

New render functions, all DOM-only: `renderCareerIdentity`, `renderCareerOffers`,
`renderCareerEvent`, `renderCareerTable`, `renderCareerResults`. None contains a number that is
not read from `simulateCareer`'s output — score and share can never disagree (US-005 AC).

---

## Wave: DESIGN / [REF] Reuse Analysis

| Existing primitive | Career use | Verdict |
|---|---|---|
| `hashStr` | all seed derivation | **REUSE** unchanged |
| `mulberry32` | all four sub-streams | **REUSE** unchanged |
| `todayStr` / `yesterdayStr` | day key, UTC rollover | **REUSE** unchanged |
| `bumpStreak` / `liveStreak` | streak bump on retirement | **REUSE** unchanged — existing guard covers cross-mode double-count |
| `visibilitychange` rollover handler | new-day detection | **REUSE** unchanged |
| `MOBILE_SHARE` touch gate + clipboard/`legacyCopy` chain | career share | **REUSE** unchanged |
| `loadState` / `save` signature-guard idiom | career persistence | **EXTEND** — new branch, same shape |
| `shareText()` mode branching | career card | **EXTEND** — one branch, do not fork |
| `shareUrl()` | `?m=career` | **EXTEND** — one case |
| `MODES` array + `onze:lastMode` fallback | third segment | **EXTEND** — one entry; unknown stored mode already falls back to `squad` |
| `DATA_V` | cache-bust two new data files | **EXTEND** — bump on any data change (C6) |
| `MEDIUM_BIAS` comment convention | the `CAREER` constants block | **REUSE** the convention, not the value |
| `buildPuzzle` weighted-sample loop (running total, `usedClub` set, guard counter) | `sampleClub` | **ADAPT** — identical shape, different weight function |
| `buildPlayerPuzzle` seeded-shuffle / no-repeat pattern | not needed | not used |
| `DATA.rosters[season][cid].w` fame weight | prestige source | **REPLACED** by `clubs.json.prestige` — see D-6 |
| `data/squads.json` | — | **NOT LOADED.** 4 MB; career mode reads only the 96 KB `clubs.json` |
| — | `simulateCareer`, `blockOutcome`, `buildOffers`, `reachBand`, event engine, `scoreCareer` | **NEW** |

Genuinely new code is confined to the simulation and the event engine. Every piece of daily-mode
plumbing — seeding, UTC day, persistence idiom, streak, share chain, mode toggle — is reused or
extended. That is why Slice 01 has no walking skeleton: there is nothing beneath it to build.

---

## Wave: DESIGN / [REF] Decisions

| # | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| **D-6** | **`clubs.json.prestige` replaces `squads.json` `w` as the single prestige source**, everywhere: offer sampling, ★ display, best-club score component. | Career mode must not load the 4 MB `squads.json` (page-weight guardrail: +50 KB). Slice 00 built `clubs.json` (96 KB, 916 clubs, 43 countries, two tiers) precisely so the climb arc has somewhere to happen. | Loading `squads.json` for `w` — blows the page-weight guardrail for one field. Duplicating `w` into `clubs.json` — two prestige scales that will drift. |
| D-7 | 11 blocks of exactly 2 seasons; retirement at end of block 8/9/10 → 9–11 rows | Preserves "each resolution advances exactly two seasons" while landing retirement in 33–38. Player *decisions* = 1 position + 9–11 club = 10–12, matching US-002's AC. | Variable-length first block (breaks the two-season rule); a 12th block to age 40 (retirement age out of range). |
| D-8 | Growth is `age-table × minutes × environment × challenge`, decline is `age-table × minutes` only | Makes decline inevitable on every path regardless of choices — the emotional spine — while keeping growth fully choice-driven. | A single symmetric curve: lets a strong player out-run decline, killing the arc. |
| D-9 | Coasting penalty (`CHALLENGE_LO = −0.35`) is wider than the stretch bonus (`+0.25`) | Without the asymmetry, "always take guaranteed minutes" is strictly dominant on every axis. | Symmetric clamp — measured, produced a solved game. |
| D-10 | Squeeze-out: two consecutive blocks under 15% minutes removes the current club from the offer set | Without it, "always take the biggest club" is a degenerate flat line — no growth, no band rise, same club forever. Also realistic. | Letting it stand: produces an 11-row career of six appearances, which is not a career. |
| D-11 | One position constant set with per-position modifiers, not four archetypes | Answers Slice 06's open question. Four archetypes is four tuning problems on a one-day slice. GK shows clean sheets instead of goals — answers the "table of zeroes" worry. | Four independent constant tables. |
| D-12 | Events are JSON with a **closed effect vocabulary** of 11 keys | Slice 07's "data, not code" only holds if the effect surface is closed. Adding an event = adding an object; adding a new *kind* of effect is the only code change, and that boundary is explicit. | Free-form effect expressions / a mini-DSL: turns the catalogue back into code and makes validation impossible. |
| D-13 | Four domain-separated RNG sub-streams (`offers`, `sim`, `event.pick`, `event.roll`), not sequential reads | Sequential reads off one generator couple every consumer: change how many values one takes and every downstream draw shifts. Distinct hash inputs are uncorrelated by construction. | One stream with a counter — the classic silent re-roll bug. |
| D-14 | Offers for block *k* are seeded over the path **excluding** the block-*k* choice; everything after includes it | The option set must not depend on the option about to be picked. | Seeding everything over the full path: makes offers self-referential. |
| D-15 | Persist `{v, sig, path, name}` only (~150 bytes); re-derive everything | There is no stored value that can disagree with a recomputation, because there is no stored value. Directly implements C4 and shrinks R4's blast radius. | Persisting career rows: two sources of truth, and the exact failure C6 warns about. |
| D-16 | `clubPts` is squared, not linear | 68% of `clubs.json` sits in prestige 35–54; linear hands 20/25 to a mid-table career. Squared, only genuine giants score. | Linear scale — makes the best-club component nearly free. |
| D-17 | Reputation drag designed but shipped at `REP_WEIGHT = 0` | v1 validates the simplest model that demonstrably diverges. The lever is written down with a named trigger rather than left as folklore. | Shipping it on (unvalidated, and the divergence proof would no longer be hand-checkable); omitting it (loses the named fix for O-1). |
| D-18 | `probeStorage()` write-read-delete canary at boot | `typeof localStorage !== 'undefined'` is true in exactly the browsers where writing throws. US-003 forbids false "saved" copy, which requires *detecting* the failure. | Feature detection; try/catch alone (catches writes but still shows the copy). |
| D-19 | `validateCatalogue` runs in `tools/test.mjs` **and** at boot; failure hides the Career segment | Slice 07's design rules ("every event changes a number", "there is always an out") are asserted, not reviewed. A mode that would produce nonsense refuses to start. | Review-time checking — erodes on the first hurried event addition. |

### Amendments to DISCUSS artifacts required by D-6

These are not optional; they are places the DISCUSS text names `w` or `squads.json` explicitly.

- **C2** — "Top-5 leagues only; the fame weight is the prestige ladder" is superseded by Slice 00.
  The universe is 916 clubs / 43 countries / 54 leagues / 2 tiers, and the ladder is
  `clubs.json.prestige`.
- **C6** — the `DATA_V` rule now attaches to `clubs.json` and `career-events.json`, not
  `squads.json`. The failure mode is unchanged and still the highest-consequence item in the feature.
- **US-001 AC** — "prestige indicator derived from the fame weight `w`" → `prestige`.
- **US-002 AC** — "using the fame weight `w`" → `prestige`; "all offered clubs existed in a top-5
  league" → "all offered clubs exist in `clubs.json` for the stated season".
- **US-003 Technical Notes** — "a `data/squads.json` change invalidates stored runs" → `clubs.json`.
- **US-004 AC** — best-club component reads `prestige`; point totals in the D-1 examples shift
  (tier labels do not).
- **Shared artifacts table** — replace the `club fame w` row with `club prestige`
  (`data/clubs.json`), still HIGH.

---

## Wave: DESIGN / [REF] Open Questions

| # | Question | Why it is open | Named trigger / next step |
|---|---|---|---|
| **O-1** | **"Always chase minutes" is close to optimal, not merely different.** It wins the two components worth 75 of 100 points. | The divergence proof shows the policies diverge (R2 answered), but also that one of them is strong. "Solved" is a lesser failure than "slot machine", and acceptable for v1 — not for v2. | If playtesting shows players converge on always-taking-guaranteed-minutes, or anyone describes the game as solved: set `REP_WEIGHT = 0.25` (D-17) and re-run both fixture policies. Second lever: raise `CHALLENGE_HI` to +0.35. |
| O-2 | Does a goalkeeper career read as interesting? | Clean sheets replace goals (D-11), but no one has read a GK table yet. | Slice 06. Hand-generate one GK career and one FW career and read both aloud. |
| O-3 | `EVENT_RATE` sums to ~3.9 events per run. Is that right? | Slice 07 says "start at 3–4 and tune". It is a guess with no evidence behind it. | Founder plays five runs and answers: could you recall a moment? Was there noise between the real decisions? |
| **O-4** | **D-6 changes the prestige source and therefore every score in the DISCUSS examples.** | Owner sign-off needed on the amendment list above. Tier *labels* still land where D-1 said they would; point totals move. | Peter's call before Slice 01 starts. This is cheap now and expensive after the first share card is posted. |
| O-5 | Loan destinations use a ×3 same-country weight. | Untested. Without it a Roma academy graduate gets loaned to the Dutch second division, which reads wrong; with it, small countries may loop. | Generate 50 seeded block-0 loan offers from five different starting clubs and read the list. |
| O-6 | Career rows are 9–11; US-002's AC says 10–12 decisions. | Reconciled by counting the position choice (D-7). Needs confirming rather than assuming. | Confirm with the AC's author; amend US-002 to say "9–11 career rows, 10–12 player decisions". |
| O-7 | `CAREER_TIERS` bands rest on two hand-simulated careers, not a distribution. | Floor ~5, A = 36, B = 76, estimated ceiling ~88. Three data points is not a calibration. | After Slice 02: run 500 seeded careers under 5 fixed policies, plot the score distribution, re-cut the bands once. Then freeze — D-1's version-marker warning applies. |
| O-8 | Should the share card name the biggest moment ("played the final on a broken foot")? | Slice 07's own open question. The `tag` effect key already carries the data; the share line is already tight at 60 characters. | Defer to Slice 05. The data exists either way, which is the point. |


---

## Wave: DELIVER / [REF] v1 shipped

All of v1 is live on onzedaily.com. Slices 00-07 built, verified in the browser and pushed.

| Slice | State | Notes |
|---|---|---|
| 00 Club universe | **shipped** | 916 clubs, 43 countries, 54 leagues, current-season divisions |
| 01 First decision | **shipped** | Career in the toggle; the day's club; the first fork |
| 02 A whole career | **shipped** | 9-11 blocks, growth then decline, retirement |
| 03 Resume | **shipped** | Only the decision path persists; a reload recomputes |
| 04 The number | **shipped** | Career Score /100 with its three components visible |
| 05 The share | **shipped** | Spoiler-free card with the club path |
| 06 Your position | **shipped** | First decision of all; GK table shows clean sheets |
| 07 Events | **shipped** | 16 events, five families, ~4.4 per career |
| 08 Honours | **shipped** | Trophy cabinet, caps, career totals; 4th score component (SCORE_VERSION 2) |
| 09 Par | **shipped** | Reproducible reference bot, per position, on the results screen and share |

### What changed from the design during build

1. **Block 0 exemption.** A 50-rated 16-year-old was instantly "outgrown" by his own academy, so
   the day's starting club never appeared in the career — breaking the mode's one promise. The
   squeeze-out and outgrown rules now start at block 1.
2. **Continuity weighting.** The sampler produced world tours (Israel to Scotland to Argentina to
   Portugal). Current-country x2.6 and home x1.8; the anti-repetition penalty now bites only after
   a third straight block in one country.
3. **EVENT_RATE 0.5**, giving ~4.4 events per career — the design left the rate open.
4. **TT-001 (analytics) is NOT built.** v1 ships uninstrumented, so the KPIs in this document
   remain unmeasurable. This is a known, accepted gap, not an oversight: it was gating the v2
   decision, and the v2 decision was made on product grounds instead.

### Open, carried forward

- **O-1 reputation drag** ships at REP_WEIGHT 0. Chasing minutes remains close to optimal rather
  than merely different. Trigger to pull the lever: if real careers cluster on one policy.
- **O-4 prestige source.** `clubs.json.prestige` replaced `squads.json`'s `w`; a few DISCUSS ACs
  still name the old source. Labels land where D-1 said; point totals moved.
- Tuning generally. The sim is honest but young; the constants are a first calibration, not a
  finished one.


### Post-launch, on the founder's play-testing

- **National-team difficulty.** Caps now scale with the strength of the country calling: ~76.5 OVR
  to break into Portugal or Brazil, ~66.5 for Cyprus. Being very good and being one of the best in
  your own country are different achievements, which is what makes "capped" worth reading.
- **Year-by-year career table.** The decision cadence is unchanged (a block is still two seasons);
  only the display is finer, with the rating interpolated and trophies marked on the season won.
- **Par exposed a position-balance bug.** `peakShift` was added rather than subtracted, inverting
  it, and shifting the whole growth curve was worth ~24 points of score. Position choice was
  therefore a scoring decision disguised as a style one — par by position ran GK 50 / FW 88. It now
  moves only the ageing half of the curve; spread is 4 points. A test fails if any position drifts
  more than 12 points of par, so it cannot silently regress.

**All nine slices are shipped.** What remains is not features but calibration: the constants are a
first pass, REP_WEIGHT is still 0, and — the honest gap — the mode is uninstrumented, so none of
this document's KPIs can be measured yet.
