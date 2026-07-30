# Timeline Navigation Interaction Contract

Status: Accepted
Date: 2026-07-30
Owners: Post-M4 interaction runtime and public API

## Context

Base M4 established controlled horizontal range ownership, native vertical lane
scrolling, drag-edge auto-pan, imperative viewport requests, and viewport-filtered
render primitives. It did not bind ordinary wheel, trackpad, or grab gestures to
semantic time navigation. It also reconciled selection and focus against rendered
task bars, so viewport exclusion was indistinguishable from occurrence deletion and
a known offscreen occurrence could not be revealed by `scrollToTask`.

This decision corrects those boundaries without reopening document ownership,
command history, persisted session state, zoom policy, or the public layout facade.
It extends the accepted
[M4 interaction-runtime and public-API contract](2026-07-30-interaction-runtime-public-api-contract.md)
and is implemented by the
[timeline navigation interactions plan](../plans/2026-07-30-timeline-navigation-interactions-plan.md).

## Decision

### Pan the semantic controlled range

Horizontal navigation shifts the required controlled `range` while preserving its
finite positive duration. For a measured timeline width `W`, range duration `D`, and
accepted horizontal pixel delta `dx`, the time shift is proportional to
`dx * D / W`. Wheel deltas use the browser's reported scroll direction; grab
dragging reverses pointer movement so the content follows the hand.

`onRangeChange` remains the only request boundary. A chart without that callback
does not claim horizontal navigation input. `onViewportChange` continues to observe
an adopted range or vertical session value and is not a proposal callback.

Each chart instance owns one transient proposed-range accumulator. Deltas in one
animation frame coalesce into at most one request. Later deltas rebase on the latest
unacknowledged proposal; adoption clears a matching proposal; an unrelated external
range replacement cancels stale proposal state; and unmount cancels scheduled work.
No proposed range enters document history or persisted session state.

### Keep full occurrence lifetime separate from visible rendering

The private derived pipeline produces one immutable full occurrence catalog before
viewport filtering. Each entry carries stable target identity and provenance, lane
identity and order, absolute vertical bounds, and its scheduled interval.

The catalog is the authority for selection and logical-focus existence,
offscreen-target lookup, and geometric keyboard navigation. Viewport-filtered lanes,
task bars, hit-test nodes, and the public `GanttVisibleOccurrence` snapshot remain
the authority for painting and pointer interaction. Moving an occurrence outside
either viewport axis does not remove it from selection or logical focus; actual
document or resolved-view removal does.

When a browser-focused task node is virtualized away, DOM focus moves to the chart
root without clearing logical focus. After navigation reveals the occurrence, the
renderer may restore its roving task focus. No hidden offscreen DOM task forest is
retained.

The full catalog, resolved layouts, prefix indexes, interval indexes, and work
counters remain private. Horizontal or vertical viewport adoption reuses completed
topology, interval, and stack-layout work.

### Normalize wheel and trackpad input deterministically

The accepted wheel policy is:

| Input | Horizontal time | Vertical lanes | Default handling |
| --- | --- | --- | --- |
| Unmodified `deltaX` | Pan | No change from this axis | Prevent only when accepted |
| Unmodified `deltaY` | No change | Preserve lane scrolling | Native unless diagonal input is claimed |
| Diagonal `deltaX` + `deltaY` | Pan | Apply the vertical component | Prevent after both accepted components are preserved |
| `Shift` + `deltaY` without meaningful `deltaX` | Pan | No vertical move | Prevent only when accepted |
| `Ctrl`/`Meta` wheel or pinch channel | No change | No change | Browser-owned |
| Non-finite or zero delta | No change | No change | Pass through |

Line and page `deltaMode` values normalize to pixels before time conversion. There
is no custom inertia engine: trackpad momentum is the browser's wheel sequence.
Wheel handling is non-passive only on the scoped chart navigation surface where
cancellation may be required. Accepted navigation is contained without introducing
page-level horizontal overflow.

### Resolve pointer conflicts by surface, button, and capability

| Surface/input | Result |
| --- | --- |
| Primary drag on task body or resize edge | Existing move or resize |
| Primary drag on empty body with a create mapper | Existing task creation |
| Primary drag on empty body without creation capability | Pan both axes |
| Primary drag on the time header | Pan time |
| Middle drag on timeline body | Pan both axes |
| Secondary/right drag | Browser or context-menu behavior |
| Pen or touch body drag | Existing M4 editing behavior |

Mouse panning uses a movement threshold and instance-owned pointer capture. It
cancels on `pointercancel`, capture loss, or unmount. Starting a pan closes transient
tooltip and context-menu surfaces but does not clear selection, dispatch a command,
or enter document history. Modal editor content is excluded. `grab` appears only on
a surface that can pan and `grabbing` only on the owning instance while active.

Read-only document state disables document mutation, not viewport navigation.
Range acknowledgement and session ownership independently determine whether the
chart can navigate.

### Add discrete keyboard viewport navigation

The post-M4 keyboard bindings add:

- `PageUp` and `PageDown` move vertically by one measured viewport with one lane of
  overlap;
- `Alt+PageUp` and `Alt+PageDown` move horizontally by one range with a small time
  overlap.

Arrow, `Home`, and `End` task navigation use the full occurrence catalog. If the
chosen task is outside the current render window, the runtime requests the required
range and vertical position before transferring DOM focus. Discrete keyboard paging
may announce the adopted time window once; continuous wheel and pointer updates do
not create live-region noise. Help text and keyboard shortcuts must describe the
navigation and its edit conflicts.

### Leave zoom and broader policy to M5

This correction does not add zoom, `defaultRange`, time bounds, Today or fit
commands, a semantic horizontal scrollbar, custom inertia, one-finger touch panning,
multi-touch arbitration, RTL delta reversal, calendar-aware panning, raw task-ID
lookup, or configurable binding maps. `Ctrl`/`Meta` wheel and pinch remain
browser-owned.

## Public API Impact

No public type or export is required. The implementation reuses `range`,
`onRangeChange`, `onViewportChange`, `GanttTaskTarget`, `GanttScrollOptions`,
`GanttHandle`, and existing semantic event/session contracts. The occurrence catalog
and navigation scheduler are private implementation details.

## Consequences

- Controlled consumers must acknowledge range requests for horizontal gestures to
  take effect.
- Full-catalog reconciliation preserves session identity while viewport-only
  rendering retains bounded DOM and hit-test work.
- Navigation remains available in read-only document consumers and never enters the
  M2 command/history path.
- Pointer arbitration becomes an explicit compatibility contract for later editing
  features.
- Hardware momentum and natural-scroll preference remain browser/platform behavior;
  synthetic wheel evidence is not represented as physical trackpad evidence.

## Verification Evidence

The completed implementation is evidenced by the
[timeline navigation interactions plan](../plans/2026-07-30-timeline-navigation-interactions-plan.md):

- the complete local CI gate passes 58 files / 287 tests plus package generation;
- 18 final focused files / 108 tests cover pure navigation, proposal ownership,
  occurrence lifetime, session retention, scene reuse, DOM inputs, focus,
  accessibility, hydration, public facade, and playground consumers;
- the fixed-seed 2,000-task/400-lane runtime benchmark includes steady controlled
  horizontal pan and guards exact work metadata:
  `topology0/interval0/stack0/catalog0/kernel0/ticks1/query1`;
- the deterministic `/navigation` consumer contains 144 events across 36 lanes and a
  fixed 18-month UTC period with a 12-week controlled viewport;
- trusted in-app Browser wheel/diagonal input, header grab, keyboard traversal,
  task drag, mapped creation, menu/editor, selection/focus restoration, and
  sibling-instance isolation pass;
- all five routes at 1,440 × 900, 900 × 900, and 560 × 900 retain exact lane
  alignment, one current menu link, zero page/menu overflow, named accessibility
  structure, and no application console warnings/errors.

Chrome DevTools was attempted first but its configured profile remained locked, so
the repository-approved in-app Browser supplied live input and responsive evidence.
That surface could not deliver a shifted wheel modifier or held middle-button drag;
focused DOM tests cover both. No connected tool can reproduce physical trackpad
momentum, so physical trackpad confirmation remains explicitly outstanding. The
DevTools network panel was unavailable; the fixture remains deterministic and
network-free, but this record makes no standalone live network-panel claim.

## Revisit Triggers

Revisit this decision before adding uncontrolled range ownership, zoom or pinch,
semantic horizontal scrollbars, touch panning, RTL-specific navigation, calendar
clamping, public occurrence search, configurable input bindings, or a public layout
query API.

## Links

- [Architecture](../ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md#post-m4-timeline-navigation-interactions)
- [Implementation plan](../plans/2026-07-30-timeline-navigation-interactions-plan.md)
- [M4 interaction-runtime and public-API contract](2026-07-30-interaction-runtime-public-api-contract.md)
- [M3 view/layout/viewport contract](2026-07-30-view-layout-viewport-kernel-contract.md)
