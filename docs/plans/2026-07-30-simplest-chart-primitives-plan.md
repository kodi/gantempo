# Simplest Read-Only Chart Primitives Implementation Plan

## Summary

Build the first real, end-to-end chart path behind `@gantempo/gantt`: typed lanes,
tasks, and placements enter a pure linear-time layout pipeline and become
renderer-neutral primitives consumed by a read-only React DOM/SVG renderer.

The first finished chart should replace the percentage-positioned fake implementation
without trying to build scheduling, editing, virtualization, or the complete public
API at the same time. The existing `/` and `/matrix` playground pages are the visual
contract: preserve their clear lane column, time header, grid, bars, empty state,
density variants, and theme tokens while replacing their fake geometry with real
time-based input.

This plan is intentionally narrower than the broad implementation slices in
`docs/ARCHITECTURE.md`. It is the first vertical subset of architecture Slice 2, with
only the minimum model contracts from architecture Slice 1 that rendering genuinely
requires.

## Target State

At the end of this plan:

- `<Gantt>` renders a responsive, read-only chart from epoch-millisecond task
  schedules rather than caller-provided percentages.
- A task, lane, and placement remain separate records; the playground does not
  establish a temporary "task equals row" model.
- A pure linear time scale converts between time and normalized horizontal chart
  coordinates without adding a runtime scale dependency.
- A pure scene builder resolves placements, clips scheduled intervals to the visible
  range, and emits semantic lane, tick, grid-line, and task-bar primitives.
- The default React renderer uses DOM for headers and lane labels and SVG for the time
  grid and task bars.
- The main and matrix playground scenarios use the real chart path, including compact,
  dark, high-contrast, multiple-entry, and empty cases.
- `PlaceholderGantt` and percentage-based scenario fields are removed after parity is
  verified.
- Pure geometry, React structure, packaging, and the playground build are covered by
  repeatable checks.

The minimum user-visible acceptance case is an explicit time window containing
multiple named lanes and scheduled tasks. It renders a labeled time header, vertical
grid lines, lane rows, clipped task bars, task labels, and a useful empty state.

## Decisions

### 1. Use the canonical domain separation from the start

The minimum render document will contain separate task, lane, and placement records:

```ts
interface GanttDocument {
  schemaVersion: number;
  tasks: readonly TaskRecord[];
  lanes: readonly LaneRecord[];
  placements: readonly PlacementRecord[];
}

interface TaskRecord {
  id: EntityId;
  title: string;
  schedule?: {
    mode: "instant";
    start: EpochMilliseconds;
    end: EpochMilliseconds;
  };
}

interface LaneRecord {
  id: EntityId;
  title: string;
}

interface PlacementRecord {
  id: EntityId;
  taskId: EntityId;
  laneId: EntityId;
}
```

Use the names and semantics already established in `docs/ARCHITECTURE.md`. Keep the
interfaces extensible enough to add the documented optional records later, but do not
implement codec/migration behavior, assignments, dependencies, segments, or calendars
in this plan. Fixtures still carry the required `schemaVersion`; tests may use fixture
helpers, but the public component must not infer persisted placements or collapse task
and lane identity.

### 2. Use real time at the component boundary

Tasks use half-open instant intervals `[start, end)` expressed as epoch milliseconds.
The chart receives an explicit visible time range. Percentage positions belong only to
derived render geometry and are never accepted as task data.

The first time scale is continuous elapsed time. Tick spacing is an explicit fixed
elapsed-time interval, and labels are formatted with an explicit IANA time-zone ID.
Calendar-aware day/week alignment, working-time compression, all-day schedules, zoom
levels, and daylight-saving calendar arithmetic remain later work. The names and docs
must not imply that fixed elapsed-time ticks already provide those capabilities.

### 3. Implement the first scale as a small internal utility

Do not add `d3-scale` for this milestone. Implement a narrow, immutable
`createLinearTimeScale` utility over numeric epoch milliseconds and a numeric output
range. It should expose only the operations the first renderer needs:

- `timeToX(time)`;
- `xToTime(x)`;
- validated domain and range metadata.

The conversion itself must not clamp values. Interval clipping belongs to the scene
builder, and fixed tick generation and label formatting remain separate utilities.
This keeps the affine mapping easy to reason about and prevents scale, clipping,
calendar, and presentation concerns from becoming one API.

This decision is based on the current requirement, not a rejection of D3:

- The initial mapping is a small affine transform that can be exhaustively tested.
- `d3-scale` currently declares five runtime dependencies, while the repository's
  `neverBundle` packaging would expose a new runtime dependency surface to consumers.
- D3 time scales provide browser-local or UTC calendar behavior, not arbitrary IANA
  time-zone alignment. Gantempo still needs its own explicit time-zone/calendar
  boundary.
- A private `TimeScale` contract lets the implementation adopt D3 later without
  changing document or renderer APIs.

Reconsider `d3-scale` when adaptive/nice ticks, calendar interval selection, multiple
scale types, or zoom behavior would otherwise create substantial custom machinery.
If adopted, keep it behind the Gantempo scale contract and do not expose D3 types from
the public API. Prefer UTC behavior over browser-local behavior where it meets the
product contract; arbitrary IANA calendar behavior remains a separate concern.

Licensing does not block a future adoption. `d3-scale` is distributed under the
permissive [ISC license](https://github.com/d3/d3-scale/blob/main/LICENSE), which
allows commercial use and redistribution with or without a fee as long as its
copyright and permission notice are preserved. A future adoption must add the notice
to the distributed third-party license material and audit the complete transitive
dependency set. See the official
[package metadata](https://github.com/d3/d3-scale/blob/main/package.json) and
[time-scale documentation](https://d3js.org/d3-scale/time).

### 4. Keep primitive generation pure and renderer-independent

The scene builder receives normalized records, a visible range, lane order, and layout
metrics. It returns semantic primitives such as:

- time ticks and vertical grid lines;
- lane rows and lane-label data;
- task-bar rectangles and labels;
- chart bounds and empty-state metadata;
- typed diagnostics for records that cannot be rendered.

Horizontal coordinates are normalized to `[0, 1]`; vertical coordinates and heights
use layout units. This lets the first SVG renderer stay responsive without DOM
measurement while preserving a numeric scale contract that a future measured or
canvas viewport can map to pixels.

Do not emit a generic stream of arbitrary SVG elements. Primitives should retain task,
lane, and placement identity so later hit testing, accessibility, customization, and
incremental layout can build on them.

### 5. Use one real public chart path

`Gantt` is currently a private-package scaffold at version `0.0.0`, not a released
compatibility contract. Evolve it into the read-only chart rather than adding a second
long-lived `RealGantt` component or retaining children-only and document modes.

The initial public props should cover only:

- `document`;
- visible `range`;
- explicit `timeZone`;
- fixed tick interval;
- accessible `label`;
- `className`;
- small layout metrics only where a genuine consumer need is proven.

Theme and density remain CSS-variable/class concerns. Do not add product-specific
values such as the playground's `accent`, `success`, or `warning` tones to the
canonical task record. If the first playground migration needs task appearance
variation, keep that mapping in a typed renderer slot or playground-owned
presentation map rather than in scheduling data.

### 6. Start with the hybrid DOM/SVG renderer

Follow the architecture baseline:

- DOM for the chart region, corner/header cells, lane labels, and empty state;
- SVG for grid lines, row separators, task bars, and bar labels;
- CSS custom properties for default visual tokens;
- stable task/lane/placement data attributes for testing and future interaction;
- meaningful accessible names for the chart and visible tasks.

No canvas renderer is introduced. The primitive contract must not depend on SVG so a
canvas capability can consume it later.

### 7. Treat the fake playground as a reference, not a second implementation

Keep `PlaceholderGantt` unchanged while the pure primitives and renderer are built.
Once the real component covers all existing scenarios, migrate both playground pages
and delete the placeholder and percentage fields in the same cleanup slice. Do not
maintain adapters that indefinitely translate percentages into dates.

## Scope

### In scope

- Opaque string entity IDs.
- Minimal task, lane, placement, schedule, and visible-range types.
- Indexing the minimum records required for layout.
- A continuous linear time scale with `timeToX` and `xToTime`.
- Explicit fixed-interval ticks and time-zone-aware labels.
- Deterministic lane order from document/view input.
- One fixed-height visual row per lane.
- Zero, one, or multiple non-stacked task bars in a lane.
- Horizontal clipping at the visible time window.
- Semantic renderer-neutral chart primitives.
- Read-only DOM/SVG rendering.
- Default CSS tokens, compact density hooks, dark and high-contrast token overrides.
- Empty document and empty lane rendering.
- Focused diagnostics for dangling placements, absent schedules, and invalid intervals.
- Playground migration and placeholder cleanup.
- Unit, component, package, build, and manual visual verification.

### Out of scope

- Commands, reducers, patches, history, controlled/uncontrolled mutation flows.
- Dragging, resizing, selection, keyboard editing, tooltips, menus, and editors.
- Hierarchical lanes or tasks, disclosure state, summary tasks, and milestones.
- Dependency layout or dependency rendering.
- Placement derivation from assignments.
- Overlap stacking, overlay/compress/reject policies, or variable lane heights.
- Vertical or horizontal virtualization and spatial indexes.
- Zooming, panning, scrolling orchestration, or a "Today" action.
- Calendar-aware ticks, all-day tasks, working calendars, or non-linear scales.
- `d3-scale` or another general-purpose scale runtime dependency for the first chart.
- Localization API design beyond accepting the formatter's explicit time zone and a
  deterministic default locale for the initial examples.
- JSON codecs, schema migration, runtime validation of arbitrary external JSON.
- Canvas rendering, exports, Pro capabilities, persistence, SSR hydration guarantees,
  and performance claims.

The existing fake toolbar may remain playground chrome. Its buttons must not imply
working chart interactions until those interactions exist.

## Current State and Behavior to Preserve

Observed at commit `adcee7237448b9844bd1687c2e1c002ccba743df` on 2026-07-30:

- `packages/gantt/src/index.tsx` exposes only an accessible region wrapper with
  children.
- `apps/playground/src/placeholder/PlaceholderGantt.tsx` renders the entire fake chart.
- `ScenarioTask.start` and `ScenarioTask.width` are percentages, not dates.
- The placeholder already separates its lane list from tasks sufficiently to serve as
  a visual fixture, but it is not the canonical architecture model.
- `/` is the stable large development case.
- `/matrix` covers comfortable/compact density, light/dark/high-contrast tokens,
  multiple entries per lane, and an empty document.
- Bars are horizontally clipped by the track, labels use ellipsis, and lane labels
  truncate.
- The left lane column and right time grid remain aligned at responsive widths.
- The local server responded successfully at `http://localhost:5173/` during planning.
  A connected browser surface was unavailable, so current visual behavior was traced
  from the source and CSS rather than claimed as manually re-verified.

## Implementation Shape

Keep the first implementation inside `packages/gantt` while preserving internal
layering:

```text
packages/gantt/src/
├── index.tsx                     # Deliberate public facade
├── model/
│   ├── types.ts                  # Minimum canonical render records
│   └── indexes.ts                # Pure ID lookup helpers
├── time/
│   ├── linear-time-scale.ts      # Pure domain/range conversion
│   └── fixed-interval-ticks.ts   # Explicit elapsed-time ticks
├── render/
│   ├── primitives.ts             # Semantic scene contract
│   ├── build-chart-scene.ts      # Pure records-to-primitives pipeline
│   └── diagnostics.ts            # Focused render diagnostics
├── react/
│   └── Gantt.tsx                 # DOM/SVG consumer of the scene
└── styles.css                    # Default token and structure styles
```

Co-locate focused `*.test.ts` and `*.test.tsx` files with the implementation unless
the existing Vite+ test discovery requires a different shape.

Do not split new workspace packages yet. The first renderer is the evidence needed to
confirm which internal contracts deserve package boundaries. Keep imports directional:

```text
model <- time
  \       /
   render primitives
          |
       React/SVG
          |
    public facade
```

The model and time modules must not import React, DOM types, CSS, or playground code.
The pure scene builder must not call browser APIs or format JSX.
The time modules must not import `d3-scale` in this plan; their private contract should
still leave room for a later implementation swap.

## Cross-Slice Rules

- Preserve the task/lane/placement separation in every fixture and API.
- Never accept percentage geometry as canonical chart input.
- Keep pure layers free of React and browser globals.
- Use explicit time ranges and deterministic time-zone inputs; do not depend on
  `Date.now()` during layout or tests.
- Clip primitives at the visible range and retain stable entity identity.
- Do not claim calendar-aware behavior from fixed elapsed-time ticks.
- Keep conversion, clipping, tick generation, and label formatting as separate
  concerns; do not grow the internal linear scale into a general charting framework.
- Do not add `d3-scale` during this plan unless a newly verified requirement exceeds
  the agreed affine-scale scope and the decision is recorded here first.
- Do not add interaction props before a real command path exists.
- Keep `/` and `/matrix` working after each slice. The placeholder stays as the active
  renderer until the real renderer is ready to replace it.
- Delete temporary adapters and placeholder code only after both playground pages use
  the real path.
- Add only deliberate top-level exports. Keep scene-building internals private until a
  second consumer proves that their shape should be public or experimental.
- Record exact commands and manual checks in this document when a slice is completed;
  do not mark a slice done from implementation alone.

## Implementation Slices

### Slice 1: Minimum render document contracts

Status: `[x]` Done

**Goal**

Establish the smallest canonical, React-free input model that can represent the
playground's read-only charts without encoding row positions or percentages.

**Why here**

Time and layout helpers need stable entity identity and schedule semantics. Starting
with geometry or JSX would make the fake scenario shape the de facto public data
model.

**This slice should implement**

- Add opaque string `EntityId`, `EpochMilliseconds`, and half-open `TimeRange` types.
- Add the minimum `TaskRecord`, instant schedule, `LaneRecord`, `PlacementRecord`, and
  versioned `GanttDocument` types described above.
- Add pure indexes for tasks, lanes, and placements without mutating caller arrays.
- Define focused render diagnostics for duplicate IDs, dangling placement references,
  missing schedules, non-finite times, and `end <= start`.
- Decide and test which conditions omit one primitive versus invalidate the complete
  scene. A bad placement should not make unrelated valid lanes disappear.
- Export only consumer-facing record types from the package facade; keep index helpers
  internal.
- Add fixtures expressed in epoch milliseconds with at least:
  - one lane and one task;
  - multiple tasks in one lane;
  - an empty lane and empty document;
  - a dangling placement;
  - an unscheduled task.

**Expected output**

- React-free model modules and focused tests.
- A canonical fixture shape later slices can reuse.
- No visible playground changes.

**Verification**

- `vp test run packages/gantt/src/model`
- `vp check`

Record the exact commands that pass when the slice is implemented. If Vite+ does not
accept a directory filter, record the exact focused file command used instead.

**Dependencies**

- None.

### Slice 2: Linear time scale and explicit ticks

Status: `[x]` Done

**Goal**

Convert real task times into deterministic chart coordinates and labeled header ticks
without importing React or relying on the browser clock.

**Why here**

The scale is the central risky primitive: bar placement, grid alignment, clipping,
future pointer conversion, and zoom all depend on its direction and boundary
semantics.

**This slice should implement**

- Add `createLinearTimeScale` with explicit time domain and numeric output range.
- Implement `timeToX` and `xToTime` as inverse operations within documented floating
  point tolerance.
- Keep the returned scale immutable and independent of `d3-scale` or other runtime
  scale packages.
- Reject or diagnose non-finite and zero/negative domains.
- Define boundary behavior for values outside the visible range; keep raw conversion
  separate from clipping.
- Add fixed elapsed-time tick generation from an explicit anchor and interval.
- Format tick labels with `Intl.DateTimeFormat` using an explicit `timeZone` and stable
  locale input/default.
- Test exact boundaries, midpoint conversion, round trips, negative epochs, ranges
  before 1970, partially visible intervals, and invalid inputs.
- Include one test demonstrating that fixed `24h`/`7d` intervals are elapsed-time
  ticks, not calendar-aware working-day or DST arithmetic.

**Expected output**

- Pure scale and tick modules usable by any renderer.
- Focused tests that define numerical and interval behavior.
- No new runtime scale dependency.
- No visible playground changes.

**Verification**

- `vp test run packages/gantt/src/time`
- `vp check`

**Dependencies**

- Slice 1 time and diagnostic types.

### Slice 3: Semantic chart scene and layout

Status: `[x]` Done

**Goal**

Turn the minimum render document plus a visible range into one deterministic,
renderer-neutral chart scene.

**Why here**

The scene contract must be proven before JSX fixes SVG-specific assumptions into the
layout API.

**This slice should implement**

- Define chart bounds, tick, grid-line, lane-row, and task-bar primitives with stable
  task/lane/placement IDs.
- Define explicit layout metrics for header height, row height, bar height, lane-column
  width, and label padding.
- Build task and lane indexes once per scene construction.
- Preserve input lane order and placement order deterministically.
- Resolve each placement through its referenced lane and task schedule.
- Map task intervals through the linear scale.
- Omit fully off-window bars and clip partially visible bars to `[0, 1]`.
- Retain unclipped start/end times on task primitives for labels and accessibility.
- Center bars vertically in fixed-height rows.
- Emit lane rows even when they contain no scheduled bars.
- Emit a document-level empty-state primitive only when there are no display lanes.
- Return diagnostics alongside usable primitives; do not silently discard invalid
  records.
- Keep all arrays immutable from the caller's perspective.
- Add structural assertions rather than broad snapshots for:
  - exact left/right boundary bars;
  - bars clipped at each edge;
  - multiple bars in one lane;
  - empty lanes and documents;
  - unscheduled tasks;
  - dangling task and lane references;
  - deterministic ordering;
  - no input mutation.

Overlap stacking is not part of this slice. Bars in the same lane may share the
vertical slot; the tests and initial fixtures should avoid overlapping time intervals
unless explicitly verifying deterministic overlay order.

**Expected output**

- A pure `buildChartScene` pipeline.
- A semantic primitive contract independent of SVG and CSS.
- No visible playground changes.

**Verification**

- `vp test run packages/gantt/src/render`
- `vp check`

**Dependencies**

- Slices 1 and 2.

### Slice 4: Read-only React DOM/SVG renderer

Status: `[x]` Done

**Goal**

Render the semantic scene through the real public `<Gantt>` component with a usable
default visual and accessibility baseline.

**Why here**

The component should consume a tested scene rather than combine record lookup, time
math, layout, and JSX in one module.

**This slice should implement**

- Replace the children-only scaffold with the minimum document/range/time-axis props.
- Keep the default `role="region"` and accessible label behavior.
- Render the corner/time header and lane labels as DOM.
- Render grid lines, row separators, task bars, and task labels as SVG.
- Convert normalized x values into SVG percentage coordinates while keeping vertical
  metrics stable.
- Add stable `data-task-id`, `data-lane-id`, and `data-placement-id` attributes.
- Add task accessible names containing the task title and formatted start/end.
- Ensure decorative grid and separator primitives are hidden from assistive
  technology.
- Provide a useful empty state and avoid an empty, unlabeled SVG.
- Add CSS custom properties for surfaces, borders, grid, text, accent bar, focus, and
  empty-state colors.
- Keep the renderer width-responsive without `window` or element measurement at
  module scope.
- Make clipped bar labels safe: ellipsis visually, full title in accessible text.
- Define how render diagnostics are exposed in development without silently printing
  or throwing for every bad record. A callback or returned internal result is
  preferable to console-only behavior.
- Update component tests to cover region semantics, DOM/SVG structure, IDs, clipped
  bars, empty state, and static server rendering without browser globals.
- Update package CSS packaging deliberately. If CSS is emitted as a side effect,
  reflect that in `packages/gantt/package.json` rather than leaving
  `sideEffects: false` misleading.

**Expected output**

- A real read-only `<Gantt>` component.
- Packaged default styles.
- Component and server-render structure tests.
- The playground may still use `PlaceholderGantt` until Slice 5.

**Verification**

- `vp test run packages/gantt/src`
- `vp pack`
- `vp check`

**Dependencies**

- Slices 1 through 3.

### Slice 5: Playground migration, parity, and placeholder cleanup

Status: `[x]` Done

**Goal**

Make the real chart the only renderer used by `/` and `/matrix`, preserve the fake
examples' useful visual language, and remove the percentage-based implementation.

**Why here**

The playground should change only after the real path is independently tested.
Migrating all scenarios in one final integration slice avoids an indefinite dual
implementation.

**This slice should implement**

- Replace `ScenarioTask.start` and `ScenarioTask.width` with real task schedules.
- Express scenarios as canonical tasks, lanes, and placements, plus separate
  playground-only presentation metadata where needed.
- Give every scenario an explicit visible range, tick anchor/interval, and time zone.
- Render the main page and every matrix card through `<Gantt>`.
- Preserve:
  - the large stable development case on `/`;
  - compact rows;
  - dark and high-contrast tokens;
  - multiple entries in one lane;
  - empty-state treatment;
  - aligned lane/time columns;
  - label truncation at narrow widths.
- Keep toolbar buttons clearly outside the chart's implemented behavior, or render them
  as non-functional playground chrome without introducing fake component callbacks.
- Remove `PlaceholderGantt.tsx`, placeholder-only selectors, percentage task fields,
  and any temporary date/percentage adapter.
- Rename placeholder CSS selectors to stable playground or library selectors and
  remove dead rules.
- Update `README.md` to state that the playground now exercises the first real
  read-only rendering pipeline.
- Append a dated implementation note to this plan with any contract changes,
  verification results, and implications for the next architecture slice.

**Expected output**

- Both playground routes render the real component.
- No percentage geometry or placeholder renderer remains.
- Documentation accurately describes the implemented boundary.

**Verification**

- `vp test run`
- `vp check`
- `vp pack`
- `vp build apps/playground`
- Manual check at `http://localhost:5173/`:
  - wide desktop;
  - approximately 900 px;
  - approximately 560 px.
- Manual check at `http://localhost:5173/matrix`:
  - all scenarios render;
  - compact/light/dark/high-contrast differences remain legible;
  - the empty state is centered and readable;
  - lane headers, time grid, and bars remain aligned.
- Manual keyboard/accessibility smoke check:
  - chart regions have distinct accessible names;
  - decorative SVG elements are not announced;
  - task names and dates are inspectable;
  - high-contrast colors and visible text remain usable.

**Dependencies**

- Slices 1 through 4.

## Testing Plan

### Per-slice confidence

- Model tests own record identity, lookup, and render-diagnostic behavior.
- Time tests own numerical conversion, round trips, fixed ticks, and time-zone label
  inputs.
- Scene tests own clipping, ordering, primitive identity, empty behavior, and
  immutability.
- React tests own accessible structure and DOM/SVG translation, not time math.
- Playground checks own theme, density, responsive layout, and scenario parity.

### Final automated gate

Run the repository-standard gate and the standalone playground build:

```sh
mise run ci
mise run build-playground
```

If the mise tasks and direct Vite+ commands diverge during implementation, fix or
document the task graph rather than reporting a narrower command as the full gate.

### Final manual gate

Inspect `/` and `/matrix` in the running playground at the responsive widths listed in
Slice 5. Automated component tests are not sufficient proof of the visual contract.
Record the person/tool, date, and exact surfaces checked in this plan before marking
the integration slice done.

## Likely Files to Add

- `packages/gantt/src/model/types.ts`
- `packages/gantt/src/model/indexes.ts`
- `packages/gantt/src/time/linear-time-scale.ts`
- `packages/gantt/src/time/fixed-interval-ticks.ts`
- `packages/gantt/src/render/primitives.ts`
- `packages/gantt/src/render/diagnostics.ts`
- `packages/gantt/src/render/build-chart-scene.ts`
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/styles.css`
- Focused co-located test files for each pure module and the React renderer.

The exact filenames may change to match implementation discoveries, but the layer
boundaries should remain.

## Likely Files to Change

- `packages/gantt/src/index.tsx`
- `packages/gantt/src/index.test.tsx`
- `packages/gantt/package.json`
- `vite.config.ts` if CSS/package entry handling requires it
- `apps/playground/src/pages/MainPage.tsx`
- `apps/playground/src/pages/MatrixPage.tsx`
- `apps/playground/src/scenarios/index.ts`
- `apps/playground/src/styles.css`
- `README.md`
- `docs/ARCHITECTURE.md` only if implementation proves a baseline decision wrong

## Files to Remove After Parity

- `apps/playground/src/placeholder/PlaceholderGantt.tsx`

Do not remove it before Slice 5 has passed the real-renderer checks.

## Risks and Edge Cases

- **Accidental throwaway model:** reusing `ScenarioTask` as the public record would
  collapse presentation geometry into domain data. Slice 1 prevents this.
- **Scale boundary ambiguity:** inconsistent inclusive/exclusive handling will create
  one-pixel or missing-bar errors. Tests must use half-open intervals explicitly.
- **Small utility growing into a framework:** the internal scale is only an affine
  converter. Adaptive ticks, calendar arithmetic, clipping, and formatting stay in
  separate modules, and D3 should be reconsidered if those requirements outgrow the
  narrow contract.
- **Misleading time behavior:** fixed millisecond ticks can drift from local calendar
  boundaries around DST. Name and document them as elapsed-time ticks.
- **SVG responsiveness:** percentage x coordinates and fixed vertical metrics must be
  tested at narrow widths, especially label clipping and grid alignment.
- **Invalid records:** silent omission would make integration failures difficult to
  diagnose. Return typed render diagnostics while preserving unrelated valid output.
- **Theme leakage into the model:** playground tones should not become scheduling
  fields. Keep presentation metadata outside canonical records.
- **Packaging CSS:** the current package declares `sideEffects: false`. Emitted/imported
  CSS must be packaged and declared intentionally.
- **Premature public surface:** pure primitives are valuable internally, but exporting
  unstable scene details would make later virtualization and canvas work harder.
- **Dual implementation drift:** finish the migration and cleanup in Slice 5 rather
  than leaving placeholder and real scenario models side by side.

## Open Questions

Resolve these during the named slice and record the answer here:

1. **Slice 1:** Should optional future `GanttDocument` arrays be introduced now as
   optional empty fields, or should the type contain only the three implemented record
   collections until their behavior exists?
2. **Slice 2:** Should the initial tick formatter accept a `locale` prop or use one
   documented deterministic default while keeping a formatter injection internal?
3. **Slice 3:** Should invalid visible ranges return a typed failed scene result or
   throw a programmer-error exception? The choice must be consistent with the
   architecture's diagnostics direction.
4. **Slice 4:** What is the smallest accessibility representation that makes SVG task
   dates inspectable without prematurely designing the full treegrid? Prefer a
   synchronized visually hidden list/table if individual SVG naming is insufficient.
5. **Slice 5:** Does the first renderer need a typed task-content/appearance slot to
   preserve all matrix tones, or is one default bar appearance sufficient for this
   milestone? Do not put the answer into `TaskRecord`.

None of these questions blocks beginning Slice 1.

## Working Notes

### 2026-07-30 — Planning baseline

- Repository status was clean on `main` when this plan was created.
- Baseline commit: `adcee7237448b9844bd1687c2e1c002ccba743df`.
- The live Vite server returned HTTP 200 for `/`.
- Source and CSS for both playground pages were inspected.
- Connected browser inspection was unavailable, so no current visual or accessibility
  behavior is marked verified by this planning pass.
- No implementation or test command is marked complete by this plan.

### 2026-07-30 — Scale dependency decision

- Decision: implement the first linear time scale as a small internal utility; do not
  add `d3-scale` in this plan.
- The utility owns only numeric domain/range conversion and inversion. Clipping, fixed
  ticks, and time-zone-aware label formatting remain separate.
- `d3-scale` remains an allowed future implementation detail when adaptive calendar
  ticks, nice domains, zoom, or additional scale types justify its dependency surface.
- Its ISC license permits commercial redistribution, subject to preserving the
  copyright and permission notice and auditing transitive dependency licenses.
- Implication for later slices: no public API may expose the internal scale
  implementation, so a future D3-backed implementation remains replaceable.
- This decision changes planning only. No implementation or verification status was
  advanced.

### 2026-07-30 — Slices 1–4 implementation

- Slice 1 added only the implemented `tasks`, `lanes`, and `placements` document
  collections. Duplicate IDs keep the first record and emit a typed diagnostic;
  invalid placements or schedules omit only their own task primitive.
- Slice 2 added an immutable affine scale with unclamped conversion and fixed
  elapsed-time ticks. Tick labels default deterministically to `en-US` while the
  renderer accepts an optional locale and always requires an explicit IANA time zone.
- Slice 3 throws `RangeError` for an invalid visible range or layout metrics because
  those are component configuration errors. Invalid document records remain
  recoverable diagnostics alongside usable scene primitives.
- Slice 4 uses named SVG task groups so titles and formatted start/end values remain
  inspectable without introducing a treegrid contract. Chrome's accessibility tree
  confirmed those groups are exposed correctly, so the initially implemented hidden
  fallback list was removed to avoid announcing every task twice. SVG-owned
  `foreignObject` labels provide real responsive CSS ellipsis while accessible text
  retains the full task title and interval.
- The public facade exports only the component, its input record types, and render
  diagnostic types. Scale, indexes, scene primitives, and scene construction remain
  internal.
- Packaged CSS is emitted as `dist/style.css`, exported as
  `@gantempo/gantt/styles.css`, and declared as a package side effect.
- Verification passed:
  - `vp test run packages/gantt/src/model packages/gantt/src/time packages/gantt/src/render packages/gantt/src/index.test.tsx`
    — 5 files and 16 tests passed after the floating-point assertion used tolerance.
  - `vp check` — formatting, lint, and type checking passed on 33 files.
  - `vp pack` — emitted ESM, declarations, source map, and `style.css`.

### 2026-07-30 — Slice 5 automated implementation

- Both playground routes now render `Gantt` from canonical epoch-millisecond tasks,
  lanes, and placements. Every scenario supplies a visible range, tick anchor,
  elapsed-time interval, and `Europe/Belgrade` time zone.
- A typed task-variant presentation map preserves the playground tones without adding
  appearance fields to `TaskRecord`.
- Compact, dark, and high-contrast variants are CSS-variable overrides. Toolbar
  controls remain explicitly disabled playground chrome.
- `PlaceholderGantt.tsx`, percentage scenario fields, and all placeholder selectors
  were removed. `README.md` now describes the real read-only pipeline and stylesheet
  import.
- Verification passed:
  - `vp test run` — 5 files and 17 tests passed in the final run.
  - `vp check` — formatting, lint, and type checking passed.
  - `vp pack` — the library and stylesheet packaged successfully.
  - `vp build apps/playground` — the standalone playground built successfully.
  - `mise run ci` — `check`, `test`, and `build` all passed.
  - `mise run build-playground` — passed.
  - HTTP probes returned `200 OK` for `/` and `/matrix` from the running local server.
- Manual visual and accessibility verification remains outstanding. Browser discovery
  returned no available browser surface in this implementation session, so responsive
  widths, visual alignment, and the accessibility tree are not marked verified.

### 2026-07-30 — Slice 5 Chrome visual and accessibility verification

- Chrome DevTools MCP inspected `http://localhost:5173/` and `/matrix` at emulated
  1440 × 900, 900 × 900, and 560 × 900 viewports.
- The first pass found and fixed three issues:
  - boundary tick labels were clipped, so near-edge labels now use edge-aware
    alignment;
  - non-accent dark-theme task labels lacked contrast, so they now use the dark
    theme's light text color;
  - named SVG task groups and the visually hidden task list duplicated every task in
    the accessibility tree, so the proven-redundant fallback list was removed.
- Final screenshots confirmed:
  - the main chart remains aligned and readable at all three widths;
  - the matrix switches from two columns to one at the planned responsive boundary;
  - compact, light, dark, and high-contrast variants remain distinct and legible;
  - narrow task labels ellipsize without escaping their bars;
  - the high-contrast empty state is centered and readable.
- Live geometry checks at 560 px reported zero table overflow, zero lane/time boundary
  delta, and matching timeline/SVG heights for every non-empty scenario. All five
  rendered chart instances reported zero diagnostics.
- Chrome's accessibility tree exposed distinct named chart regions and task images
  with full titles and formatted start/end dates. Decorative grid primitives were
  absent, disabled playground controls were identified as disabled, and the empty
  state text was exposed.
- The final page navigation returned HTTP 200 and Chrome reported no console errors.
- Post-verification gates passed against the final fixes: `vp check`, `vp test run`
  (5 files, 17 tests), `vp pack`, `vp build apps/playground`, `mise run ci`, and
  `mise run build-playground`.

## Progress

- [x] Slice 1: Minimum render document contracts
- [x] Slice 2: Linear time scale and explicit ticks
- [x] Slice 3: Semantic chart scene and layout
- [x] Slice 4: Read-only React DOM/SVG renderer
- [x] Slice 5: Playground migration, parity, and placeholder cleanup
- [x] Final automated gate
- [x] Final manual visual/accessibility gate

## Next Slice

This implementation plan is complete. Before starting the next architecture slice,
inspect the resulting private scene contract and public `Gantt` facade against
`docs/ARCHITECTURE.md`; only promote additional scene or interaction APIs when a
second consumer proves the need.
