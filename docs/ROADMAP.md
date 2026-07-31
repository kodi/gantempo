# Gantempo Roadmap

Status: Active execution roadmap
Last updated: 2026-07-31

## Purpose

This document is the execution-level bridge between
[`ARCHITECTURE.md`](ARCHITECTURE.md) and the detailed working plans under
[`docs/plans/`](plans/).

It answers:

- what has been completed;
- what is active or next;
- which milestones depend on which foundations;
- what proves each milestone complete;
- which detailed plan owns the current implementation work.

It does not redefine the target architecture or contain file-level implementation
checklists. Architecture decisions belong in `ARCHITECTURE.md` or a focused decision
record. Detailed tasks, findings, verification commands, and handoff notes belong in
the active plan.

## Status Legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Done and verified

Only verified work may be marked done.

## Current Baseline

The first real read-only chart path is complete:

- task, lane, and placement records remain separate;
- epoch-millisecond schedules flow through a pure linear scale and scene builder;
- a responsive DOM/SVG renderer consumes semantic primitives;
- the main and matrix playground routes use the real component;
- compact, dark, high-contrast, multiple-entry, clipped, and empty cases are covered;
- package, test, build, responsive visual, and accessibility checks pass.

Completion evidence and implementation findings are recorded in
[`2026-07-30-simplest-chart-primitives-plan.md`](plans/2026-07-30-simplest-chart-primitives-plan.md).

This rendering baseline is a deliberately narrow vertical subset of architecture
Slice 2. The completed M1, M2, and M3 kernels now provide its canonical document,
change, resolved-view, variable-height layout, and indexed viewport foundations.

The M1 document kernel is also complete:

- unknown wire input passes through one schema-version-1 parse boundary;
- IDs, instant/all-day dates, collections, JSON extensions, and records normalize to
  one canonical React-free model;
- structured diagnostics preserve unrelated valid records across recoverable failures;
- referential validation and deterministic primary/relationship indexes are verified;
- stable serialization and the full six-domain round trip are byte-idempotent;
- the existing scene, React package, and responsive playground consume the same model.

Detailed completion evidence is recorded in
[`2026-07-30-document-kernel-foundation-plan.md`](plans/2026-07-30-document-kernel-foundation-plan.md).

The M2 change kernel is complete:

- typed commands normalize ergonomic record inputs and reject invalid intent without
  repairing it;
- one versioned collection-plus-ID patch format applies atomically and returns direct
  inverses;
- task/relationship deletion, ordered nested transactions, and collection-qualified
  affected references are deterministic;
- explicit-capacity immutable history reuses patch application for fail-closed
  undo/redo;
- stable root exports document the pure change and persistence boundary;
- fixed-seed properties, the full repository gate, packed artifacts, and playground
  build pass without changing rendered output.

Detailed completion evidence is recorded in
[`2026-07-30-change-kernel-plan.md`](plans/2026-07-30-change-kernel-plan.md).

The M3 view, layout, and viewport kernel is complete:

- one immutable React-free boundary resolves document, flat project, flat resource,
  and application-defined view topology with stable identity and provenance;
- task and explicit segment references resolve to isolated half-open instant
  intervals with structured diagnostics;
- deterministic lowest-track stacking computes exact variable lane geometry;
- binary-searched lane boundaries and augmented interval trees answer repeated
  two-dimensional viewport queries with brute-force parity;
- the read-only React component and real playground consume the same scene path;
- fixed-seed properties, the 10,000-task/2,000-lane baseline, package/facade
  inspection, full CI, production build, and responsive browser matrix pass.

Detailed completion evidence is recorded in
[`2026-07-30-view-layout-viewport-kernel-plan.md`](plans/2026-07-30-view-layout-viewport-kernel-plan.md).

The base M4 interaction runtime and public API is complete:

- controlled and uncontrolled document/session ownership converge on one per-instance
  command bus, bounded history, persistence-ready change envelope, and selective
  derived pipeline;
- pointer, pen, touch, keyboard, toolbar, menu, editor, history, and imperative
  actions use the same semantic commands and lifecycle;
- occurrence-aware selection, focus, measured viewport, hit testing, snapping,
  previews, native vertical scrolling, drag-edge auto-pan, viewport-rendered
  occurrence focus/scroll, and accessible treegrid behavior are verified;
- typed content/surface slots, class hooks, columns, tooltip, context menu, and the
  instant-task editor compose without exposing private runtime or renderer state;
- controlled and runtime-owned playground consumers prove API-shaped loading,
  immediate acknowledgement, async interception, CRUD, ambiguous-view mapping,
  persistence batch derivation, lifecycle events, and the narrow handle;
- fixed-seed runtime/cache/hit-test evidence, 238 tests, full CI, SSR/hydration,
  packed-facade, production-build, responsive, accessibility, console, and network
  gates pass.

Detailed completion evidence is recorded in
[`2026-07-30-interaction-runtime-public-api-plan.md`](plans/2026-07-30-interaction-runtime-public-api-plan.md).

## Milestone Map

| Milestone | Architecture mapping | Outcome | Status | Detailed plan |
| --- | --- | --- | --- | --- |
| M0: Read-only chart primitives | First vertical subset of Slice 2 | Real time-based lanes and task bars render through one public React path | `[x]` | [Completed plan](plans/2026-07-30-simplest-chart-primitives-plan.md) |
| M1: Document kernel | Slice 1 foundation | Canonical records can be normalized, validated, indexed, migrated, and serialized without React | `[x]` | [Completed plan](plans/2026-07-30-document-kernel-foundation-plan.md) |
| M2: Change kernel | Remainder of Slice 1 | Typed commands produce deterministic patches, inverse patches, transactions, and local history | `[x]` | [Completed plan](plans/2026-07-30-change-kernel-plan.md) |
| M3: View, layout, and viewport kernel | Remainder of Slice 2 | Resolved views, overlap stacking, variable lane heights, and two-dimensional viewport queries feed render primitives | `[x]` | [Completed plan](plans/2026-07-30-view-layout-viewport-kernel-plan.md) |
| M4: Interaction runtime and public API | Slice 3 | Controlled and uncontrolled applications use the same command path as pointer, touch, and keyboard interaction | `[x]` | [Completed plan](plans/2026-07-30-interaction-runtime-public-api-plan.md) |
| M4 appendix: Item properties, semantic appearance, and progress | Post-M4 appendix | Canonical task/lane properties, portable semantic variants, and complete progress behavior extend the verified command path | `[x]` | [Completed plan](plans/2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md) |
| M5: Basic project Gantt | Slice 4 | Hierarchy, summaries, milestones, dependencies, zoom, filtering, localization, and SSR form a complete free Gantt | `[-]` | [Active plan](plans/2026-07-31-basic-project-gantt-plan.md) |
| M6: Advanced scheduling and resources | Slice 5 | Calendars, constraints, resource planning, explainable scheduling, workers, and Pro capabilities compose with the same model | `[ ]` | Not yet created |
| M7: Hardening and release | Slice 6 | Export, benchmarks, compatibility, accessibility conformance, examples, and release artifacts are reproducible | `[ ]` | Not yet created |

## Dependency Order

```text
M0 read-only vertical slice [done]
  |
  v
M1 document kernel [done]
  |
  v
M2 change kernel [done]
  |
  v
M3 view/layout/viewport kernel [done]
  |
  v
M4 interaction runtime [done]
  |
  v
M4 item-properties appendix [done]
  |
  v
M5 basic project Gantt
  |
  v
M6 advanced scheduling/resources
  |
  v
M7 hardening/release
```

The completed M0 vertical slice proves the renderer direction, M1 and M2 complete
architecture Slice 1, M3 completes architecture Slice 2, and base M4 completes
architecture Slice 3 with one verified interaction/runtime/public-facade path. The
timeline navigation interaction correction and the bounded item-properties,
semantic-color, and progress appendix are complete. The M5 plan is active, and its
first three slices are complete.

## Current Focus

### M5: Basic project Gantt

**Status:** `[-]` In progress; Slices 1-3 complete, Slice 4 next

The
[active M5 plan](plans/2026-07-31-basic-project-gantt-plan.md)
splits architecture Slice 4 into 13 ordered implementation slices: contract freeze;
hierarchy integrity; project-tree projection; summary/milestone semantics; accessible
React integration; dependency graph analysis; dependency geometry; dependency editing;
adaptive zoom; localization and RTL; selective Community integration; public/SSR
consumers; and final milestone evidence.

Planning preserves the completed M1–M4 model, command, view, runtime, interaction,
customization, persistence, package, and SSR boundaries. Community M5 remains manual
and diagnostic: automatic scheduling, working calendars, persisted summary rollups,
critical path, resource planning, and other Pro behavior remain M6 scope.

The accepted
[basic project Gantt contract](decisions/2026-07-31-basic-project-gantt-contract.md)
fixes hierarchy recovery and ordering, project queries/session, summary/milestone
presentation, dependency graph/editing/routes, range/scale/zoom ownership,
localization, RTL, SSR, accessibility workflows, and the final `/project` matrix. The
unpublished schema-version-1 model has gained optional finite task sibling `order`;
this pre-publication correction is the only canonical-data change accepted by Slice
1. The contract slice passed cross-document checks, packed-declaration inspection,
`git diff --check`, and full `mise run ci` with 68 test files / 357 tests, 160
formatted files, 149 lint/type files, and four package artifacts.

Slice 2 now implements optional task order, iterative pure hierarchy indexes,
deterministic edge-preserving parse recovery, strict add/update/reparent/kind
validation, and descendant plus old/new ancestor invalidation. Property coverage
includes arbitrary forest order, normalized cycles, deep chains, transaction repair,
patch/inverse/history, facade, and persistence projection. Full `mise run ci` passes
71 test files / 368 tests, 164 formatted files, 153 lint/type files, and four package
artifacts; the 44.69 kB declaration exposes no private hierarchy engine. Slice 3
now resolves deterministic depth-first project trees with collapse, ancestor-aware
filtering, sibling-local sorting, stable task-derived identity, frozen callback
inputs, and structured query/callback diagnostics. A 10,000-task fixture projects to
2,000 collapsed root lanes; full `mise run ci` passes 71 files / 376 tests, 165
formatted files, 154 lint/type files, and four artifacts. The 45.05 kB declaration
adds only the accepted public filter/comparator types. Slice 4 summary and milestone
presentation semantics are next.

### M4 appendix: item properties, semantic appearance, and progress

**Status:** `[x]` Complete; M5 is active

The bounded
[progress-drag feedback follow-up](plans/2026-07-31-progress-drag-feedback-plan.md)
is complete. It keeps the completed appendix boundary intact while making direct
progress adjustment snap to five-point increments and visibly report the immutable
preview percentage during the gesture. The active M5 plan now owns the next action.

The
[active appendix plan](plans/2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md)
extends the completed base-M4 runtime with canonical description and task/lane
semantic appearance, accessible properties surfaces, and complete progress behavior.
Appendix Slice A1 preserves the packed M4 `TaskEditor`, `features.editor`, and
view-only `taskVariants` contracts while accepting additive canonical record,
appearance-registry, and `ItemProperties` contracts. The accepted durable boundary is
recorded in the
[item-properties, semantic-appearance, and progress decision](decisions/2026-07-31-item-properties-semantic-appearance-progress.md).
The docs-only slice passed `vp check`, packed-declaration inspection, terminology and
link review, `git diff --check`, and full `mise run ci` with 61 files / 297 tests and
four package artifacts.

Appendix Slice A2 added normalized, frozen, serializable optional task description and
task/lane semantic appearance to schema version 1. Existing `task.update` and
`lane.update` now set and clear those fields through deterministic patches,
transactions, history, entity-change envelopes, and the root facade. Focused
model/command/facade properties passed 10 files / 47 tests; the complete gate passed
62 files / 304 tests, formatting/lint/types, and four package artifacts. Packed
declarations expose only `GanttAppearanceReference` plus the accepted record/input/
command members. Rendering is unchanged. Appendix Slice A3 owns pure resolution,
progress primitives, and selective invalidation.

Appendix Slice A3's first complete CI run exposed one order-dependent existing pan DOM
fixture: synthetic geometry was installed after mount, but the test could begin its
drag before publishing that geometry through the measured scroll/frame path. The
isolated case and complete DOM file passed immediately. A narrow test-only correction
now publishes installed geometry before the drag; runtime behavior and the accepted
interaction contract are unchanged.

Appendix Slice A3 now resolves configured lane/task semantic variants and the legacy
task fallback into frozen portable paint data, reports each unresolved ID once per
scene, and projects canonical task progress into clipped/virtualized geometry.
Appearance, progress, and registry changes selectively rebuild primitives without
topology, interval, stack, occurrence-catalog, viewport-kernel, or query work.
Focused scene/resolver parity passed 5 files / 24 tests; the deterministic pan case
passed five consecutive isolated runs; and the corrected full gate passed 64 files /
311 tests plus formatting/lint/types and four package artifacts. The fixed
`m4-appendix-scene-v1` 2,000-task/400-lane local benchmark observed a 7.0164 ms mean
for warm affected appearance/progress projection with no release threshold. Appendix
Slice A4 owns DOM/SVG paint, progress semantics, forced colors, and per-instance
diagnostic delivery deduplication.

Appendix Slice A4 is complete. Instance `appearanceVariants` and the
source-compatible `taskVariants` fallback enter the React runtime as display inputs
and feed the existing selective scene pipeline; paint-registry changes do not require
a document mutation or geometry rebuild.

The first A4 narrow browser pass found and corrected a playground-only header
overflow: the route navigation now shrinks and scrolls inside the 390 px header
instead of widening the page. The chart surface itself did not overflow, and the
library contract and milestone order are unchanged.

The same browser pass cleared the playground theme selector's form-identity issue by
adding a stable field name. Its accessible label and behavior are unchanged.

Appendix Slice A4 now publishes stable lane accent, task track, and progress parts;
maps the portable registry to coordinated DOM/SVG tokens; includes progress once in
each ordinary task's accessible name; and deduplicates unresolved-variant callback
delivery per instance and registry revision. SSR/hydration, legacy fallback, slots,
forced-colors/reduced-motion declarations, and non-color interaction indicators are
covered. The playground demonstrates canonical lane inheritance, explicit task
overrides, and zero/partial/full progress through an application-owned palette rather
than index-cycled CSS tones.

A4 focused verification passed 5 files / 51 tests, `vp check` covered 156 formatted
and 145 lint/type files, package output retained four artifacts and the accepted
public declaration, and the production playground built successfully. Chrome
DevTools verified `/` at 1440x1000 and 390x844 plus `/matrix` at 1440x1000: accessible
progress was not duplicated, the minimum observed label contrast across light, dark,
and high-contrast partial progress was 4.53:1, the narrow document did not overflow,
the console was clean, and all 73 inspected development requests returned 200. The
required full `mise run ci` passed 65 files / 317 tests. A5 properties surfaces are
complete with the accepted additive value, slot, and feature facade; the legacy
`TaskEditor` contract remains unchanged. One selection-driven default surface now
inspects and edits persisted tasks and lanes through the M4 command,
acknowledgement, rejection, and history path. It covers schedule, description,
integer-percent progress, semantic appearance, unambiguous lane moves, deletion,
read-only metadata, unavailable variants, stale targets, custom replacement, focus
return, and instance isolation.

A5 focused properties coverage passed 10 tests; the complete gate passed 66 files /
328 tests plus formatting, lint/types, and four packed artifacts. Production
playground build and packed-declaration inspection passed. Chrome DevTools verified
controlled task/lane properties at desktop and narrow widths plus narrow read-only
inspection, with a clean console and 74 successful or cache-valid requests. Appendix
Slice A6 owns direct pointer, pen, touch, and keyboard progress editing.

Appendix Slice A6 now gives ordinary tasks one pure progress hit/intent/preview and
strict `task.update` mapping across mouse, pen, touch, and keyboard. Keyboard uses
1-point and Shift+10-point steps plus Home/End; pointer values round to percentage
points. Controlled acknowledgement, rejection, cancellation, focus retention,
stable unsupported-kind reasons, and one-command/one-history behavior are verified.
The accepted decision, architecture, and theming docs record the additive public
progress interaction state, preview fraction, class state/hook, and stable marker
part while keeping hit geometry private.

Pure progress coverage passed within 4 files / 21 tests, the DOM/keyboard lifecycle
matrix passed 2 files / 43 tests, and the broader focused matrix passed 10 files / 98
tests. The complete gate passed 66 files / 343 tests plus formatting, lint/types, and
four packed artifacts; the production playground build passed. Chrome DevTools
verified desktop keyboard commit/persistence/Undo/focus plus live pen preview and
narrow 44x24 px coarse touch targeting with cancellation, no overflow, a clean
console, and 76 successful or cache-valid requests.

Appendix Slice A7 closes the milestone with root-import controlled, runtime-owned,
and read-only playground consumers. The main route proves lane inheritance, a
repeated task with different lane variants, explicit task precedence, unknown
fallback, and live theme switching. Controlled field editing commits progress,
appearance, and lane movement in one transaction and proves deletion plus Undo/Redo;
the runtime-owned resource view commits through async policy and explains why its
derived occurrence cannot persist a lane move.

The clean packed-consumer gate found and corrected a missing React DOM peer declaration
for the already-existing portal import. The final tarball contains only four built
artifacts plus metadata, installs in a fresh temporary consumer, imports all 11 runtime
exports, and resolves the stylesheet subpath. Production playground and 46 focused
SSR/hydration tests pass. A live narrow Lighthouse finding raised the light muted text
token from 3.96:1 to the 4.5:1 normal-text threshold; the repeated accessibility score
is 100. Desktop/narrow Chrome checks pass modal containment/isolation, read-only
inspection, 44x24 px coarse progress targeting, reduced-motion behavior, forced-colors
rule coverage, zero overflow, a clean console, and 74 successful requests. Final
`mise run ci` passes 158 formatted files, 147 lint/type files, 67 test files / 346
tests, and four package artifacts. The accepted architecture and decision boundaries
remain unchanged; M5 now owns active execution.

### Post-M4 Interactive Custom consumer integration

**Status:** `[x]` Complete

The
[Interactive Custom integration plan](plans/2026-07-31-interactive-custom-integration-plan.md)
adds a second controlled playground route at `/interactive-custom`. The page
keeps the existing timeline, command/history, and controlled-document behavior, omits
the persistence/API debug log, and renders task details below the chart in an
application-owned display/edit panel.

Current `onTaskActivate` behavior can open the panel in display mode. The built-in
`Edit properties` task-menu action is hard-wired to Gantt's private overlay opener,
however, and appended consumer menu items can dispatch commands but cannot publish an
application edit request. Slice 1 accepts the narrow, task-only
`GanttTaskEditRequest` / `onTaskEditRequest` callback. The action remains disabled for
read-only controlled charts; on mutable charts it closes the menu without restoring
chart focus, publishes one immutable request, and does not enter the command,
history, persistence, or overlay lifecycle. Slice 2 publishes the package-root seam
with pointer, keyboard, focus, fallback, read-only, exact-once, and instance-isolation
coverage. Its focused 4-file / 29-test gate, packed declaration inspection, and full
`mise run ci` gate with 67 test files / 352 tests pass.

Slice 3 adds the routed `Interactive Custom` consumer and its application-owned,
responsive display/edit panel. Canonical task and placement values stay tied to the
acknowledged controlled document; Save emits one task command or one task/placement
transaction, while Cancel and unchanged saves create no history. Focused route,
display/edit, validation, acknowledgement, history, stale deletion, no-dialog,
no-API-log, and axe coverage passes 2 files / 7 tests. `mise run build-playground`
and `mise run ci` with 68 files / 357 tests pass. Desktop and narrow live browser
verification at 1440 x 900 and 560 x 900 confirms application-owned display/edit
focus, pointer and keyboard menu handoff, transactional task/placement Save,
Undo/Redo, Cancel, deletion closure, zero page/chart horizontal overflow, no
dialog/API-log/raw-JSON surface, a clean final console, and four successful
production requests. Chrome's initial form-field warning was resolved by naming the
custom controls before the clean rerun. The final focused test, production build,
`git diff --check`, and `mise run ci` with 68 files / 357 tests pass.

### Post-M4 persistence entity-change projection

**Status:** `[-]` Structured log implemented; narrow live gate pending

The
[persistence entity-change projection plan](plans/2026-07-31-persistence-entity-change-projection-plan.md)
addresses a user-discovered integration gap in the controlled `/interactive` example:
the primary JSON showed runtime proposal, pointer, patch, and lifecycle mechanics
instead of directly identifying the changed row and its old/new values.

The accepted
[persistence entity-change decision](decisions/2026-07-31-persistence-entity-change-projection.md)
adds an immutable create/update/delete row projection to the existing
patch-authoritative document-change envelope. The playground will retain only
application-owned operation identity, base revision, and concise business changes in
its primary persistence log.

The final correction passes 60 test files / 294 tests, full formatting/lint/types,
package and production playground builds, and live desktop/narrow drag,
accessibility, overflow, and console checks. Full task create/delete DTOs retain
schedule `mode`, while the short date-only form is limited to same-mode updates. The
accepted data contract remains complete. A presentational follow-up now replaces the
raw textarea with a ten-entry expandable event stream. Focused tests, full CI, the
production playground build, and a live desktop drag/retention/disclosure check pass.
Chrome DevTools remains profile-locked, and the fallback cannot resize or provide a
console ledger, so the narrow and console gates remain unclaimed before the
item-properties appendix resumes.

### Post-M4 timeline navigation interactions

**Status:** `[x]` Complete and verified

The
[timeline navigation interactions plan](plans/2026-07-30-timeline-navigation-interactions-plan.md)
corrects a user-discovered base interaction gap before the queued item-properties
appendix. The chart now supports semantic horizontal wheel/trackpad, grab, paging,
edge-auto-pan, and imperative range navigation alongside native vertical scrolling.
Slice 8 completed the final automated, performance, artifact, and live gates.

The selected plan adds a viewport-independent occurrence catalog before input
adapters so panning cannot discard offscreen selection/focus. It then adds controlled
range-pan orchestration, trackpad/wheel navigation, conflict-safe mouse grab panning,
keyboard/focus parity, self-demonstrating playground consumers, and full automated
and live gates. The top-level `/navigation` example contains 144
deterministic scheduled events across 36 lanes and an 18-month UTC period, initially
shown through a 12-week range. Zoom, pinch, default-range ownership, touch panning,
and M5 project navigation policy remain out of scope.

Slice 1 accepted the durable
[timeline navigation interaction contract](decisions/2026-07-30-timeline-navigation-interaction-contract.md),
including the axis/modifier/pointer matrix, controlled-range proposal lifecycle,
private full-occurrence lifetime, focus handoff, browser-zoom exclusion, and
keyboard paging. Slice 2 added the private viewport-independent occurrence catalog,
switched session existence and known-target imperative reveal to it, preserved
viewport-only public/render/hit-test data, and proved catalog/layout reuse across
ordinary range and scroll changes. Slice 3 added pure delta/time/page math, one
instance-owned controlled range proposal controller, a combined runtime viewport
operation, and shared edge-auto-pan/imperative range orchestration. No public API
expanded. Slice 4 connected a scoped non-passive wheel/trackpad adapter with
deterministic axes/modifiers/units, diagonal vertical preservation, browser-zoom and
missing-callback pass-through, cleanup/isolation, overscroll containment, automated
DOM coverage, and live horizontal input evidence. Slice 5 added pure thresholded
mouse-pan state plus header, conditional empty-body, and middle-body/task bindings
with edit/create/pen/touch/secondary conflict preservation, read-only navigation,
capture cleanup, cursor state, automated isolation, and responsive live drag
evidence. Slice 6 added read-only vertical/time paging, full-catalog keyboard
geometry and offscreen reveal, root focus handoff/restoration, discrete-only live
announcements, accessible gesture guidance, focused hydration/axe regression
coverage, and responsive live accessibility evidence. The existing four-lane
consumer cannot provide the planned live offscreen-lane flow, so the automated
vertical proof remains complete here and the live flow moves to Slice 7's required
36-lane navigation fixture for the final gate. Slice 7 made scenario ranges
independently controlled, added the deterministic
top-level 144-event/36-lane/18-month `/navigation` route with a 12-week viewport,
documented all navigation bindings, and proved the public facade and packed
declaration boundary. Its live keyboard flow closed the deferred offscreen-lane
evidence and exposed one read-only roving-stop mismatch; task navigation now remains
available while document mutation stays disabled. Slice 8 added a guarded steady-pan
benchmark, reran the complete automated, performance, artifact, and live verification
matrix, and closed the correction with the physical-trackpad limitation recorded
rather than claimed.

### Post-M4 playground focus and theme refinement

**Status:** `[x]` Complete and verified

The
[playground focus and theme refinement plan](plans/2026-07-30-playground-focus-theme-refinement-plan.md)
replaces the browser's square SVG task outline with one rounded focus treatment,
clears active task focus/selection from empty timeline presses, and turns the main
page's static theme label into a light/dark/high-contrast selector. The work stays
inside the verified M4 session boundary and existing playground theme tokens; no
public contract changes. Focused tests, the complete 52-file/251-test CI gate,
package/playground builds, and live Chrome checks at 1,440 × 900 and 560 × 900 pass.
The timeline navigation correction is complete; Appendix Slice A1 is the next action.

### Post-M4 default-surface modernization

**Status:** `[x]` Complete and verified

The [default surface modernization plan](plans/2026-07-30-default-surface-modernization-plan.md)
refreshes the built-in task editor and context menu with a tighter hierarchy,
consistent Lucide iconography, native local date-time controls, modern control and
action states, and responsive overlay styling. Public slot, command, accessibility,
focus, and overlay contracts remain unchanged.

The menu and editor now pass focused and full CI, package/playground builds, and live
Chrome gates at 1,440 × 900 and 560 × 900. Menu collision safety, responsive
bottom-sheet layout, focus, Escape restoration, modal isolation, console, network,
and accessibility-tree behavior are recorded in the completed plan. The timeline
navigation correction is complete; Appendix Slice A1 is the next action.

### Post-M4 lane-properties trigger polish

**Status:** `[x]` Complete and verified

The
[lane-properties trigger polish plan](plans/2026-07-31-lane-properties-trigger-polish-plan.md)
keeps the package-owned default chrome and reuses its existing Lucide icon system.
It replaces the zero-padding text ellipsis with balanced button geometry and focused
interaction states while preserving the accepted properties, accessibility,
focus-return, and customization contracts. The first live measurement exposed
overlap with the final code column, so the completed implementation reserves a
dedicated visual control column instead of subtracting button space from consumer
content.

Focused verification passed 2 files / 13 tests. The complete CI gate passed 67 files
/ 347 tests and all four package artifacts; the production playground transformed
1,918 modules. Built-in Browser fallback checks at 1,440 × 900 and 390 × 844 found
balanced 36 × 30px trigger/18px icon geometry, 48.74px code-to-button clearance,
7px/9px control-cell insets, zero page/chart overflow, complete lane-specific
accessible names, correct focus return and outline, and no application console
warning/error. Chrome DevTools was profile-locked, so no live request-ledger claim is
made.

User review then found the bordered horizontal-ellipsis control too prominent for an
occasional action. Completed follow-up Slice 2.1 uses a 16px vertical overflow icon
inside a 28 × 28px transparent resting control and a 44px reserved column. Hover and
keyboard focus restore the full surface; coarse-pointer styling keeps the quiet icon
discoverable without restoring the card treatment.

Focused tests again passed 2 files / 13 tests; the complete CI gate again passed 67
files / 347 tests and all four artifacts, and the production playground again
transformed 1,918 modules. Built-in Browser fallback at 1,440 × 900 and 390 × 844
confirmed 48.74px code clearance, 7px/9px control insets, zero page/chart overflow,
complete accessible names, correct focus return/emphasis, and a clean application
console. Chrome DevTools remained profile-locked, so no live request-ledger claim is
made.

### Post-M4 inline selected-label removal

**Status:** `[x]` Complete and verified

The
[inline selected-label removal plan](plans/2026-07-31-inline-selected-label-removal-plan.md)
removes the controlled playground's redundant inline `SELECTED` label and extra
selected paint. The package's blue outline, `aria-pressed`, `data-selected`, public
slot/class state, runtime selection, events, and imperative access remain unchanged.
The focused consumer test passed 1 file / 2 tests; the complete CI gate passed 67
files / 347 tests and all four artifacts, and the production playground transformed
1,918 modules.

Built-in Browser fallback at 1,440 × 900 and 390 × 844 confirmed the selected task
renders only its title while retaining `aria-pressed="true"`,
`data-selected="true"`, and the blue 2px outline. No selected label/class, page/chart
overflow, or application console warning/error remained. Chrome DevTools was
profile-locked, so no live request-ledger claim is made.

### Post-M4 default-tooltip usability

**Status:** `[-]` Implemented; live verification pending

The
[default-tooltip usability plan](plans/2026-07-31-default-tooltip-usability-plan.md)
replaces raw ISO timestamps with a deterministic human calendar range and compact
duration while preserving the public tooltip summary, replacement slot, bindings,
overlay ownership, class hooks, and accessibility relationship.

Focused customization/stylesheet coverage passed 2 files / 12 tests. The complete CI
gate passed 67 files / 348 tests and all four artifacts, and the production
playground transformed 1,918 modules. Chrome DevTools remained profile-locked, and
the built-in Browser fallback timed out after bounded documented recovery, so live
desktop/narrow geometry, accessibility-tree, overflow, console, and request evidence
remain pending and are not claimed.

### Post-M4 overlay-boundary hardening

**Status:** `[x]` Complete and verified

The [overlay boundary plan](plans/2026-07-30-overlay-boundary-plan.md) fixes the
discovered mismatch between the promised external portal contract and the internal
chart-local implementation. Default tooltips, menus, and editors will use an
instance-owned document-level overlay wrapper with viewport collision handling,
theme isolation, and page-modal behavior. Explicit chart-local, application overlay,
shadow-root, SSR, and iframe boundaries remain documented.

The package now exposes document-default, explicit-root, and custom overlay targets;
owns and cleans up one themed fixed wrapper per external target; collision-adjusts
menus/tooltips; and gives document-body editors full-viewport, scroll-lock,
background-isolation, and exact restoration behavior. Focused and full tests,
format/lint/types, package/playground builds, packed declarations, and desktop/narrow
Chrome gates pass. Detailed evidence is in the completed plan.

The timeline navigation correction is complete; Appendix Slice A1 of the
item-properties, semantic-color, and progress plan is the next action.

### Cross-cutting M1/M2 document-kernel hardening

**Status:** `[x]` Complete and verified

The [Zod runtime schema migration plan](plans/2026-07-30-zod-runtime-schema-migration-plan.md)
consolidates duplicated wire and strict-command structural validation behind private
Zod 4 Mini schemas while preserving schema-version-1 behavior. The durable codec
decision, architecture responsibility split, fixed-seed codec baseline, focused
characterization gate, packed artifact, and playground production bundle baseline are
recorded. Private Zod wire schemas now power production normalization, strict
canonical schemas power command/patch shape validation, legacy structural duplication
is removed, public declarations remain Zod-free, final benchmark/package evidence is
inside the migration budgets, and the complete local CI gate passes with 237 tests
across 49 files.

### M4 appendix: Item properties, semantic color, and progress

**Status:** `[x]` Complete; M5 is active

**Target outcome**

Add a bounded standard task/lane properties surface, semantic task/lane appearance,
and coordinated progress rendering/editing over the verified base-M4 ownership,
command, event, accessibility, customization, and package boundaries.

**Verified prerequisites**

- M1–M3 supply the canonical model, change kernel, view/layout/viewport kernels, and
  renderer.
- Base M4 supplies the verified per-instance runtime, unified command bus, public
  facade, consumer examples, persistence envelope, interaction parity, and
  customization surfaces.

**Next action**

Continue the
[active M5 basic-project-Gantt plan](plans/2026-07-31-basic-project-gantt-plan.md).
The completed
[item properties, semantic color, and progress plan](plans/2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md)
contains the appendix implementation and final evidence.

**Completed M4 appendix**

The
[item properties, semantic color, and progress appendix](plans/2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md)
adds task/lane semantic variants, coordinated progress rendering/editing, and a
bounded standard properties surface without reopening the completed base-M4
contract. Its controlled, runtime-owned, read-only, package, SSR, browser,
accessibility, console, and network gates are complete.

**Adjacent proof complete**

The
[interactive playground plan](plans/2026-07-30-interactive-playground-plan.md)
records a completed bounded controlled-consumer example that composes the existing
public M2 command/history kernel with the read-only M3 React renderer. The new
`/interactive` route proves add, batch-add, cascade remove, transactional clear,
undo, and redo across responsive chart layouts without starting M4 or defining
chart-owned interaction, session, or imperative contracts.

## Later Milestone Outcomes

### M5: Basic project Gantt

- Add task hierarchy, summaries, and milestones.
- Add dependency graph validation, paths, and editing.
- Add zoom, adaptive ticks, filtering, sorting, localization, RTL, and SSR examples.
- Complete the basic free-edition product boundary.

### M6: Advanced scheduling and resources

- Add explicit working calendars and time-zone-aware working arithmetic.
- Add explainable automatic scheduling and constraint stages.
- Add resource assignments, capacity, workload, critical path, and baselines.
- Prove synchronous and worker execution parity.
- Install advanced behavior through capabilities rather than React conditionals.
- Follow the accepted package, compatibility, and activation boundaries in the
  [Community and Pro distribution plan](plans/2026-07-30-community-pro-distribution-licensing-plan.md).

### M7: Hardening and release

- Add versioned performance benchmarks and regression thresholds.
- Complete accessibility and compatibility matrices.
- Add export/import capabilities and public examples.
- Add API reports, migration guidance, synchronized Community/Pro release automation,
  public npm provenance, and verified license boundaries.
- Complete the publishing and entitlement-continuity slices in the
  [Community and Pro distribution plan](plans/2026-07-30-community-pro-distribution-licensing-plan.md).

## Cross-Milestone Rules

- Preserve task, resource, assignment, lane, placement, and segment separation.
- Persistent state remains serializable plain data.
- Commands mutate; queries derive.
- Pure engines do not import React, DOM types, browser globals, or playground code.
- Renderers consume semantic primitives and do not interpret scheduling rules.
- Keep public exports deliberately small; internal contracts stay private until a
  second consumer proves they should be public or experimental.
- Do not split workspace packages until the internal boundaries are proven by real
  consumers.
- Keep Community as the sole component, model, codec, and command authority; Pro is
  installed additively through capabilities.
- Release one public Community package and one public Pro package at the same version.
- Preserve offline, domain-independent, non-destructive commercial entitlement:
  previously entitled versions keep running when their update window closes.
- Do not begin interaction work before the document and change kernels are verified.
- Do not claim performance, accessibility, compatibility, or scheduling behavior
  without evidence at the scope of the claim.
- Keep governance proportional: new features and substantial changes or deviations
  update the active detailed plan and this roadmap in the same change set. Minor
  fixes, cosmetic polish, obvious improvements, code-inferable implementation
  details, and straightforward continuation of already documented work do not
  require standalone planning or roadmap updates.

## Change Log

- 2026-07-31: Completed M5 Slice 3. The project view now resolves ordered task trees
  depth-first with private depth, child, expansion, and match metadata while
  preserving existing task-derived occurrence keys. Collapse input normalizes unknown,
  duplicate, and leaf IDs; filtering retains and force-opens complete match paths but
  not unmatched descendants; sorting is sibling-local with explicit canonical ties.
  Public filter/comparator hooks receive copied frozen semantic records and participate
  in topology invalidation; malformed input and callback failures reject with distinct
  diagnostics. Focused view/hierarchy/render/layout/viewport/property/facade/React-
  runtime coverage passed 17 files / 82 tests, including a deterministic 10,000-task
  to 2,000-lane structural case. Full `mise run ci` passed 71 files / 376 tests, 165
  formatted files, 154 lint/type files, and four package artifacts; the 45.05 kB
  declaration keeps resolved tree/query engines private. Slice 4 summary/milestone
  presentation is next.

- 2026-07-31: Completed M5 Slice 2. Schema version 1 now normalizes and serializes
  optional finite task sibling order, and `task.update` can set or clear it. A private
  iterative hierarchy boundary indexes ordered children, roots, depths, ancestry, and
  half-open subtree ranges; a 5,000-level chain verifies non-recursive traversal.
  Parsing clears invalid edges with stable self, parent-kind, and normalized cycle
  diagnostics while retaining every task. Strict add/update/patch/transaction paths
  reject invalid output but permit ordered repairs, and task changes report descendants
  plus old/new ancestor chains. Fixed-seed forest/cycle/reparent, patch, inverse,
  history, facade, and persistence tests pass. Full `mise run ci` passed 71 test files /
  368 tests, 164 formatted files, 153 lint/type files, and four package artifacts; the
  packed declaration is 44.69 kB. Slice 3 visible project-tree projection is next.

- 2026-07-31: Completed M5 Slice 1 and accepted the
  [basic project Gantt contract](decisions/2026-07-31-basic-project-gantt-contract.md).
  It fixes all 13 hierarchy, query/session, summary/milestone, dependency, scale/zoom,
  localization/RTL, accessibility, SSR, package, and browser-matrix questions. The
  package is unpublished pre-alpha, so schema version 1 will gain optional finite task
  sibling `order` without a migration or version bump. Cross-document and stale-
  handoff checks, packed-declaration inspection, `git diff --check`, and full `mise
  run ci` passed with 68 test files / 357 tests, 160 formatted files, 149 lint/type
  files, and four package artifacts. Slice 2 hierarchy integrity is next.

- 2026-07-31: Created the detailed M5 basic-project-Gantt implementation plan and
  linked it as the active roadmap plan. The plan keeps M5 at `[ ]`, preserves the
  completed Community model/runtime boundary, splits the milestone into 13 ordered
  contract, kernel, integration, consumer, and final-evidence slices, and selects the
  focused M5 contract decision as the next action. Planning validation passed diff,
  whitespace, link, stale-handoff, and slice-structure checks. No runtime behavior
  changed, so the code/test/build suite was not run.

- 2026-07-30: Completed and verified the timeline-navigation correction. Slice 8
  added fixed-seed steady controlled horizontal pan to the existing
  2,000-task/400-lane benchmark and guards the exact companion work profile
  `topology0/interval0/stack0/catalog0/kernel0/ticks1/query1`; timing remains local
  diagnostic evidence, not a portable claim. The final focused matrix passed 18
  files / 108 tests, complete CI passed 58 files / 287 tests, and the playground,
  package, packed declarations, SSR/hydration, and diff gates passed. Trusted live
  wheel, diagonal scroll, header grab, keyboard traversal, focus/selection
  restoration, editing, creation, menu/editor, and sibling-isolation flows passed.
  All five routes at 1,440 × 900, 900 × 900, and 560 × 900 retained exact alignment,
  one current link, zero page/menu overflow, named accessibility structure, and a
  clean application console. Chrome DevTools remained profile locked, so the
  approved in-app Browser supplied available live evidence; shifted wheel and held
  middle-button input remain covered by DOM tests, physical trackpad momentum
  remains explicitly unverified, and no standalone live network-panel claim is
  made. Appendix Slice A1 is the next action.
- 2026-07-30: Completed timeline-navigation Slice 7. `ScenarioGantt` now owns an
  independent acknowledged range, the top-level menu includes `/navigation`, and
  the deterministic route contains exactly 144 scheduled events/placements across
  36 lanes over January 2025–July 2026 with a 12-week initial viewport, boundary
  clipping, overlap, and work before/inside/after the range. README now documents
  semantic range ownership and every gesture/modifier/conflict. The stress fixture
  exposed that read-only tasks had lost roving stops despite the accepted navigation
  contract; task focus and Arrow/Home/End navigation now remain available while
  mutation stays guarded. Focused suites passed 5 files / 17 tests, the playground
  and package built, private catalog/runtime names stayed out of packed declarations,
  and complete CI passed 58 files / 287 tests. Live desktop/narrow checks found one
  current link and zero page/menu overflow on all five routes; keyboard focus moved
  from event 040 to event 077 across offscreen lanes/times while the range advanced
  June–August to August–October with a clean console. Final gates are Slice 8.
- 2026-07-30: Completed timeline-navigation Slice 6. Keyboard paging now moves
  vertical session state with one-lane overlap or controlled time with ten-percent
  overlap, including read-only charts. Arrow/Home/End navigation uses the full
  private occurrence catalog, fails closed when combined reveal cannot be
  acknowledged, and retains logical focus/selection while browser focus hands to
  the root and restores after adoption. Focused keyboard/session/hydration/axe
  coverage passed 7 files / 65 tests, including silence for continuous navigation.
  Chrome DevTools remained profile locked; the approved in-app Browser verified
  time paging, root/task focus handoff/restoration, named accessibility trees at
  1,440 × 900 and 560 × 900, zero overflow, and a clean console. The current
  four-lane fixture cannot overflow vertically, so live offscreen-lane proof moves
  to Slice 7's already-required 36-lane route and remains in the final gate. Complete
  CI passed 57 files / 283 tests and rebuilt all four artifacts. Public
  consumer/playground proof is Slice 7.
- 2026-07-30: Completed timeline-navigation Slice 5. Primary header, conditional
  primary empty-body, and middle body/task mouse drags now pan through one pure,
  thresholded, instance-owned gesture without commands or history. Existing task
  edits, mapped creation, pen/touch, secondary input, selection, read-only document
  navigation, capture loss, unmount, and sibling instances pass focused regression
  coverage (4 files / 45 tests). A missing range callback preserves simple empty
  selection clearing but no longer enters an unavailable create rejection on drag.
  Live desktop and 560 × 900 header drags advanced ticks with `grab`, clean release,
  zero overflow, and no console errors. The first pack caught a missing explicit
  internal pan-state annotation under declaration isolation; after that narrow fix,
  complete CI passed 57 files / 279 tests and all artifacts. Keyboard/focus parity
  is Slice 6.
- 2026-07-30: Completed timeline-navigation Slice 4. Each chart now owns a scoped
  non-passive wheel listener that claims only acknowledged horizontal time
  navigation, retains native vertical-only scrolling, preserves accepted diagonal
  vertical movement, normalizes line/page units, supports the Shift fallback, and
  passes browser zoom, missing callbacks, form controls, cleanup, and sibling
  instances. Focused tests passed 4 files / 37 tests. Chrome DevTools was profile
  locked, so the approved in-app Browser fallback exercised horizontal scroll on
  `/interactive`: ticks advanced, zero page overflow and containment held, and the
  console stayed clean. Complete CI passed; mouse grab panning is Slice 5.
- 2026-07-30: Completed timeline-navigation Slice 3. Browser-free navigation helpers
  now normalize delta units, preserve finite range duration, and clamp direct/page
  vertical movement. One React-free proposal controller coalesces continuous
  per-instance range shifts per frame, rebases delayed acknowledgement, cancels
  unrelated replacements and disposal, and supports immediate imperative requests.
  The runtime combines horizontal pixel and vertical session deltas, while edge
  auto-pan and imperative reveal share the controller. Focused tests passed 6 files /
  38 tests including fixed-seed properties and the existing DOM auto-pan regression;
  complete CI passed. Wheel/trackpad binding is Slice 4.
- 2026-07-30: Completed timeline-navigation Slice 2. A private immutable full
  occurrence catalog now projects from completed layout and carries target, lane,
  absolute geometry, and time data independent of viewport-filtered primitives.
  Session reconciliation and known-target `focusTask`/`scrollToTask` use the catalog;
  public visible occurrences and hit testing remain viewport-only. Focused
  catalog/session/runtime/property tests passed 4 files / 35 tests, range/scroll work
  counters proved topology/layout/catalog reuse, and the complete CI gate passed.
  Pure navigation math and controlled proposal orchestration are Slice 3.
- 2026-07-30: Accepted the post-M4
  [timeline navigation interaction contract](decisions/2026-07-30-timeline-navigation-interaction-contract.md).
  It keeps `range` controlled, makes accepted wheel/grab/page input pan semantic
  time, separates private full-occurrence lifetime from viewport-only rendering,
  fixes focus handoff and offscreen reveal expectations, preserves browser zoom and
  document-edit conflicts, requires no public API expansion, and selects the private
  occurrence catalog as Slice 2.
- 2026-07-30: Expanded the active timeline-navigation plan with a required top-level
  `Navigation` menu item and `/navigation` page. The deterministic consumer fixture
  will contain exactly 144 scheduled task events across 36 lanes over an 18-month UTC
  period, start with a 12-week visible range, include before/inside/after, overlap,
  and clipping cases, and display current-range plus dataset metadata. Slice 7 and
  the final responsive/live gates own this example; Slice 1 remains next and no
  implementation status changed.
- 2026-07-30: Reproduced and planned the missing ordinary timeline-navigation
  interaction on the selected local `/interactive` page. The chart has native
  vertical overflow ownership and controlled range callbacks but no wheel/trackpad
  or grab-pan adapter; its horizontal timeline has no DOM scroll width. The active
  plan first separates full resolved occurrences from viewport-filtered primitives,
  then adds controlled pan orchestration, trackpad/wheel, mouse, keyboard/focus,
  playground, and final live gates. Slice 1 decision/architecture work is next; the
  item-properties appendix remains queued afterward.
- 2026-07-30: Started the bounded playground focus/theme refinement after Chrome
  reproduced the square SVG focus outline and retained active task on empty timeline
  clicks at `/`. The active plan keeps visible keyboard focus, clears both runtime
  and DOM focus for empty primary presses, and reuses existing scenario tokens in an
  accessible main-page theme selector.
- 2026-07-30: The first focused run found that the repository test include omitted
  `apps/**`, silently excluding the new playground selector regression. The active
  refinement expands the normal test gate to app tests and records the direct-test
  matcher correction without changing runtime behavior.
- 2026-07-30: Completed and verified the playground focus/theme refinement. Empty
  primary timeline presses clear runtime and DOM task focus/selection, task focus uses
  one rounded two-pixel bar stroke, and the labelled selector switches all three
  existing themes. Focused tests, 52 files/all 251 tests, formatting/lint/types,
  package and playground builds, and desktop/narrow Chrome gates pass with zero page
  overflow, console errors, warnings, or failed requests.
- 2026-07-30: Started the bounded post-M4 default-surface modernization. The active
  plan selects internally owned Lucide icons and native local date-time controls while
  preserving the public slots, menu items, epoch-millisecond command boundary,
  accessible labels, keyboard/focus behavior, and overlay ownership.
- 2026-07-30: The first Lucide install attempt found that the checkout's existing
  modules use the user pnpm store while sandboxed pnpm defaults to a project-local
  store. No dependency files changed; implementation will reuse the existing store
  rather than relink the workspace.
- 2026-07-30: The shell pnpm is 11.9.0 while the repository pins 11.18.0, and the
  successful dependency add rewrote unrelated peer snapshots. The lockfile will be
  normalized with the pinned client so this slice retains only Lucide-related changes.
- 2026-07-30: Lockfile normalization now retains only 12 Lucide-specific lines.
  Existing `@napi-rs/wasm-runtime` alpha peer warnings remain unrelated; Lucide's
  React peer is satisfied.
- 2026-07-30: Pnpm 11.18.0 would require purging modules linked by 11.9.0 before
  scripts run. This bounded UI pass will not perform a broad reinstall; existing
  linked tooling runs verification and the pinned client remains lockfile authority.
- 2026-07-30: Direct formatting passed 132 files. Direct type checking then exposed
  an unrelated Vite/plugin config type collision after the older install changed
  module links; repository-managed verification will confirm whether accepted
  lockfile links need repair.
- 2026-07-30: Focused DOM tests caught the visible Required hint changing the Title
  input's computed accessible name. The implementation now preserves the stable
  `Title` name explicitly while retaining the visual hint.
- 2026-07-30: Completed default-surface implementation. Eight focused tests, all 248
  repository tests, formatting/lint/types, package build, and production playground
  build pass. Live Chrome verification is the remaining gate.
- 2026-07-30: The first live-gate server start was blocked by sandbox `EPERM` while
  binding local port 5173; the verified repository dev task requires local-listener
  permission for Chrome inspection.
- 2026-07-30: The selected Chrome tab retained a prior 150-pixel emulation after a
  window resize request. The menu remained operable in that stress case; explicit
  viewport emulation will own the recorded desktop/narrow matrix.
- 2026-07-30: Desktop Chrome exposed unnecessary seconds/milliseconds in ordinary
  date controls. Inputs now use minute precision for minute-aligned tasks and preserve
  sub-minute precision only when present.
- 2026-07-30: Chrome's issue panel found unnamed editor controls. Stable
  `title`/`start`/`end` names now satisfy form diagnostics without changing command
  submission.
- 2026-07-30: Completed and verified default-surface modernization. The 1,440 × 900
  and 560 × 900 Chrome gates pass menu/editor geometry, responsive layout, focus and
  modal restoration, accessibility-tree, console, and 69-request network checks.
  Final CI passes all 248 tests and the production builds.
- 2026-07-30: Started post-M4 overlay-boundary hardening after Chrome DevTools
  reproduced a 74-pixel clipped context menu and chart-confined modal on
  `/interactive`. Accepted the document-default, explicit-root/custom-container,
  themed-wrapper, collision, modal-isolation, SSR, shadow-root, and iframe contract;
  Slice 1 documentation verification passed and runtime implementation is active.
- 2026-07-30: Completed overlay-boundary hardening. The exported document/root/custom
  target contract, themed wrapper lifecycle, eight-pixel collision handling, and
  full-viewport modal isolation/restoration pass 248 tests, the complete local CI and
  production playground builds, packed declaration inspection, and Chrome gates at
  1,440 × 900 and 560 × 900. A live-discovered dynamic body-child case is covered by
  an observer regression test. The M4 item-properties appendix is next.
- 2026-07-30: Started the cross-cutting Zod runtime-schema migration. The document
  codec decision now selects private Zod 4 Mini schemas while retaining Gantempo-owned
  migrations, recovery, diagnostics, graph policy, freezing, and serialization.
- 2026-07-30: Completed migration Slice 1 with 77 focused tests, a fixed-seed
  50/2,000/10,000-task codec baseline, packed-artifact measurements, and a playground
  consumer bundle baseline; Slice 2 private schema foundations are active.
- 2026-07-30: Completed Zod migration Slices 2–5. Private wire/canonical schemas now
  own record structure across codec and strict command paths; 892 net legacy lines
  were removed from those paths, focused tests/type checks pass, large-valid parsing
  remains within the local budget, and the downstream bundle delta is +14.11 kB
  raw/+5.39 kB gzip with one Zod copy.
- 2026-07-30: Completed and verified Zod migration Slice 6. Package, Node import,
  playground consumer, declaration privacy, dependency uniqueness, fixed-seed
  performance, formatting, lint, type checking, all 237 tests, and the final package
  build pass.

## Decision Queue

Decisions remain open until a focused prototype or decision record resolves them.
The document wire-format decisions resolved for M1 are recorded in the
[document codec contract](decisions/2026-07-30-document-codec-contract.md). The M2
patch, affected-reference, strict-validation, transaction, revision, and local-history
decisions are recorded in the
[change-kernel contract](decisions/2026-07-30-change-kernel-contract.md).
The M3 view identity, topology rejection, interval source, overlap, lane-height,
viewport-query, benchmark, and read-only React-facade decisions are recorded in the
[view, layout, and viewport kernel contract](decisions/2026-07-30-view-layout-viewport-kernel-contract.md).
The M4 ownership, acknowledgement, event, interaction-target, viewport, accessibility,
and minimum customization decisions are recorded in the
[interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md).
The post-M4 timeline navigation axis/modifier/pointer, controlled-range,
occurrence-lifetime, browser-zoom, and accessibility contract is accepted in the
[timeline navigation interaction decision](decisions/2026-07-30-timeline-navigation-interaction-contract.md)
and implemented through the
[timeline navigation interactions plan](plans/2026-07-30-timeline-navigation-interactions-plan.md).
The post-M4 document/root/custom-container portal default, overlay lifecycle,
collision, modal-isolation, shadow-root, SSR, and iframe decisions are recorded in
the [overlay boundary contract](decisions/2026-07-30-overlay-boundary-contract.md).
The repository, package, activation, release, deployment, and update-entitlement
decisions for Community and Pro are recorded in the
[Community and Pro distribution and licensing decision](decisions/2026-07-30-community-pro-distribution-licensing.md).

1. The threshold for splitting internal modules into workspace packages.
2. The measured threshold for revisiting the M1 internal codec in favor of a runtime
   schema dependency.

Decision records should live under `docs/decisions/` when their consequences cross
more than one implementation plan.

## Roadmap Change Log

### 2026-07-31 — Interactive Custom consumer verified

- Completed the production `/interactive-custom` Chrome gate at 1440 x 900 and
  560 x 900.
- Verified named display/edit panels, pointer and Shift+F10 menu paths, canonical
  task/placement Save, Undo/Redo, Cancel, stale deletion closure, focus/live status,
  zero page/chart horizontal overflow, and the intentional absence of dialog,
  persistence log, and raw JSON surfaces.
- Fixed the only live issue by naming the custom form controls, then confirmed a
  clean console and four successful production requests.
- Passed the focused page test, production playground build, `git diff --check`, and
  final `mise run ci` with 68 files / 357 tests. The bounded integration plan is
  complete.

### 2026-07-31 — Interactive Custom consumer implemented

- Added `/interactive-custom` and the `Interactive Custom` navigation item without
  changing `/interactive`.
- Kept controlled loading, add/remove controls, history, range, direct interaction,
  appearance, progress, tooltip, menu, command callbacks, and acknowledgement while
  omitting all persistence-log imports and UI.
- Added a site-owned named display/edit panel below the chart with task title,
  description, instant schedule, progress, semantic appearance, and persisted lane
  placement.
- Save omits unchanged fields and emits one `task.update`, one `placement.move`, or
  one transaction; Cancel and unchanged Save return to display mode without history.
- Verified acknowledgement, Undo/Redo, validation, deletion closure, focus, keyboard
  menu access, no package dialog, no API log/raw JSON, route preservation, responsive
  styling, and axe rules.
- Passed 2 focused files / 7 tests, the production playground build, and
  `mise run ci` with 68 files / 357 tests. Slice 4 owns the live desktop/narrow gate.

### 2026-07-31 — Interactive Custom package seam complete

- Published `GanttTaskEditRequest` and `GanttProps.onTaskEditRequest` from the package
  root.
- Let the callback enable the built-in task menu without enabling a package editor;
  selecting `Edit properties` closes the menu, publishes one frozen request, and
  leaves focus available to application-owned chrome.
- Preserved the existing editor fallback when the callback is absent and kept
  read-only controlled charts disabled.
- Verified task activation independence, keyboard and pointer paths, exact-once
  delivery, focus, no package dialog, two-instance isolation, root-facade typing, and
  packed declarations.
- Passed 4 focused files / 29 tests and `mise run ci` with 67 files / 352 tests.
  Slice 3 will add the controlled `/interactive-custom` consumer.

### 2026-07-31 — Interactive Custom edit-request contract accepted

- Accepted `/interactive-custom` and `Interactive Custom` as the separate route and
  label while preserving `/interactive`.
- Fixed the additive public contract as task-only
  `GanttTaskEditRequest` / `onTaskEditRequest`, sourced only from the built-in context
  menu.
- Kept read-only controlled charts disabled and existing consumers on the current
  editor fallback.
- Fixed menu closure without chart-focus restoration before exact-once request
  delivery so an application-owned panel can take focus.
- Kept the request outside commands, history, persistence, acknowledgement, and
  package overlay state. Slice 2 will publish and verify the package seam.

### 2026-07-31 — Interactive Custom integration proposed

- Planned `/interactive-custom` as a separate `Interactive Custom` playground
  consumer while preserving `/interactive`.
- Kept the controlled timeline, command/history, and direct-interaction proof, but
  removed the persistence/API debug surface from the proposed page.
- Confirmed that `onTaskActivate` is sufficient for application-owned display mode.
- Recorded the missing public seam: the built-in `Edit properties` action directly
  opens Gantt's private overlay and cannot currently hand edit intent to a site-owned
  panel.
- Proposed a narrow additive task edit-request callback and stopped before
  implementation pending contract review.

### 2026-07-31 — Proportional documentation governance

- Limited mandatory plan and roadmap synchronization to new features, substantial
  changes, and substantial deviations.
- Explicitly exempted minor fixes, cosmetic or interaction polish, obvious
  improvements, code-inferable implementation details, and straightforward
  continuation of already documented work.
- Preserved documentation requirements when status, scope, evidence, durable
  decisions, significant deviations, or the actionable next step materially changes.
- This policy refinement is owned by Slice 4 of the
  [documentation-governance plan](plans/2026-07-30-roadmap-documentation-governance-plan.md).

### 2026-07-31 — Progress drag feedback complete

- Recorded the user-reported ambiguity in direct progress dragging: the existing
  preview changes completed width but does not visibly report the amount.
- Started one bounded M4 appendix follow-up to snap pointer progress to `5%`
  increments and show the current percentage during the gesture.
- Preserved canonical `0..1` data, keyboard `1%`/`10%` adjustment, one-command
  commit/history behavior, assistive announcements, and the public facade.
- Selected focused pure/DOM/style regressions, full CI/build/diff gates, and live
  desktop/narrow Chrome verification as the completion evidence.
- The first narrow live check found the preview-owned badge could clip on a short
  task at the timeline boundary, and the timeline itself can be narrower than the
  badge in the two-column narrow layout. The private presentation now clamps a
  body-level badge to visible chart bounds without changing interaction or public
  contracts.
- Pointer-derived progress now snaps to `5%`; keyboard `1%`/`10%`, canonical
  `0..1` storage, controlled acknowledgement, cancellation, history, and the public
  facade remain unchanged.
- The drag-only percentage badge is `aria-hidden`, pointer-transparent, clamped to
  chart bounds, and absent from keyboard, pending, committed, and cancelled states.
- Focused verification passed 4 files / 53 tests. Final `mise run ci` passed 158
  formatted files, 147 lint/type files, 67 test files / 348 tests, and four package
  artifacts; the production playground transformed 1,918 modules.
- Because Chrome DevTools was profile-locked, the in-app browser fallback verified
  `/interactive` at 1440 x 1000 and 390 x 844. Live drag values, five-point commits,
  badge containment/lifecycle, zero document overflow, and an empty warning/error
  console passed. The fallback exposes neither touch emulation nor a network panel,
  so those live claims remain unmade; mouse/pen/touch paths are covered in DOM tests.

### 2026-07-31 — M4 item-properties appendix complete

- Completed Appendix Slice A7 and the final automated/package/SSR and
  browser/accessibility gates.
- Added root-import controlled, runtime-owned, and read-only consumer proofs for
  properties, semantic appearance precedence, repeated tasks, unknown fallback,
  progress, persisted lane movement, deletion, Undo/Redo, and async acknowledgement.
- Corrected the package manifest to declare the React DOM 18/19 peer required by the
  existing portal import after a fresh tarball consumer exposed the omission.
- Corrected light muted helper/meta text from 3.96:1 to the normal-text threshold;
  the repeated narrow Lighthouse accessibility score is 100.
- Recorded the `vp pack` repository-root and `npm pack` package-directory cwd
  constraints. The corrected tarball contains four artifacts plus metadata and
  installs/imports cleanly.
- Final Chrome evidence covers desktop/narrow containment, modal isolation, live
  light/dark/high-contrast switching, a 44x24 px touch progress target,
  reduced-motion behavior, forced-colors rules, zero overflow, no console issues, and
  74 successful requests.
- Full `mise run ci` passes 158 formatted files, 147 lint/type files, 67 test files /
  346 tests, and four package artifacts. M5 detailed planning is next.

### 2026-07-31 — Persistence entity-change projection started

- Recorded the user-reported controlled-consumer gap: a same-lane task drag logged
  candidate/API-write/committed protocol entries but did not directly show the old
  and new dates.
- Accepted an additive row-oriented `entityChanges` projection while preserving
  commands, patches, inverses, lifecycle ordering, and controlled acknowledgement.
- Created the focused implementation plan and selected public type/runtime coverage,
  the concise playground adapter, README updates, full CI, and live desktop/narrow
  verification as the ordered path.
- Recorded that Markdown-only targets are excluded by both `vp check` and `vp fmt`;
  documentation uses diff/link/terminology checks, while the full source-aware check
  remains in CI.
- Slice 1 contract synchronization passed diff, link-target, and focused terminology
  checks; implementation of the public projection is active.
- The first focused projection run exposed and corrected a test-only cascade-order
  assumption; runtime output already matched the established task-first deletion
  patch order.
- The public hook projection and concise playground adapter are implemented: repeated
  transaction patches coalesce by row, and task movement now reports ISO before/update
  dates without lifecycle telemetry.
- Chrome DevTools could not attach because its dedicated profile was already locked;
  live verification uses the built-in Browser fallback without terminating the
  existing browser.
- Focused projection/example coverage now passes four files and 25 tests; full
  formatting/lint/types and the production playground build pass.
- Live desktop drag and 1,440 × 900 / 560 × 900 checks prove the single
  `task.schedule.updated` ISO-date request, labelled accessible log, no page overflow,
  and zero console warnings/errors. The fallback has no separate failed-request
  ledger, so that check is not claimed.
- Final CI passed 60 test files / 293 tests, formatting across 147 files, lint/types
  across 136 files, and the package build. The final playground build transformed
  1,914 modules, and diff checks passed.
- Final review found one adapter omission outside the verified move path: full task
  create/delete rows dropped schedule `mode`. The short date-only projection is now
  limited to same-mode updates, and focused create-payload coverage passes.
- Repeated final CI passed 60 test files / 294 tests, formatting across 147 files,
  lint/types across 136 files, and the package build. The production playground again
  transformed 1,914 modules, final diff checks passed, and the correction is complete.
- A user-requested presentational follow-up replaces the raw textarea with a bounded
  Sentry/Grafana-style event stream. It keeps the newest ten writes, summarizes each
  operation, and reveals metadata plus raw JSON through native disclosure without
  changing the accepted persistence contract.
- The follow-up passes two focused files / six tests with axe, final CI across 149
  formatted files, 138 lint/type-checked files, 61 test files / 297 tests, the
  four-artifact package build, the 1,915-module production playground build, and
  final diff checks.
- Live in-app Browser verification moved `Work item 1`, expanded its concise row,
  preserved keyboard focus/toggle, retained operations 004–013 after 13 writes,
  bounded the stream at 430 pixels with real overflow, and kept page overflow at
  zero. Chrome DevTools remained profile-locked, while the fallback could not run
  the 560 × 900 or console gates; the active plan records that verification-only
  deviation.
- Appendix Slice A1 remains next after the structured-log follow-up.

### 2026-07-30 — Default-surface modernization started

- Created and linked the active implementation plan for the built-in task editor and
  context menu.
- Kept the work inside the existing M4 surface and overlay boundaries: no public
  contract or architecture decision changes.
- Selected internal `lucide-react` icons, native `datetime-local` inputs, modern
  control/action styling, destructive action treatment, and responsive verification.
- Baseline inspection confirmed the existing role, accessible-name, keyboard,
  focus-return, collision, and modal-isolation contracts can be preserved.
- Recorded the non-product dependency-store deviation: the first install stopped
  before mutation because the checkout and sandbox selected different pnpm stores.
- Recorded the pnpm-version deviation after 11.9.0 rewrote unrelated lockfile peer
  snapshots; the pinned 11.18.0 client owns final lockfile verification.
- Normalization removed all unrelated lockfile churn. The remaining peer warnings
  predate and are independent of this surface refinement.
- Avoided an unnecessary full module purge when the pinned client rejected script
  execution against older links; verification uses the working linked runtime.
- Direct formatting passed; the first typecheck exposed a Vite/plugin type collision
  in tooling resolution rather than the changed surface code.
- The first focused DOM run caught and corrected the Title-label regression introduced
  by the visual Required hint.
- Slice 2 now passes 8 focused tests and the complete 51-file/248-test CI gate.
  Package output is 307.90 kB JavaScript/20.38 kB CSS, and the production playground
  emits 408.69 kB JavaScript/26.23 kB CSS before compression.
- Live inspection remains active after the sandbox blocked the first local-listener
  attempt before the application served.
- Chrome's stale 150-pixel emulation was identified before accepting live geometry;
  intended viewport evidence will use explicit emulation.
- Live desktop inspection tightened the native date controls after their universal
  millisecond step produced visual noise for minute-aligned schedules.
- Live console/issue inspection added stable form-control names after Chrome flagged
  the otherwise-labelled controls for autofill diagnostics.

### 2026-07-30 — Default-surface modernization complete

- Added internally owned Lucide iconography without changing public surface-slot or
  menu-item contracts.
- Modernized the default menu with task context, four icon-backed actions, consumer
  action ordering, keyboard focus treatment, and separated destructive Delete.
- Modernized the editor with a structured header, local native date-time controls,
  precision-aware date display, styled validation, primary Save, responsive
  two-column/bottom-sheet layouts, and stable form/accessibility names.
- The final local gate passed 132-file formatting, 121-file lint/type checking, 51
  test files/all 248 tests, package build, and the production playground build.
- Chrome DevTools passed `/interactive` at 1,440 × 900 and 560 × 900: the desktop
  menu measured 248 × 239.59 pixels, the desktop editor 540 × 353.70 pixels, the
  narrow menu retained the eight-pixel collision safe area, and the narrow editor
  became a 540-pixel bottom sheet with one-column dates and no page overflow.
- The modal accessibility tree, initial focus, Escape focus return, body scroll/inert
  restoration, form issue cleanup, zero application console errors/warnings, and all
  69 successful requests passed. Extension/DevTools warnings matched prior recorded
  environment noise.
- Appendix Slice A1 is again the next action.

### 2026-07-30 — Overlay-boundary hardening started

- Recorded the `/interactive` clipping deviation: an ordinary rounded overflow
  container cut 74 pixels from the context menu, and the modal backdrop matched only
  the chart's 1,308 × 272 pixel root.
- Accepted the overlay boundary contract and created the active implementation plan.
- Updated architecture to make an instance-owned document-level wrapper the default,
  retain explicit chart-local and custom-container targets, preserve per-instance
  themes, and state the iframe boundary.
- Slice 1 passed diff, linked-file, and cross-document contract checks.
- Slices 2 and 3 then added the exported target, wrapper/theme lifecycle, coordinate
  correction, full-viewport modal isolation/restoration, dynamic-child hardening,
  public docs, and focused coverage.
- Final evidence passed 51 files/248 tests, 132-file formatting, 121-file lint/type
  checking, package and playground builds, packed declarations, and live 1,440 × 900
  plus 560 × 900 Chrome gates with zero page overflow or failed request.
- The hardening plan is complete; Appendix Slice A1 is again the next action.

### 2026-07-30 — Base M4 interaction runtime and public API complete

- Completed the controlled `/interactive` consumer over one runtime-owned
  toolbar/pointer/keyboard/menu/editor/history path and added immediate application
  candidate adoption plus the labelled network-free API-shaped change log.
- Added `/uncontrolled` with parsed `defaultDocument`, `defaultSession`, async
  allow/reject/replace interception, derived resource-view mapping, typed
  slots/columns, lifecycle observers, toolbar CRUD/history, and occurrence-aware
  imperative focus/scroll.
- Rewrote the README for API loading, direct React and external-store controlled
  ownership, uncontrolled ownership, persistence batches, session ownership,
  interception/events, handles, customization, ambiguous-view mapping, and the
  instant/all-day boundary.
- Added root-facade consumer proof and fixed-seed `m4-runtime-v1` evidence. The full
  suite passed 50 files/238 tests; `vp check` and `mise run ci` passed 123 formatted
  and 112 checked source files; the package built four artifacts with exactly eleven
  intentional runtime exports and no private runtime/store/scene/hit-test declaration
  leakage; the playground transformed 59 modules.
- Fixed-seed scene/runtime/cache/hit-test evidence used 2,000 tasks, 400 lanes, seed
  `20260730`, local Vite Plus `0.2.6`, Vitest `4.1.10`, Node `24.18.1`, macOS arm64,
  and Apple M3 Pro hardware. Exact timings and work metadata are recorded in the
  completed plan without a cross-machine threshold.
- Chrome DevTools verified `/`, `/matrix`, `/interactive`, and `/uncontrolled` at
  1440 × 900, 900 × 900, and 560 × 900 with aligned columns/timelines, no horizontal
  page overflow, labelled treegrid/task/status/persistence surfaces, controlled
  transaction logging, async policy outcomes, mapped and rejected derived moves,
  focus retention, high contrast, inspected reduced-motion/forced-colors rules, no
  failed local request, and no application-owned console error.
- Corrected all-day example wording to the accepted canonical-data/no-instant-bar M4
  boundary. Recorded that the final DevTools touch viewport's semantic drag emitted a
  mouse pointer source; the verified Slice 8 live touch evidence and still-green touch
  integration coverage remain authoritative.
- The first post-commit CI rerun exposed an order-dependent pointer auto-pan DOM
  gate. It now publishes installed synthetic geometry through the measured
  scroll/animation-frame path before pointer movement; five consecutive isolated
  cases, the complete DOM suite, and two consecutive full CI reruns pass without
  changing runtime behavior.
- Marked base M4 done only after both final gates and added completion evidence to the
  accepted decision. Architecture required no change.
- The separately accepted post-M4 item-properties/semantic-color/progress appendix
  supersedes the older M5-next handoff. Appendix Slice A1 is now the next action; M5
  detailed planning remains queued after it.

### 2026-07-30 — M4 typed customization and instant-task CRUD complete

- Added the bounded public content/surface slots, task/lane summaries, class-state
  callbacks, aligned read-only lane columns, feature toggles, task-derived menu items,
  and overlay/editor props required by the accepted M4 contract without exposing
  mutable documents or private runtime, scene, geometry, and command-bus objects.
- Added one themed portal host per instance plus built-in tooltip, context menu, and
  instant-task editor behavior with roles, labels, focus trap/return, Escape,
  click-away, pending/rejection state, local validation, and polite outcomes.
- Routed Create/Edit/Delete and custom menu commands through the existing mapper and
  command bus. Multi-field title/start/end edits become one ordered
  update/move/resize transaction and one history entry, with stable disabled reasons
  for unsupported read-only/derived/custom/all-day/segment cases.
- Updated `/interactive` with custom task/lane content, two columns, class hooks, a
  task-derived command, tooltip, menu, and editor. `docs/UI_THEMING.md` required no
  change because the implementation matches its existing durable contract.
- Five new Testing Library/axe cases cover slots/class state, columns, tooltip/editor
  validation and commit, menu/custom commands and focus return, two-instance portal
  isolation, and async pending/rejection. The full gate passed 49 files/236 tests;
  `vp check` passed 120 formatted and 109 lint/type-checked files, `vp pack` built four
  artifacts with only intentional public types, and the playground transformed 58
  modules.
- `mise run ci` passed the complete check, 49-test-file/236-test, and four-artifact
  package build gates.
- Chrome DevTools passed `/`, `/matrix`, and `/interactive` at 1440 × 900 and
  560 × 900 with exact column alignment, intact light/dark/high-contrast/empty
  surfaces, no horizontal overflow, typed menu and editor commits with focus return,
  no failed local request, and no application-owned console error or warning.
- Axe found and corrected nested editor header/footer landmarks. Source inspection
  removed an obsolete narrow playground width override that would have separated the
  custom header/body column widths. Both deviations and their evidence are recorded
  in the active plan; neither changes the architecture contract.
- Selected consumer proof, facade hardening, documentation, and M4 closure as
  Slice 11.

### 2026-07-30 — M4 keyboard, focus, and accessibility parity complete

- Added roving occurrence focus, deterministic geometric navigation, selection and
  activation, mode-based move/resize, create/delete, undo/redo, cancellation, focus
  retention, and polite outcomes over the existing interaction intent, mapper,
  preview, transaction, and command-bus path.
- Added one labeled hybrid region/treegrid surface with lane relationships and
  occurrence task buttons, useful date names, selected/disabled state, shortcut
  descriptions, visible focus, forced-colors rules, reduced-motion behavior, and
  explicit dependency-link/all-day deferrals.
- Added exact Testing Library, user-event, and axe-core development dependencies
  through `vp add -Dw`. Focused keyboard suites passed 2 files/9 tests; the final full
  gate passed 48 files/230 tests. `vp check` passed all 118 formatted and 107
  lint/type-checked files, `vp pack` built four artifacts with only the intentional
  public action/state additions, and the production playground transformed 57
  modules.
- `mise run ci` passed the complete check, 48-test-file/230-test, and four-artifact
  package build gates.
- Chrome DevTools passed `/`, `/matrix`, and `/interactive` at 1440 × 900 and
  560 × 900 with intact main, dark/high-contrast, empty, and interactive layouts,
  coherent accessibility trees, one live outcome, no page-level horizontal overflow,
  no failed local request, and no application-owned console error or warning.
- Live keyboard operation covered selection, activation, occurrence navigation,
  cross-time/lane movement, resize cancellation/commit, creation, deletion, undo, and
  redo with retained focus; a narrow keyboard move passed as well.
- Live accessibility inspection found duplicate visual empty-state copy. It is now
  presentational while the semantic treegrid row remains the single accessible
  source; the active plan records the exact deviation.
- Chrome lacked native forced-colors/reduced-motion emulation and the built-in Browser
  fallback reported `No browser is available`. Exact shipped nested media rules were
  activated non-persistently for computed-style proof, then restored by reload; this
  tooling deviation is recorded in the active plan and is not a native-OS emulation
  claim.
- Selected typed customization, menus, tooltip, columns, and instant-task editing as
  Slice 10.

### 2026-07-30 — M4 pointer, pen, and touch workflows complete

- Connected delegated Pointer Events to the private hit-test/gesture/preview mapper
  and the existing command bus, with occurrence selection/focus, capture and loss,
  multi-pointer rejection, async pending/rejected states, edge auto-pan, mapped
  creation, and reduced-motion/forced-colors presentation under focused test.
- Updated the controlled playground seam to acknowledge chart-originated candidates
  so the live `/interactive` route can prove direct manipulation without adding an
  alternate document mutation path.
- Corrected a Slice 7 event-order deviation: controlled session actions now use only
  `onSessionChange` as the proposal callback; selection/focus/viewport observations
  wait for authoritative prop adoption. The active plan records the exact finding.
- The first live Chrome mouse drag exposed and fixed a synchronous controlled-ack
  race: a resolving pointer dispatch now retains pending UI only while the store still
  holds the matching proposal, so an already-observed commit cannot be overwritten by
  stale continuation state.
- Focused tests cover 14 DOM interaction cases including mouse/pen/touch variants;
  the final full gate passed 46 files/221 tests. `vp check` passed all 115 formatted
  and 104 lint/type-checked files, `vp pack` built four artifacts, declaration
  inspection retained private runtime/scene/hit-test internals, and the production
  playground transformed 55 modules.
- `mise run ci` passed the complete check, 46-test-file/221-test, and four-artifact
  package build gates.
- Chrome DevTools passed `/`, `/matrix`, and `/interactive` at 1440 × 900 and
  560 × 900 with intact layouts, complete labeled chart/task/status/live-region
  snapshots, no page-level horizontal overflow, no failed local request, and no
  application-owned console error or warning.
- Live desktop mouse movement committed the expected controlled task move. Touch
  emulation traversed pressing/dragging/preview/idle, committed the same command path,
  and created a mapped second task in an empty lane with one polite completion
  announcement.
- Selected keyboard, focus, and assistive-technology parity as Slice 9.

### 2026-07-30 — M4 React runtime facade complete

- Connected exactly one per-instance ownership store, command bus, staged composer,
  measured viewport, selector context, semantic event surface, and narrow imperative
  handle to the React component with controlled/uncontrolled document and session
  ownership.
- Preserved trusted affected references through local adoption/acknowledgement,
  retained SSR-safe deterministic initial markup, added absolute scrollable lane
  geometry and post-mount coalesced measurement, and exposed stable
  disabled/pending/selected/focused attributes plus a polite live region.
- Added focused jsdom/root-facade evidence for command rendering, controlled
  acknowledgement/callback order, selector isolation, refs, two instances, hydration,
  measurement cleanup, Strict Mode replay, and compile-time ownership exclusivity.
- Recorded the implementation deviation that React final disposal must defer across
  passive cleanup and the Strict Mode replay; paired activation cancels only the final
  disposal while direct runtime disposal remains immediate.
- Focused tests passed 4 files/24 tests; the existing SSR/M1/M2/M3 subset passed
  27 files/124 tests; `vp check`, `vp pack`, public declaration inspection,
  `git diff --check`, and the 52-module production playground build passed.
- `mise run ci` passed the complete 46-test-file/213-test and four-artifact package
  gates.
- Chrome DevTools passed `/`, `/matrix`, and `/interactive` at 1440 × 900 and
  560 × 900 with zero chart diagnostics, no page-level horizontal overflow, aligned
  viewport/lane/timeline geometry, complete labeled-region/task/live-region
  accessibility snapshots, successful controlled “Add item” rendering, no failed
  local request, and no application-owned console error or warning. Extension and
  DevTools environment noise was recorded separately in the active plan.

### 2026-07-30 — M4 renderer-independent interaction geometry complete

- Added private immutable lane-grouped hit geometry for bodies, resize edges, and
  empty timeline positions with clipped-edge suppression, deterministic overlap
  priority, touch expansion, copied provenance, coordinate/time conversion, and
  explicit snap ties.
- Added visual occurrence navigation, pure threshold/gesture/cancel/commit states,
  cross-lane/create/resize intent, immutable previews and descriptions, built-in
  semantic command mapping, and frozen fail-closed application mapper seams.
- Fixed-seed indexed/brute-force parity used seed `20260730`, 250 runs, up to eight
  variable lanes and 40 dense tasks across mouse, pen, and touch.
- Focused tests passed 5 files/16 tests; `vp check` passed all 109 formatted and 98
  lint/type-checked files; `vp pack` built four artifacts; `git diff --check` and
  framework-boundary inspection passed.
- `mise run ci` passed the complete check, 43-test-file/196-test, and four-artifact
  package build gates.
- No React, CSS, scenario, or playground source changed, so no browser claim was
  added.

### 2026-07-30 — M4 derived pipeline and measured viewport complete

- Added a private staged scene composer with exact cold compatibility, canonical
  dependency maps, selective topology/interval/lane/index/tick/primitive reuse,
  fixed work observations, safe external fallback, and fixed-seed cached/cold parity.
- Added lane-local/cumulative geometry reuse and DOM-free runtime measurement with
  asymmetric overscan, focus-range retention, session-intent reconciliation,
  injectable coalescing, flush/clear, and disposal safety.
- Kept reference validation/shared document indexing conservative for every changed
  document because M1 sanitization can cross collection boundaries; recorded this
  broader safe boundary in the active plan without changing milestone scope or order.
- Focused tests passed 5 files/29 tests; the M3 layout/scene refactor subset passed 5
  files/23 tests. The `m4-scene-v1` benchmark used seed `20260730`, 2,000 tasks, 400
  lanes, sparse distribution, and 45/40 visible tasks on an arm64 Apple M3 Pro
  (12 cores, 18 GB), with no CI timing threshold.
- `vp check` passed all 99 formatted and 88 lint/type-checked files,
  `vp build apps/playground` transformed 46 modules, `vp pack` built four artifacts,
  and `git diff --check` plus framework-boundary inspection passed.
- `mise run ci` passed the complete check, 38-test-file/180-test, and four-artifact
  package build gates.
- No React, CSS, scenario, or playground source changed, so no browser claim was
  added.

### 2026-07-30 — M4 async command bus and history orchestration complete

- Added one React-free FIFO command bus with normalized immutable proposals,
  registration-order allow/reject/replace interception, exact one-reducer delegation,
  stale/pending/read-only rejection, and active/queued abort and disposal settlement.
- Added immutable candidate/commit/rejection/error phases, local proposal correlation,
  uncontrolled adoption, controlled exact acknowledgement/divergence, callback-error
  reporting without rollback, and JSON-compatible change envelopes.
- Composed bounded M2 history with acknowledgement-time controlled entries, one-entry
  transactions, explicit undo/redo proposals, revision-only rebasing, and fail-closed
  external-content invalidation.
- Added fixed-seed mixed controlled operation sequences and focused queue,
  interception, cancellation, callback, candidate, history, transaction, and envelope
  evidence.
- Combined focused M2/M4 tests passed 15 files/73 tests, `vp check` passed all 93
  formatted and 82 lint/type-checked files, `vp pack` built four artifacts, and
  `git diff --check` plus framework-boundary import inspection passed.
- `mise run ci` passed the complete check, 35-test-file/167-test, and four-artifact
  package build gates.
- No React, renderer, style, playground, or browser behavior changed; no browser claim
  was added.

### 2026-07-30 — M4 React-free runtime ownership store complete

- Added private immutable runtime snapshots, independent document/session ownership,
  batched and reentrant-safe subscriptions, selector equality, interaction/history
  metadata, and disposal without expanding the package facade.
- Added stable-serialization document cloning, one-pending controlled proposal
  metadata, exact acknowledgement, same-base rerender tolerance, divergence handling,
  revision-only history preservation, and fail-closed external-content invalidation.
- Added occurrence-based selection/focus normalization and deterministic reconciliation
  with controlled full-session proposals, repeated task occurrences, and cross-family
  same-key identity preserved.
- Added fixed-seed ownership/session sequences and focused evidence for independent
  instances, mutable inputs, frozen snapshots, view removal, stale inputs,
  unsubscribe/reentrancy, selector equality, subscriber failures, and disposal.
- Focused runtime tests passed 2 files/16 tests, `vp check` passed all 89 formatted and
  78 lint/type-checked files, `vp pack` built four artifacts, import inspection and
  `git diff --check` passed.
- `mise run ci` passed the complete check, 33-test-file/149-test, and four-artifact
  package build gates.
- No React, renderer, style, playground, or browser behavior changed; no browser claim
  was added.

### 2026-07-30 — M4 semantic task commands complete

- Added public `task.move` and `task.resize` command types with exclusive
  delta/absolute-start movement and explicit instant edge/time resize payloads.
- Added pure strict reduction with exact duration preservation, positive half-open
  intervals, deterministic whole-task patches/inverses, direct affected references,
  and identity-preserving no-ops.
- Added stable failure diagnostics and focused/fixed-seed evidence for malformed,
  unsupported, cross-family, nested transaction, replay, inversion, immutability, and
  root-facade behavior.
- Recorded the implementation-only TypeScript plain-object narrowing finding without
  changing the accepted public union or any durable architecture boundary.
- Focused command tests passed 11 files/39 tests, the root-facade test passed,
  `vp check` passed all 84 formatted and 73 lint/type-checked files, `vp pack` built
  four artifacts, and `git diff --check` passed.
- `mise run ci` passed the complete check, 31-test-file/133-test, and four-artifact
  package build gates.
- No React, renderer, style, playground, or browser behavior changed; no browser claim
  was added.

### 2026-07-30 — M4 interaction-runtime/public-API contract accepted

- Added and cross-linked the accepted
  [interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md).
- Fixed independent controlled/uncontrolled document and combined session ownership,
  retained controlled horizontal range ownership for M4, and separated local candidate
  acknowledgement from later server persistence/revision replacement.
- Fixed occurrence targets, semantic instant move/resize payloads, derived-placement
  mapper boundaries, FIFO interception, immutable lifecycle payloads, bounded history,
  the occurrence-aware imperative handle, and the narrow selector facade.
- Fixed flat treegrid/task-control semantics, mode-based keyboard editing, live
  announcements, focus retention, the focused jsdom integration stack, and the minimum
  M4 customization surface.
- Kept this slice documentation-only; no production runtime, React behavior, package
  export, interaction test, benchmark, or browser claim was added.
- `vp check` passed all 82 formatted files and 71 lint/type-checked files;
  `git diff --check`, linked-file/heading checks, and the focused cross-contract read
  passed.
- `mise run ci` passed the complete check, 29-test-file/125-test, and four-artifact
  package build gates.

### 2026-07-30 — M4 state and backend-hook boundary refined

- Clarified that a reducer-accepted controlled candidate is not `commandCommitted`
  until the authoritative prop acknowledges it.
- Added an opaque local proposal ID and immutable persistence-ready change envelope
  while keeping backend operation IDs, retries, rollback, server revision
  reconciliation, temporary-ID mapping, and conflicts outside M4.
- Required controlled consumers to acknowledge candidates in local React or external
  store state before asynchronous persistence.
- Expanded final M4 consumer evidence with API-shaped loading and a network-free,
  read-only debug textarea that records candidate/commit/rejection events and example
  patch request payloads, including atomic transaction batches.
- Kept Slice 1 as the next action and made no runtime or playground implementation
  claim in this documentation-only refinement.
- `vp check` passed all 82 formatted files and 71 lint/type-checked files;
  `git diff --check` and focused lifecycle/envelope/example terminology checks also
  passed.

### 2026-07-30 — M4 interaction-runtime implementation plan ready

- Added the detailed
  [M4 interaction runtime and public API plan](plans/2026-07-30-interaction-runtime-public-api-plan.md)
  with eleven ordered implementation slices.
- Kept M4 not started while fixing the planned boundaries for semantic task
  move/resize commands, runtime ownership, async interception/history, incremental
  derivation, viewport measurement, hit testing, React ownership, pointer/touch,
  keyboard/accessibility, customization/CRUD, and final consumer evidence.
- Preserved M5 ownership of hierarchy, dependency editing, adaptive zoom,
  localization, and calendar-aware behavior, and preserved M6 ownership of advanced
  scheduling/resource semantics.
- Selected the M4 decision-record/contract slice as the next action; no runtime,
  package, benchmark, or browser claim was added by this docs-only planning pass.
- `vp check` passed all 82 formatted files and 71 lint/type-checked files;
  `git diff --check`, linked-file existence, and focused M4 status/link/slice checks
  also passed.

### 2026-07-30 — Interactive controlled playground proof complete

- Confirmed that external toolbar-driven document changes can be demonstrated with
  the already-public M2 commands/history and M3 immutable `document` prop.
- Added a playground-only `/interactive` proof with an initially empty four-lane
  canvas plus add, batch-add, remove, clear, undo, and redo controls.
- `vp check` passed 82 formatted and 71 lint/type-checked files; 29 test files and
  125 tests passed; the production playground transformed 46 modules.
- Final `mise run ci` repeated the full check and test gates and built all four
  package artifacts.
- Chrome DevTools passed `/interactive` at 1440 × 900 and 560 × 900 with zero chart
  diagnostics, no horizontal overflow, aligned lane/timeline geometry, correct
  control state and live feedback, complete chart/task accessible names, and no
  application-owned console or network failure.
- Kept M4 not started: chart-owned pointer, touch, keyboard, focus, selection,
  scrolling, zooming, and imperative APIs remain subject to the required M4 plan.

### 2026-07-30 — M3 view, layout, and viewport kernel complete

- Completed all nine slices: durable contract, four-view topology, task/segment
  intervals, deterministic variable-height stacks, immutable indexed viewport,
  performance baseline, semantic scene composition, React/playground integration, and
  intentional facade/documentation.
- Public M3 surface is limited to optional `GanttProps.view` and seven data-only
  definition/descriptor types. Resolved keys/views, layout, viewport, counters,
  generators, and oracles remain private.
- Final `mise run ci` passed 81 formatted and 70 lint/type-checked files, 29 test files
  and 125 tests, and four package artifacts. Focused root imports passed 3 files and
  12 tests; the production playground transformed 45 modules.
- The final `m3-v1`/seed `20260738` benchmark retained exact oracle parity. Cold means
  were `37.4279`–`39.8472` ms; warm horizontal/vertical/diagonal means were `0.4483`,
  `0.0033`, and `0.0030` ms with unchanged structural work counts. This remains a
  local baseline without a timing threshold.
- Packed inspection found exactly five npm entries, ten intentional runtime exports,
  seven M3 public view types, React/browser-free pure sources, no private declaration
  leakage, and no test/benchmark/oracle/playground dependency leakage.
- Reused the final Slice 8 Chrome DevTools matrix because no rendered source changed:
  `/` and `/matrix` passed at 1440 × 900, 900 × 900, and 560 × 900 with aligned
  variable geometry, zero diagnostics, no page overflow, complete accessible names,
  intended provenance/themes/clipping/stacks, disabled controls, and no
  playground-owned console or network failure.
- Marked M3 complete and selected detailed M4 interaction-runtime/public-API planning
  as the next action.

### 2026-07-30 — M3 Slice 8 React and playground integration

- Added optional public data-only view selection, stable view/provenance DOM
  attributes, and variable-height React/CSS lane/timeline/separator rendering while
  preserving the document default.
- Expanded the real playground to persisted document, flat project, dark custom,
  stacked resource, explicit segment/variable-height, compact, high-contrast, clipped,
  and empty paths.
- Focused verification passed 2 files and 15 tests; `vp check` passed 80 formatted and
  69 lint/type-checked files; the production playground transformed 45 modules.
- Chrome DevTools inspection passed `/` and `/matrix` at 1440 × 900, 900 × 900, and
  560 × 900 with zero diagnostics, no horizontal overflow, aligned lane/timeline/SVG
  geometry, correct responsive columns/themes/provenance/clipping/stacks, complete
  accessible chart/task names, and disabled controls.
- Fixed two live browser findings: removed redundant SVG task descriptions while
  preserving `aria-label`, and added an inline favicon to eliminate the only
  playground-owned 404. Final network requests all succeeded; remaining console
  warnings/issues were browser-extension injected rather than application output.
- The maximized Chrome window rejected direct content resize, so the required sizes
  used Chrome DevTools viewport emulation with the same selected local page.
- The per-slice `mise run ci` checkpoint passed 28 test files and 121 tests plus the
  four-artifact package build.
- Selected intentional facade/docs/packed/final evidence as Slice 9.

### 2026-07-30 — M3 Slice 7 viewport-backed semantic scene

- Replaced fixed-row document lookup in `buildChartScene` with composition over the
  verified view, interval, stack, viewport, scale, tick, and primitive boundaries.
- Added stable view identity/provenance and optional canonical source IDs to semantic
  lanes/bars while preserving default persisted identities.
- Added direct all-view, segment, stack, variable-height, partial-viewport, rejected
  topology, and M0 parity coverage.
- Focused pure/scene verification passed 9 files and 36 tests; model/time/render
  regression passed 9 files and 54 tests; `vp check` passed 80 formatted and 69
  lint/type-checked files.
- Browser verification was not applicable because default valid document
  markup/geometry and playground sources were unchanged; React/CSS integration is
  Slice 8.
- The per-slice `mise run ci` checkpoint passed 28 test files and 120 tests plus the
  four-artifact package build.
- Selected read-only React/playground integration as Slice 8.

### 2026-07-30 — M3 Slice 6 pure-kernel performance baseline

- Added the `m3-v1`/seed `20260738` 10,000-task/2,000-lane document/resource,
  sparse/dense fixed generator and exact viewport-adjacent Vitest benchmark.
- On Node `v24.18.1`/Vitest `4.1.10`, arm64 Apple M2 Max/32 GiB, cold full-pipeline
  means were `38.1043`–`39.2424` ms. Warm query means were `0.4711` ms horizontal,
  `0.0033` ms vertical, and `0.0030` ms diagonal dense.
- Warm structural observations were 2,000 lanes/4,326 nodes for the all-lane
  horizontal case, 8/40 for vertical, and 8/34 for diagonal dense. All matched the
  brute-force oracle outside timed sections.
- Focused verification passed 8 files and 28 tests; `vp check` passed 80 formatted
  and 69 lint/type-checked files. No timing threshold or frame-rate claim was added.
- The per-slice `mise run ci` checkpoint passed 28 ordinary test files and 117 tests
  plus the four-artifact package build.
- Selected viewport-backed semantic scene composition as Slice 7.

### 2026-07-30 — M3 Slice 5 immutable viewport index and query

- Added binary-searched variable lane boundaries, augmented max-end interval trees,
  validated half-open queries, immutable visible output, and complete content bounds.
- Indexed results match a brute-force two-dimensional oracle, including long
  earlier-starting intervals and out-of-bounds windows.
- A 1,000-lane/64-interval-per-lane observation visited one lane and fewer than 64
  interval nodes. Focused verification passed 2 files and 8 tests, including 200
  property runs with seed `20260737`; `vp check` passed 79 formatted and 68
  lint/type-checked files.
- Corrected one test-only empty-lane height expectation from 10 to the accepted
  34-unit padding minimum; no runtime or architecture contract changed.
- The per-slice `mise run ci` checkpoint passed 28 test files and 117 tests plus the
  four-artifact package build.
- Selected the reproducible pure-kernel performance baseline as Slice 6.

### 2026-07-30 — M3 Slice 4 deterministic stacks and lane geometry

- Added validated stack metrics, lowest-available deterministic tracks, and exact
  variable outer lane heights with contiguous absolute geometry.
- Verified touching half-open intervals share tracks, overlaps do not, empty/minimum
  lanes remain usable, and stack count equals brute-force maximum concurrency.
- Focused verification passed 4 files and 12 tests, including 200 property runs with
  seed `20260736` and an explicit 256-way dense fixture; `vp check` passed 71
  formatted and 60 lint/type-checked files.
- The per-slice `mise run ci` checkpoint passed 26 test files and 109 tests plus the
  four-artifact package build.
- Selected immutable two-dimensional viewport indexing/query as Slice 5.

### 2026-07-30 — M3 Slice 3 placement interval resolution

- Added one pure task/explicit-segment instant interval boundary while preserving
  resolved identity, order, provenance, and input immutability.
- Isolated missing, all-day, non-finite, zero-width, and reversed interval failures to
  the affected placement with stable `layout.*` diagnostics.
- Focused verification passed 4 files and 13 tests, including 200 property runs with
  seed `20260735`; `vp check` passed 68 formatted and 57 lint/type-checked files.
- The per-slice `mise run ci` checkpoint passed 24 test files and 102 tests plus the
  four-artifact package build.
- Selected deterministic overlap stacks and variable lane geometry as Slice 4.

### 2026-07-30 — M3 Slice 2 deterministic view topology

- Added one immutable React-free document/project/resource/custom topology boundary
  with stable collision-safe view keys and canonical provenance.
- Preserved explicit source order and cross-family same-ID legality while rejecting
  ambiguous keys and custom lane topology.
- Isolated invalid task, segment, assignment, and assignment-compatibility references
  to the affected placement.
- Focused verification passed 2 files and 8 tests, including 150 property runs with
  seed `20260734`; `vp check` passed 65 formatted and 54 lint/type-checked files.
- The per-slice full CI rerun passed 22 test files and 97 tests plus the four-artifact
  package build after fixing one formatting-only drift.
- Selected task and explicit segment interval resolution as Slice 3.

### 2026-07-30 — M3 Slice 1 contract selected

- Accepted one data-only document/project/resource/custom view union and optional
  `GanttProps.view`, with document view remaining the default.
- Fixed collision-safe private view identity, explicit canonical provenance,
  placement-isolated source diagnostics, one instant interval per placement,
  deterministic `stack`, minimum outer lane heights, and renderer-neutral half-open
  viewport queries.
- Selected internal query-work evidence and a fixed-seed viewport-adjacent benchmark
  without a portable timing threshold or browser frame-rate claim.
- Documentation verification passed `vp check` across 61 formatted and 50
  lint/type-checked files, `git diff --check`, explicit existence/link checks, and a
  focused cross-document terminology read.
- The required per-slice `mise run ci` checkpoint passed 20 test files and 89 tests
  and built all four package artifacts.
- Marked Slice 1 complete and selected deterministic view topology as Slice 2.

### 2026-07-30 — M3 implementation plan created

- Added the active
  [view, layout, and viewport kernel plan](plans/2026-07-30-view-layout-viewport-kernel-plan.md).
- Kept M3 not started while ordering nine reviewable slices: contract, view topology,
  interval resolution, overlap/variable-height layout, viewport indexing/query,
  performance evidence, scene composition, React/playground integration, and final
  facade/evidence.
- Scoped M3 to immutable React-free kernels plus read-only integration. Viewport
  session state, hit testing, interaction, hierarchy/filtering, calendar conversion,
  alternate overlap policies, and stable release thresholds remain later milestones.
- Selected a reproducible fixed-seed 10,000-task/2,000-lane benchmark and brute-force
  query parity as M3 performance evidence without making an unverified frame-rate or
  cross-machine CI-threshold claim.
- Planning-document verification passed `vp check` across 61 formatted and 50
  lint/type-checked files, `git diff --check`, and the focused linked-file existence
  checks.
- This documentation-only planning pass ran no source tests, benchmark, package build,
  playground build, or browser verification. Slice 1 contract evidence is the next
  action.

### 2026-07-30 — M2 change kernel complete

- Exposed one stable root facade for typed commands, versioned domain patches,
  collection-qualified affected references, transactions, and bounded local history.
- Documented ergonomic input normalization, explicit clears, committed/rejected/no-op
  outcomes, direct inverses, revision preservation, persistence ownership, and M2
  exclusions.
- The root-facade test passed 2 files and 7 tests. `mise run ci` passed clean checks,
  20 test files and 89 tests, and a four-artifact package build.
- `mise run build-playground` transformed 38 modules successfully. Packed declaration
  and runtime export inspection found the intentional facade, no private declaration
  exports, and no property-test runtime dependency.
- Browser verification was not applicable because no React renderer, scene, style,
  playground source, route output, or serialized scene input changed.
- Marked M2 complete only after the final evidence gate and selected detailed M3
  view/layout/viewport planning as the next action.

### 2026-07-30 — M2 Slice 6 bounded local history

- Added explicit-capacity immutable history state with commit, undo, redo, and clear
  operations over committed patch and inverse pairs.
- Only non-empty committed outcomes enter history; transactions are one step, oldest
  entries trim deterministically, and a new branch clears redo state.
- Undo and redo reuse atomic patch application. Stale application rejects without
  changing the present document or either history stack.
- Capacity, branching, grouped transactions, extension data, cross-family identity,
  assignment cleanup, cascade restoration, and input immutability are covered.
- The history property ran 100 examples with seed `20260733`. Focused verification
  passed 2 files and 10 tests; `vp check` passed 60 formatted and 49 lint/type-checked
  files with no warnings or errors.
- Selected the intentional facade, README contract, packed inspection, and final M2
  gate as Slice 7.

### 2026-07-30 — M2 Slice 5 atomic transactions

- Added ordered recursive transactions by composing children through the single
  command reducer and atomic patch interpreter.
- Forward patches flatten in encounter order, inverse child groups reverse, and
  affected references retain deterministic first-touch ordering.
- First, middle, last, and nested child failures retain the original document and
  expose stable transaction-indexed diagnostic paths with empty change arrays.
- Empty and semantically unchanged transactions collapse to identity-preserving
  committed no-ops; cross-command references and cascade/recreate flows commit as one
  outcome.
- The transaction property ran 150 examples with seed `20260732`. Focused verification
  passed 2 files and 8 tests; `vp check` passed 57 formatted and 46 lint/type-checked
  files with no warnings or errors.
- Selected bounded immutable local history as Slice 6.

### 2026-07-30 — M2 Slice 4 referential deletion

- Added task, assignment, placement, and dependency deletion through the single
  command and atomic patch authorities.
- Task deletion rejects dependent state by default and `cascade: true` removes the
  visited subtree plus owned or incident relationships in canonical document order.
- Assignment deletion preserves placements by replacing them without the optional
  assignment reference; direct inverses restore exact order and bytes.
- Cross-family same-ID examples, cyclic malformed ancestry termination, untouched
  identity, and generated wide/deep tree inversion are covered.
- The cascade property ran 150 examples with seed `20260731`. Focused verification
  passed 3 files and 9 tests; `vp check` passed 55 formatted and 44 lint/type-checked
  files with no warnings or errors.
- Selected ordered atomic transactions as Slice 5.

### 2026-07-30 — M2 Slice 3 typed non-delete commands

- Added typed ergonomic task, resource, lane, assignment, placement, and dependency
  commands with canonical string update targets and explicit `null` clears.
- Shared the existing M1 record decoders through a private record-normalization entry
  point while leaving document recovery diagnostics and source paths unchanged.
- Commands reject unknown fields, malformed values, immutable IDs, duplicate or
  missing targets, and strict reference failures without exposing partial candidates.
- Reducer patches replay the returned document and inverses restore stable bytes;
  deterministic no-ops retain the document by identity and mutable payloads are not
  retained.
- Focused verification passed 5 files and 25 tests. `vp check` passed formatting for
  53 files and lint/type checking for 42 files with no warnings or errors.
- Selected referential deletion and deterministic task cascade as Slice 4.

### 2026-07-30 — M2 Slice 2 atomic domain patches

- Added one versioned collection-plus-ID patch interpreter for add, replace, and
  remove across all six canonical collections.
- Atomic final-state integrity validation rejects malformed, stale, duplicate, or
  referentially invalid batches while retaining the original document by identity.
- Ready-to-apply inverses restore byte-identical stable serialization and preserve
  collection order, revision, metadata, and untouched identities.
- Added exact development dependency `fast-check@4.9.0`; the inversion property ran
  200 examples with seed `20260730` and replay seed/path reporting on failure.
- Focused verification passed 3 files and 5 tests. `vp check` passed formatting for
  50 files and lint/type checking for 39 files with no warnings or errors.
- Selected typed non-delete command normalization and reduction as Slice 3.

### 2026-07-30 — Community and Pro distribution contract

- Accepted the
  [Community and Pro distribution and licensing decision](decisions/2026-07-30-community-pro-distribution-licensing.md):
  one public mixed-license monorepo, MIT Community plus one additive commercial Pro
  npm package, synchronized versions, strict compatibility, and signed offline
  activation.
- Fixed commercial entitlement to package release dates: entitled versions continue
  to build and run after the update window closes, while later releases and support
  require renewal.
- Rejected launch-time private-registry credentials, production call-home, deployment
  binding, a replacement Pro component, and separately purchased Pro modules.
- Added the
  [cross-milestone implementation plan](plans/2026-07-30-community-pro-distribution-licensing-plan.md)
  for package licensing, activation, additive Pro packaging, synchronized publishing,
  and entitlement-continuity evidence.
- Documentation verification passed `vp check` across 44 formatted and 33
  lint/type-checked files, `git diff --check`, explicit linked-file existence checks,
  and focused four-document contract searches.
- This documentation-only decision does not change M2 status, implementation scope,
  runtime behavior, package contents, dependencies, or the current next action.

### 2026-07-30 — M2 plan and change-kernel contract

- Created and activated the
  [M2 implementation plan](plans/2026-07-30-change-kernel-plan.md), splitting the
  milestone into patch, command, deletion, transaction, history, facade, and
  final-evidence slices.
- Accepted the
  [change-kernel contract](decisions/2026-07-30-change-kernel-contract.md): one
  versioned ID-keyed domain patch format, ready-to-apply inverse patches, strict
  non-repairing command validation, ordered atomic transactions, revision-preserving
  local changes, and bounded immutable history.
- Replaced the architecture sketch's raw affected-ID list with collection-qualified
  entity references because M1 permits the same ID in multiple entity families.
- Moved M2 to in progress and selected the atomic patch interpreter plus seeded
  inversion properties as the next runtime slice.
- Slice 1 verification passed with `git diff --check`, linked-file existence checks,
  and a focused architecture/decision/plan/roadmap consistency read.
- This planning slice changes documentation only; no M2 runtime, dependency, test,
  package, or browser behavior is yet verified.

### 2026-07-30 — M1 Slice 7 milestone completion

- Documented the public wire-versus-normalized parse/serialize flow in `README.md`.
- `mise run ci` passed clean format/lint/type checking, 10 test files and 57 tests,
  and the package build; `mise run build-playground` transformed 32 modules
  successfully.
- Chrome DevTools `list_pages` timed out, so the plan-authorized built-in Browser
  fallback performed a connected inspection of `/` and `/matrix` at all three
  required viewports.
- The browser gate found aligned headers/lanes/timelines, no horizontal page overflow,
  zero unexpected diagnostics, unchanged entity identities, complete accessible
  regions/groups/task names, empty console logs, and correct light/dark/high-contrast,
  overlap, clipped, compact, and empty scenarios. Both routes and both observed Vite
  assets returned HTTP `200`.
- `git diff --check`, explicit existence checks for architecture, roadmap, completed
  plan, decision record, and README, and the focused cross-document completion/link
  read all passed.
- Marked M1 complete only after final evidence and selected M2 planning as the next
  action.

### 2026-07-30 — M1 Slice 6 scene convergence

- Converged scene construction on the model validator and one `DocumentIndexes`
  instance, leaving only genuinely render-specific schedule diagnostics in the
  renderer.
- Removed the temporary M0 record index/diagnostic helpers and
  `RenderDiagnostic` compatibility alias.
- Exported the intentional parser, serializer, result, normalized model, JSON, and
  diagnostic contracts while keeping migrations, validation, indexing, and scene
  internals private in the packed declaration.
- Render/facade tests passed 11 tests, `vp check` passed cleanly, `vp pack` produced
  the package artifacts, and `vp build apps/playground` built 32 modules successfully.
- Selected documentation and the final automated/browser evidence gate as the next
  slice.

### 2026-07-30 — M1 Slice 5 stable serialization

- Added deterministic current-schema serialization with fixed known-key order,
  preserved domain arrays, recursively lexical extension keys, and defensive
  non-JSON rejection.
- Added the React-free full-domain
  `parse -> validate -> index -> serialize -> parse -> validate -> index` proof,
  including numeric IDs, negative epochs, instant/all-day schedules, task segments,
  Unicode, nested metadata, and every M1 relationship family.
- The serializer suite passed 8 tests, the round-trip suite passed its end-to-end
  test, and `vp check` passed repository formatting, lint, and type checking with no
  warnings after focused formatting and one literal-schema lint correction.
- Selected scene and public-facade convergence as the next slice.

### 2026-07-30 — M1 Slice 4 integrity and indexes

- Added source-path-preserving referential validation. Invalid primary parent/resource
  links are cleared while invalid assignments, placements, and dependencies are
  omitted without removing unrelated valid records.
- Added deterministic primary, hierarchy, segment, assignment, placement, and
  dependency indexes that derive lookup state without filtering or diagnostics.
- Validation and index suites each passed 4 tests, the upstream 16-test codec suite
  remained green, and `vp check` passed repository formatting, lint, and type
  checking after formatting the changed model files.
- Selected stable serialization and the full-domain round trip as the next slice.

### 2026-07-30 — M1 Slice 3 wire codec

- Added fatal root/schema inspection and the explicit empty ordered migration registry
  for the first published schema.
- Added the schema-version-1 decoder with numeric/string ID normalization,
  explicit-offset instant parsing, strict all-day dates, JSON extension cloning,
  canonical defaults, unknown-property warnings, first-seen duplicate recovery, and
  path-aware diagnostics.
- Codec tests passed 16 cases, migration tests passed 9 cases, and `vp check` passed
  formatting, lint, and type checking across the repository after formatting the two
  new codec files.
- Selected referential integrity and stable full-document indexes as the next slice.

### 2026-07-30 — M1 Slice 2 normalized model

- Added the model-owned structured diagnostic contract and JSON-compatible value
  types.
- Expanded the normalized document to tasks, resources, lanes, assignments,
  placements, dependencies, and task segments with required readonly collection
  arrays.
- Adapted the existing renderer and public facade to the general diagnostics and
  normalized types without changing scene output; the render diagnostic name remains
  a temporary compatibility alias until Slice 6.
- Focused model/facade tests passed with 7 tests, and `vp check` passed formatting,
  lint, and type checking across the repository.
- Selected the versioned wire codec and scalar normalization as the next slice.

### 2026-07-30 — M1 Slice 1 codec contract

- Accepted the
  [document codec contract](decisions/2026-07-30-document-codec-contract.md), choosing
  a small internal schema-version-1 codec without a runtime dependency.
- Fixed wire ID/date rules, fatal and recoverable boundaries, unknown and duplicate
  handling, the empty initial migration registry, public parse/serialize shape, and
  stable JSON ordering.
- Moved M1 to in progress and selected normalized diagnostics and record contracts as
  the next slice.
- Verification passed with `git diff --check`, explicit existence checks for the four
  linked documents, and a focused cross-document codec/next-slice consistency read.
- No runtime behavior changed in this slice.

### 2026-07-30 — Commit-message convention

- Named Conventional Commits as the repository commit-message convention and
  required it for every commit in `AGENTS.md`.
- This policy change is owned by Slice 3 of
  [`2026-07-30-roadmap-documentation-governance-plan.md`](plans/2026-07-30-roadmap-documentation-governance-plan.md).
- Verification passed with `git diff --check`, a focused cross-document policy
  search, and inspection of recent commit subjects.
- No milestone order, product scope, or architecture contract changes.

### 2026-07-30 — M1 document-kernel plan

- Created the detailed M1 implementation plan and linked it as the active plan.
- Split the milestone into decision, model/diagnostic, codec/migration,
  integrity/index, serialization/round-trip, renderer-convergence, and final-evidence
  slices.
- Kept M1 at `[ ]` because planning did not implement or verify runtime behavior.
- Selected the codec contract and decision record as the actionable first slice.
- Planning validation passed with `git diff --check`, explicit linked-file existence
  checks, and focused roadmap/plan status and final-gate consistency checks.

### 2026-07-30 — Initial roadmap

- Recorded the completed read-only chart primitives baseline as M0.
- Mapped architecture Slices 1–6 into smaller execution milestones M1–M7.
- Selected the document kernel as the immediate next milestone.
- Recorded the rule that every repository change and deviation updates both its
  active plan and this roadmap.
- This governance change is owned by
  [`2026-07-30-roadmap-documentation-governance-plan.md`](plans/2026-07-30-roadmap-documentation-governance-plan.md).
- Governance verification passed with `git diff --check`, explicit linked-file
  existence checks, and a cross-document ownership/synchronization consistency check.
