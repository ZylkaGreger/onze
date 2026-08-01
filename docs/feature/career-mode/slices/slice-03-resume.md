# Slice 03 — Resume

**Release:** v1 (committed) · **Effort:** ~0.5 day · **Stories:** US-003 · **job_id:** J1, J2

## Goal

A career survives a closed tab. Reopening resumes at the exact decision index; reopening after
retirement shows the finished career and a countdown. One run per day, locked.

## Learning hypothesis

**We believe** that interruption is the normal case, not the edge case, and that persistence
converts abandoned runs into completed ones.
**We will know we are wrong if** the share of completions that span more than one session is
near zero — meaning everyone who finishes finishes in one go, and this slice bought nothing.

## In scope

- Career state written to a date-keyed localStorage entry after every committed decision,
  following the existing `onze:<date>:<mode>:…` convention.
- Mid-run resume at the exact decision index with all completed rows intact.
- Post-retirement reopen: completed career, countdown, no way to start again.
- Signature guard: a stored run whose scenario signature no longer matches is discarded, not
  resumed against different offers.
- Guarded storage access — Safari private browsing must not crash the mode.
- UTC rollover handling via the existing `visibilitychange` hook.

## Out of scope

- Score (04) · sharing (05) · everything in v2.
- Any attempt to *prevent* a determined player clearing localStorage to replay. See R8.

## Taste tests

| Test | Verdict |
|------|---------|
| End-to-end? | Yes — touches the whole run lifecycle |
| User-visible value? | Yes — Marco's tram no longer costs him the career |
| Shippable alone? | Yes |
| ≤1 day? | Yes — mirrors the existing `loadState`/`save` pattern |
| Teaches something? | Yes — how much of the audience is interrupted |
| Reversible? | Yes — stop writing state; the mode still plays in-session |

## Done when

- Closing the tab at decision 7 and reopening later the same UTC day returns the player to
  decision 7 with six rows and the correct rating.
- Reloading immediately after a resolution shows the identical outcome — because outcomes are
  recomputed from the seeded stream over the committed path, never restored from storage (C4).
- A completed run cannot be replayed the same UTC day through the UI.
- A UTC date change offers the new day's career without presenting yesterday's unfinished run
  as an error.
- With localStorage throwing, the career plays through and no copy claims progress was saved.

## Evidence to collect

Session-spanning completion rate. Also: does completion rate move at all versus Slice 02?

## Honesty note

This slice makes replay *inconvenient*, not impossible. With a fixed public seed and no backend,
clearing site data yields a fresh attempt at the same day's career. Do not spend effort on
obfuscation a devtools console defeats in a minute, and do not write copy that claims the run
is protected. See R8 and design decision D-4.

## Gate to Slice 04

Interruption no longer destroys a run, so completion numbers measure engagement rather than tab
survival — which is what Slices 04 and 05 need in order to mean anything.
