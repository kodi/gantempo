# View, Layout, and Viewport Kernel Implementation Plan

## Summary

Complete roadmap milestone M3 by turning the current document-only, fixed-row scene
builder into a pure, deterministic pipeline with three independently testable
boundaries:

1. a view resolver that maps the canonical document into document, project, resource,
   or application-defined lanes and placement references;
2. a layout kernel that resolves renderable intervals, stacks overlaps, and computes
   effective variable lane heights;
3. a viewport kernel that indexes the completed layout once and answers repeated
   horizontal-plus-vertical visibility queries without scanning the full document.

The existing read-only DOM/SVG chart remains the regression baseline. M3 should make
the new kernels real consumers of the canonical M1 document and feed their output into
the existing semantic primitive and React path. It must not start M4 interaction,
viewport-session ownership, or a second renderer.

This plan is the working handoff for M3. It records the intended contracts, ordered
implementation slices, verification boundaries, performance evidence, deviations,
and actionable next work. Architecture-level contract decisions are fixed by the
[M3 view, layout, and viewport kernel contract](../decisions/2026-07-30-view-layout-viewport-kernel-contract.md)
recorded in Slice 1 and synchronized with `docs/ARCHITECTURE.md`.

## Target State

At the end of this plan:

- One React-free view boundary produces deterministic lane and placement topology for:
  - the current persisted-lane/persisted-placement document view;
  - a flat project view with one task-backed lane per task;
  - a flat resource view with resource-backed lanes and assignment-derived
    placements;
  - application-defined, data-only lane and placement descriptors.
- Resolved lanes and placements retain stable view identity and explicit provenance
  back to canonical task, resource, assignment, lane, placement, and segment IDs where
  those sources exist.
- One resolved placement represents one renderable half-open instant interval. An
  explicit segment placement resolves the referenced segment interval; an ordinary
  placement resolves the task interval.
- Invalid or unsupported individual intervals produce structured diagnostics without
  invalidating unrelated lanes or placements.
- Overlapping intervals use a deterministic `stack` layout. Touching intervals do not
  overlap, subrow assignment is stable, and each lane reports an effective height
  derived from its minimum height, padding, bar metrics, gap, and stack depth.
- A reusable viewport index contains variable-height lane prefix data and an augmented
  interval index. Repeated queries accept an explicit time range and vertical range,
  then return only intersecting lanes and bars plus complete content bounds.
- Ordinary viewport queries do not perform work proportional to all lanes or all
  placements. Exact indexed-query parity is checked against a brute-force oracle, and
  a fixed-seed 10,000-task/2,000-lane benchmark records the M3 baseline without
  claiming a stable CI threshold.
- `buildChartScene` composes the view, layout, and viewport kernels instead of owning
  record lookup and fixed-row placement math itself.
- `<Gantt>` keeps the existing document view as its default and can select the
  read-only M3 view definition accepted in Slice 1 without taking ownership of
  scrolling, zooming, selection, focus, drag state, or command dispatch.
- The playground proves persisted document, project, resource, application-defined,
  dense-overlap, variable-height, clipped, empty, compact, dark, and high-contrast
  paths through the real component.
- Pure tests, seeded properties, the performance baseline, root-facade tests, package
  output, the production playground build, responsive browser inspection, and the
  full repository gate are recorded before M3 is marked complete.

## Decisions

These are the implementation direction for M3. Slice 1 must sharpen the type names,
diagnostic codes, identity rules, and public/private boundary in a decision record
before runtime code makes them accidental contracts.

### 1. Keep four pure stages with one-way data flow

Use the architecture pipeline directly:

```text
canonical document + data-only view definition
  -> resolved view topology
  -> resolved instant intervals
  -> overlap and variable-height lane layout
  -> reusable viewport index

viewport time range + vertical range
  -> visible layout query
  -> semantic render primitives
  -> renderer
```

View resolution must not emit pixels. Layout must not generate React, SVG, DOM, or
formatted labels. Viewport queries must not mutate or silently rebuild the document,
view, or layout. The renderer must not rediscover placement relationships or choose an
overlap policy.

### 2. Use data-only view definitions and one normalized result

The M3 direction is one discriminated view definition with four cases:

- `document`: canonical lane collection order plus persisted placements;
- `project`: canonical task collection order, one derived task-backed lane per task,
  and one task-backed placement where a renderable task interval exists;
- `resource`: canonical resource collection order plus assignment-derived task
  placements in the assignment's resource lane;
- `custom`: caller-supplied immutable lane descriptors and placement references with
  required stable view keys.

The custom case is data, not a function retained in persistent state. Applications may
compute that data with their own grouping, filtering, and sorting logic before calling
the kernel. M4 can later decide whether the React API also accepts a resolver callback;
M3 does not serialize functions or store them in `GanttDocument`.

The resolver must produce the same normalized `ResolvedView` shape for every case.
Downstream layout and viewport code must not branch on the originating view kind.

### 3. Separate view identity from canonical entity identity

Derived and application-defined lanes and placements are not document entities.
Introduce an opaque string view-key type rather than pretending every resolved item is
a persisted `EntityId`.

Each resolved item carries:

- a stable view key unique within its resolved collection;
- its deterministic source order;
- explicit source provenance when backed by canonical records;
- the canonical task ID for every placement;
- optional canonical lane, resource, assignment, placement, and segment IDs where
  applicable.

Generated keys must be namespaced by view kind and source family so legal cross-family
ID reuse cannot collide. Custom definitions must provide their own keys. Duplicate
view keys reject that view result with structured diagnostics; they are not repaired
by renaming.

Document-view keys must preserve the existing lane and placement IDs in their
provenance and DOM data attributes. The renderer may add an always-present view-key
attribute, but it must not remove persisted identity attributes from the baseline.

### 4. Keep M3 view ordering deliberately flat

M3 preserves explicit sequence rather than inventing hierarchy behavior:

- document view follows canonical `document.lanes` and `document.placements` order;
- project view follows canonical `document.tasks` order;
- resource view follows canonical `document.resources` and
  `document.assignments` order;
- custom view follows caller-provided order.

`parentId`, `order`, expansion state, filtering, and sorting do not implicitly reorder
M3 views. M5 owns task/lane hierarchy, summary behavior, disclosure state, filtering,
and sorting. The M3 contract must allow M5 to supply a flattened ordered view later
without changing layout or viewport types.

### 5. Resolve exactly one instant interval per layout placement

M3 layout operates on half-open epoch-millisecond intervals `[start, end)`:

- a placement with `segmentId` resolves that task segment's schedule;
- a placement without `segmentId` resolves the task schedule;
- a project-derived placement resolves the task schedule;
- a resource-derived placement resolves the assigned task schedule;
- a custom placement explicitly chooses its task and optional segment source.

Built-in project and resource views do not automatically expand all task segments.
That would create display policy not present in the view definition. Applications can
request segment-backed custom placements, and a later project-view policy can add
automatic split-task expansion without changing the one-placement/one-interval layout
contract.

Only canonical instant schedules are renderable in M3. Converting all-day schedules
requires explicit calendar and time-zone semantics and remains M5/M6 work. Missing,
all-day, non-finite, reversed, or zero-width intervals omit only the affected resolved
placement and return a stable diagnostic. Existing M0 diagnostic meaning should be
preserved or migrated explicitly in Slice 1.

### 6. Implement deterministic `stack` before other overlap policies

M3 implements one overlap policy: `stack`.

- Touching half-open intervals can share a track.
- Overlapping intervals take the lowest available track.
- Track assignment uses a deterministic working order: interval start, interval end,
  source order, then stable view key.
- Final lane and placement output remains in resolved-view order unless a primitive
  contract explicitly requires a different paint order.
- The assigned track count must equal the maximum concurrent interval count for the
  lane.

The effective lane height is:

```text
max(
  resolved lane minimum height,
  top padding + bottom padding
    + stack count * bar height
    + max(0, stack count - 1) * stack gap
)
```

An empty lane still occupies its validated minimum height. Persisted `LaneRecord.height`
and custom lane minimum heights are minimums, not fixed heights that may clip a stack.
Project and resource lanes use the configured default minimum.

`overlay`, `compress`, `reject`, and capability-supplied policies remain out of M3.
`reject` also requires command/interaction semantics and must not be simulated by
dropping bars during layout.

### 7. Build once, query many times

Create an immutable viewport kernel from completed lane layout:

- variable-height lane offsets use cumulative heights and binary-searchable prefix
  data;
- interval visibility uses an augmented interval index that can find all half-open
  intersections without scanning every earlier-starting long interval;
- the kernel retains complete content height and lane/view identity;
- the kernel does not cache prior query result arrays or retain unbounded primitives.

A viewport query receives:

- an explicit valid `TimeRange`;
- a finite non-negative vertical start;
- a finite positive vertical extent.

The query returns intersecting lanes, bars, their absolute vertical coordinates,
content bounds, and stable keys/provenance. Horizontal coordinates are normalized to
the query time range when primitive generation occurs, preserving the responsive M0
renderer contract.

Overscan is caller policy. M4 may expand the requested time and vertical ranges
differently for steady scrolling, dragging, or focus retention. M3 must not embed
scroll velocity or interaction state in the pure query.

### 8. Keep viewport session state and hit testing out of M3

M3 owns visibility math, not:

- `scrollTop`, measured element size, resize observers, or scroll listeners;
- zoom level or pan commands;
- selection, focus, drag preview, editor state, or announcements;
- hit testing or a visible-item spatial index for pointer interaction;
- command interception or affected-reference cache orchestration.

Those are M4 runtime concerns. M3 must expose stable identity, absolute geometry, and
an immutable queryable index so M4 can add those concerns without replacing the
kernel.

### 9. Treat performance evidence as a reproducible baseline, not a release claim

M3 must prove indexed-query behavior in two ways:

1. deterministic/property tests compare every indexed result with a brute-force
   oracle and inspect internal query-work counters in test or benchmark code;
2. a Vitest benchmark with a fixed generator version and seed covers at least
   10,000 tasks, 2,000 lanes, sparse and dense overlap, cold kernel construction, and
   repeated warm viewport queries.

Record Node/Vite+/Vitest versions, seed, document and visible counts, view kind,
benchmark mode, hardware profile, and result distribution in this plan.

Do not set a cross-machine wall-clock CI threshold in M3 and do not claim 60 FPS,
drag-frame latency, canvas density, or release-grade regression protection. M7 owns
versioned benchmark artifacts and stable-environment thresholds. M3 may add the
repeatable benchmark source that M7 will later promote.

## Scope

### In scope

- React-free view, layout, and viewport modules.
- Stable internal contracts for:
  - data-only document, project, resource, and custom view definitions;
  - resolved view lanes and placements;
  - source provenance and view keys;
  - resolved instant intervals and diagnostics;
  - stack assignments and effective lane geometry;
  - immutable viewport indexes and query results.
- Persisted document-view parity with the current M0 scene.
- Flat task-backed project lanes.
- Flat resource-backed lanes and assignment-derived placements.
- Application-defined lanes and task/segment placement references.
- Explicit segment placement interval resolution.
- Deterministic overlap stacking and variable lane heights.
- Vertical prefix lookup and horizontal interval intersection.
- Recomposition of scene primitives from a viewport query.
- A narrow read-only React view selector if Slice 1 proves it is required by the real
  playground consumers.
- Seeded property tests and fixed-seed performance fixtures.
- A repeatable M3 viewport benchmark without stable CI timing thresholds.
- Playground and responsive browser coverage for the new rendered cases.
- README, package-facade, architecture/decision/roadmap/plan synchronization, and final
  completion evidence.

### Out of scope

- Task/lane tree flattening, expansion, summary rows, milestones, filtering, sorting,
  dependency geometry, or dependency rendering.
- Automatic expansion of split-task segments in built-in views.
- All-day-to-instant conversion, working calendars, time-zone scheduling, adaptive
  ticks, non-linear scales, zoom levels, or RTL behavior.
- `overlay`, `compress`, `reject`, or capability-provided overlap policies.
- Pointer, touch, keyboard, drag, resize, selection, focus, editing, announcements,
  hit testing, menus, tooltips, or commands triggered by UI.
- Controlled/uncontrolled runtime ownership, viewport subscriptions, imperative
  handles, or persistence orchestration.
- DOM measurement, scroll orchestration, resize observers, scroll velocity, or
  interaction-specific overscan.
- Incremental re-resolution from M2 affected references. M3 produces immutable,
  reusable kernels; M4 owns runtime cache invalidation and may use M2 references.
- Canvas rendering, workers, Pro capabilities, export, or release automation.
- Workspace package splitting.
- Stable cross-machine benchmark thresholds or release performance claims.

## Current State

Observed at planning time on `main` at
`0170c1d4281352ea43e04c1422ad7eb197281931`:

- The worktree was clean before this plan and roadmap synchronization.
- M1 and M2 are complete. The public package exposes the canonical six-domain
  document, codec, serializer, typed command/patch kernel, atomic transactions, and
  bounded local history.
- `packages/gantt/src/model/types.ts` already separates tasks, resources, lanes,
  assignments, placements, dependencies, and task segments. `LaneRecord` has optional
  `parentId`, `resourceId`, `order`, and `height`.
- `packages/gantt/src/model/indexes.ts` already provides deterministic primary,
  relationship, task-child, resource-child, lane-child, assignment, placement, and
  segment lookup maps.
- `packages/gantt/src/render/build-chart-scene.ts` currently performs validation,
  document indexing, lane mapping, task/placement interval resolution, horizontal
  clipping, fixed-row vertical positioning, tick generation, and primitive assembly
  in one function.
- The scene builder iterates every document lane and every persisted placement for
  each build. It has no view definition, resolved-view contract, overlap stack,
  variable lane prefix data, interval index, or two-dimensional query.
- All lanes currently use `metrics.rowHeight`; `LaneRecord.height` is ignored.
- All bars in a lane are vertically centered at the same coordinate. The playground's
  resource-overlap case contains multiple entries in a lane but does not contain
  overlapping time intervals that prove stack behavior.
- Only persisted lanes and persisted placements render. Resources and assignments do
  not derive a resource view, tasks do not derive a project view, and there is no
  application-defined view input.
- Task-level instant schedules render. All-day schedules and segment-backed
  placements currently produce no specialized resolution path.
- `ChartScene` carries complete lane and bar arrays. Its horizontal coordinates are
  normalized to `[0, 1]`; vertical geometry uses layout units.
- `packages/gantt/src/react/Gantt.tsx` memoizes one complete scene from the canonical
  document and range. It renders every lane and task primitive and owns no viewport
  session state.
- The root facade exports `Gantt` and `GanttProps` but keeps indexes, time helpers,
  scene primitives, and scene construction private.
- `/` and `/matrix` are the established visual regression surfaces. Prior verified
  evidence covers 1440 × 900, 900 × 900, and 560 × 900 with aligned responsive
  geometry, accessible named chart regions/task images, zero diagnostics, and no
  console errors.
- `fast-check@4.9.0` is already an exact development dependency and is used by M2
  property suites.
- Vite+ supports `vp test bench`; the local command resolves to Vitest `4.1.10`.
- No benchmark source or benchmark task exists in the repository.

This documentation-only planning pass does not verify current runtime behavior anew.
No source test, package build, benchmark, playground build, or browser matrix is
marked complete by this plan.

## Behavior to Preserve

- The canonical M1 document remains the only persistent source of truth. Views,
  resolved placements, stacks, indexes, and primitives remain derived data.
- Task, resource, assignment, lane, placement, and segment identities remain separate.
- Cross-family duplicate entity IDs remain legal.
- The document view preserves canonical lane/placement order and current task-bar
  identity, titles, clipping, diagnostics, and empty-state behavior.
- The half-open interval rule remains `[start, end)`.
- Existing fixed elapsed-time tick generation, explicit locale/time-zone inputs, and
  responsive normalized horizontal coordinates remain unchanged unless Slice 1
  records a proven limitation.
- Invalid individual records or schedules do not remove unrelated valid output.
- Pure kernels never mutate caller-owned documents, view definitions, arrays, records,
  intervals, metrics, indexes, or query objects.
- Pure modules do not import React, DOM types, browser globals, playground code,
  current time, host locale defaults, or host time-zone defaults.
- The renderer consumes semantic primitives and does not perform view derivation,
  stacking, interval intersection, or scheduling.
- Existing `Gantt` document/range/time-zone/tick props remain valid. The document view
  stays the default when no M3 view selector is supplied.
- Existing package export paths, stylesheet export, scoped CSS tokens, theme/density
  behavior, DOM/SVG roles, accessible task names, and SSR-safe module imports remain
  intact.
- M2 command, patch, inverse, affected-reference, transaction, history, and packed
  facade behavior remain regression green.
- `revision`, metadata, and canonical document arrays are not changed by view or
  layout work.

## Implementation Shape

Slice 1 fixed the public/private boundary and namespacing semantics. Implementation
should converge on a shape equivalent to:

```ts
type GanttViewDefinition =
  | { readonly kind: "document" }
  | { readonly kind: "project" }
  | { readonly kind: "resource" }
  | {
      readonly kind: "custom";
      readonly id: string;
      readonly lanes: readonly CustomViewLane[];
      readonly placements: readonly CustomViewPlacement[];
    };

interface ResolvedViewLane {
  readonly key: ViewLaneKey;
  readonly title: string;
  readonly sourceOrder: number;
  readonly minimumHeight?: number;
  readonly source: ViewLaneSource;
}

interface ResolvedViewPlacement {
  readonly key: ViewPlacementKey;
  readonly laneKey: ViewLaneKey;
  readonly taskId: EntityId;
  readonly segmentId?: EntityId;
  readonly assignmentId?: EntityId;
  readonly sourceOrder: number;
  readonly source: ViewPlacementSource;
}

interface ResolvedIntervalPlacement extends ResolvedViewPlacement {
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
}

interface LaidOutLane {
  readonly key: ViewLaneKey;
  readonly y: number;
  readonly height: number;
  readonly stackCount: number;
  readonly placements: readonly LaidOutPlacement[];
}

interface ViewportQuery {
  readonly timeRange: TimeRange;
  readonly verticalStart: number;
  readonly verticalExtent: number;
}
```

The view result should distinguish a fatal definition failure from recoverable
per-placement diagnostics. A duplicate lane key, missing placement lane, or malformed
custom descriptor makes the custom view ambiguous and should reject that view
definition. A missing or unsupported schedule omits only its placement from interval
layout.

Viewport construction should accept already laid-out lanes and produce an immutable
kernel. Primitive generation should accept one query result plus the existing tick,
locale, time-zone, and visual metric inputs. `buildChartScene` may remain as the
compatibility composer but should no longer contain document relationship lookup,
stacking, or visibility scans.

## Cross-Slice Rules

- Update this plan and `docs/ROADMAP.md` in every M3 change set. Append dated findings
  and exact evidence; do not replace prior notes.
- Update `docs/ARCHITECTURE.md` and the M3 decision record in the same change set if
  evidence changes view identity, derivation, interval resolution, overlap semantics,
  lane-height meaning, viewport coordinates, query complexity, public surface, or
  release acceptance criteria.
- Do not start a later slice until the active slice's focused tests and `vp check`
  pass and their exact outcomes are recorded.
- Do not mark a slice done from inspection, type checking, or benchmark output alone.
- Keep the document, project, resource, and custom cases behind one resolved-view
  contract. Do not fork layout or renderer implementations per view kind.
- Keep application-defined view input data-only and outside the canonical document.
- Preserve stable view keys and explicit canonical provenance through layout,
  viewport query, primitives, DOM attributes, diagnostics, and benchmark fixtures.
- Use canonical collection order or explicit custom order. Do not rely on `Map`
  insertion order created by an unrelated traversal.
- Keep half-open interval semantics in resolution, stacking, intersection, clipping,
  properties, and brute-force oracles.
- Never use array indexes as identity. Prefix positions and source-order indexes are
  derived coordinates only.
- Keep stack output deterministic under equal starts, equal ends, cross-family same
  IDs, empty lanes, and repeated calls.
- Validate all layout metrics and viewport query values. Programmer configuration
  errors should fail consistently; recoverable document/view item failures should
  return diagnostics.
- Build the viewport kernel only when document/view/layout inputs change. Repeated
  viewport queries must not rebuild view topology, stacking, prefix sums, or interval
  indexes.
- Keep benchmark generators deterministic and record seed, size, visible counts,
  runtime versions, and hardware. Do not turn local timing into a CI threshold.
- Keep M3 source free of React and browser dependencies except the existing React
  composer/renderer integration slice.
- Do not add scroll/zoom session ownership, hit testing, interaction overscan,
  commands, or selection while implementing visibility queries.
- Keep new internal contracts private until a real package consumer proves the
  minimum root facade. Do not export interval trees, prefix arrays, layout internals,
  benchmark helpers, or brute-force oracles.
- Any React, primitive, style, scenario, or playground output change triggers the
  connected Chrome DevTools matrix required by `AGENTS.md`. Record routes, viewports,
  accessibility-tree findings, console state, geometry checks, and fixes in this plan.

## Implementation Slices

### Slice 1: Freeze the M3 contract and decision record

Status: `[x]` Done

**Goal**

Turn the planning direction into one durable contract for resolved views, stable view
identity, interval resolution, stack ordering, lane-height calculation, viewport
coordinates, error semantics, benchmark evidence, and the minimum React facade.

**Why here**

View keys, generated placement rules, interval ownership, and vertical coordinates
flow through every later module. Changing them after code lands would rewrite tests,
DOM identity, application-defined inputs, and benchmark fixtures.

**This slice should implement**

- Add `docs/decisions/2026-07-30-view-layout-viewport-kernel-contract.md`.
- Resolve the open questions listed below.
- Define the accepted view variants and which types, if any, must be package-visible.
- Fix namespacing and provenance rules for document, project, resource, and custom
  view keys.
- Fix fatal-view versus recoverable-placement diagnostic behavior and stable codes.
- Fix interval source rules for tasks and explicit segments.
- Fix deterministic stack ordering, half-open edge behavior, metric validation, and
  lane-height formula.
- Fix the viewport query coordinate system, boundary inclusion, empty/out-of-bounds
  behavior, and query-work evidence.
- Decide whether `<Gantt view={...}>` is the minimum read-only public consumer or
  whether derived views remain internal until M4. The decision must still provide a
  real M3 integration proof.
- Link the decision from architecture, roadmap, and this plan.
- Update architecture only where the accepted contract is more specific than or
  changes the durable baseline.

**Expected output**

- A linked decision record that lets later slices implement without redefining core
  semantics.
- Updated architecture/roadmap/plan text with no runtime status advanced.

**Verification**

- `vp check`
- `git diff --check`
- Explicit linked-file existence checks.
- Focused read across architecture Section 6, Section 10, Section 18, the M3 decision,
  this plan, and the roadmap confirming compatible terminology, scope, and next work.
- No runtime test, package, benchmark, or browser claim for this docs-only slice.

**Dependencies**

- Verified M1 and M2 completion.
- Existing M0 read-only scene and renderer baseline.

### Slice 2: Resolve deterministic view topology

Status: `[x]` Done

**Goal**

Produce one immutable resolved lane/placement topology for document, flat project,
flat resource, and application-defined views without performing interval or pixel
layout.

**Why here**

Every later interval, stack, viewport, and primitive contract depends on stable lane
and placement keys plus canonical provenance.

**This slice should implement**

- Add the private view-definition, resolved-view, source-provenance, and result types.
- Implement document view from persisted lanes and placements in canonical order.
- Implement flat project view from tasks in canonical order.
- Implement flat resource view from resources and assignments in canonical order.
- Implement custom data-only view normalization.
- Validate unique keys, lane references, task/segment/assignment references, and
  assignment/task/resource compatibility without using codec repair as commit
  authority.
- Return fresh frozen results and diagnostics; never retain mutable custom input.
- Cover empty views, empty lanes, cross-family same IDs, duplicate custom keys,
  dangling references, repeated tasks, one task in multiple resource lanes, and
  document-view parity.
- Add a fixed-seed property that repeated resolution is deterministic, preserves input
  deep equality, and produces only valid lane references.

**Expected output**

- A renderer-independent `ResolvedView` boundary shared by all four view kinds.
- Focused example and property tests with recorded seed/run count/replay behavior.

**Verification**

- `vp test run packages/gantt/src/view`
- `vp check`
- `git diff --check`

Record exact test files, test count, property seed, run count, and any diagnostic
contract refinement before marking the slice done.

**Dependencies**

- Slice 1 complete and verified.

### Slice 3: Resolve placement intervals

Status: `[x]` Done

**Goal**

Convert resolved placement references into valid renderable instant intervals while
preserving stable identity, order, provenance, and unrelated usable output.

**Why here**

Stacking and interval indexing need one unambiguous interval representation. Keeping
record dereferencing out of those algorithms makes their properties independent of
the document codec.

**This slice should implement**

- Resolve task-level placements from canonical task schedules.
- Resolve explicit segment placements from the referenced task segment schedule.
- Preserve task, segment, assignment, persisted-placement, and view provenance.
- Apply half-open interval validation consistently.
- Emit focused diagnostics for missing task/segment sources, absent schedules,
  all-day schedules, non-finite boundaries, zero-width intervals, and reversed
  intervals.
- Keep valid sibling placements and empty lanes usable.
- Reconcile existing M0 render diagnostic codes and source/entity paths with the
  accepted decision; update the decision and architecture if evidence changes the
  contract.
- Add example and fixed-seed property coverage for task/segment selection,
  determinism, immutability, omission isolation, and valid output intervals.

**Expected output**

- A pure interval-resolution module consumed by stack layout.
- Diagnostics that remain useful before any primitive or React work runs.

**Verification**

- `vp test run packages/gantt/src/view packages/gantt/src/layout`
- `vp check`
- `git diff --check`

Record exact counts and property configuration.

**Dependencies**

- Slice 2 complete and verified.

### Slice 4: Deterministic overlap stacks and variable lane geometry

Status: `[x]` Done

**Goal**

Assign resolved intervals to deterministic tracks and compute exact effective lane
offsets and heights.

**Why here**

The viewport prefix index requires final lane heights, and render primitives require
stable absolute vertical geometry.

**This slice should implement**

- Add validated layout metrics for default minimum lane height, bar height, top/bottom
  padding, and stack gap.
- Treat persisted/custom height as a minimum and project/resource lanes as defaulted.
- Implement the lowest-available-track stack algorithm with the Slice 1 tie-break.
- Compute stack count, bar `y`/height, lane `y`/height, total content height, and
  immutable outputs.
- Preserve empty lanes and source order.
- Cover exact touching boundaries, nested intervals, equal boundaries, zero/one/many
  placements, dense overlap, explicit tall/short lane minimums, non-finite metrics,
  and repeated calls.
- Add a fixed-seed interval property asserting:
  - no two overlapping intervals share a track;
  - every track assignment is deterministic;
  - stack count equals brute-force maximum concurrency;
  - lane offsets are contiguous and total height is exact;
  - inputs remain unchanged.

**Expected output**

- A pure lane-layout module whose output contains complete variable-height geometry.
- No React, SVG, viewport, or view-kind branching.

**Verification**

- `vp test run packages/gantt/src/layout`
- `vp check`
- `git diff --check`

Record exact counts, property seed/run count, and the largest dense-overlap fixture.

**Dependencies**

- Slice 3 complete and verified.

### Slice 5: Immutable two-dimensional viewport index and query

Status: `[x]` Done

**Goal**

Build an immutable index once from completed layout and answer exact repeated
time-plus-vertical intersection queries without scanning the full layout.

**Why here**

Viewport behavior can be proven against pure layout before scene composition,
React measurement, or playground state obscures the algorithm.

**This slice should implement**

- Add binary-searchable variable-height lane prefix data.
- Add an augmented half-open interval index able to return long-running intervals
  that begin before the visible range.
- Implement validated viewport query input and immutable output.
- Return only intersecting lanes and bars, with absolute vertical geometry, stable
  keys/provenance, complete content bounds, and deterministic order.
- Define exact behavior for partially visible lanes, query boundaries, empty layouts,
  vertical ranges past content, and time ranges with no bars.
- Keep query-work counters internal to tests/benchmarks if they would enlarge the
  runtime/public contract.
- Add a brute-force oracle and fixed-seed properties across random lane heights,
  intervals, vertical windows, and time windows.
- Prove that one kernel can answer many queries without mutation, rebuild, or retained
  prior primitive arrays.

**Expected output**

- A pure reusable viewport kernel with exact indexed-query parity.
- Focused examples and property evidence for both dimensions.

**Verification**

- `vp test run packages/gantt/src/viewport`
- `vp check`
- `git diff --check`

Record exact counts, seeds, run counts, query-work observations, and replay syntax.

**Dependencies**

- Slice 4 complete and verified.

### Slice 6: Performance fixture and M3 viewport baseline

Status: `[x]` Done

**Goal**

Record reproducible evidence that warm viewport queries scale with visible/intersecting
output rather than the full benchmark document.

**Why here**

The benchmark must exercise the final pure view/layout/index/query path, but it should
run before React integration so renderer and browser costs are not confused with
kernel behavior.

**This slice should implement**

- Add a versioned fixed-seed benchmark generator.
- Cover at minimum:
  - 10,000 tasks and 2,000 lanes;
  - document and resource view construction;
  - sparse placement distribution;
  - dense per-lane overlap;
  - cold view/layout/index construction;
  - repeated warm horizontal, vertical, and diagonal viewport queries.
- Report generator version/seed, total and visible lane/placement counts, build mode,
  Node/Vite+/Vitest versions, hardware profile, and benchmark distributions.
- Compare indexed results with the brute-force oracle outside timed sections.
- Record internal query-work observations showing that unrelated lanes and intervals
  are not visited during ordinary warm queries.
- Avoid committing host-specific temporary JSON unless the decision record selects a
  stable result-artifact format.
- Do not add a wall-clock CI failure threshold.

**Expected output**

- A repeatable benchmark source suitable for later M7 promotion.
- M3 baseline evidence recorded in this plan and summarized in the roadmap.

**Verification**

- `vp test bench packages/gantt/src/viewport/view-layout-viewport.bench.ts --run`
- `vp test run packages/gantt/src/view packages/gantt/src/layout packages/gantt/src/viewport`
- `vp check`
- `git diff --check`

If the final benchmark path differs, update this plan before running it. Record the
exact accepted command and output rather than silently substituting a smaller fixture.

**Dependencies**

- Slice 5 complete and verified.
- A benchmark host profile that can be recorded honestly.

### Slice 7: Compose viewport-backed scene primitives

Status: `[x]` Done

**Goal**

Make the existing semantic scene boundary consume the M3 pipeline while preserving
document-view render behavior.

**Why here**

Pure contracts and performance are already proven, so scene changes can focus on
translation and regression rather than debugging view or intersection algorithms
through JSX.

**This slice should implement**

- Refactor `buildChartScene` into composition over view resolution, interval
  resolution, stack layout, viewport construction/query, time scale, ticks, and
  primitive translation.
- Extend lane and task primitives with stable view keys/provenance required by derived
  views while preserving existing document identity fields.
- Use query-relative normalized horizontal coordinates and absolute variable vertical
  coordinates.
- Derive bounds and separators from queried lane geometry rather than lane count and
  fixed row height.
- Preserve ticks, grid lines, clipping, empty state, diagnostics, task titles, and
  accessible interval data.
- Keep the default compatibility call equivalent to document view plus a full-height
  vertical query.
- Add direct scene tests for each view kind, stacked overlaps, variable heights,
  partial vertical visibility, horizontal clipping, diagnostics, immutability, and M0
  document-view parity.
- Do not add scroll listeners, DOM measurement, React state, or hit testing.

**Expected output**

- One semantic primitive path backed by the M3 kernels.
- The old record-lookup/fixed-row scene implementation removed rather than retained as
  a parallel fallback.

**Verification**

- `vp test run packages/gantt/src/view packages/gantt/src/layout packages/gantt/src/viewport packages/gantt/src/render`
- `vp test run packages/gantt/src/model packages/gantt/src/time packages/gantt/src/render`
- `vp check`
- `git diff --check`

Browser verification is not yet sufficient at this slice unless React or playground
output also changes; record applicability accurately.

**Dependencies**

- Slices 2 through 6 complete and verified.

### Slice 8: Read-only React and playground integration

Status: `[ ]` Not started

**Goal**

Prove document, project, resource, and application-defined views plus variable-height
stacking through the real component without starting M4 session or interaction work.

**Why here**

The renderer becomes a consumer of already-proven primitives. Visual fixes can remain
in React/CSS instead of leaking back into view, layout, or viewport semantics.

**This slice should implement**

- Add only the narrow read-only `Gantt` view selection accepted in Slice 1.
- Keep document view as the default and preserve all existing required props.
- Render variable-height lane rows, separators, task bars, and complete timeline
  bounds from scene geometry.
- Preserve full task names/dates in the accessibility tree and decorative-grid hiding.
- Add stable view-key attributes while retaining canonical task/lane/placement/
  assignment/resource provenance attributes where present.
- Keep CSS structural and token behavior scoped; avoid per-item runtime style
  injection beyond required geometry.
- Update playground scenarios so real component consumers prove:
  - persisted document view;
  - flat project view;
  - assignment-derived resource view with genuine overlap;
  - application-defined grouping;
  - explicit segment placement;
  - variable lane heights;
  - compact, dark, high-contrast, clipped, and empty cases.
- Keep Today/more-options controls disabled; do not add scrolling, zooming, selection,
  drag, resize, or editor behavior.
- Run connected Chrome DevTools inspection only on `/` and `/matrix` at 1440 × 900,
  900 × 900, and 560 × 900.
- Record visual alignment, lane/timeline height parity, overflow, clipping,
  accessibility-tree names/roles, duplicate announcements, console errors, network
  failures, and every issue fixed.

**Expected output**

- User-visible proof of all M3 view and stack paths through one component.
- Responsive visual/accessibility evidence without M4 behavior.

**Verification**

- `vp test run packages/gantt/src/index.test.tsx packages/gantt/src/render`
- `mise run build-playground`
- `vp check`
- Connected Chrome DevTools matrix for `/` and `/matrix` at the three required
  viewports.
- `git diff --check`

Record exact test/build counts, inspected routes and dimensions, accessibility and
console findings, screenshots or geometry observations, and any fixes before marking
the slice done.

**Dependencies**

- Slice 7 complete and verified.
- Chrome DevTools MCP can reach the running local playground.

### Slice 9: Intentional facade, documentation, and M3 completion evidence

Status: `[ ]` Not started

**Goal**

Ship only the proven M3 consumer surface, document the read-only view contract and
limitations, inspect packed output, and run the complete milestone gate.

**Why here**

The final public names and documentation should follow real pure, React, playground,
and benchmark consumers rather than expose every internal helper speculatively.

**This slice should implement**

- Export only the view-definition and provenance types required by `GanttProps` and
  real application-defined input.
- Keep resolved-view internals, interval resolvers, stack implementation, prefix sums,
  interval indexes, query counters, benchmark generators, and brute-force oracles
  private.
- Add focused root-facade tests for document, project, resource, and custom view
  selection through package imports.
- Update `README.md` with the read-only M3 view examples, stable identity/provenance,
  stack behavior, instant-schedule limitation, and explicit M4 exclusions.
- Inspect packed declarations, JavaScript, source map, and CSS for intentional exports,
  React-free pure modules, and unexpected runtime dependencies.
- Run the full automated gate, standalone playground build, focused benchmark, and
  final browser regression if Slice 8 fixes changed the rendered surface.
- Update this plan and roadmap with exact verification and benchmark evidence.
- Mark M3 done only after every required gate passes and select M4 planning as the
  actionable next milestone.

**Expected output**

- A documented, package-tested M3 facade with no leaked kernel internals.
- Exact M3 completion evidence and a concrete M4 planning handoff.

**Verification**

- `mise run ci`
- `mise run build-playground`
- `vp test bench packages/gantt/src/viewport/view-layout-viewport.bench.ts --run`
- Focused root-facade tests through the chosen package import.
- Packed declaration, bundle, source-map, and CSS inspection.
- `git diff --check`
- Explicit linked-document existence checks.
- Focused cross-document read confirming compatible architecture, decision, plan,
  roadmap, README, exports, statuses, evidence, and next action.
- Final connected Chrome DevTools matrix if any rendered output changed after Slice 8.

The final gate is not replaceable by focused tests or one benchmark. Record exact test
counts, property seeds/replay configuration, benchmark configuration/results, package
artifacts, browser evidence, and warnings before marking M3 done.

**Dependencies**

- Slices 1 through 8 complete and verified.

## Testing Plan

### Focused unit and example tests

- View definitions, key namespacing, provenance, order, reference validation, freezing,
  and fatal/recoverable diagnostics.
- Task versus segment interval resolution and unsupported schedule behavior.
- Stack order, half-open overlap, minimum track count, metrics, variable lane heights,
  and total content bounds.
- Vertical prefix lookup and horizontal interval intersection.
- Viewport query boundaries, clipping, result order, empty windows, and immutability.
- Scene composition, primitive identity, normalized horizontal geometry, absolute
  vertical geometry, ticks, grid lines, empty state, and diagnostics.
- React DOM/SVG structure, stable data attributes, accessibility names, and default
  document-view compatibility.
- Root package facade and SSR-safe import behavior.

### Seeded property tests

Use the existing exact `fast-check` dependency with fixed seeds, finite size limits,
`endOnFailure: true`, and replay seed/path visible on failure.

Generators should cover:

- legal cross-family duplicate IDs;
- document, project, resource, and custom view definitions;
- repeated tasks across lanes and resources;
- task and explicit segment schedules;
- empty, touching, nested, equal, sparse, and densely overlapping intervals;
- variable lane minimum heights and valid metrics;
- viewport ranges before, within, across, and after content;
- long intervals beginning before the query range;
- frozen inputs and repeated calls.

Core properties:

1. Equal input produces deeply equal ordered output.
2. Inputs remain unchanged and frozen-input safe.
3. Every resolved placement references one resolved lane and canonical task.
4. Every laid-out placement belongs to one lane and one valid track.
5. Overlapping intervals never share a track; touching intervals may.
6. Stack count equals brute-force maximum concurrency.
7. Lane offsets are monotonic/contiguous and total height is exact.
8. Indexed viewport results equal the brute-force two-dimensional oracle exactly.
9. Query results contain no lane or interval outside the requested half-open ranges.
10. Repeated queries do not mutate or rebuild the kernel.

Record the final seeds, run counts, maximum generated sizes, and replay syntax in this
plan as each slice completes.

### Performance evidence

The M3 benchmark owns:

- generator version and fixed seed;
- 10,000-task/2,000-lane document and resource scenarios;
- sparse and dense-overlap distributions;
- cold view/layout/index construction;
- repeated warm horizontal, vertical, and diagonal queries;
- total and visible counts;
- query-work observations;
- local runtime and hardware profile;
- benchmark distribution.

The benchmark does not own:

- React commit/render timings;
- browser scrolling frame rate;
- drag latency;
- canvas density;
- release CI thresholds.

Those need M4 runtime/browser work or M7 stable benchmark infrastructure.

### Regression tests

- M1 codec, normalization, validation, indexes, migration, serializer, and six-domain
  round trip.
- M2 patch, command, deletion, transaction, history, inversion, and facade properties.
- M0 time scale, ticks, scene, React, CSS package, and playground behavior.
- Full repository formatting, linting, type checking, tests, and package build.
- Standalone playground production build.

### Final automated gate

Run:

```sh
mise run ci
mise run build-playground
vp test bench packages/gantt/src/viewport/view-layout-viewport.bench.ts --run
```

Also run focused root-facade tests and inspect packed declarations/bundles. If the
accepted benchmark path changes, update this plan and roadmap first.

### Final browser gate

Use the installed Chrome DevTools MCP against only:

- `http://localhost:5173/`
- `http://localhost:5173/matrix`

Inspect both routes at:

- 1440 × 900;
- 900 × 900;
- 560 × 900.

Record route status, responsive layout, lane/timeline/SVG height parity, horizontal and
vertical overflow, clipped bars, stacked bars, theme/density contrast, accessible
regions and task names, duplicate announcements, disabled controls, console state, and
network state. Browser component tests alone are not sufficient proof for Slice 8 or
the final rendered milestone.

## Likely Files to Add

- `docs/decisions/2026-07-30-view-layout-viewport-kernel-contract.md`
- `packages/gantt/src/view/types.ts`
- `packages/gantt/src/view/resolve-view.ts`
- Focused view example and property tests.
- `packages/gantt/src/layout/resolve-placement-intervals.ts`
- `packages/gantt/src/layout/stack-lanes.ts`
- Focused layout example and property tests.
- `packages/gantt/src/viewport/types.ts`
- `packages/gantt/src/viewport/lane-prefix-index.ts`
- `packages/gantt/src/viewport/interval-index.ts`
- `packages/gantt/src/viewport/create-viewport-kernel.ts`
- `packages/gantt/src/viewport/query-viewport.ts`
- Focused viewport example and property tests.
- `packages/gantt/src/viewport/view-layout-viewport.bench.ts`
- A fixed-seed benchmark fixture generator if it does not fit beside the benchmark.

Names may be consolidated when a smaller internal shape is clearer, but view
resolution, interval resolution, overlap layout, and viewport indexing/querying must
remain separately testable.

## Likely Files to Change

- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `README.md`
- `packages/gantt/src/model/diagnostics.ts`
- `packages/gantt/src/render/primitives.ts`
- `packages/gantt/src/render/build-chart-scene.ts`
- `packages/gantt/src/render/build-chart-scene.test.ts`
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/styles.css`
- `packages/gantt/src/index.tsx`
- `packages/gantt/src/index.test.tsx`
- `apps/playground/src/ScenarioGantt.tsx`
- `apps/playground/src/scenarios/index.ts`
- `apps/playground/src/styles.css`
- `vite.config.ts` only if benchmark discovery needs an explicit include.
- `package.json` and `mise.toml` only if a stable benchmark task is proven useful.

The canonical document/command implementations should not need behavior changes. If
M3 proves they do, record the deviation before editing them and update the owning
decision/architecture contracts in the same change set.

## Risks and Edge Cases

- **Derived identity collision:** reusing raw entity IDs for task lanes, resource
  lanes, and persisted lanes makes legal cross-family duplicates ambiguous.
  Namespaced view keys and provenance prevent this.
- **Custom view becoming persistence:** custom view data is derived/session
  configuration and must never be written into `GanttDocument` by the kernel.
- **Project hierarchy scope creep:** honoring parents, expansion, sorting, or summaries
  in the first flat project view would pull M5 into M3. Preserve explicit order and
  leave the contract extensible.
- **Segment duplication:** automatically emitting both a task schedule and all segment
  schedules could double-render work. M3 resolves only the explicitly selected
  interval source.
- **All-day ambiguity:** coercing local dates to midnight without calendar/time-zone
  policy would violate the model. Return an unsupported-schedule diagnostic.
- **Overlap boundary errors:** closed-interval comparisons would place touching tasks
  on separate tracks. Use half-open comparisons everywhere.
- **Unstable stacks:** sorting only by start time makes equal intervals dependent on
  engine or input accidents. Use the complete deterministic tie-break.
- **Explicit height clipping:** treating `LaneRecord.height` as fixed could hide
  stacked bars. It is a minimum in M3.
- **Prefix off-by-one:** a lane ending exactly at `verticalStart` is not visible; a
  lane beginning exactly at the query end is not visible. Test half-open vertical
  ranges explicitly.
- **Long-interval omission:** binary search by start alone misses intervals that begin
  far before the range and remain active. Use an augmented interval index and a
  brute-force oracle.
- **Hidden full scans:** a fast-looking viewport API that filters complete arrays on
  every call does not meet M3. Inspect query work separately from wall-clock timing.
- **Premature runtime caching:** command invalidation and scroll state would mix M3
  engines with M4 session ownership. Make the immutable kernel reusable and stop
  there.
- **Primitive/public leakage:** exporting interval-tree nodes or layout records would
  freeze implementation details before the React/runtime consumer proves need.
- **Renderer drift:** changing scene identity or y-coordinate meaning can break DOM
  keys, accessible naming, row separators, and responsive height calculations. Keep
  focused M0 parity tests and run the browser matrix.
- **Flaky timing thresholds:** local benchmark time cannot be a universal CI contract.
  Record distributions and structural query evidence without a threshold.
- **Benchmark self-deception:** timing only small visible output while rebuilding the
  kernel inside each iteration would hide the actual boundary. Benchmark cold build
  and warm query separately.

## Open Questions

Resolve these in Slice 1 and record the accepted answers in the M3 decision:

1. What exact stable string format and opaque TypeScript types distinguish view lane
   keys from view placement keys while remaining useful as React/DOM keys?
2. Should duplicate/missing custom view topology return a result with no view or a
   discriminated rejected result, and which diagnostic path format is stable?
3. Does the minimal M3 React facade expose one `view` discriminated union, a narrower
   `viewKind` plus custom descriptor, or keep derived views behind an experimental
   prop until M4? There must be one real package consumer and no duplicate API.
4. Should `LaneRecord.height` be interpreted as a content minimum or an outer
   border-box minimum? Fix the formula before CSS and layout both consume it.
5. Should query time coordinates be clipped/normalized during viewport query or only
   during primitive translation? Prefer keeping the index/query renderer-neutral
   unless measured evidence requires precomputed x geometry.
6. Which internal query-work counters can prove absence of full scans without becoming
   retained production data or a public API?
7. Should the benchmark source live beside viewport code or under a repository-level
   benchmark directory that anticipates M7? Choose the smallest location that `vp test
   bench` discovers consistently.

None of these questions authorizes implementation before Slice 1 is complete.

## Working Notes

### 2026-07-30 — Planning baseline

- Repository status was clean on `main` before this plan and roadmap change.
- Baseline commit:
  `0170c1d4281352ea43e04c1422ad7eb197281931`.
- The complete planning-slices instructions, repository governance, roadmap M3
  milestone/current focus, architecture domain/state/rendering/performance/testing
  sections, completed M0/M1/M2 plans, current model/indexes, scene primitives/builder
  and tests, React renderer, root facade, playground scenarios, package manifests,
  Vite+ config, and mise gates were inspected.
- M3 is the next dependency-ordered milestone. M1/M2 provide the canonical document
  and change foundations; M0 provides the rendered regression baseline.
- The current scene builder is the exact seam to split: it combines view derivation,
  interval lookup, fixed-row layout, horizontal visibility, and primitive assembly.
- Vite+ locally exposes `vp test bench`; the resolved benchmark runner reported Vitest
  `4.1.10`.
- The plan deliberately separates pure viewport visibility from M4 viewport session
  state and M4 hit testing.
- The plan deliberately limits built-in project/resource view policy to flat canonical
  order and task-level schedules. M5/M6 retain hierarchy, filtering/sorting,
  all-day/calendar, and scheduling policy.
- No architecture decision is claimed resolved by this plan alone. Slice 1 owns the
  durable M3 decision record and any architecture refinement.
- Planning-document verification passed:
  - `vp check` reported all 61 files formatted and no warnings, lint errors, or type
    errors across 50 checked files;
  - `git diff --check` passed;
  - explicit existence checks passed for the roadmap, architecture, active plan, and
    the three source seams named in `Next Slice`.
- No implementation, unit/property test, benchmark, package build, playground build,
  or browser verification was run by this documentation-only pass.

### 2026-07-30 — Slice 1 contract decisions

- Accepted one package-visible data-only `GanttViewDefinition` selected through
  optional `GanttProps.view`; document view remains the default.
- Selected collision-safe JSON tuple serialization behind private branded lane and
  placement keys, with custom keys namespaced by custom view ID and source family.
- Ambiguous or malformed lane topology rejects the resolved view. A task, segment,
  assignment, schedule, or interval failure omits only the affected placement with a
  stable `view.*` or `layout.*` diagnostic.
- Fixed one-placement/one-instant-interval resolution, deterministic lowest-track
  `stack`, outer-border-box lane minimums, contiguous absolute vertical geometry, and
  renderer-neutral half-open viewport query semantics.
- Selected internal ephemeral query-work counters and a fixed-seed benchmark beside
  viewport code; M3 adds no portable wall-clock threshold or frame-rate claim.
- Linked the accepted
  [M3 contract](../decisions/2026-07-30-view-layout-viewport-kernel-contract.md)
  from architecture, roadmap, and this plan. Runtime implementation remains
  unstarted until the documentation gate passes.
- Documentation verification passed:
  - `vp check` reported all 61 files formatted and no warnings, lint errors, or type
    errors across 50 checked files;
  - `git diff --check` passed;
  - explicit existence and link checks passed across the decision, architecture,
    roadmap, and plan;
  - a focused terminology read confirmed compatible view variants, key/provenance,
    rejection, interval, stack, lane-height, viewport, benchmark, and public-boundary
    semantics.
- The required per-slice `mise run ci` checkpoint passed all 61 formatting files, 50
  lint/type-checked files, 20 test files and 89 tests, then built all four package
  artifacts.

### 2026-07-30 — Slice 2 deterministic view topology

- Added one React-free topology resolver for document, flat project, flat resource,
  and custom data-only views.
- Added private branded lane/placement keys using the accepted tuple encoding and
  preserved canonical lane, resource, task, assignment, placement, and segment
  provenance where applicable.
- Built-in views preserve their canonical source collection order. Custom views
  defensively copy and freeze caller descriptors.
- Duplicate source or custom keys and missing custom lane topology reject the view.
  Missing task, segment, assignment, or incompatible assignment references omit only
  the affected placement with stable `view.*` diagnostics.
- Focused verification passed 2 files and 8 tests. The property used seed `20260734`,
  150 runs, at most 20 generated lanes/placements, `endOnFailure: true`, and the
  standard fast-check seed/path replay configuration.
- `vp check` passed 65 formatted and 54 lint/type-checked files after formatting the
  two newly added source files. `git diff --check` passed.
- The first full CI attempt exposed one formatting-only drift after an import cleanup;
  `vp fmt packages/gantt/src/view/resolve-view.ts` fixed it. The rerun passed 22 test
  files and 97 tests, all 65 formatting files and 54 lint/type-checked files, and all
  four package artifacts.

### 2026-07-30 — Slice 3 placement interval resolution

- Added a pure task/explicit-segment dereference boundary that preserves resolved view
  keys, order, source provenance, and caller inputs.
- Each resolved placement produces at most one half-open instant interval. Missing
  tasks or segments, absent schedules, all-day schedules, non-finite boundaries,
  zero-width intervals, and reversed intervals omit only that placement with the
  accepted stable `layout.*` code.
- Focused view/layout verification passed 4 files and 13 tests. The interval property
  used seed `20260735`, 200 runs, at most 50 placements, `endOnFailure: true`, and
  standard seed/path replay.
- `vp check` passed 68 formatted and 57 lint/type-checked files after `vp fmt` corrected
  formatting in the three new layout files. `git diff --check` passed.
- The required per-slice `mise run ci` checkpoint passed 24 test files and 102 tests,
  all static checks, and the four-artifact package build.

### 2026-07-30 — Slice 4 deterministic stacks and lane geometry

- Added validated stack metrics with 58-unit default minimum lanes, 24-unit bars,
  17-unit top/bottom padding, and a 6-unit stack gap, preserving the former one-bar
  vertical baseline while allowing dense lanes to grow.
- Implemented the accepted start/end/source-order/key working order and
  lowest-available track assignment. Touching half-open intervals share tracks;
  overlaps do not.
- Persisted/custom heights remain positive finite minimum outer heights. Empty lanes
  remain present, lane offsets are contiguous, and bars use absolute vertical
  coordinates.
- Focused layout verification passed 4 files and 12 tests. The property used seed
  `20260736`, 200 runs, at most 10 lanes and 20 intervals per lane,
  `endOnFailure: true`, and standard seed/path replay. The largest explicit dense
  fixture contained 256 mutually overlapping placements.
- `vp check` passed 71 formatted and 60 lint/type-checked files after formatting the
  three new stack files. `git diff --check` passed.
- The required per-slice `mise run ci` checkpoint passed 26 test files and 109 tests,
  all static checks, and the four-artifact package build.

### 2026-07-30 — Slice 5 immutable viewport index and query

- Added binary-searched variable-height lane ends and balanced augmented per-lane
  interval trees with subtree maximum ends. Long intervals beginning before a query
  are retained without scanning all earlier-starting entries.
- Added validated finite half-open time/vertical queries, complete content bounds,
  visible lanes even when no bar intersects horizontally, absolute geometry, stable
  provenance, and fresh frozen result arrays for repeated queries.
- Added internal ephemeral work observations plus a deliberately brute-force
  two-dimensional oracle. A 1,000-lane/64-interval-per-lane example visited exactly
  one lane and fewer than 64 interval nodes for an ordinary query.
- Focused verification passed 2 files and 8 tests. The parity property used seed
  `20260737`, 200 runs, at most 12 lanes and 20 intervals per lane,
  `endOnFailure: true`, and standard seed/path replay.
- The first focused run exposed an incorrect test expectation that an empty lane with
  a 10-unit minimum would ignore the accepted 17+17 padding minimum. The assertion was
  corrected to 34; runtime layout behavior and the decision contract were unchanged.
- `vp check` passed 79 formatted and 68 lint/type-checked files after formatting the
  new viewport directory. `git diff --check` passed.
- The required per-slice `mise run ci` checkpoint passed 28 test files and 117 tests,
  all static checks, and the four-artifact package build.

### 2026-07-30 — Slice 6 pure-kernel performance baseline

- Added benchmark generator `m3-v1` with seed `20260738`, 10,000 tasks, 2,000 lanes,
  document and resource views, sparse intervals, and dense five-way per-lane overlap.
- The exact accepted command
  `vp test bench packages/gantt/src/viewport/view-layout-viewport.bench.ts --run`
  passed under Node `v24.18.1`, Vite+ CLI `0.2.6` (`vp` `0.2.3`), and Vitest
  `4.1.10` on an arm64 Apple M2 Max with 32 GiB memory. Vitest identified benchmark
  support as experimental.
- Cold full view/interval/layout/index distributions in milliseconds were:
  - document sparse: min `34.0697`, mean `38.1043`, p75 `39.8557`, p99/max
    `45.4597`, 14 samples;
  - resource sparse: min `37.4732`, mean `39.2155`, p75 `39.7972`, p99/max
    `42.5623`, 13 samples;
  - document dense: min `36.3929`, mean `39.2424`, p75 `39.7601`, p99/max
    `41.6427`, 13 samples.
- Warm query distributions in milliseconds and structural work were:
  - horizontal sparse: 397 visible placements, 2,000 lanes/4,326 interval nodes
    visited, min `0.4077`, mean `0.4711`, p75 `0.5021`, p99 `0.7276`, 1,062
    samples;
  - vertical sparse: 40 visible placements, 8 lanes/40 interval nodes visited, min
    `0.0030`, mean `0.0033`, p75 `0.0033`, p99 `0.0055`, 150,847 samples;
  - diagonal dense: 25 visible placements, 8 lanes/34 interval nodes visited, min
    `0.0024`, mean `0.0030`, p75 `0.0032`, p99 `0.0065`, 163,955 samples.
- Each warm scenario passed exact brute-force parity outside its timed section. The
  benchmark records a local structural/timing baseline only; it adds no CI threshold
  or browser performance claim.
- Focused pure-kernel verification passed 8 files and 28 tests. `vp check` passed all
  80 formatting files and 69 lint/type-checked files; `git diff --check` passed.
- The required per-slice `mise run ci` checkpoint passed 28 ordinary test files and
  117 tests, all static checks, and the four-artifact package build.

### 2026-07-30 — Slice 7 viewport-backed semantic scene

- Replaced the scene builder's document lookup, fixed-row math, and full placement
  scan with composition over validation, view resolution, interval resolution, stack
  layout, viewport construction/query, time scale/ticks, and primitive translation.
- Lane/task primitives now carry stable view keys, immutable source provenance, and
  optional canonical lane, resource, assignment, placement, and segment IDs. Default
  document identity attributes remain available.
- The compatibility call remains document view plus full vertical content. Optional
  private scene viewport input proves partial vertical visibility while bounds retain
  complete content height.
- Added direct project/resource/custom, explicit-segment, dense-stack,
  variable-height, partial-viewport, and rejected-topology scene coverage. Existing
  clipping, tick, empty, diagnostic-isolation, and input-immutability coverage remains
  green.
- Focused view/layout/viewport/render verification passed 9 files and 36 tests. The
  model/time/render regression command passed 9 files and 54 tests.
- `vp check` passed 80 formatted and 69 lint/type-checked files after formatting the
  rewritten scene and primitive sources. `git diff --check` passed.
- Browser verification is not applicable to this slice: the default valid document
  markup and geometry remain unchanged, the React view selector and variable-height
  DOM/CSS consumption are deliberately Slice 8, and no playground source changed.
- The required per-slice `mise run ci` checkpoint passed 28 test files and 120 tests,
  all static checks, and four package artifacts (126.60 kB JavaScript, 270.62 kB source
  map, 3.75 kB CSS, and 17.23 kB declarations).

## Progress

- [x] Slice 1: Freeze the M3 contract and decision record
- [x] Slice 2: Resolve deterministic view topology
- [x] Slice 3: Resolve placement intervals
- [x] Slice 4: Deterministic overlap stacks and variable lane geometry
- [x] Slice 5: Immutable two-dimensional viewport index and query
- [x] Slice 6: Performance fixture and M3 viewport baseline
- [x] Slice 7: Compose viewport-backed scene primitives
- [ ] Slice 8: Read-only React and playground integration
- [ ] Slice 9: Intentional facade, documentation, and M3 completion evidence
- [ ] Final automated gate
- [ ] Final browser gate

## Next Slice

Start Slice 8 by adding the accepted optional `GanttProps.view`, view/provenance DOM
attributes, variable-height lane/timeline/separator rendering, and real playground
document/project/resource/custom/segment/stack cases. Preserve accessibility and
disabled controls, build the playground, then run the required connected Chrome
DevTools matrix at both routes and all three viewport sizes before the per-slice
`mise run ci`.
