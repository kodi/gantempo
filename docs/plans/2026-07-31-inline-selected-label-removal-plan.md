# Inline Selected Label Removal Plan

Status: Complete and verified
Date: 2026-07-31
Milestone: Post-M4 playground visual refinement

## Summary

Remove the controlled playground's inline `SELECTED` task label and redundant
playground-only selected paint. Keep the package's blue selected outline and every
selection state/integration contract intact.

## Decision

- Selection remains a real runtime and accessibility state.
- The default blue outline is the only selected-state paint in the controlled
  playground.
- Preserve `GanttTaskContentProps.selected`, `GanttClassNameState.selected`,
  `aria-pressed`, `data-selected`, selection events, selectors, and imperative
  selection access for consumers.
- Remove only the playground's visible selected text and its extra selected class
  styling. Pending `saving` feedback remains.

## Scope

In scope:

- controlled `/interactive` task-content markup and selected styling;
- focused DOM regression coverage for invisible-but-preserved selection state;
- desktop and narrow live verification;
- synchronized plan and roadmap evidence.

Out of scope:

- changing selection semantics, interaction, announcements, or public types;
- removing the selected outline;
- changing the runtime-owned page's selection status announcement;
- redesigning task content or pending feedback.

## Slice 1: Remove redundant playground selection paint

Status: `[x]` Done

- stop rendering `selected` text from `InteractiveTaskContent`;
- remove the playground-only selected class mapping/style;
- prove selection still sets `aria-pressed` and `data-selected`;
- run focused tests and path-scoped checks.

Verification:

- `vp test run apps/playground/src/pages/AppendixConsumers.dom.test.tsx`
- path-scoped `vp check`

Dependencies: completed M4 selection contract and controlled playground consumer.

## Slice 2: Live and complete verification

Status: `[x]` Done

- select Work item 1 at desktop and narrow widths;
- confirm the blue outline remains, no `SELECTED` text is rendered, accessible state
  remains pressed/selected, no page overflow appears, and the console stays clean;
- run the complete repository and playground gates.

Verification:

- `mise run ci`
- `mise run build-playground`
- live `/interactive` desktop and narrow checks
- `git diff --check`

Dependencies: Slice 1.

## Working Notes

### 2026-07-31 baseline

- The visible label is emitted only by the playground's custom
  `InteractiveTaskContent` slot.
- The package independently retains selected state in `aria-pressed`,
  `data-selected`, `GanttTaskContentProps.selected`, the class-name state, runtime
  selection selectors/events, and the blue selected outline.
- `.interactive-task--selected` adds a second playground-only saturation/brightness
  treatment. Removing it leaves the package outline as the single visual signal.
- The previously completed lane-trigger files are staged user work. This refinement
  must preserve that index state and remain an unstaged layer unless the user asks
  otherwise.

### 2026-07-31 implementation and verification

- `InteractiveTaskContent` now renders only the task title and pending `saving`
  feedback. It no longer reads or emits selected state.
- Removed the controlled playground's `interactive-task--selected` class mapping and
  saturation/brightness style. The package's `[data-selected='true']` blue outline is
  now the only selected-state paint.
- The focused consumer regression passed 1 file / 2 tests and proves a click still
  sets `aria-pressed="true"` and `data-selected="true"` while task text contains no
  `selected` label or playground selected class. Path-scoped format/lint/type checks
  passed.
- Chrome DevTools remained unavailable because its dedicated profile was already
  locked by another browser instance. No process was terminated; the
  repository-authorized built-in Browser fallback verified `/interactive`.
- At 1,440 × 900 and 390 × 844, selected Work item 1 rendered only `Work item 1`,
  retained `aria-pressed="true"` and `data-selected="true"`, and retained the blue
  `rgb(0, 95, 204)` 2px stroke. No inline `small` label or selected class remained,
  and page/chart horizontal overflow were both zero.
- The application warning/error console was empty. The Browser fallback does not
  expose a request ledger, so no live per-request status claim is made.
- `mise run ci` passed 158-file formatting, 147-file lint/type checking, 67 test
  files / 347 tests, and all four package artifacts. `mise run build-playground`
  transformed 1,918 modules, and `git diff --check` passed.

## Next Slice

Resume the pending narrow live verification in Slice 5 of
`2026-07-31-persistence-entity-change-projection-plan.md`; this visual refinement has
no remaining slice.
