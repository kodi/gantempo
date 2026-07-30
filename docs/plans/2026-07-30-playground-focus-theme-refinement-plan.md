# Playground Focus and Theme Refinement Plan

Status: Complete and verified
Date: 2026-07-30
Milestone: Post-M4 interaction refinement

## Summary

Refine the primary playground surface so a focused task has one rounded, intentional
focus treatment, an empty timeline press clears the active task, and the main-page
theme control switches the chart between the existing light, dark, and high-contrast
tokens.

## Decisions

- Keep focus visible with one task-shaped ring; suppress the browser's square SVG
  outline instead of removing focus indication.
- Treat a primary press on empty timeline space as a clear-selection gesture before
  any existing drag-to-create interaction continues.
- Clear both runtime focus/selection and stale DOM task focus so read-only and
  interactive consumers behave consistently.
- Keep theme selection playground-local and reuse the existing scenario theme tokens;
  no package theme API or persistence contract is added.

## Scope

In scope:

- package task focus styling and empty-timeline pointer behavior;
- focused DOM regression coverage;
- a labelled main-page theme selector and playground styling;
- focused/full verification plus responsive Chrome checks on `/`.

Out of scope:

- changing keyboard selection or multi-selection semantics;
- clearing selection for secondary pointers or presses on task occurrences;
- persisting the playground theme across navigation or reload;
- changing public runtime, session, or theming contracts.

## Slices

### Slice 1: Plan and reproduced baseline

Status: `[x]` Done

- reproduce the square task focus outline and retained focus on empty timeline clicks;
- trace the existing runtime session and scenario-theme boundaries;
- create and link this plan.

Verification:

- Chrome DevTools inspection on `/` at the current desktop viewport;
- focused source inspection;
- `git diff --check`.

Dependencies: none.

### Slice 2: Focus, deselection, and selector implementation

Status: `[x]` Done

- render one rounded focus treatment for task occurrences;
- clear runtime focus/selection and DOM task focus on an empty primary timeline press;
- add a labelled light/dark/high-contrast selector to the main playground page;
- add focused regression tests.

Verification:

- `vp test run packages/gantt/src/react/Gantt.dom.test.tsx
  apps/playground/src/pages/MainPage.dom.test.tsx --reporter=verbose` passed 2 files
  and 17 tests;
- formatting passed for the changed implementation and test files;
- `git diff --check` passed.

Dependencies: Slice 1.

### Slice 3: Full and live verification

Status: `[x]` Done

- run the repository CI and production playground build;
- verify focus, deselection, all three themes, responsive layout, accessibility tree,
  console, and network state on `/`;
- record exact evidence here and in `docs/ROADMAP.md`.

Verification:

- `mise run ci`;
- `mise run build-playground`;
- Chrome DevTools at 1,440 × 900 and 560 × 900;
- `git diff --check`.

Dependencies: Slice 2.

## Working Notes

### 2026-07-30 baseline

- Chrome computed the focused SVG task group with a two-pixel `#005fcc` square
  outline even though the low-specificity task rule requested `outline: none`; the
  user-agent focus rule won the cascade.
- The main page passes a controlled document without a document-change callback, so
  mutation is disabled while task occurrences remain keyboard-focusable. Clicking a
  task therefore establishes DOM/runtime focus, but the current disabled pointer
  guard prevents the interaction runtime from handling an empty timeline press.
- Interactive runtime pointer presses already distinguish task hits from
  timeline-position hits. The internal session boundary can clear selection/focus
  without changing the public handle.
- The main scenario already carries light/dark/high-contrast theme tokens. Its
  displayed theme value is static and `ScenarioGantt` currently reads the immutable
  scenario value directly.

### 2026-07-30 playground-test discovery deviation

- The repository test include initially matched only `packages/**/*.test.{ts,tsx}`,
  so the focused playground selector test was silently excluded from the first root
  runner invocation.
- Expand the existing test boundary to `apps/**/*.test.{ts,tsx}` as well. This makes
  playground behavior part of the normal repository test gate rather than relying
  only on a direct config override.
- The direct app test then exposed that this suite does not install jest-dom matchers;
  use the native select `value` property for the regression assertion.

### 2026-07-30 Slice 2 completion

- The square SVG-group outline was removed. Focus now applies one two-pixel rounded
  stroke to the task bar itself for mouse and keyboard focus, with the existing
  forced-colors override retained.
- An empty primary timeline press now clears the internal session's focus and
  selection before the existing empty-lane gesture continues. It also blurs a
  currently focused task occurrence inside the timeline, including when the chart is
  read-only.
- The main page now exposes a labelled native selector for Light, Dark, and High
  contrast and passes the chosen existing token set into `ScenarioGantt`.
- Focused coverage passed 2 files and 17 tests, including uncontrolled
  selection/focus clearing, read-only DOM/runtime focus clearing, and all three theme
  choices.

### 2026-07-30 Slice 3 completion

- `mise run ci` passed formatting for 133 files, lint/type checking for 122 files, 52
  test files and all 251 tests, plus the four-artifact package build.
- Final package output is 308.61 kB JavaScript (61.01 kB gzip), 20.23 kB CSS
  (3.52 kB gzip), and 40.07 kB declarations (6.83 kB gzip).
- `mise run build-playground` passed after transforming 1,908 modules and emitted
  409.53 kB JavaScript (117.06 kB gzip) and 26.58 kB CSS (5.55 kB gzip).
- Chrome DevTools verified `/` at 1,440 × 900 and 560 × 900. Focused Requirements
  computed with no group outline and one two-pixel `#005fcc` task-bar stroke; an
  empty primary timeline press left no active task, runtime focus, or selection.
- The labelled selector switched live between light, dark, and high-contrast tokens.
  High contrast computed a two-pixel `#111` frame border, and the 560-pixel layout
  retained a 198.32-pixel selector with zero page overflow.
- The final accessibility snapshot exposed the `Chart theme` combobox with all three
  named options. Chrome reported no console errors or warnings, and all 13
  hot-reload requests completed with status 200.

## Next Slice

Resume Appendix Slice A1 of the item-properties, semantic-color, and progress plan.
