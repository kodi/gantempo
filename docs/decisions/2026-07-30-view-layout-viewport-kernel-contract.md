# Decision: View, Layout, and Viewport Kernel Contract

Status: Accepted
Date: 2026-07-30
Owners: M3 view, layout, and viewport kernel

## Context

M3 replaces the fixed-row document-only scene builder with pure stages for view
resolution, interval resolution, overlap layout, and repeated two-dimensional
viewport queries. The stages must preserve the M1 canonical document and M0 renderer
baseline without taking on M4 viewport session state or interaction.

This decision sharpens the rendering pipeline in
[`ARCHITECTURE.md`](../ARCHITECTURE.md). Its implementation and evidence are owned by
the
[`2026-07-30-view-layout-viewport-kernel-plan.md`](../plans/2026-07-30-view-layout-viewport-kernel-plan.md).

## Decision

### Accept one data-only view union

The package-visible read-only selector is:

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
```

`GanttProps` accepts `view?: GanttViewDefinition`; omission means document view.
Custom lanes provide a stable key, title, and optional minimum outer height. Custom
placements provide a stable key, lane key, canonical task ID, and optional canonical
segment and assignment IDs. Applications may derive this data with arbitrary logic,
but functions and resolved output are not retained in `GanttDocument`.

Document view follows canonical lane and placement order. Project view follows task
order and derives one lane and one task placement per task. Resource view follows
resource order and assignment order, deriving placements from assignments. The built
in views do not interpret hierarchy, `order`, filtering, sorting, or expansion.

### Keep resolved identity private, stable, and collision-safe

Resolved lane and placement keys are distinct private opaque string brands. Generated
keys serialize a tuple of key kind, view kind, source family, and source IDs as JSON
after a fixed `gt:v1:` prefix. JSON tuple serialization is injective for valid string
inputs and avoids delimiter collisions. Examples are descriptive only:

```text
gt:v1:["lane","document","lane","lane-id"]
gt:v1:["placement","resource","assignment","assignment-id"]
```

Custom keys are namespaced by custom view ID and item family before tuple
serialization. Keys must be non-empty and unique within their resolved lane or
placement collection. Array indexes are never identity.

Each resolved lane retains its source order plus optional canonical lane or resource
ID. Each resolved placement retains its source order, canonical task ID, and optional
canonical lane, resource, assignment, placement, and segment IDs. Provenance flows
unchanged through layout, viewport output, scene primitives, and DOM attributes.

### Reject ambiguous topology and isolate placement source failures

View resolution returns a discriminated resolved or rejected result with structured
diagnostics.

The whole view is rejected when topology cannot be interpreted unambiguously:

- duplicate generated or custom lane keys;
- duplicate generated or custom placement keys;
- a custom placement references no resolved custom lane;
- a custom view ID or item key is empty;
- a built-in source collection contains duplicate IDs needed for generated identity.

Canonical task, segment, assignment, or compatibility failures affect only the
placement that references them. That placement is omitted and a diagnostic is
returned; unrelated lanes and placements remain usable. This preserves M1 recovery
semantics while preventing custom lane topology from being silently repaired.

View diagnostic codes use the `view.*` namespace and stable paths rooted at
`view`, `lanes`, or `placements`. Interval diagnostics use `layout.*`. Diagnostics
retain relevant canonical entity IDs where available.

### Resolve one explicit instant interval per placement

Every resolved placement selects exactly one canonical interval:

- a placement with `segmentId` uses that task segment's schedule;
- every other placement uses its task schedule.

Built-in project and resource views do not expand task segments. An absent task or
segment, absent schedule, all-day schedule, non-finite boundary, zero-width interval,
or reversed interval omits only that placement. Stable interval diagnostic codes are:

- `layout.missing-task`;
- `layout.missing-segment`;
- `layout.missing-schedule`;
- `layout.unsupported-all-day-schedule`;
- `layout.non-finite-interval`;
- `layout.invalid-interval`.

The old `render.missing-task-schedule`, `render.non-finite-task-time`, and
`render.invalid-task-interval` codes are replaced when the scene adopts the interval
resolver. All intervals are half-open `[start, end)`.

### Implement deterministic stack layout with outer-height minimums

M3 supports only `stack`. Within each lane, working order is ascending interval start,
end, source order, then placement view key. Each interval takes the lowest numbered
track whose prior interval ends at or before its start. Final lane and placement
collections remain in resolved-view order.

Layout metrics contain a positive finite default minimum lane height and bar height,
plus finite non-negative top padding, bottom padding, and stack gap. Persisted lane
height and custom minimum height must be positive finite values and are interpreted as
minimum outer border-box heights.

Effective lane height is:

```text
max(
  lane minimum outer height,
  top padding + bottom padding
    + stack count * bar height
    + max(0, stack count - 1) * stack gap
)
```

An empty lane uses its minimum height. Lane offsets are contiguous from zero; bar
coordinates are absolute content coordinates.

### Keep viewport queries renderer-neutral and half-open

An immutable viewport kernel is built once from completed layout. It owns
binary-searchable lane boundary data and an augmented interval index per lane.

A query supplies a finite time range with `start < end`, a finite non-negative
`verticalStart`, and a finite positive `verticalExtent`. Its vertical range is
`[verticalStart, verticalStart + verticalExtent)`. A lane is visible only when its
outer range intersects that half-open range. A bar is visible only when its lane is
visible and its interval intersects the query time range.

Queries return visible lanes and bars in resolved-view order, absolute vertical
geometry, unchanged keys/provenance, and complete content bounds. Empty or
out-of-bounds queries return empty visible collections without changing bounds.
Horizontal clipping and normalized `x` coordinates are produced later by primitive
translation; the index retains time intervals, not renderer coordinates.

The interval index must find long intervals that begin before the query. Tests and
benchmarks may call an internal query entry point that reports visited lane candidates
and interval nodes. Those counters are ephemeral return values: they are not retained
in the kernel, scene, React state, or root package facade.

### Record a structural benchmark baseline without a timing threshold

The repeatable benchmark lives beside viewport code at
`packages/gantt/src/viewport/view-layout-viewport.bench.ts`. It uses a versioned
fixed-seed generator with 10,000 tasks and 2,000 lanes, document and resource views,
sparse and dense overlap, cold construction, and repeated warm queries.

The benchmark records runtime/tool versions, seed and generator version, host profile,
total and visible counts, query-work observations, and timing distributions. Indexed
results are checked against a brute-force oracle outside timed sections. M3 adds no
cross-machine wall-clock threshold and makes no browser frame-rate claim.

## Public and Private Boundary

M3 may export only `GanttViewDefinition` and the custom descriptor/source-reference
types required to pass `GanttProps.view`. Resolved views, branded resolved keys,
interval records, layout records, indexes, query-work counters, fixture generators,
and brute-force oracles remain package-private.

The M3 kernels are React-free and browser-free. `<Gantt>` is their first package
consumer. M4 may add runtime ownership and callbacks without changing the data-only
view or pure layout contracts.

## Testing Contract

Focused examples and fixed-seed properties must prove:

- deterministic resolution and immutable inputs for every view kind;
- stable provenance and valid resolved lane references;
- isolated interval omission and exact task/segment selection;
- lowest-available deterministic tracks and half-open touching behavior;
- stack count equal to brute-force maximum concurrency;
- contiguous variable lane offsets and exact content height;
- indexed viewport output exactly equal to a brute-force two-dimensional oracle;
- ordinary warm queries do not visit unrelated lanes or all intervals;
- document-view scene parity and one React path for all view kinds;
- no React, DOM, browser, clock, locale default, or host time-zone dependency in pure
  modules.

Property failures must expose their fixed seed and replay path.

## Consequences

- Callers get a small read-only view selector now instead of waiting for M4.
- Custom views remain explicit derived input rather than a second persistence model.
- Stable resolved keys are longer than raw entity IDs but cannot collide across legal
  source families.
- Invalid schedules remain recoverable while ambiguous lane topology fails closed.
- Variable-height geometry is available for M4 scrolling without introducing scroll
  ownership in M3.
- Benchmark evidence can prove index structure locally without overstating a portable
  latency or frame-rate guarantee.

## Revisit Triggers

Revisit this decision before:

- serializing a view definition or resolved output;
- accepting a resolver callback in the public React API;
- adding automatic segment expansion to built-in views;
- converting all-day schedules to instants;
- adding overlap policies other than `stack`;
- exposing resolved layout or viewport internals publicly;
- embedding viewport session state, hit testing, or overscan policy in the kernel;
- introducing stable performance thresholds.
