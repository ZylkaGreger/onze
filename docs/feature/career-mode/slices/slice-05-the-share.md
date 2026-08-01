# Slice 05 — The share

**Release:** v1 (committed) · **Effort:** ~0.75 day · **Stories:** US-005, TT-001 ·
**job_id:** J3, J5 (+ one `infrastructure-only` task)

## Goal

A spoiler-free career card, wired into the existing share plumbing, plus the instrumentation
without which none of v1's learning is retrievable.

```
🎽 Onze Career — 1 Aug
61 · CULT HERO
Crotone › Sassuolo › Sevilla › Lorient › Empoli
Peak 78 · 512 apps · 🔥 12d
https://onzedaily.com/?m=career
```

## Learning hypothesis

**We believe** that career shares outperform puzzle shares, because a career path spoils
nothing — it is a record of the sharer's own choices, not the day's answer — so there is no
social cost to posting one.
**We will know we are wrong if** the career share rate lands at or below the puzzle modes'.

This is the growth bet. It is last in v1 because it needs everything above it to be true first.

## In scope

- `career` branch in the existing `shareText()` and `shareUrl()`. Do not fork the functions.
- Native share sheet on touch devices, async clipboard then legacy `execCommand` on desktop —
  the existing chain, including the touch check that fixed the desktop "share is broken" reports.
- Path line capped at 60 characters; longer paths collapse to first, best, last plus a count.
- Streak tag from the game-wide counter, bumped at most once per UTC day across all three modes.
- **TT-001**: script-tag-only analytics (no backend, no API key), instrumenting mode selected,
  career started, decision committed, career completed, share tapped — and instrumenting the
  existing modes at the same time so career share rate has something to be compared against.

## Out of scope

- Any image, card render, crest or trademarked artwork. Text only (C1).
- Anything revealing which offers existed, or anything about the other two modes.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — run to retirement to group chat |
| User-visible value? | Yes — US-005 is user-facing; TT-001 rides with it |
| All-infrastructure slice? | **No** — TT-001 alone would have no release value, so it is attached here rather than standing as its own slice |
| Shippable alone? | Yes |
| ≤1 day? | Yes — ~0.5 day for the card, ~0.25 for instrumentation |
| Teaches something? | Yes — and it is what makes the other four slices legible at all |
| Reversible? | Yes — remove the share button; remove the script tag |

## Done when

- One tap on iOS opens the native sheet with the five-line text; no image attached.
- Desktop copies to clipboard with a toast and opens no OS dialog.
- An aborted native sheet produces no false "copied" confirmation.
- The share text contains no club that was offered and declined.
- An eleven-club path fits inside 60 characters.
- Score and tier in the share text come from the same functions the results screen calls.
- Completing Squads and then a career on the same UTC day yields one streak increment.
- Analytics is live, holds no key, and the site behaves identically when the script is blocked.

## HARD GATE — do not start Slices 06–09 until this passes

Slices 06–09 must not be started unless **either**:

- (a) v1 career completion rate is ≥40% **and** share rate is ≥25%; **or**
- (b) Peter explicitly overrides, in writing, stating which gate is waived and why.

Absent one of those two, the correct next action after Slice 05 is to stop and look at the
numbers — not to start Slice 06.

## Evidence to collect

Share rate versus the puzzle modes. `?m=career` inbound referrals. This slice is the first point
at which any target in the KPI table becomes checkable.

## Why TT-001 sits here

Every outcome KPI in this feature is currently unmeasurable: static site, no backend, no
analytics, no accounts. Shipping v1 without instrumentation means shipping five slices and
learning nothing — which would make the evidence gate on Slices 06–09 meaningless. It is bundled
into a user-facing slice rather than standing alone because a slice made entirely of
infrastructure has no release value.

## Gate to v2

**Hard gate.** Slices 06–09 are not committed. They ship only if v1 shows a completion rate
above 40% and a share rate above 25% — or if the founder's own qualitative read is unambiguously
positive and he chooses to override the numbers with that stated openly.
