# Gantempo Roadmap

Status: Active execution roadmap
Last updated: 2026-07-30

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

## Milestone Map

| Milestone | Architecture mapping | Outcome | Status | Detailed plan |
| --- | --- | --- | --- | --- |
| M0: Read-only chart primitives | First vertical subset of Slice 2 | Real time-based lanes and task bars render through one public React path | `[x]` | [Completed plan](plans/2026-07-30-simplest-chart-primitives-plan.md) |
| M1: Document kernel | Slice 1 foundation | Canonical records can be normalized, validated, indexed, migrated, and serialized without React | `[x]` | [Completed plan](plans/2026-07-30-document-kernel-foundation-plan.md) |
| M2: Change kernel | Remainder of Slice 1 | Typed commands produce deterministic patches, inverse patches, transactions, and local history | `[x]` | [Completed plan](plans/2026-07-30-change-kernel-plan.md) |
| M3: View, layout, and viewport kernel | Remainder of Slice 2 | Resolved views, overlap stacking, variable lane heights, and two-dimensional viewport queries feed render primitives | `[x]` | [Completed plan](plans/2026-07-30-view-layout-viewport-kernel-plan.md) |
| M4: Interaction runtime and public API | Slice 3 | Controlled and uncontrolled applications use the same command path as pointer, touch, and keyboard interaction | `[-]` | [Active plan](plans/2026-07-30-interaction-runtime-public-api-plan.md) |
| M5: Basic project Gantt | Slice 4 | Hierarchy, summaries, milestones, dependencies, zoom, filtering, localization, and SSR form a complete free Gantt | `[ ]` | Not yet created |
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
M4 interaction runtime
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
architecture Slice 1, and M3 completes architecture Slice 2 with pure view, layout,
viewport, and read-only rendering foundations. M4 is in progress: its public contract,
semantic task-command foundation, React-free ownership store, async command/history
lifecycle, staged derivation, measured viewport model, renderer-independent
interaction intent, runtime-backed React facade, and pointer/pen/touch direct
manipulation plus keyboard/focus/accessibility parity are complete; bounded typed
customization, menus, tooltip, columns, and instant-task editing are complete;
consumer proof, facade hardening, and M4 closure are next.

## Current Focus

### M4: Interaction runtime and public API

**Status:** `[-]` In progress; Slices 1–10 complete, Slice 11 next

**Target outcome**

Give controlled and uncontrolled applications the same command path as pointer,
touch, keyboard, toolbar, and imperative interaction while keeping document, session,
and derived state separate. Expose one immutable persistence-ready change envelope
while keeping local controlled acknowledgement independent from asynchronous backend
persistence.

**Verified prerequisites**

- M1 supplies the canonical document, diagnostics, persistence, and indexes.
- M2 supplies strict commands, patches/inverses, transactions, affected references,
  and bounded history.
- M3 supplies stable view/provenance identity, absolute variable geometry, reusable
  viewport indexes, semantic primitives, and one read-only React renderer.

**Next action**

Execute Slice 11 of the
[M4 interaction runtime and public API plan](plans/2026-07-30-interaction-runtime-public-api-plan.md).
The
[interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md)
pure instant-only `task.move`/`task.resize` foundation, React-free ownership store,
async command/history lifecycle, private derived pipeline, affected-reference
invalidation/work observations, measured vertical viewport/overscan publication,
renderer-independent hit testing, navigation, gesture intent, command mapping,
previews, the per-instance React facade, pointer/pen/touch workflows, and
keyboard/focus/assistive-technology parity plus typed content/class/column
customization and accessible tooltip/menu/editor CRUD are verified. Consolidate the
playground and direct React/external-store consumer proofs, add the API-shaped
persistence debug seam, harden the facade/documentation, and record M4 completion
evidence before the separate final gates.

**Queued M4 appendix**

After the base M4 implementation and both final gates close, execute the
[item properties, semantic color, and progress appendix](plans/2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md).
The appendix adds task and lane semantic variants, coordinated progress rendering and
editing, and a bounded standard properties surface without inserting scope into the
active M4 slices.

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
- Every repository change and every discovered deviation must be recorded in the
  active detailed plan and reflected in this roadmap in the same change set.

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
The repository, package, activation, release, deployment, and update-entitlement
decisions for Community and Pro are recorded in the
[Community and Pro distribution and licensing decision](decisions/2026-07-30-community-pro-distribution-licensing.md).

1. The threshold for splitting internal modules into workspace packages.
2. The measured threshold for revisiting the M1 internal codec in favor of a runtime
   schema dependency.

Decision records should live under `docs/decisions/` when their consequences cross
more than one implementation plan.

## Roadmap Change Log

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
