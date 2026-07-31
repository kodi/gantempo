# Progress Drag Feedback Plan

Status: Complete
Date: 2026-07-31
Milestone: M4 appendix follow-up

## Summary

Make direct progress adjustment legible while it is happening. Pointer, pen, and
touch dragging should snap to five-percentage-point increments and show the current
preview percentage next to the progress marker until release or cancellation.

## Decisions

- Quantize only direct pointer progress adjustment to `5%` increments. Preserve the
  existing keyboard contract of `1%` steps, `10%` with Shift, and Home/End boundaries.
- Keep canonical task progress in `0..1`; quantization happens when the immutable
  pointer intent is created.
- Render one drag-only, `aria-hidden` value bubble from the existing immutable
  preview. The existing live-region description remains the assistive-technology
  path, so the visible number does not create duplicate announcements.
- Preserve the existing one-preview/one-`task.update` command path, controlled
  acknowledgement, cancellation, history, and public facade.

## Scope

In scope:

- pure pointer progress quantization;
- visible percentage feedback while a direct progress gesture is active;
- mouse, pen, touch, controlled, cancellation, reduced-motion, and forced-colors
  regressions;
- desktop and narrow live browser verification.

Out of scope:

- changing keyboard increments;
- making the snap interval configurable;
- changing stored progress precision outside direct pointer gestures;
- adding a new public slot, class-name hook, or interaction type.

## Slice 1: Five-point pointer snapping and drag feedback

Status: `[x]` Done

Goal: direct progress dragging is predictable and visibly reports its preview value.

This slice should implement:

- snap pointer-derived progress intent to `0.05` boundaries between `0` and `1`;
- render a compact percentage bubble only for the active pointer progress preview;
- keep the bubble attached to the marker without intercepting input;
- add focused pure and DOM coverage for off-step coordinates, bubble text, release,
  cancellation, and keyboard exclusion;
- verify package styling under reduced motion and forced colors;
- run the complete repository gate and live desktop/narrow interaction checks.

Verification:

- focused interaction and React DOM tests;
- focused stylesheet regression;
- `mise run ci`;
- `mise run build-playground`;
- `git diff --check`;
- Chrome DevTools `/interactive` at desktop and narrow viewport sizes, including
  mouse/touch behavior, percentage visibility, snapping, containment,
  accessibility, console, and network state.

Dependencies: completed M4 appendix progress interaction.

## Working Notes

- 2026-07-31: The existing pointer path rounds arbitrary coordinates to one
  percentage point in `interaction/gesture.ts`. The immutable preview already
  carries normalized progress and a textual description, but the React surface
  renders only the completed-width block.
- 2026-07-31: This follow-up does not change an intended system boundary, public
  contract, or release acceptance criterion, so no architecture or decision-record
  revision is required.
- 2026-07-31: The first 390 x 844 live check found that aligning the badge within
  the progress preview still clipped it when a short task began at the timeline
  boundary. A second check showed the narrow two-column chart can leave a timeline
  narrower than the badge itself. The badge is now a body-level overlay whose center
  clamps to the visible chart bounds; this deviation changes private presentation
  only.
- 2026-07-31: Pointer intent now quantizes the clamped task-width ratio to twentieths.
  Mouse, pen, and touch therefore share exact `5%` boundaries while the keyboard
  reducer retains its independent `1%`/`10%` contract. The React surface renders one
  drag-only, `aria-hidden`, pointer-transparent percentage badge and removes it on
  release, cancellation, rejection, or pending acknowledgement.
- 2026-07-31: Focused verification passed 4 files / 53 tests covering pure pointer
  snapping, mouse/pen/touch command and history behavior, visible badge content and
  lifecycle, keyboard exclusion, boundary clamping structure, and forced-color
  styling. `git diff --check` passed.
- 2026-07-31: The final `mise run ci` passed 158 formatted files, 147 lint/type
  files, 67 test files / 348 tests, and four package artifacts.
  `mise run build-playground` transformed 1,918 modules successfully.
- 2026-07-31: Chrome DevTools `list_pages` was profile-locked, so the repository
  fallback used the in-app browser on `/interactive`. At 1440 x 1000 an in-progress
  off-step drag visibly reported `75%`, stayed inside the chart, remained
  `aria-hidden`, and committed on a five-point boundary. At 390 x 844 the `100%`
  boundary badge stayed fully inside the chart despite the narrow timeline, did not
  intercept input, disappeared after release, and caused no document overflow.
  Both checks had zero console warnings/errors. The fallback does not expose touch
  emulation or a network panel, so live touch and network-panel claims are not made;
  mouse/pen/touch paths and cancellation remain covered by DOM tests.

## Next Slice

No follow-up slice remains. Create the detailed M5 basic-project-Gantt plan before
starting hierarchy, summary, milestone, dependency, zoom, filtering, localization,
or additional SSR implementation.
