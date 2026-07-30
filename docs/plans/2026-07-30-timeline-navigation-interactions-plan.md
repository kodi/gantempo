# Timeline Navigation Interactions Plan

Status: In progress; Slice 4 complete, Slice 5 next
Date: 2026-07-30
Milestone: Post-M4 interaction correction

## Summary

Make viewport navigation a first-class chart interaction. A user must be able to move
through lanes and time with an ordinary mouse, mouse wheel, or trackpad without first
capturing an imperative task target. The chart must preserve task editing,
selection, logical focus, controlled range ownership, virtualization, and browser
zoom behavior while it does so.

This plan exists because the completed base-M4 surface implements native vertical
lane scrolling, drag-edge auto-pan, and imperative range requests, but no ordinary
wheel/trackpad or grab gesture changes the horizontal time range. The main and matrix
playground examples also pass a fixed `range` without acknowledging
`onRangeChange`, so their timelines are intentionally immovable today.

The correction starts below the DOM adapter. The current runtime derives its
occurrence registry from viewport-filtered task primitives. Adding horizontal panning
directly on top of that behavior would discard selection/focus as tasks leave the
window and would preserve the existing inability of `scrollToTask` to locate a known
offscreen occurrence. A private viewport-independent occurrence catalog must precede
the input adapters.

## Target State

At completion:

- a two-finger horizontal trackpad gesture pans the time range under the pointer;
- a two-finger vertical trackpad gesture and an ordinary mouse wheel retain native
  vertical lane scrolling;
- diagonal trackpad input can advance both axes without leaking horizontal
  overscroll to browser history or the page;
- `Shift` plus a vertical mouse wheel pans time for devices without a horizontal
  wheel axis;
- primary-button dragging on the time header pans time directly;
- primary-button dragging empty timeline space pans when task creation is not
  available, while a configured empty-space creation gesture remains creation;
- middle-button dragging the timeline pans even when task creation is configured;
- unmodified task-body and resize-edge drags preserve the existing M4 move/resize
  behavior;
- horizontal panning preserves the current finite positive range duration and
  requests the next controlled `range` through `onRangeChange`;
- a chart without `onRangeChange` does not claim or consume horizontal navigation
  input that it cannot acknowledge;
- panning remains available when the document is read-only because viewport movement
  is not a document mutation;
- selection and logical focus survive viewport virtualization and are pruned only
  when their occurrence disappears from the resolved view;
- a known offscreen occurrence target can be revealed by the existing
  `scrollToTask` handle using the same full occurrence catalog;
- keyboard users can page vertically and horizontally and task navigation can reveal
  the next occurrence even when it begins outside the rendered window;
- all playground chart examples acknowledge user-driven range changes;
- the playground top-level menu includes a dedicated `/navigation` page with 144
  deterministic scheduled task events across 36 lanes and an 18-month UTC data
  period, initially viewed through a 12-week range, so both axes and long-range
  panning are obvious;
- wheel, pointer, keyboard, focus, virtualization, cleanup, performance, responsive,
  accessibility, console, and network gates pass before the correction is marked
  complete.

## Planning Decisions

These are the selected implementation direction for this plan. Slice 1 must formalize
the durable parts in a focused decision record and architecture update before runtime
code begins.

The durable parts are accepted in the
[timeline navigation interaction contract](../decisions/2026-07-30-timeline-navigation-interaction-contract.md).

### 1. Pan the semantic time range, not a wide DOM canvas

The current horizontal viewport is a finite `TimeRange` normalized to the measured
timeline width. Panning shifts that range while preserving its duration. It must not
create horizontal DOM overflow, duplicate the scene in a translated container, or
turn scroll pixels into persistent document data.

For a measured timeline width `W`, current duration `D`, and consumed horizontal
pixel delta `dx`, the requested time shift is proportional to `dx * D / W`. Grab
dragging reverses the pointer delta so the content follows the hand. Wheel/trackpad
sign follows the platform scroll direction reported by the browser.

Panning is continuous and does not reuse task-edit snapping. Tick generation and
viewport intersection consume the adopted range through the existing derived
pipeline.

### 2. Retain the current controlled range contract in this bounded correction

`range` remains the authoritative required prop. User gestures request changes
through `onRangeChange`, and `onViewportChange` continues to observe an adopted prop.
This plan does not add `defaultRange`, store a second range in session state, or
define M5 zoom policy.

Continuous input may produce more wheel events than React can acknowledge. The
runtime therefore needs one instance-local transient proposed-range accumulator:

- deltas received in one animation frame coalesce into at most one range request;
- a later delta rebases on the latest proposed range until the prop acknowledges it;
- adoption clears the matching proposal;
- an unrelated external range replacement cancels stale proposal state and becomes
  the new base;
- unmount cancels scheduled publication;
- no proposal enters document history or the persisted session.

All standard playground examples will own local range state and synchronously
acknowledge `onRangeChange`, just as the interactive examples already do.

### 3. Separate full resolved occurrences from visible render primitives

The runtime needs two related but distinct derived views:

- a private full occurrence catalog with stable target identity, lane position,
  absolute vertical geometry, and time interval for every occurrence in the resolved
  view;
- the existing viewport-filtered lanes, task bars, hit-test nodes, and public
  `GanttVisibleOccurrence` selector snapshot.

Session reconciliation, offscreen lookup, and geometric keyboard navigation use the
full catalog. Painting and pointer hit testing remain viewport-only. The catalog must
reuse resolved layout work; it must not rebuild the document, topology, intervals, or
lane stacks during ordinary scrolling.

The catalog remains private. This plan does not export M3 layouts, prefix indexes,
interval nodes, or a general query API.

### 4. Use a deterministic wheel and trackpad policy

Input policy:

- unmodified `deltaX` pans time;
- unmodified `deltaY` retains vertical lane scrolling;
- when `Shift` is held and no meaningful horizontal delta is already present,
  `deltaY` becomes horizontal pan input;
- diagonal trackpad input may update `scrollTop` and the time range together;
- `deltaMode` line and page units normalize to pixels before conversion to time;
- non-finite and zero deltas are ignored;
- `Ctrl`/`Meta` modified wheel input is not consumed because browser zoom and
  trackpad pinch commonly use that channel;
- wheel handling is non-passive only where cancellation is required, and calls
  `preventDefault` only after the chart accepts horizontal input;
- accepted diagonal input manually preserves its vertical component when preventing
  the browser default;
- `overscroll-behavior` continues to contain accepted chart navigation.

There is no custom inertia engine. Trackpad momentum is represented by the browser's
wheel sequence and passes through the same frame coalescing.

### 5. Preserve editing gestures with an explicit pointer conflict matrix

Pointer policy:

| Surface/input | Result |
| --- | --- |
| Primary drag on task body or edge | Existing move or resize |
| Primary drag on empty body with a create mapper | Existing task creation |
| Primary drag on empty body without creation capability | Pan both axes |
| Primary drag on time header | Pan time |
| Middle drag on timeline body | Pan both axes |
| Secondary/right drag | Preserve context-menu/browser behavior |
| Pen or touch body drag | Existing M4 editing behavior; no new pan in this plan |

Panning uses pointer capture, a movement threshold, cancellation on
`pointercancel`/capture loss/unmount, and no command dispatch. It must not clear
selection merely because panning began. Starting a pan closes transient
tooltip/context-menu surfaces but cannot begin through the modal editor.

The cursor is `grab` only on a surface where the current input can pan and
`grabbing` only for the owning instance while active.

### 6. Treat read-only document state and viewport navigation independently

The current `disabled` renderer state means built-in document mutation is unavailable
for a controlled document without `onDocumentChange`. It must not disable range or
session navigation. Wheel, header drag, empty-space pan, and keyboard paging may
request viewport changes while task move/resize/create/delete remain disabled.

No panning path calls the M2 command bus, creates history, changes persistence
payloads, or emits command lifecycle events.

### 7. Preserve offscreen selection and focus deliberately

Viewport exclusion is not occurrence deletion. The full catalog owns session
existence checks, so panning a task out of view does not remove it from selection or
logical focus.

When the browser-focused task DOM node is virtualized away, focus moves to the chart
root without clearing logical focus. When navigation reveals that occurrence again,
the renderer may restore its roving task focus after the adopted viewport is
published. No hidden offscreen task DOM forest is retained merely to preserve focus.

Continuous wheel events do not produce live-region announcements. Discrete keyboard
paging may announce the newly visible time window once after adoption.

Keyboard paging uses:

- `PageUp`/`PageDown` for a vertical viewport-sized move with one lane of overlap;
- `Alt+PageUp`/`Alt+PageDown` for a horizontal range-sized move with a small overlap.

Existing arrow-key task navigation remains task navigation. It must use the full
occurrence catalog and reveal the chosen target before DOM focus transfers when that
target starts outside the rendered viewport.

### 8. Keep zoom and broader navigation policy out of this correction

This plan does not implement:

- wheel, button, pinch, or adaptive zoom;
- `fitToProject`, `zoomTo`, minimaps, scrollbars for semantic time, or a Today policy;
- custom inertial physics or elastic time bounds;
- clamping panning to document dates;
- one-finger touch panning or multi-touch gesture arbitration;
- RTL-specific delta reversal;
- calendar-aware, all-day, or working-time panning;
- a public occurrence search API by raw task ID;
- configurable input binding maps.

`Ctrl`/`Meta` wheel and pinch remain browser-owned until the M5 zoom contract is
planned. A raw-ID occurrence lookup remains a separate API question because resource
and custom views can render one task more than once.

## Behavior To Preserve

- `range` remains finite, increasing, controlled, and required.
- `onRangeChange` remains the horizontal request callback.
- `onViewportChange` observes adopted horizontal or vertical viewport state.
- Vertical scroll continues to use the real `.gt-gantt__body-scroll` element and M3
  absolute lane geometry.
- The lane column and timeline remain aligned with one shared vertical scroll offset.
- Task move, resize, mapped creation, selection, activation, context menu, editor,
  pointer capture, edge auto-pan, keyboard editing, history, and async interception
  retain their current command semantics.
- Scene primitives and hit-test nodes remain viewport-filtered.
- Multiple chart instances keep independent range accumulators, pointer captures,
  scroll positions, focus, and cleanup.
- No DOM event object, element, animation-frame handle, or mutable collection enters
  public session or document state.
- Server rendering and hydration do not read browser globals during render.
- Main, matrix, interactive, and uncontrolled routes retain responsive layout,
  semantic themes, overlay behavior, and zero page-level horizontal overflow.

## Cross-Slice Rules

- Complete and verify one slice before starting the next.
- Record every discovered deviation here and in `docs/ROADMAP.md` in the same change
  set.
- Use one focused Conventional Commit per verified slice.
- Do not change the accepted M2 command/history path for viewport navigation.
- Do not expose the full occurrence catalog or renderer geometry publicly.
- Keep event normalization and time conversion pure and browser-type-free below the
  React adapter.
- Keep pointer edit and pointer pan state mutually exclusive per instance.
- Preserve native browser zoom and do not prevent default for unaccepted input.
- Update architecture and a decision record before changing the durable interaction
  contract.
- Mark no behavior complete from source inspection alone; automated and live input
  evidence are both required.

## Implementation Shape

The intended flow is:

```text
wheel / trackpad / pointer drag / keyboard page
  -> renderer adapter normalizes device input
  -> pure viewport-navigation intent
  -> instance runtime coalesces horizontal proposal
     + updates/proposes vertical session intent
  -> consumer acknowledges controlled range/session
  -> derived pipeline reuses topology/layout/catalog
  -> viewport query + primitives + hit-test refresh
  -> DOM scroll/focus reconcile to adopted state
```

The private occurrence path is:

```text
resolved topology + intervals + stacked layout
  -> full occurrence catalog
     -> session existence/reconciliation
     -> offscreen target lookup
     -> keyboard geometric navigation
  -> M3 viewport query
     -> visible lanes/task bars
     -> pointer hit-test index
     -> public visible-occurrence selector
```

Likely implementation boundaries:

- a React-free viewport-navigation helper under `packages/gantt/src/interaction/` or
  `packages/gantt/src/runtime/`;
- a private occurrence catalog produced beside the scene pipeline's completed layout;
- instance-local proposal/pointer state in the existing React runtime rather than
  module globals;
- wheel and pointer DOM adapters in `packages/gantt/src/react/Gantt.tsx`;
- low-specificity cursor/overscroll states in `packages/gantt/src/styles.css`;
- a full-size `/navigation` stress consumer linked from the playground's top-level
  menu, with 144 deterministic events across 36 lanes and an 18-month UTC period.

Exact private filenames may change in Slice 2 after the pipeline return boundary is
audited. Public API changes require explicit Slice 1 justification; the default
implementation should reuse existing `GanttProps`, `GanttSemanticEvent`,
`GanttScrollOptions`, and `GanttHandle` types.

## Slices

### Slice 0: Record the plan and reproduced baseline

Status: `[x]` Done

Goal: Make the missing base interaction and its architectural prerequisite
recoverable before implementation starts.

Why here: The gap crosses runtime, virtualization, DOM input, accessibility,
playground, and public-contract evidence. It must not be implemented as an isolated
event handler.

This slice implements:

- source inspection of range ownership, wheel listeners, pointer conflicts,
  occurrence derivation, and playground consumers;
- live Chrome inspection of the selected `/interactive` chart geometry;
- this detailed plan and synchronized roadmap priority/deviation entry.

Expected output:

- one active implementation plan;
- one roadmap link selecting Slice 1 ahead of the previously queued appendix;
- no runtime behavior change.

Verification:

- `git diff --check`;
- linked-file existence and focused plan/roadmap status checks;
- Chrome DevTools `list_pages` plus geometry inspection on
  `http://localhost:5173/interactive`.

Dependencies: none.

### Slice 1: Freeze the navigation and occurrence-lifetime contract

Status: `[x]` Done

Goal: Accept the durable behavior before changing runtime ownership or gestures.

Why here: Wheel cancellation, controlled proposal coalescing, creation-versus-pan
conflicts, and offscreen focus lifetime are product contracts rather than incidental
DOM details.

This slice should implement:

- add
  `docs/decisions/2026-07-30-timeline-navigation-interaction-contract.md`;
- formalize the axis/modifier/pointer conflict matrix, controlled range proposal
  lifecycle, full-versus-visible occurrence distinction, focus behavior, browser
  zoom exclusion, and accessibility bindings;
- update `docs/ARCHITECTURE.md` with the accepted post-M4 navigation target;
- link the decision from architecture, roadmap, and this plan;
- correct any base-M4 wording that currently implies ordinary horizontal panning was
  verified;
- record exact public API impact, expected to be none unless the contract audit
  proves otherwise.

Expected output:

- one accepted cross-plan decision and synchronized architecture/roadmap boundary;
- no source runtime change.

Verification:

- `git diff --check`;
- exact link existence and cross-document terminology/status checks.

Dependencies: Slice 0.

Completed in this slice:

- accepted the axis/modifier/pointer matrix and semantic controlled-range pan model;
- fixed one transient per-instance proposal lifecycle and browser-zoom pass-through;
- separated private full-occurrence lifetime from viewport-only paint, hit testing,
  and public selectors;
- fixed read-only navigation, DOM-focus handoff, offscreen reveal, keyboard paging,
  and accessibility expectations;
- confirmed that no public type or export is required;
- linked the decision from architecture, roadmap, the base-M4 decision, and this
  plan, while correcting the broad base-M4 occurrence-scroll wording.

Verification:

- `git diff --check` passed;
- exact decision/architecture/roadmap/plan links and status terminology checks
  passed;
- `mise run ci` passed on the completed Slice 1 tree.

### Slice 2: Add a viewport-independent occurrence catalog

Status: `[x]` Done

Goal: Stop treating viewport exclusion as occurrence deletion and make offscreen
geometry addressable without exposing layout internals.

Why here: Every later pan can move selected/focused tasks out of the render query.
The registry must be correct before input can drive that transition.

This slice should implement:

- derive a private immutable occurrence catalog from completed resolved
  intervals/layout before viewport filtering;
- carry target provenance, stable view key, lane order/key, absolute vertical bounds,
  and start/end time;
- feed full occurrences to session reconciliation while preserving visible selector
  occurrences and viewport-only hit testing;
- preserve selection/logical focus when an occurrence is merely outside either axis;
- prune/reconcile only on actual document/view removal;
- update the existing `scrollToTask` implementation to locate a known target in the
  catalog, propose vertical alignment, and request horizontal range alignment when
  needed;
- preserve `false` for genuinely missing/stale occurrence targets or a required
  horizontal request without `onRangeChange`;
- prove cache reuse and avoid full layout work on vertical/horizontal viewport moves.

Expected output:

- one private full occurrence boundary;
- corrected session lifetime under virtualization;
- corrected known-target offscreen imperative reveal as a by-product;
- no public layout/index export.

Verification:

- focused scene-pipeline, runtime-store, session, runtime, and facade tests;
- property coverage for visible/full occurrence parity and document/view removal;
- cache work-counter assertions for vertical and horizontal viewport changes;
- `vp check`;
- `git diff --check`.

Dependencies: Slice 1.

Completed in this slice:

- added one private frozen occurrence catalog projected from completed absolute
  layout before viewport filtering;
- retained stable target provenance, lane order/key and bounds, task bounds, and
  scheduled interval for every resolved occurrence;
- reconciled selection/logical focus against the full catalog while leaving public
  visible occurrences, scene primitives, and pointer hit testing viewport-only;
- preserved full-catalog identity across horizontal and vertical queries without
  rebuilding topology, intervals, lane stacks, or the catalog;
- updated `focusTask` and `scrollToTask` to resolve known offscreen targets, with
  atomic failure when a required horizontal or controlled vertical request cannot be
  acknowledged;
- preserved missing-target failure and deterministic session reconciliation after
  actual document removal.

Verification:

- `vp test run packages/gantt/src/render/scene-pipeline.test.ts packages/gantt/src/render/scene-pipeline.property.test.ts packages/gantt/src/runtime/store.test.ts packages/gantt/src/react/runtime.test.ts`
  passed 4 files / 35 tests;
- fixed-seed property coverage passed cached/cold full-catalog parity and proved
  every visible task maps to one full occurrence;
- horizontal and vertical work-counter assertions passed with zero topology,
  interval, lane-stack, and occurrence-catalog rebuilds;
- `vp check`, `git diff --check`, and `mise run ci` passed on the completed Slice 2
  tree.

### Slice 3: Implement pure pan intent and controlled proposal orchestration

Status: `[x]` Done

Goal: Convert device-independent pixel/page intent into safe vertical and horizontal
viewport requests.

Why here: DOM listeners should be thin adapters over verified math, ownership, and
coalescing.

This slice should implement:

- pure finite delta normalization and pixel-to-time conversion;
- range shifting that preserves duration and rejects overflow/non-finite results;
- viewport-sized vertical/page calculations with clamping to content height;
- one per-instance animation-frame horizontal proposal accumulator;
- acknowledgement, external replacement, callback absence, cancellation, disposal,
  and multi-instance semantics;
- one runtime operation usable by wheel, pointer pan, keyboard paging, edge auto-pan,
  and the repaired imperative path where appropriate;
- retain `onViewportChange` as adopted-state observation rather than proposal
  delivery.

Expected output:

- renderer-independent navigation math and proposal lifecycle;
- no wheel or new pointer binding yet.

Verification:

- focused unit tests for signs, delta units, measured/unmeasured state, clamping,
  finite boundaries, proposal accumulation, acknowledgement/rebase, replacement, and
  cleanup;
- fixed-seed property coverage for duration preservation and finite results;
- existing edge-auto-pan and imperative runtime suites;
- `vp check`;
- `git diff --check`.

Dependencies: Slice 2.

Completed in this slice:

- added browser-type-free delta normalization for pixel, line, and page units;
- added finite duration-preserving pixel/time range shifting plus vertical direct and
  viewport-page clamping;
- added one React-free per-instance controlled range proposal controller with
  deferred frame coalescing, immediate discrete requests, pending-proposal rebasing,
  exact acknowledgement, unchanged-prop retention, unrelated external replacement,
  callback absence, cancellation, disposal, and independent-instance behavior;
- added one runtime `navigateViewport` operation that safely combines optional
  horizontal pixel and vertical session deltas;
- routed drag-edge horizontal auto-pan and imperative `scrollToTask`/`scrollToTime`
  range requests through the same proposal lifecycle;
- preserved `onViewportChange` as adopted-state observation and kept all navigation
  outside document commands/history.

Verification:

- `vp test run packages/gantt/src/react/Gantt.dom.test.tsx packages/gantt/src/interaction/viewport-navigation.test.ts packages/gantt/src/interaction/viewport-navigation.property.test.ts packages/gantt/src/runtime/range-proposals.test.ts packages/gantt/src/react/runtime.test.ts packages/gantt/src/interaction/gesture.test.ts`
  passed 6 files / 38 tests;
- fixed-seed property coverage passed 200 finite duration-preservation cases;
- the existing DOM drag-edge auto-pan test passed after observing the intentional
  animation-frame publication boundary;
- `vp check`, `git diff --check`, and `mise run ci` passed on the completed Slice 3
  tree.

### Slice 4: Connect wheel and trackpad navigation

Status: `[x]` Done

Goal: Make ordinary wheel/trackpad input move the appropriate viewport axis.

Why here: The adapter can now delegate to stable navigation semantics and full
occurrence state.

This slice should implement:

- a scoped non-passive wheel adapter on the chart navigation surfaces;
- horizontal `deltaX`, vertical `deltaY`, diagonal input, `Shift` fallback, and
  line/page normalization;
- `Ctrl`/`Meta` browser-zoom pass-through;
- vertical preservation when an accepted horizontal gesture requires
  `preventDefault`;
- no-op/pass-through behavior when horizontal range changes cannot be acknowledged;
- per-frame coalescing, cleanup, and two-instance isolation;
- overlay/form-control exclusions;
- styling needed to contain accepted overscroll without introducing page overflow.

Expected output:

- trackpad and wheel time panning;
- preserved native-feeling vertical scrolling;
- no pointer-drag behavior change yet.

Verification:

- focused DOM tests using `WheelEvent` for horizontal, vertical, diagonal, shifted,
  modifier, delta-mode, missing-callback, cleanup, and multi-instance cases;
- runtime callback-order assertions;
- Chrome DevTools geometry/console inspection on the selected local route;
- use the built-in Browser input surface only if Chrome DevTools still lacks trusted
  wheel dispatch, as allowed by `AGENTS.md`;
- `vp check`;
- `git diff --check`.

Dependencies: Slice 3.

Completed in this slice:

- added one scoped non-passive wheel listener to each chart surface;
- normalized pixel, line, and page delta modes through the pure Slice 3 helper;
- mapped unmodified horizontal, native vertical, accepted diagonal, and
  `Shift`-vertical fallback policy into the shared runtime operation;
- preserved `Ctrl`/`Meta` browser zoom, zero/non-finite input, native vertical-only
  scrolling, missing range acknowledgement, form controls, and detached instances
  without preventing default;
- manually preserved the vertical component after accepted horizontal diagonal input
  and retained instance-local range coalescing;
- contained accepted overscroll on the complete chart surface without adding
  horizontal DOM overflow.

Verification:

- `vp test run packages/gantt/src/react/Gantt.wheel.dom.test.tsx packages/gantt/src/react/runtime.test.ts packages/gantt/src/interaction/viewport-navigation.test.ts packages/gantt/src/react/Gantt.dom.test.tsx`
  passed 4 files / 37 tests;
- focused wheel cases covered horizontal, vertical, diagonal, shifted, `Ctrl`,
  `Meta`, zero, line, page, missing callback, form exclusion, cleanup, and two
  instances with callback/default assertions;
- Chrome DevTools `list_pages` was attempted first but its configured profile was
  locked by another process; the repository-approved in-app Browser fallback opened
  only `http://localhost:5173/interactive`;
- live horizontal scroll input moved ticks from `Jul 29`–`Aug 26` to
  `Aug 12`–`Sep 02` on the controlled consumer, kept the URL stable, retained zero
  page overflow, and produced no console warnings/errors;
- live geometry measured a roughly 942 × 232 timeline with `overflow-x: hidden` and
  `overscroll-behavior: contain` on both chart and body; the fixture had equal
  vertical content/extent, so diagonal vertical movement remains automated evidence;
- `vp check`, `git diff --check`, and `mise run ci` passed on the completed Slice 4
  tree.

### Slice 5: Add direct mouse grab panning without breaking editing

Status: `[ ]` Not started

Goal: Let mouse users drag the timeline while preserving M4 task editing and mapped
creation.

Why here: Pointer arbitration must build on the same verified pan operation as wheel
input.

This slice should implement:

- primary drag on the time header;
- primary empty-body drag only when creation is unavailable;
- middle-button timeline drag regardless of creation capability;
- pointer threshold, capture, movement, cancellation, capture loss, and unmount
  cleanup;
- horizontal range and vertical scroll updates from one grab origin;
- task move/resize, mapped empty creation, activation/click threshold, context menu,
  pen, and touch preservation;
- instance-scoped `grab`/`grabbing` cursor states;
- transient tooltip/menu dismissal without session clearing or command dispatch.

Expected output:

- direct mouse navigation with a tested conflict matrix;
- unchanged document/history behavior during pans.

Verification:

- pure gesture and focused DOM tests for every conflict-matrix row;
- tests proving no command/history/change callbacks during pan;
- pointer capture/cancel/lost-capture/unmount and two-instance isolation cases;
- regression suites for mouse/pen/touch move, resize, creation, activation, menu, and
  editor;
- live Chrome mouse-drag verification at desktop and narrow widths;
- `vp check`;
- `git diff --check`.

Dependencies: Slice 4.

### Slice 6: Complete keyboard, focus, and accessibility behavior

Status: `[ ]` Not started

Goal: Keep navigation usable and focus-correct when virtualization changes both axes.

Why here: The full catalog and adopted pan behavior now exist, so focus handoff and
offscreen reveal can be tested against real transitions.

This slice should implement:

- `PageUp`/`PageDown` vertical paging and
  `Alt+PageUp`/`Alt+PageDown` horizontal paging;
- full-catalog arrow navigation that reveals a chosen offscreen occurrence before
  moving DOM focus;
- root focus handoff when the currently browser-focused task virtualizes out;
- logical focus/selection retention and deterministic restoration when revealed;
- concise help text for wheel, trackpad, header/middle drag, paging, and editing
  conflicts;
- no per-frame live-region noise;
- reduced-motion, forced-colors, zoomed-text, and focus-visible regression coverage.

Expected output:

- keyboard viewport navigation;
- no focus loss or session pruning caused only by viewport movement;
- an updated accessible interaction description.

Verification:

- focused keyboard, session, DOM focus, hydration, and axe tests;
- keyboard-only live Chrome flow across initially offscreen lanes and times;
- accessibility-tree inspection at 1,440 × 900 and 560 × 900;
- existing keyboard move/resize/create/delete/history regression suites;
- `vp check`;
- `git diff --check`.

Dependencies: Slice 5.

### Slice 7: Prove the public consumer and playground experience

Status: `[ ]` Not started

Goal: Make the basic interaction visible in real examples and document its controlled
ownership boundary.

Why here: Examples should consume only the completed package behavior, not guide
unfinished runtime design.

This slice should implement:

- make `ScenarioGantt` own a local range initialized from its scenario and acknowledge
  `onRangeChange`;
- keep `/interactive` and `/uncontrolled` acknowledgement behavior explicit;
- add a top-level `Navigation` menu item and dedicated `/navigation` route;
- add a deterministic navigation fixture with exactly 144 scheduled task events
  across 36 lanes, distributed across a fixed 18-month UTC period;
- give the example a 12-week initial range rather than another few-day window, while
  retaining events before, inside, and after that initial viewport;
- keep the fixture deterministic and network-free, with stable IDs/timestamps and no
  runtime randomness, so DOM and browser evidence is reproducible;
- show concise example metadata/instructions including the event count, lane count,
  total covered period, current visible range, and supported wheel/trackpad/mouse/
  keyboard gestures;
- include clipped edge cases, overlapping work, and sufficiently distributed dates
  that repeated horizontal panning continues to reveal real content rather than only
  empty time;
- ensure every playground chart instance pans independently;
- document trackpad, mouse-wheel, header/middle-drag, keyboard paging, controlled
  range acknowledgement, and modifier behavior in `README.md`;
- remove or update stale playground wording that says timeline navigation is not
  implemented;
- inspect packed declarations to confirm no private catalog/navigation type leaked.

Expected output:

- self-demonstrating playground navigation;
- one top-level `/navigation` example with 144 events, 36 lanes, an 18-month data
  period, and a 12-week initial viewport;
- consumer documentation with no imperative-only implication;
- stable live-test fixtures for both viewport axes.

Verification:

- focused playground DOM tests proving the top-level `Navigation` link/current-page
  state, exact 144-event/36-lane fixture, 18-month coverage, 12-week initial range,
  deterministic IDs/timestamps, and visible-range updates after navigation;
- root public-facade consumer compile/runtime tests;
- `mise run build-playground`;
- `vp pack` and packed declaration inspection;
- Chrome DevTools on `/`, `/matrix`, `/interactive`, `/uncontrolled`, and
  `/navigation`, including top-level-menu responsiveness and zero page overflow;
- `git diff --check`.

Dependencies: Slice 6.

### Slice 8: Run final automated, performance, and live gates

Status: `[ ]` Not started

Goal: Close the correction only with repository-wide and real-input evidence.

Why here: Input interaction, virtualization, focus, and controlled callbacks have
cross-cutting failure modes that focused tests alone cannot settle.

This slice should implement:

- run final scoped and complete automated gates;
- extend the existing runtime interaction benchmark with a reproducible steady
  horizontal-pan case and exact work counters, without a cross-machine timing claim;
- inspect SSR/hydration and package boundaries;
- exercise mouse wheel, trackpad-equivalent horizontal/diagonal input, shifted wheel,
  header drag, middle drag, vertical scroll, keyboard paging, task drag, creation,
  focus retention, and two instances;
- traverse the `/navigation` fixture from early to late data and back while proving
  that its current-range display, event count, lane alignment, virtualization, and
  focus/selection remain coherent;
- verify console, network, accessibility, responsive geometry, and no page-level
  horizontal overflow;
- record exact evidence here, in the decision record, and in `docs/ROADMAP.md`;
- select the next repository action only after every required gate passes.

Expected output:

- one completed and evidenced navigation contract;
- no unverified completion claim.

Verification:

- focused navigation/runtime/scene/session/DOM/keyboard/playground suites;
- `mise run ci`;
- `mise run build-playground`;
- `git diff --check`;
- packed artifact and SSR/hydration inspection;
- fixed-seed runtime interaction benchmark with work metadata;
- Chrome DevTools at 1,440 × 900, 900 × 900, and 560 × 900 on every in-scope route;
- trusted wheel dispatch through the built-in Browser only where Chrome DevTools lacks
  that input capability;
- manual physical trackpad confirmation recorded as outstanding if no connected tool
  can produce trusted diagonal/momentum input.

Dependencies: Slice 7.

## Testing Plan

### Pure and runtime checks

- wheel unit normalization for pixel, line, and page modes;
- pixel/time sign and duration-preservation properties;
- finite range and content-bound clamping;
- per-frame proposal coalescing and controlled acknowledgement/rebase;
- external range replacement and callback absence;
- full/visible occurrence parity and stable target identity;
- selection/focus retention across both viewport axes;
- actual occurrence removal after document/view change;
- offscreen `scrollToTask` alignment;
- cache invalidation/work-counter evidence;
- disposal and multi-instance isolation.

### DOM interaction checks

- vertical, horizontal, diagonal, shifted, modified, and zero wheel input;
- accepted versus pass-through `preventDefault`;
- header primary drag, conditional empty primary drag, and middle drag;
- task move/resize and mapped creation conflict regression;
- pointer threshold, capture, cancel, capture loss, and unmount;
- cursor/data state, overlay dismissal, and modal exclusion;
- root focus handoff/restoration and no session clearing;
- keyboard paging and offscreen task reveal;
- SSR/hydration with no render-time browser access.

### Live browser checks

Record for each route and viewport:

- exact route and viewport dimensions;
- input device/emulation method and every gesture exercised;
- range/tick movement and vertical scroll offsets before/after;
- task/lane alignment and page overflow;
- selection/focus before and after offscreen transitions;
- accessibility-tree roles, names, focus, and help text;
- context menu/editor/task-drag/create regressions;
- console errors/warnings and failed network requests;
- any Chrome/extension environment noise kept separate from application findings.

Chrome DevTools remains the preferred inspection surface. If it cannot dispatch a
trusted wheel gesture, use the built-in Browser only for that missing input capability
and retain DevTools for geometry, accessibility, console, and network evidence.

## Likely Files to Add

- `docs/decisions/2026-07-30-timeline-navigation-interaction-contract.md`
- `packages/gantt/src/interaction/viewport-navigation.ts`
- `packages/gantt/src/interaction/viewport-navigation.test.ts`
- `apps/playground/src/pages/NavigationPage.tsx`
- `apps/playground/src/pages/NavigationPage.dom.test.tsx`

## Likely Files to Change

- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/decisions/2026-07-30-interaction-runtime-public-api-contract.md` only if the
  new decision needs an explicit supersession link
- `README.md`
- `packages/gantt/src/render/scene-pipeline.ts`
- `packages/gantt/src/render/scene-pipeline.test.ts`
- `packages/gantt/src/runtime/session.ts`
- `packages/gantt/src/runtime/session.test.ts`
- `packages/gantt/src/runtime/store.ts`
- `packages/gantt/src/runtime/store.test.ts`
- `packages/gantt/src/react/runtime.ts`
- `packages/gantt/src/react/runtime.test.ts`
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/react/Gantt.dom.test.tsx`
- `packages/gantt/src/react/Gantt.keyboard.dom.test.tsx`
- `packages/gantt/src/react/runtime-interaction.bench.ts`
- `packages/gantt/src/styles.css`
- `apps/playground/src/Playground.tsx`
- `apps/playground/src/ScenarioGantt.tsx`
- `apps/playground/src/scenarios/index.ts`
- relevant playground page/test/style files

This is a blast-radius guide, not permission to edit every listed file. Each slice
must re-audit the narrowest actual boundary before implementation.

## Risks

### Controlled proposal lag causes jumps or lost deltas

Rebasing every wheel event only on the last adopted prop can repeat the same range.
The instance-local proposed-range accumulator and callback-order tests must cover
bursts, synchronous acknowledgement, delayed acknowledgement, and external
replacement.

### Preventing wheel default breaks vertical scrolling or browser navigation

The adapter must claim only accepted horizontal input and manually preserve a
diagonal vertical component when cancellation is necessary. `Ctrl`/`Meta` wheel must
remain browser-owned.

### Panning steals task editing or creation

The pointer conflict matrix is contractual. Tests must cover every surface/button
combination, not only successful pan gestures.

### Virtualization clears selection or strands DOM focus

The full occurrence catalog must own existence while visible primitives own paint.
Focus handoff/restoration needs browser tests because jsdom cannot prove every native
focus transition.

### Continuous input rebuilds too much work

Horizontal adoption should reuse validation, topology, intervals, lane stacks, and
the full catalog. Benchmarks and work counters must demonstrate the invalidation
boundary without claiming a portable frame rate.

### Static consumers make the implementation appear broken

Every playground example must acknowledge `onRangeChange`, and documentation must
state the controlled contract directly.

### A large demo fixture becomes noisy or non-reproducible

The `/navigation` example must use deterministic fixed data rather than random
generation, keep its 144 events distributed across 36 lanes and 18 months, and show
summary metadata instead of rendering a separate control or explanation per event.
The example is a consumer proof, not a replacement for the 10,000-task kernel
benchmark.

### Synthetic wheel evidence differs from a physical trackpad

Automated trusted wheel dispatch can prove handler/default/callback behavior, but
diagonal momentum and natural-scroll settings can differ by hardware. Record one
physical trackpad check when available; do not represent synthetic input as physical
hardware evidence.

## Open Questions

No product decision blocks Slice 1. The following implementation choices remain
deliberately private:

1. Whether the full occurrence catalog is returned directly beside the scene or
   retained as a private pipeline cache projection.
2. Whether wheel frame coalescing lives in the React adapter or runtime scheduler;
   it must remain instance-owned and independently testable either way.

Any choice that changes public types, input bindings, range ownership, or
accessibility semantics must return to Slice 1 rather than being decided privately
during implementation.

## Working Notes

### 2026-07-30 reproduced baseline

- The selected Chrome page was `http://localhost:5173/interactive`.
- Live geometry reported a 1,293 × 232 body viewport with equal
  `clientWidth`/`scrollWidth` and `clientHeight`/`scrollHeight`; the current fixture
  therefore exercises neither DOM axis overflow.
- The live timeline measured 1,089 pixels wide with equal `clientWidth` and
  `scrollWidth`, computed `overflow-x: hidden`, `touch-action: none`, and an automatic
  cursor. Visible ticks were `Aug 12`, `Aug 19`, `Aug 26`, and `Sep 02`.
- Source inspection found a passive body `scroll` measurement listener but no wheel
  or trackpad navigation handler.
- `.gt-gantt__body-scroll` owns native `overflow: auto`; the timeline owns
  `overflow: hidden`, so horizontal movement cannot be produced by DOM scroll width.
- The public `range` prop is required and controlled. `onRangeChange` is optional.
  `/interactive` and `/uncontrolled` acknowledge range requests; `ScenarioGantt`
  passes a fixed scenario range, so `/` and `/matrix` cannot move horizontally.
- Primary timeline pointers currently feed task move/resize or empty-space creation.
  The renderer rejects non-primary buttons before the runtime, so no grab-pan gesture
  exists.
- The runtime currently builds session occurrences from `scene.taskBars`, which are
  produced only from viewport-filtered placements. This is the shared cause of
  offscreen session/reveal risk.
- The existing `scrollToTask` searches only `snapshot.scene.taskBars`; a known target
  outside the current viewport returns `false`. Slice 2 includes the known-target
  correction because the full catalog is already required for safe user panning.
- Chrome DevTools can inspect the selected page, geometry, accessibility, console,
  and network state but the exposed tool surface does not currently include trusted
  wheel dispatch. The final gate may use the built-in Browser for that capability
  while retaining DevTools for the rest.

### 2026-07-30 planning verification

- `git diff --check` passed.
- `vp fmt ... --check` reported that Markdown is excluded by the repository formatter,
  so no formatting claim is made for these documentation files.
- The new plan path exists, the roadmap links it as the selected correction, Slice 0
  is the only completed slice, and Slice 1 is the actionable next slice.
- Chrome DevTools selected only the in-scope `/interactive` page and returned the
  geometry recorded above.
- No runtime, package, playground, architecture, or decision behavior changed in
  this planning slice.

### 2026-07-30 top-level long-range example requirement

- The navigation stress surface is no longer an open route-versus-section choice.
  It must be a dedicated `/navigation` page linked as `Navigation` from the
  playground's top-level menu.
- The fixed consumer dataset contains exactly 144 scheduled task events across 36
  lanes over an 18-month UTC period. Its initial visible range is 12 weeks, not a
  few-day example window.
- Events must exist before, within, and after the initial range, include overlap and
  clipping cases, and remain deterministic/network-free so horizontal and vertical
  scrolling can be verified repeatably.
- The page must display its event/lane/period summary, current visible range, and
  concise navigation instructions without exposing private runtime geometry.
- This refines Slice 7 and its final live gate only. Slice 1 remains the actionable
  next slice, and no implementation status changed.
- Amendment verification passed `git diff --check`, exact plan/roadmap requirement
  searches, explicit future page/test path checks, and confirmation that the former
  route-versus-section open question was removed.

### 2026-07-30 Slice 1 navigation contract

- Accepted
  `docs/decisions/2026-07-30-timeline-navigation-interaction-contract.md`.
- The correction keeps `range` required and controlled, adds no public export, and
  treats the proposed-range accumulator plus full occurrence catalog as private
  per-instance/derived runtime state.
- Architecture now distinguishes semantic time panning from DOM overflow and full
  occurrence lifetime from visible painting/hit testing.
- The base-M4 decision now links the correction and limits its completed imperative
  focus/scroll claim to viewport-rendered targets.
- `git diff --check`, exact cross-document link/status checks, and `mise run ci`
  passed on the completed slice.

### 2026-07-30 Slice 2 full occurrence catalog

- The scene pipeline now returns a private catalog beside the public scene. It is
  derived only when completed layout identity changes and is reused across ordinary
  range/scroll queries.
- The React runtime converts the full catalog to internal session occurrences while
  continuing to derive the public `GanttVisibleOccurrence` list from visible task
  primitives.
- A direct runtime regression proves selected/logically focused occurrences survive
  both-axis exclusion and reconcile only after actual task deletion.
- Known offscreen `scrollToTask` now requests aligned semantic time and vertical
  session intent, while missing callbacks reject the combined reveal before either
  request is published.
- Focused tests passed 4 files / 35 tests; `vp check`, `git diff --check`, and
  `mise run ci` passed on the completed slice.

### 2026-07-30 Slice 3 navigation math and proposals

- Added pure viewport-navigation functions for unit normalization, time shifts,
  direct vertical movement, and discrete page movement. Non-finite/unmeasured input
  fails closed without emitting a proposal.
- Added a React-free proposal controller that keeps one adopted base and one transient
  proposed base per instance. Continuous shifts publish at most once per scheduled
  frame; imperative requests remain immediate.
- Exact adoption clears a proposal, repeated rendering of the unchanged old prop
  does not discard delayed deltas, and an unrelated replacement cancels scheduled
  stale work.
- The runtime now exposes one internal combined pixel-navigation operation for later
  wheel, grab, and keyboard adapters. Edge auto-pan and imperative range requests
  already reuse the same controller.
- Focused tests passed 6 files / 38 tests; `vp check`, `git diff --check`, and
  `mise run ci` passed on the completed slice.

### 2026-07-30 Slice 4 wheel and trackpad adapter

- Each chart owns one non-passive listener on its chart subtree. The listener
  prevents default only after the horizontal controlled-range operation accepts the
  input.
- Vertical-only input remains native. Accepted diagonal input applies its vertical
  component through the runtime before cancellation; if controlled session ownership
  cannot accept that component, the DOM scroll offset is preserved directly.
- `Ctrl`/`Meta`, zero/non-finite deltas, missing `onRangeChange`, form controls,
  unmount, and sibling instances pass through or isolate as contracted.
- Chrome DevTools could not attach because its configured profile was already locked.
  The in-app Browser fallback exercised actual horizontal scroll input on
  `/interactive`: ticks advanced, URL and zero-overflow state held, overscroll
  containment was computed on chart/body, and console logs remained clean.
- The live fixture had no vertical overflow, and its modifier input surface did not
  expose a distinct shifted-wheel result. Diagonal vertical and Shift fallback
  claims therefore remain backed by focused `WheelEvent` automation in this slice.
- Focused tests passed 4 files / 37 tests; `vp check`, `git diff --check`, and
  `mise run ci` passed on the completed slice.

## Deviations

### 2026-07-30 — Base-M4 “scrolling” evidence did not include ordinary time panning

- The roadmap's base-M4 summary used the broad word “scrolling.”
- Verified behavior is narrower: native vertical viewport scrolling, drag-edge
  auto-pan, and imperative range requests exist, but wheel/trackpad/header/body
  gestures do not move the horizontal time range.
- The roadmap now names the verified behavior precisely and selects this correction
  before the previously queued item-properties appendix.
- This changes execution priority and requires a post-M4 interaction decision; it
  does not invalidate the completed document, command, layout, or renderer kernels.

## Final Completion Gate

Do not mark this plan complete until:

- Slices 1–8 are `[x]` with exact verification evidence;
- the navigation decision is accepted and linked from architecture, roadmap, and
  this plan;
- selection/focus survive horizontal and vertical virtualization;
- known-target offscreen `scrollToTask` works without exporting the full catalog;
- wheel, trackpad-equivalent, mouse drag, keyboard paging, editing conflicts, and
  cleanup are covered;
- `mise run ci`, `mise run build-playground`, `vp pack`, SSR/hydration inspection,
  and `git diff --check` pass;
- fixed-seed performance/work evidence is recorded without a portable timing claim;
- Chrome DevTools responsive/accessibility/console/network gates pass;
- trusted wheel evidence is recorded, and physical trackpad evidence is either
  recorded or explicitly left unverified;
- the top-level `/navigation` example renders the deterministic 144-event, 36-lane,
  18-month fixture, starts with a 12-week range, and passes long-range two-axis
  navigation plus responsive-menu checks;
- the plan, decision, architecture, README, and roadmap describe the same final
  behavior and next action.

## Next Slice

Start Slice 5 by adding an explicit mouse-only pan gesture state beside the existing
edit gesture in `packages/gantt/src/react/runtime.ts` and thin header/body pointer
adapters in `packages/gantt/src/react/Gantt.tsx`. Preserve primary task edit, mapped
empty creation, pen/touch, secondary/context-menu, activation threshold, and editor
behavior; add primary header, conditional primary empty-body, and unconditional
middle-body pan with capture/cancel/lost-capture/unmount isolation plus
instance-scoped cursor state. Verify the conflict matrix, zero command/history
effects, live desktop/narrow mouse drag, `vp check`, `git diff --check`, and
`mise run ci`.
