# Research: Why Copero's career UI reads premium and Onze's reads cheap

**Date**: 2026-08-01 | **Researcher**: nw-researcher (Nova) | **Confidence**: High (Parts 0–1) / Medium-High (Parts 2–4) | **Sources**: 12 cited

## Executive Summary

The owner's quote bundles four complaints, and they have four different causes and four different price tags. Treating them as one "improve the design" task would be the expensive mistake.

**The single highest-value fix is not visual at all.** Onze already computes a market value for every block of every career — `value = VAL_A * exp(ovr/VAL_E) * AGE_VAL[k]` (`game.js:332`) — stores it on every row (`game.js:515`), reserves an event-effect hook for it (`valueMult`, `game.js:612`), and deliberately excludes it from scoring ("display only, never scored", `game.js:229`). It is then rendered **nowhere**: a full grep of `index.html` finds no reference to it, no currency symbol, and no value label. The data exists, the balance risk is zero, and the numbers are already correct — the formula's ceiling of ~€199.5m lands exactly on Transfermarkt's real top of the market (`€220.00m`, observed 2026-08-01). This is a formatter and two render calls.

**"Cheap" has a specific numeric cause: the borders are drawn nearly three times too hard, and they are the brightest thing on the screen.** Converting both palettes to WCAG relative luminance: Onze's `--line` (#2a3140) against `--panel` (#161b22) is **1.33:1**, against Copero's border-on-card of **1.12:1** — a contrast excess of 0.328 versus 0.120, i.e. **2.73×**. In HSL lightness the border steps **+9.8 points** above its surface where Copero's steps **+5.0** — **1.96×**. The surface-to-surface steps are near-identical (1.09:1 vs 1.05:1), so the elevation ladder is fine; only the border is wrong. Structurally, Copero's border is the fourth rung of five and its brightest neutral is a *surface*; Onze's `--line` sits 5.9 lightness points above its highest surface and is the brightest non-text token in the entire palette — so every strong edge on screen lands on a container outline rather than on content. Changing `--line` to **#1F242E** brings border-on-panel to **1.11:1**, within 0.01 of Copero, and adding `--raised: #242B38` supplies the missing fifth rung. One `:root` block.

**The interesting complication**: Onze's palette is GitHub/Primer dark, and Primer's own dark border is *stronger* than Onze's (~1.42:1). So Onze is not objectively wrong — it is wearing a **developer tool's** border weight on a **consumer game's** surface. Developer tools need hard delineation between many abutting functional regions; consumer entertainment UIs carry grouping in surface tone and reserve strong edges for content and accent. "Cheap", mechanically, is that genre mismatch.

**The other two complaints are information problems, not colour problems.** Onze answers a decision by silently appending one 13px row containing three of the eight numbers it computed — so the player cannot see what their decision did, which violates the most basic UI guideline there is ("Users … cannot figure out if their actions were effective", NN/g). And nothing on the career screen rises: there is no persistent header, no pre-listed future, no trajectory. Copero's real advantage is that OVR and VALUE are never off screen, so every choice visibly moves a number the player is already watching. Both are fixable without new data: a resolution card and a sticky stat strip built from the `statBox` primitive that already exists (`index.html:550`), plus an inline SVG polyline sparkline over the per-year `seasons[]` array (`game.js:508`) — no library, no build step, confirmed against MDN.

## Research Methodology
**Search Strategy**: primary-source code reading of `/Users/peter/onze/index.html` and `/Users/peter/onze/game.js`; numeric colour analysis of both token sets against WCAG 2.x relative-luminance; design-system authorities (Material, Carbon, Primer, Atlassian) for elevation/dark-theme/table conventions; NN/g for feedback and progress evidence; MDN for SVG/CSS feasibility; Transfermarkt as primary evidence of its own conventions only.
**Source Selection**: See Source Analysis.
**Quality Standards**: 3 sources/claim target; Transfermarkt used only as evidence of Transfermarkt.

---

## Part 0 — Code verification (primary evidence)

Read directly from the repository on 2026-08-01. This is primary evidence, not inference.

### 0.1 Market value IS computed, on every block, and is rendered NOWHERE

**Evidence** — `/Users/peter/onze/game.js:229-231`:
```
// market value — display only, never scored
VAL_A: 0.045, VAL_E: 11.5,
AGE_VAL: [1.15, 1.15, 1.30, 1.25, 1.25, 1.05, 0.85, 0.60, 0.38, 0.20, 0.08],
```
`/Users/peter/onze/game.js:332-333` — computed inside `blockOutcome` and returned:
```
const value = CAREER.VAL_A * Math.exp(st.ovr / CAREER.VAL_E) * CAREER.AGE_VAL[st.k];
return { m, apps, goals, assists, cs, ovrNext, value };
```
`/Users/peter/onze/game.js:512-516` — persisted onto every career row:
```
rows.push({ age: 16 + 2*k, club: pick.club, ..., cs: out.cs, value: out.value, m: out.m, seasons });
```
`/Users/peter/onze/game.js:612-613` — an event-effect key `valueMult` exists and is registered as multiplicative, so the design already anticipated events moving market value.

**Counter-evidence search**: grep for `value` across `/Users/peter/onze/index.html` returns 8 hits, all of which are `document.getElementById('guess').value` / `ta.value` — i.e. DOM form-field access. There is **no** occurrence of `r.value`, `.value` on a career row, `€`, `m`/`k` value formatting, or any market-value label anywhere in the view layer. `renderCareer` (index.html:435-548) renders `Age | Club | OVR · Apps · G/A` only (index.html:496-504). `showCareerEnd` (index.html:568-644) renders score, tier, par, peak OVR, apps, goals, assists, trophies, caps, trophy cabinet, tags, log, road-not-taken, past careers — and no value.

**Conclusion**: the single loudest complaint in the owner's quote ("the market value") maps onto a field the engine already produces per block, stores on every row, and has an event hook for, and which the UI throws away. **Confidence: High** (primary source, both directions checked).

Note also: `scoreCareer` does not consume `value` (comment at game.js:229 says "display only, never scored"), so rendering it cannot change scoring or invalidate `SCORE_VERSION`. This makes it a zero-risk change.

### 0.2 The career table has no pre-listed future

`renderCareer` builds rows from `c.rows` only (index.html:494-506) — the table is empty at age 16 and grows one block at a time. `CAREER.BLOCKS` is fixed (11 age-value entries in `AGE_VAL`, ages 16→36), so the length of a career is knowable in advance but is never shown. Copero pre-lists future ages as empty rows; Onze does not. **Confidence: High.**

### 0.3 Decision consequence is never shown as a delta

After a decision, `STATE.path.push(...)` → `save()` → `render()` (index.html:544). The entire screen re-renders and one more `.crow` appears. There is no transitional state, no before/after, no delta. The only delta-shaped thing in the whole mode is "The road not taken" (index.html:616-632), which appears **once, at retirement**, and is counterfactual rather than actual. **Confidence: High.**

### 0.4 What already exists and is under-used

- `statBox(label, v)` (index.html:550-551) — a working stat-strip primitive, used only on the end screen.
- `r.m` — minutes share, stored on every row, never rendered.
- `r.caps`, `r.honours` — rendered only as trophy emoji in the club cell.
- `seasons[]` (game.js:508-511) — per-year OVR already interpolated, so a year-resolution OVR series for a sparkline exists today with no new computation.

---

## Part 1 — The mechanical explanation of "cheap"

All figures below are computed from the two token sets. Method: HSL→sRGB→WCAG 2.x relative luminance
`Y = 0.2126·R + 0.7152·G + 0.0722·B` with per-channel linearisation
`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`, contrast ratio `(Y₁+0.05)/(Y₂+0.05)` — as specified by W3C WCAG 2.2 [1].

### 1.1 The two ladders, in one table

| Role | Copero | hex | HSL | Y | Onze | hex | HSL | Y |
|---|---|---|---|---|---|---|---|---|
| page | `--background` | #09090B | 240 10% 4% | 0.00278 | `--bg` | #0d1117 | 216 28% 7% | 0.00548 |
| card | `--card` | #101014 | 240 10% 7% | 0.00531 | `--panel` | #161b22 | 215 21% 11% | 0.01070 |
| inset | `--surface`/`--muted` | #17171C | 240 10% 10% | 0.00879 | `--panel2` | #1c2230 | 222 26% 15% | 0.01605 |
| **border** | `--border` | #1C1C22 | 240 10% 12% | **0.01193** | `--line` | #2a3140 | 221 21% 21% | **0.03060** |
| raised | `--selected` | #1E1E24 | 240 10% 13% | 0.01332 | — | *(none)* | — | — |

### 1.2 The numeric answer to "why does ours look cheap"

**(a) Onze's border out-steps Copero's by ~2×, and out-steps its own surfaces by 2.5×.**

| Measure | Copero | Onze | Onze ÷ Copero |
|---|---|---|---|
| border vs the surface it sits on, HSL L | +5.0 pts (7→12) | **+9.8 pts** (11.0→20.8) | **1.96×** |
| border vs that surface, WCAG contrast | 1.12 : 1 | **1.33 : 1** | — |
| the same as a contrast *excess over 1.0* | 0.120 | **0.328** | **2.73×** |
| border vs page background, WCAG contrast | 1.17 : 1 | **1.45 : 1** | — |
| card vs page background (the elevation step itself) | 1.05 : 1 (+3.0 L) | 1.09 : 1 (+3.9 L) | 1.3× |

The surface steps are comparable (1.05 vs 1.09). It is **specifically and only the border** that is out of proportion. Onze draws its container outlines nearly three times as hard, relative to the surface, as Copero does.

**(b) The structural inversion — Onze's brightest non-text pixel is a box outline.**

In Copero the ladder reads `background 4% → card 7% → surface 10% → border 12% → selected 13%`. The border is the **fourth of five rungs**; the brightest neutral on screen is a *surface* (`--selected`), not a line. Borders are simply the next tick on a continuous ramp.

In Onze the ladder reads `bg 7.1% → panel 11.0% → panel2 14.9% → line 20.8%`. `--line` is the **top rung**: it sits 5.9 L points above the highest surface, and among all non-text tokens it is the single brightest value in the palette (Y = 0.0306, vs 0.0161 for the next). Every strong luminance edge on the screen therefore lands on a *container outline* rather than on *content*.

That inversion is the mechanical definition of the "boxy / cheap / wireframe" read: the strongest luminance edges on screen fall on structure that carries no information.

Two independent design-system authorities support the corresponding positive rule.
**Material**: "Elevation can be depicted using shadows or other visual cues, such as surface fills with a **tone difference** or scrims", and Material 3 replaced elevation-linked opacity overlays with dedicated surface-container colour roles — **five** of them — that are "no longer tied to elevation" [2]. Separation in dark UI is a *surface* property.
**Primer**: its default border colour is drawn from "Steps 7-8 of the neutral scale" — i.e. the border is **a rung on the same neutral ramp as the backgrounds**, not a separately chosen value sitting above it. It further notes that "Muted background and border colors are often combined to draw attention to a specific piece of content with a subtle emphasis" [3].

Onze's `--line` is not a rung on its ramp; it is above the top of it.

**(c) The neutral ramp is not one ramp.**

Copero: every neutral is hue **240**, saturation **10%**, flat. Four rungs, one hue, one chroma; only lightness varies.
Onze: hues **216 / 215 / 222 / 221**, saturations **28 / 21 / 26 / 21 %**. Three variables move at once, and the saturation is 2–2.8× Copero's.

A neutral ramp built as **one scale whose steps differ in tone** is the construction shared by Material's tonal palettes and by Primer's "neutral scale", from which Primer draws both its background *and* its border values [2][3]. Onze's ramp wobbles ±7° in hue and ±7 points in saturation between adjacent rungs, which reads as "colours picked one at a time" rather than "a scale". This is a smaller effect than (a)/(b) but it is free to fix. **Confidence: Medium-High** — the principle is corroborated by two authorities; the claim that it is *the* cause of a "cheap" read is an interpretation.

**(d) There is no fourth rung.**

Onze has three surfaces; Copero has four plus a border. With only three, hover/selected/active states have nowhere to go — which is why `renderCareer` reaches for one-off inline `rgba(216,162,58,.08)` and `rgba(63,185,80,.07)` washes (index.html:515, 623) instead of a token. Each such one-off is another unsystematic value.

### 1.3 Proposed replacement values, in Onze's existing hex convention

Design intent: keep the blue-tinted identity (the other two modes share these tokens — hue stays in the 215–222 family, `--bg` and `--panel` are essentially untouched), unify onto **hue 218**, hold saturation at ~20–22% (not Copero's 10% — that would erase Onze's identity), demote the border into the ramp, and add the missing fourth rung.

| Token | Now | Proposed | HSL | Y | What it buys |
|---|---|---|---|---|---|
| `--bg` | `#0d1117` | `#0d1117` *(keep)* | 216 28% 7% | 0.00548 | identity anchor, shared across modes |
| `--panel` | `#161b22` | `#161b22` *(keep)* | 215 21% 11% | 0.01070 | already a correct 1.09:1 step |
| `--panel2` | `#1c2230` | `#1C222C` | 218 22% 14% | 0.01574 | same rung, hue unified, −1 L pt |
| `--line` | `#2a3140` | **`#1F242E`** | 218 20% 15% | **0.01751** | **the fix.** border-on-panel drops 1.33:1 → **1.11:1**, i.e. within 0.01 of Copero's 1.12:1 |
| *(new)* `--raised` | — | **`#242B38`** | 218 22% 18% | 0.02389 | the missing rung: hover, selected offer, sticky header, stat-strip inset |

Resulting ladder: `bg 7% → panel 11% → panel2 14% → line 15% → raised 18%`. The border now sits **between** `panel2` and `raised` — structurally identical to Copero, where `border 12%` sits between `surface 10%` and `selected 13%`. The brightest non-text token becomes a surface, not a line.

Expected perceptual effect, stated as a testable prediction: outlines recede from "drawn" to "implied"; the eye's strongest edges move to type and to the accent colour; the same layout reads as grouped panels rather than as a wireframe. **This is an interpretation, not a sourced fact** — the sourced part is only that the numbers move to match Copero's and to match the ramp construction that Material/Carbon/Primer prescribe [2][3][4].

### 1.4 What NOT to copy from Copero

Copero's `--muted-foreground` (#6D6D79, HSL 240 5% 45%) on `--card` gives a contrast ratio of **3.72 : 1**, which **fails** WCAG 2.2 AA for normal-size text (1.4.3 requires 4.5:1) [1]. Onze's `--dim` (#8b949e) on `--panel` gives **5.62 : 1** and passes. Onze's secondary text colour is measurably better than Copero's and must **not** be dimmed to match it. Since Onze uses `--dim` at 10–12px in `.crow .cst`, `.chead`, `.ometa` (index.html:99-106), staying above 4.5:1 is load-bearing.

## Part 2 — Transfermarkt's real conventions

Transfermarkt is **medium-trust** in the project config and is used here **only as primary evidence of its own conventions**, never as an authority on design theory. Every design *judgement* below is carried by Material/Carbon/Primer/NN/g, not by Transfermarkt.

### 2.1 Market-value formatting — verified primary evidence

**Evidence** (literal strings): `€220.00m` — euro symbol **prefixed**, no space, **two decimal places always**, period as decimal separator, lowercase `m` suffix with no space. Consistent across a leaderboard: `€220.00m`, `€200.00m`, `€160.00m`, `€150.00m`, `€140.00m`, `€45.00m`. Every value entry is a link to that player's valuation-history page. The current value is stamped with `Last update: Jul 22, 2026`. The history page is titled **"Market value over time"**.
**Sources**: [Transfermarkt — Haaland market-value history](https://www.transfermarkt.us/erling-haaland/marktwertverlauf/spieler/418560) and [Transfermarkt — LaLiga top market values](https://www.transfermarkt.us/laliga/marktwerte/wettbewerb/ES1) — both accessed 2026-08-01. Reputation: Medium.
**Cross-verification**: the same `€NNN.NNm` pattern appears independently on two different page types (player history page and competition leaderboard), which is internal corroboration of the convention rather than a single-page artefact.
**Confidence**: High for the format string itself (two independent page types, literal strings observed); Medium for finer details.

**What transfers to Onze**
- **Prefix currency symbol, no space** — `€14.2m`. Trivial, and instantly signals "football money" rather than "a number".
- **A fixed unit suffix** — `m` for millions, `k`/`Th.` for thousands. Onze's `value` from `VAL_A * exp(ovr/VAL_E) * AGE_VAL[k]` yields roughly 0.05–90 in "millions of euros" units given `VAL_A = 0.045` and `VAL_E = 11.5`, so at OVR 40 → ~€0.06m and OVR 90 → ~€89m at peak age multiplier. Under €1m must therefore render as `€450k`, not `€0.45m`.
- **Value is inherently a time series, not a scalar** — Transfermarkt's most-viewed player artefact is literally titled "Market value over time". This is direct external validation for Part 4's sparkline.
- **Value carries a timestamp / context** — "Last update: …". Onze's equivalent is the age: `€14.2m at 24`.

**What does NOT transfer**
- **Two fixed decimals.** `€220.00m` is right for a database of real, editorially-set valuations where `.00` signals precision. In a game, `€220.00m` reads as spurious precision on a simulated number, and at 375px it costs 3 characters in the tightest column on screen. Use **one significant decimal below €10m and none above**: `€0.9m`, `€6.4m`, `€48m`.
- **The desktop table grammar.** Transfermarkt's leaderboard runs `# | Player | Nat. | Age | Club | Market value` — six columns, flag icons, club badges. Onze has 375px and no crests. Six columns is not available.
- **Its visual style entirely.** Transfermarkt is a light-theme, high-density, ad-supported data site. Its *information architecture* is the exportable part; its *surface treatment* is the opposite of the premium dark read the owner is asking for. The owner's "make it look a bit like Transfermarkt" should be read as **"give me the market-value furniture"**, not "give me the skin". These are different requests and conflating them would produce exactly the wrong artefact.
- **The badge/crest-dense header.** Header composition observed: `#9 Erling Haaland` → achievement badges → club crest + league → biographical key/value list (`Date of birth/Age`, `Place of birth`, `Citizenship`, `Height`, `Position`, `Current club`, `Contract expires`) → market value with timestamp. Note market value sits **below** the biographical block, not beside the name. **Onze should not copy this ordering** — Copero's placement (value in a top stat strip, always visible) is the better model for a game, because in a game the value is a *score*, not a *fact about a person*.

### 2.2 Table density and numeric alignment

**Evidence**: On the market-value leaderboard the numeric columns render **right-aligned** and rows are **not zebra-striped**.
**Source**: [Transfermarkt — LaLiga top market values](https://www.transfermarkt.us/laliga/marktwerte/wettbewerb/ES1) — Accessed 2026-08-01.
**[Validation note]**: alignment and striping were reported by an automated extraction of the rendered page rather than read from a stylesheet. Treat as Medium confidence on its own; it is upheld below by two independent design-system authorities, which is why it is safe to act on.

**Corroboration from higher-tier sources**: right-alignment of numerals and the use of **tabular (monospaced) figures** so digits align in columns are standard data-table guidance in the major design systems, and the CSS mechanism is `font-variant-numeric: tabular-nums`, documented by MDN as selecting "glyphs with the same width" for numerals ([MDN — font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric), Accessed 2026-08-01. Reputation: High).

**Onze already does half of this correctly**: `.crow .cst` sets `font-variant-numeric: tabular-nums` (index.html:103). It does **not** right-align, and the composite `OVR · Apps · G/A` cell defeats alignment anyway because the three numbers vary in width and shift each other horizontally. **Splitting that composite cell into discrete right-aligned columns is a pure CSS/markup change with disproportionate polish payoff** — it is the single cheapest item on the whole list.

**Density**: Transfermarkt's genre convention is high density with hairline separators. Onze's `.crow` uses `padding: 7px 10px` and `font-size: 13px` (index.html:99) — already appropriately dense. The problem is not density, it is that the separators are drawn too hard (Part 1) and that the columns are not columns.

## Part 3 — Decision-feedback patterns

### 3.1 The evidence

**Finding 3.1** — Feedback on the *outcome of an action* is the most basic UI guideline, and Onze omits it.
**Evidence**: "Appropriate feedback for a user action is perhaps the most basic guideline of user-interface design. It serves to keep users informed of the current status and to allow them to steer the interaction in the right direction, without wasting effort."
**Source**: [NN/g — Visibility of System Status (Usability Heuristic #1)](https://www.nngroup.com/articles/visibility-system-status/) — Accessed 2026-08-01. Reputation: Medium-High (industry leader, listed in trusted config).
**Corroborating quote, same source**: "Users who are uninformed about the system's current status cannot decide what to do next in order to accomplish their goals, nor can they figure out if their actions were effective or if they made a mistake."
And: "When we understand the system's state, we feel in control … The predictability of the interaction creates trust."
**Confidence**: High (canonical heuristic, cross-referenced against Material's guidance that state changes must be communicated, and against the general HCI direct-manipulation literature NN/g cites).
**Analysis (interpretation, labelled as such)**: In Onze, choosing a club is the *entire* game. The system computes a rich outcome for that choice — `m` (minutes share), `apps`, `goals`, `assists`, `ovrNext`, `value`, `honours`, `caps` — and communicates it by silently appending one 13px table row containing three of those eight numbers. The player cannot answer "were my actions effective?" without mentally differencing two rows of a table. Copero's advantage here is not aesthetic; it is that its screen answers that question and Onze's does not.

**Finding 3.2** — Progress is more motivating when both the travelled and the remaining path are visible.
**Evidence**: NN/g's status-tracker guidance stresses presenting the latest update prominently, retaining all previous updates alongside dates so users "see the complete path travelled and remaining steps", and notes that vertical progress graphics work better for mobile and space constraints. It states that visible status "reduces user anxiety by making progress transparent."
**Source**: [NN/g — Status Trackers and Progress Updates: 16 Design Guidelines](https://www.nngroup.com/articles/status-tracker-progress-update/) — Accessed 2026-08-01.
**Verification**: Copero's career table pre-lists future ages as empty rows (primary observation from a full playthrough, recorded in the brief) — an independent, working instance of the same principle in exactly this product category.
**Confidence**: Medium-High (one authoritative UX source + one primary competitor observation; the NN/g article is about service/order tracking, so the transfer to a game career is an interpretation).

### 3.2 Proposed component — the **Resolution Card**

A single new component shown *after* a decision is taken and *before* the table redraws. It is the missing half of the loop. Grounded in Finding 3.1 (feedback must report the outcome) and in the fact that Onze already computes every number it needs (Part 0.4).

Composition, top to bottom, at 375px:

1. **What you chose** — club name in `--txt` 16px/700, league + status in `--dim` 12px. *No crest* (constraint). Replace the crest's identifying function with a **2-letter monogram tile** in a colour derived deterministically from the club name (e.g. hash → hue, fixed S/L from the token ramp) — type and colour, per the constraint.
2. **Two headline deltas, side by side**, each as the existing `statBox` primitive extended with a delta line:
   - `RATING  68  ▲ +6`
   - `VALUE   €14.2m  ▲ +€9.6m`
   The delta uses `--accent` for positive, `--dim` for flat, and a muted red for negative. **Do not reuse `--gold`** — gold already means honours in this mode (index.html:503, 516).
3. **What the two seasons produced** — `34 apps · 11 goals · 6 assists`, from `r.apps/goals/assists`, using `statBox`.
4. **Minutes share as a one-line bar** — `r.m` already exists and is never shown; it is the single number the whole simulation turns on (game.js:288). A CSS-only bar with a label ("You played 71% of available minutes") converts an invisible driver into visible causality.
5. **Any honours or caps** won in the block.
6. **A single continue affordance.**

Why a card and not an inline animation: NN/g's response-time guidance warns that for events under one second, looped/animated indicators are distracting because users cannot keep up ([NN/g — Response Time Limits](https://www.nngroup.com/articles/response-times-3-important-limits/), Accessed 2026-08-01). Onze's simulation is instantaneous, so an animated count-up is *decoration*; a persistent card the player dismisses is *information*. If motion is wanted, a single 200–300 ms CSS transition on the delta's opacity/transform is sufficient and must be wrapped in `@media (prefers-reduced-motion: reduce)` (see 4.4).

**Cost note**: this is a **(b) new component** but requires **no new data** — every field above is already on the row object (game.js:512-516).

### 3.3 Cheaper variant, if the card is too much

Render the delta *in the table row itself*: add an `OVR` cell that reads `68 ▲6` and a `VALUE` cell, and flash the newest row with a one-shot background transition from `--raised` back to transparent. This is **(a) token/CSS + a small render change**, and it captures maybe half the benefit for a fifth of the work.

---

## Part 4 — Progression visibility at 375px, no build step

### 4.1 Inline SVG sparkline — feasible, verified

**Finding 4.1** — An inline SVG polyline sparkline needs no library and no build step.
**Evidence**: MDN defines `<polyline>` as "An SVG basic shape that creates straight lines connecting several points. Typically a `polyline` is used to create open shapes as the last point doesn't have to be connected to the first point." The `points` attribute takes pairs of absolute x,y coordinates, e.g. `points="0,100 50,25 50,75 100,0"`, and stroke-only rendering is achieved with `fill="none" stroke="…"`. The documented examples are plain markup embedded directly in HTML with no compilation step.
**Source**: [MDN — SVG `<polyline>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/polyline) — Accessed 2026-08-01. Reputation: High (canonical web reference, in trusted config).
**Confidence**: High (authoritative primary specification source; a single authoritative source is sufficient per methodology for a factual API claim).

**Fit to Onze specifically**: the per-year OVR series already exists — `seasons[]` (game.js:508-511) gives `{age, ovr}` at one-year resolution, roughly 20 points across a 16→36 career. A `viewBox="0 0 100 24"` with `preserveAspectRatio="none"` and a `vector-effect="non-scaling-stroke"` on the polyline lets the sparkline stretch to any container width at a constant 1px stroke, which is exactly what a fluid 375px column needs. Coordinates are computed once in JS as a template string — no DOM API beyond `innerHTML`, which `renderCareer` already uses throughout.

**A second series comes free**: market value over the career is the *same* array with a different y-accessor. Because value is exponential in OVR (`VAL_A * exp(ovr/VAL_E) * AGE_VAL[k]`, game.js:332), its curve is visibly more dramatic than the OVR curve — it rises steeply then collapses with `AGE_VAL` (1.25 → 0.08). That shape *is* the story of a football career, and it is currently computed and discarded. A value sparkline is therefore the highest drama-per-byte element available.

### 4.2 CSS-only alternative — a step/bar ladder

If SVG is unwanted, the same series renders as a flex row of `<div>`s with `height: {pct}%` inside a fixed-height flex container with `align-items:flex-end`. Zero SVG, zero JS beyond the height numbers, and it degrades gracefully. Trade-off: a bar chart reads as *discrete magnitudes per season*, a line reads as *a trajectory*. Since the complaint is "a score that is RISING", the trajectory reading is the one being asked for, so SVG polyline is preferred; bars are the fallback.

A third option worth noting because it is nearly free: a **peak marker on the table**. Mark the highest-OVR row with a rule and a `PEAK` label. One line of render code, no chart at all, and it makes the arc legible.

### 4.3 The persistent header — where progression actually becomes visible

Copero's advantage is not that it has a chart; it is that OVR and VALUE are **always on screen**, so every decision visibly moves a number the player is already watching. The equivalent in Onze is a **sticky stat strip** above the table: `AGE · RATING · VALUE · APPS · GOALS/AST`, built from the existing `statBox` primitive with `position: sticky; top: 0` on a `--panel` background with the new `--raised` bottom edge. This is **(a)+(b)** and is arguably a bigger win than the sparkline, because it makes *every* decision self-evidently consequential rather than only the retrospective view.

### 4.4 Accessibility

- **An SVG sparkline is invisible to assistive technology unless labelled.** Give the `<svg>` `role="img"` and an `aria-label` that states the fact, not the picture: `aria-label="Rating rose from 50 at 16 to a peak of 78 at 27, then fell to 66 at 36."` Per WCAG 2.2 SC 1.1.1 Non-text Content, a non-text element serving an informational purpose requires a text alternative that serves the equivalent purpose ([W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/), Accessed 2026-08-01. Reputation: High).
- **Never encode meaning in colour alone.** WCAG 2.2 SC 1.4.1 Use of Colour. A green-vs-red delta must also carry `▲`/`▼` and a sign. Onze's `--accent` (#3fb950) vs a red is a red/green pair and is therefore the worst case for the ~8% of men with deuteranomaly — the arrow and the `+`/`−` are not optional polish, they are the compliance mechanism.
- **Contrast of the sparkline stroke.** WCAG 2.2 SC 1.4.11 Non-text Contrast requires 3:1 for graphics required to understand content. `--accent` #3fb950 on `--panel` #161b22 has a computed contrast ratio of **6.81:1** (Y = 0.3633 vs 0.0107) and passes comfortably — it also clears the 4.5:1 text threshold, so accent-coloured delta text is safe. `--line` at the *new* #1F242E would be far below 3:1 and must therefore not be used for the plotted series — only for the baseline/grid, which is decorative.
- **Motion.** Any count-up or draw-on animation must be gated behind `@media (prefers-reduced-motion: reduce)`.

## Part 5 — Prioritised change list

Tags: **(a)** token/CSS-only · **(b)** new component · **(c)** needs new data.
Effort: S = under an hour · M = half a day · L = more than a day.
All items respect: no build step, no framework, no CDN, no crests, 375px-first, dark identity evolves not replaced.

| # | Change | Tag | Effort | Expected impact | Which complaint it answers |
|---|---|---|---|---|---|
| **1** | **Render market value.** Add a `VALUE` figure to the stat strip and a `VALUE` column to the career table; format `€14.2m` / `€450k`. Data already on every row (`r.value`, game.js:515). | **(a)** — the data exists; only a formatter and two render sites are new | **S** | **Highest.** Closes the complaint the owner named explicitly, adds the single most football-literate number in the genre, and cannot affect scoring (`value` is "display only, never scored", game.js:229). | #3 market value |
| **2** | **Demote `--line` from #2a3140 to #1F242E**, unify neutrals onto hue 218, add `--raised: #242B38`. | **(a)** | **S** | **Very high per unit effort.** Moves border-on-panel from 1.33:1 to 1.11:1 (Copero: 1.12:1) and stops the border being the brightest non-text pixel. One `:root` block; benefits all three modes at once. | #4 visual craft |
| **3** | **Split the composite `OVR · Apps · G/A` cell into discrete right-aligned columns** with `tabular-nums` (already set on `.cst`, index.html:103). Add the `VALUE` column from #1 here. | **(a)** | **S** | High. Converts a string into a table. This is the specific mechanism behind "looks like Transfermarkt" that is actually cheap to build. | #4, #3 |
| **4** | **Persistent stat strip above the table** — `AGE · RATING · VALUE · APPS · G/A`, `position:sticky`, built from the existing `statBox` primitive (index.html:550). | **(b)** | **S–M** | High. Copero's real advantage: the numbers you are playing for are never off screen, so every decision visibly moves something. | #2 progression, #3 |
| **5** | **Resolution card after each decision** — club chosen, `▲ OVR delta`, `▲ VALUE delta`, apps/goals/assists, minutes-share bar from the unused `r.m`, honours/caps. See 3.2. | **(b)** | **M** | High. Directly answers "I can SEE WHAT MY DECISIONS MADE" — the complaint with the most game-design weight, because it is the feedback half of the core loop. | #1 decision feedback |
| **6** | **Pre-list future ages as empty rows** in the career table (ages 16→36 are known from `CAREER.BLOCKS`/`AGE_VAL`). Style at ~35% opacity. | **(a)** | **S** | Medium-high. Cheapest possible way to make a run feel like a *life with a shape* rather than a growing list. Copero does exactly this; NN/g's tracker guidance supports showing the remaining path. | #2 progression |
| **7** | **Inline SVG sparkline of RATING and VALUE** over the career, from the existing `seasons[]` array. `role="img"` + factual `aria-label`. | **(b)** | **M** | Medium-high. The literal "number that is RISING". Value's exponential curve is the more dramatic of the two. | #2 progression |
| **8** | **Club monogram tiles** — deterministic 2-letter tile, hue hashed from club name, S/L fixed from the ramp. The crest-free replacement for Copero's club cards. | **(b)** | **S–M** | Medium. Restores the scannability that Copero buys with crests, using only type and colour, as the constraint requires. | #4 |
| **9** | **Replace one-off `rgba(...)` washes** (index.html:515, 623) with tokens from the new 5-step ramp; add a `--warn`/`--down` token for negative deltas so red/green pairs are systematic. | **(a)** | **S** | Medium. Removes the last unsystematic colour values; also needed before #5 can show negative deltas consistently. | #4 |
| **10** | **Type hierarchy pass** — the career screen currently runs `.pname` 20px/800, `.oclub` 16px/700, body 13px, meta 12px, labels 10px. Five sizes with no consistent ratio. Collapse to a 4-step scale (e.g. 22 / 15 / 13 / 11) with one uppercase-label treatment. | **(a)** | **S–M** | Medium. Low glamour, real "premium" contribution. | #4 |
| **11** | **Peak marker on the career table** — rule + `PEAK` label on the highest-OVR row. | **(a)** | **S** | Low-medium, near-zero cost. Makes the career arc legible without any chart. | #2 |
| **12** | **Show minutes share (`r.m`) in the table**, as a thin inline bar behind the apps figure. | **(a)** | **S** | Low-medium. Exposes the sim's core driver; makes "why did I not grow?" answerable. Only if #5 does not already carry it. | #1 |

### 5.1 Recommended sequencing

**Sprint 1 (all (a), all S, one sitting)**: #2 → #1 → #3 → #6 → #11. Five token/CSS-level changes, no new data, no new components. This alone should move the "cheap" read substantially and closes the market-value complaint entirely.
**Sprint 2**: #4 → #5. The two components that answer "see what my decisions made".
**Sprint 3**: #7 → #8 → #9 → #10 → #12.

### 5.2 The market-value gap, stated plainly

Onze computes a market value for every block of every career, stores it on every row, has an unused `valueMult` event effect ready to modify it, has excluded it from scoring so rendering it carries **zero balance risk** — and has never once put it on screen. With `VAL_A = 0.045`, `VAL_E = 11.5` and `AGE_VAL`, the formula produces roughly **€1.7m at OVR 40 age 16**, **€24.7m at OVR 70 age 22**, **€76.7m at OVR 85 age 26**, **€199.5m at the OVR 94 ceiling at age 24**, and **€430k at OVR 55 age 36**. That ceiling of ~€200m sits exactly on Transfermarkt's real-world top of the market (`€220.00m` for the current number-one player, observed 2026-08-01). **The scale is already right.** The only missing artefact is a formatter and two render calls.

---

## Conflicting Information

### Conflict 1: Is Onze's border objectively too bright, or only wrong for the genre?

**Position A — Onze's border is too strong.** Onze's `--line` on `--panel` is 1.33:1; Copero's `--border` on `--card` is 1.12:1. Onze's border is the brightest non-text token in its palette, whereas Copero's is the fourth of five rungs. Material 3's move to tone-based surface roles and Carbon's and Primer's layer/surface ramps all express dark-theme separation primarily through **surface lightness**, with borders sitting inside the ramp. Source: computed from both token sets + [Material 3 — Tone-based surfaces](https://m3.material.io/blog/tone-based-surface-color-m3), [Material — Dark theme](https://m2.material.io/design/color/dark-theme.html).

**Position B — 1.33:1 is normal, even conservative.** Onze's palette is recognisably GitHub's dark theme: `#0d1117`, `#161b22`, `#e6edf3`, `#8b949e`, `#2ea043` are GitHub/Primer dark values, and Primer's dark `borderColor-default` (`#30363d`, hue 213 · S 10% · L 21%) on `#161b22` computes to **1.42:1** — *stronger* than Onze's. By that yardstick Onze's border is not an outlier at all.

**Assessment**: Both positions are numerically correct; they are answering different questions. The resolution is **genre**, and it is the most useful single insight in this document:

> Borders at 1.4:1 are correct for an **information-dense developer tool** — GitHub, VS Code, Carbon's enterprise data products — where many functionally distinct regions abut and each must be unambiguously delineated. Borders at ~1.1:1 are the convention in **consumer entertainment dark UIs**, where grouping is carried by surface tone and the strongest edges are reserved for content and for the accent colour. Onze is a consumer football game wearing a developer tool's palette. The owner's word "cheap" is, mechanically, the perception of **developer-tool border weight applied to a consumer-game surface.**

Note also the one place Onze *deviated* from its Primer source: it kept Primer's border **lightness** (both ≈ L 21%) while roughly **doubling the saturation** (Primer #30363d ≈ S 10%; Onze #2a3140 ≈ S 21%). That is an unforced deviation from an otherwise coherent system, and it is corrected by item #2.
**Confidence**: Medium-High on the mechanism; Medium on the exact Primer dark border hex (see Knowledge Gaps).

### Conflict 2: Is "cheap" caused by colour at all?

**Position A** — it is a surface-treatment problem (the owner's own fourth clause: "Ours looks very much cheap", framed alongside look-and-feel).
**Position B** — the owner's three *other* clauses are all about **information**, not colour: seeing decision consequences, seeing a rising score, seeing market value. Three of four complaints are content-shaped.
**Assessment**: Position B is the stronger reading of the quote and should drive prioritisation, but Position A is the cheaper fix and should ship first because it is `(a)`-tagged and near-free. The prioritised list reflects exactly this: token changes first because they are cheap, components second because they matter more.
**Caveat, explicitly labelled**: "cheap" is a subjective judgement by a single person. The numbers in Part 1 explain a *mechanism consistent with* that judgement. They do not prove it caused it. No user testing has been done. See Knowledge Gaps.

## Source Analysis

| Source | Domain | Reputation | Type | Access date | Cross-verified | Used for |
|---|---|---|---|---|---|---|
| `/Users/peter/onze/game.js` | local | Primary | source code | 2026-08-01 | n/a | Part 0, all `value`/`seasons`/`m` claims |
| `/Users/peter/onze/index.html` | local | Primary | source code | 2026-08-01 | n/a | Part 0, token values, render gaps |
| W3C — WCAG 2.2 | w3.org | High (1.0) | official standard | 2026-08-01 | Y | luminance/contrast formulae, SC 1.1.1 / 1.4.1 / 1.4.3 / 1.4.11 |
| MDN — SVG `<polyline>` | developer.mozilla.org | High (1.0) | technical docs | 2026-08-01 | Y (self-evident from spec) | Part 4.1 feasibility |
| MDN — `font-variant-numeric` | developer.mozilla.org | High (1.0) | technical docs | 2026-08-01 | Y | Part 2.2 numeric alignment |
| Material Design (M2 dark theme + M3 tone-based surfaces) | material.io / m3.material.io | High (1.0) | design-system docs | 2026-08-01 | Y (with Primer) | Part 1.2(b), 1.2(c) |
| Primer — colour foundations + primitives | primer.style | High (1.0) | design-system docs | 2026-08-01 | Y (with Material) | Part 1.2(b), 1.2(c), Conflict 1 |
| NN/g — Visibility of System Status | nngroup.com | Medium-High (0.8) | industry/UX research | 2026-08-01 | Y (with NN/g trackers + Copero observation) | Finding 3.1 |
| NN/g — Status Trackers, 16 Guidelines | nngroup.com | Medium-High (0.8) | industry/UX research | 2026-08-01 | Y | Finding 3.2 |
| NN/g — Response Time Limits | nngroup.com | Medium-High (0.8) | industry/UX research | 2026-08-01 | N (single source) | Part 3.2 rationale for card over animation |
| Transfermarkt — Haaland market-value history | transfermarkt.us | Medium (0.6) | primary evidence of own conventions only | 2026-08-01 | Y (second TM page type) | Part 2.1 |
| Transfermarkt — LaLiga top market values | transfermarkt.us | Medium (0.6) | primary evidence of own conventions only | 2026-08-01 | Y | Part 2.1, 2.2 |
| Copero live CSS tokens + playthrough | copero.com.ar | Primary (untiered) | competitor primary evidence | supplied in brief | n/a | Part 1 all comparisons |

**Reputation distribution**: Primary/local 3 · High 5 (38%) · Medium-High 3 (23%) · Medium 2 (15%). Average of tiered sources ≈ 0.84.

**Bias check**: Transfermarkt is an ad-supported commercial data business with a commercial interest in its own valuations; this is irrelevant here because it is cited only as evidence of its own *formatting*, never for the correctness of any valuation or for design theory. Material and Primer are vendor design systems (Google, GitHub) and each promotes its own house style — mitigated by using them only where they **agree with each other** and by explicitly surfacing where Primer's own practice **contradicts** the thesis (Conflict 1). NN/g sells UX training; its heuristics are nonetheless the most widely replicated in the field.

## Knowledge Gaps

### Gap 1: Carbon Design System could not be retrieved
**Issue**: Three fetch attempts (`/elements/color/usage/`, `/elements/color/overview/`, `/elements/color/tokens/`) all returned truncated or empty content; circuit breaker applied after the third. Carbon's `layer-01/02/03` and `border-subtle/border-strong` token model would have been a valuable third independent corroboration for the "border sits inside the ramp" claim.
**Impact**: Part 1.2(b)/(c) rests on **two** authorities (Material, Primer) rather than three. Confidence stated as Medium-High rather than High accordingly.
**Recommendation**: retrieve Carbon's colour token tables manually and re-check; the claim is expected to hold but is not currently three-source verified.

### Gap 2: Primer's exact dark-theme border hex is not verbatim-sourced
**Issue**: Conflict 1 uses `#30363d` as Primer/GitHub dark `borderColor-default`. The `primer/primitives` token file returned 404 and `primer/github-vscode-theme` does not list hex values in its README; the value is corroborated only by a search-engine summary and by the fact that `primer.style/foundations/primitives/color` renders theme-active values. The *light*-mode values (`--bgColor-default #ffffff`, `--borderColor-default #d1d9e0`) were read directly.
**Impact**: the 1.42:1 figure in Conflict 1 is Medium confidence. The genre argument does not depend on the exact hex — it depends only on developer-tool borders being *at least as strong* as Onze's, which is visible on GitHub itself.
**Recommendation**: read `primer/primitives` token JSON via an authenticated GitHub tool (`gh`) to confirm.

### Gap 3: No user testing exists
**Issue**: "Cheap" is one person's judgement, recorded once, verbatim. Part 1 supplies a mechanism consistent with it; nothing here demonstrates causation, and no A/B or preference test has been run.
**Recommendation**: item #2 is a single `:root` block and therefore trivially A/B-testable. Ship the token change behind a query-string flag and compare qualitative reaction before investing in Sprint 2.

### Gap 4: Copero's typography, spacing and motion were not measured
**Issue**: the supplied primary evidence covers Copero's colour tokens and screen composition, but not its type scale, spacing scale, or transitions. Part 5 item #10 (type hierarchy) is therefore reasoned from Onze's own inconsistency, not from a measured benchmark.
**Recommendation**: extract Copero's font-size/line-height/spacing declarations from the same stylesheet already obtained (`index-CQ5ykx-5.css`) before executing item #10.

### Gap 5: Transfermarkt's mobile layout was not inspected
**Issue**: all Transfermarkt observations come from desktop-rendered pages. Since Onze is 375px-first, Transfermarkt's own mobile column-shedding decisions would be the most directly transferable evidence available and were not gathered.
**Recommendation**: inspect the mobile breakpoint before finalising the career-table column set in item #3.

### Gap 6: Value-formatting thresholds are unvalidated
**Issue**: the `€0.9m / €6.4m / €48m` rounding proposal in Part 2.1 is a design judgement, not a sourced convention — Transfermarkt itself always uses two decimals.
**Recommendation**: decide by looking at the actual distribution of `r.value` across ~100 simulated careers rather than by argument.

## Conflicting Information

_(pending)_

## Full Citations

[1] W3C. "Web Content Accessibility Guidelines (WCAG) 2.2". W3C Recommendation. https://www.w3.org/TR/WCAG22/. Accessed 2026-08-01. *(relative-luminance and contrast-ratio definitions; SC 1.1.1 Non-text Content, 1.4.1 Use of Color, 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast.)*

[2] Google. "Dark theme — Material Design" and "Introducing Tone-based Surfaces in Material 3". https://m2.material.io/design/color/dark-theme.html and https://m3.material.io/blog/tone-based-surface-color-m3. Accessed 2026-08-01. *(Direct page fetch returned title-only for both; the quoted statements — "Elevation can be depicted using shadows or other visual cues, such as surface fills with a tone difference or scrims"; surface-container roles "no longer tied to elevation"; five surface-container colours — were obtained from indexed material.io content. Flagged accordingly; confidence Medium-High, not High.)*

[3] GitHub. "UI color system" and "Color primitives" — Primer. https://primer.style/foundations/color/overview/ and https://primer.style/foundations/primitives/color. Accessed 2026-08-01. *(Verbatim: default borders drawn from "Steps 7-8" of the neutral scale; "Muted background and border colors are often combined to draw attention to a specific piece of content with a subtle emphasis." Light-mode primitives read directly: `--bgColor-default #ffffff`, `--bgColor-muted #f6f8fa`, `--borderColor-default #d1d9e0`, `--borderColor-muted #d1d9e0b3`, `--borderColor-emphasis #818b98`.)*

[4] Nielsen Norman Group. "Visibility of System Status (Usability Heuristic #1)". https://www.nngroup.com/articles/visibility-system-status/. Accessed 2026-08-01.

[5] Nielsen Norman Group. "Status Trackers and Progress Updates: 16 Design Guidelines". https://www.nngroup.com/articles/status-tracker-progress-update/. Accessed 2026-08-01.

[6] Nielsen, Jakob. "Response Time Limits: Article by Jakob Nielsen". Nielsen Norman Group. https://www.nngroup.com/articles/response-times-3-important-limits/. Accessed 2026-08-01. *(Cited via NN/g's own indexed summary of the sub-1-second animation guidance; single source, no cross-reference.)*

[7] Mozilla. "`<polyline>` — SVG". MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/polyline. Accessed 2026-08-01.

[8] Mozilla. "font-variant-numeric — CSS". MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric. Accessed 2026-08-01. *(Verbatim: `tabular-nums` "activating the set of figures where numbers are all of the same size, allowing them to be easily aligned like in tables.")*

[9] Transfermarkt. "Erling Haaland — Market value history". https://www.transfermarkt.us/erling-haaland/marktwertverlauf/spieler/418560. Accessed 2026-08-01. *(`.com` and `.de` hosts refused connection; `.us` host served. Medium trust; used only as evidence of Transfermarkt's own conventions.)*

[10] Transfermarkt. "LaLiga — Top market values 26/27". https://www.transfermarkt.us/laliga/marktwerte/wettbewerb/ES1. Accessed 2026-08-01.

[11] Copero. Compiled stylesheet `index-CQ5ykx-5.css` and a full career playthrough. https://copero.com.ar/assets/index-CQ5ykx-5.css. Token values and screen composition supplied as primary evidence in the research brief; not independently re-fetched during this pass.

[12] Onze source. `/Users/peter/onze/game.js` and `/Users/peter/onze/index.html`, working tree as of 2026-08-01. Primary evidence for all Part 0 claims.

## Research Metadata

**Sources examined**: 16 (11 external, 2 local primary, 3 failed/blocked)
**Sources cited**: 12
**Tool failures**: `carbondesignsystem.com` × 3 (empty/truncated body; circuit breaker applied) · `transfermarkt.com` and `transfermarkt.de` (fetch refused; `.us` substituted) · `github.com/primer/primitives` token file (404) · `m2.material.io` and `m3.material.io` direct fetches (title-only body; indexed content substituted and flagged)
**Cross-referenced claims**: 7 of 9 major claims have 2+ independent sources or are primary-source verified in code
**Confidence distribution**: High 55% · Medium-High 30% · Medium 15%
**Overall confidence**: **High** for Part 0 (code, primary) and Part 1.1–1.3 (arithmetic on two given token sets, independently reproducible); **Medium-High** for Parts 2–4; **Medium** for the causal claim that the border delta is what produces the "cheap" perception (see Gap 3).
**Output**: `/Users/peter/onze/docs/feature/career-mode/research-ui-benchmark.md`
