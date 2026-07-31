# Default Tooltip Usability Plan

Status: Active; implementation and automated gates complete, live verification pending
Date: 2026-07-31
Milestone: Post-M4 default-surface refinement

## Summary

Replace the built-in tooltip's raw ISO timestamp dump with a compact human-readable
schedule summary. Keep the public tooltip replacement slot and bounded task-summary
contract unchanged.

## Decision

- Render a deterministic English/UTC calendar range such as
  `Aug 5 – Aug 12, 2026`.
- Add a compact human duration such as `7 days`; this is the only additional useful
  information available from the existing public tooltip summary.
- Keep localization and consumer-selected time-zone formatting in M5. Avoid
  server/client locale or time-zone drift in the current default surface.
- Preserve `GanttTooltipProps`, `slots.Tooltip`, bindings, overlay ownership,
  collision behavior, class hooks, and task accessibility relationships.

## Scope

In scope:

- default tooltip formatting, markup, and styling;
- focused DOM and stylesheet coverage;
- live `/interactive` desktop and narrow visual/accessibility verification;
- synchronized plan and roadmap evidence.

Out of scope:

- expanding `GanttTaskSummary`;
- progress, lane, resource, or application metadata in the default tooltip;
- public localization/time-zone configuration;
- tooltip trigger, portal, collision, or replacement-slot behavior changes.

## Slice 1: Add the human schedule summary

Status: `[x]` Done

- add deterministic date-range and duration formatting helpers;
- render one calendar row with a quiet duration badge;
- update default tooltip styles and focused tests;
- preserve custom tooltip replacement coverage.

Verification:

- focused customization DOM and stylesheet tests;
- path-scoped format/lint/type checks.

Dependencies: completed M4 customization/overlay contract and default-surface
modernization.

## Slice 2: Live and complete verification

Status: `[-]` Automated gates complete; live verification pending

- inspect `/interactive` at desktop and narrow widths;
- confirm human date text, duration, containment, accessible tooltip relationship,
  no page overflow, and a clean application console;
- run the complete repository and playground gates.

Verification:

- `mise run ci`
- `mise run build-playground`
- live `/interactive` desktop and narrow checks
- `git diff --check`

Dependencies: Slice 1.

## Working Notes

### 2026-07-31 baseline

- `DefaultTooltip` repeats the task title and renders
  `new Date(...).toISOString()` for both endpoints.
- `GanttTaskSummary` intentionally exposes only title, start, end, target, and an
  optional variant. Duration can be derived without widening the public contract.
- The existing selected-label removal changes are staged user work. This tooltip
  refinement must remain an unstaged layer unless the user asks otherwise.
- That prior refinement landed independently as
  `558df69 feat(playground): remove inline selected label` while this slice was in
  progress. The tooltip changes remain unstaged.

### 2026-07-31 implementation and automated verification

- Added deterministic English/UTC formatting for same-day, same-year, and cross-year
  date ranges plus compact minute/hour/day duration formatting.
- The default tooltip now renders title, a decorative calendar-clock icon, a human
  range such as `Aug 5 – Aug 12, 2026`, and a quiet `7 days` duration badge.
- `GanttTooltipProps`, `GanttTaskSummary`, the custom replacement slot, overlay
  bindings, and trigger behavior are unchanged.
- Focused customization/stylesheet coverage passed 2 files / 12 tests. It verifies
  `Jul 30 – Jul 31, 2026`, `1 day`, absence of the raw ISO timestamp, decorative icon
  semantics, compact layout hooks, and the existing custom-tooltip path.
- Path-scoped formatting/lint/type checks passed after applying the repository
  formatter to `surfaces.tsx`.
- `mise run ci` passed 158-file formatting, 147-file lint/type checking, 67 test
  files / 348 tests, and all four package artifacts. `mise run build-playground`
  transformed 1,918 modules, and `git diff --check` passed.

### 2026-07-31 live-browser deviation

- Chrome DevTools remained unavailable because its dedicated profile was already
  locked by another browser instance.
- The built-in Browser fallback then timed out while reading the existing local tab
  after two bounded connection attempts, including the documented bootstrap
  recovery path. No browser process was terminated and no unrelated browser tool was
  substituted.
- Live desktop/narrow tooltip geometry, accessibility-tree, overflow, console, and
  request evidence remain unverified. Do not mark Slice 2 complete or make a live
  browser claim until the local tab can be inspected.

## Next Slice

Retry Slice 2 with Chrome DevTools first. Inspect `/interactive` at 1,440 × 900 and
390 × 844, hovering Work item 3 to confirm the human range/duration, containment,
accessible tooltip relationship, page/chart overflow, console, and request state.
