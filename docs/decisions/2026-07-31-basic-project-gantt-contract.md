# Decision: Basic Project Gantt Contract

Status: Accepted
Date: 2026-07-31
Owners: M5 basic project Gantt

## Context

M5 turns the completed document, change, view/layout/viewport, interaction, and item-
properties foundations into the complete Community project Gantt. The existing model
already carries task kinds, parent relationships, schedules, progress, and dependency
records, but M1-M4 intentionally did not fix their project-tree, summary, milestone,
graph, zoom, localization, RTL, or accessible editing semantics.

This decision resolves those boundaries before runtime behavior changes. It extends
the [document codec](2026-07-30-document-codec-contract.md),
[change kernel](2026-07-30-change-kernel-contract.md),
[view/layout/viewport](2026-07-30-view-layout-viewport-kernel-contract.md), and
[interaction runtime](2026-07-30-interaction-runtime-public-api-contract.md)
contracts. Implementation order and evidence are owned by the
[M5 implementation plan](../plans/2026-07-31-basic-project-gantt-plan.md).

The package is pre-alpha and has not been published. M5 therefore prefers a durable
first public contract over preserving an accidental unpublished shape. The only
canonical-data change accepted here is optional task sibling order inside schema
version 1. Other M5 state remains derived or session-owned.

## Decision

### Rework unpublished schema version 1 to carry task sibling order

`TaskRecord`, `TaskInput`, and `TaskUpdateCommand.changes` gain optional `order`:

```ts
interface TaskRecord {
  // existing fields
  readonly order?: number;
}

interface TaskInput {
  // existing fields
  readonly order?: number;
}

interface TaskUpdateCommand {
  readonly type: "task.update";
  readonly id: EntityId;
  readonly changes: Readonly<{
    // existing mutable fields
    order?: number | null;
  }>;
}
```

An order is a finite number. Within one parent, tasks sort by present order ascending,
then tasks without an order, then canonical task-array position, then ID. The array
position and ID are deterministic tie-breakers; they are not copied into `order`.
Root tasks are siblings under an implicit root. Reparenting keeps the task's existing
order unless the same command changes or clears it. M5 does not add a separate tree-
reorder command because `task.update` can change `parentId` and `order` atomically.

This is an in-place version-1 correction, not a migration. No version-1 package has
been published, the field is optional, and the codec continues to accept documents
that omit it. Serialization places `order` after `parentId`. Schema version 1 remains
the only accepted and emitted version.

### Build one deterministic hierarchy and recover malformed wire trees visibly

The pure hierarchy boundary indexes parent, ordered children, roots, depth, ancestors,
and descendants from canonical tasks. Only a `summary` task may own children. Ordinary
tasks and milestones are leaves.

Permissive document parsing repairs hierarchy faults after missing-parent recovery:

1. a self-parent edge is cleared;
2. an edge whose parent is not a summary is cleared;
3. for each remaining multi-task cycle, the `parentId` of the lexicographically
   smallest task ID in that cycle is cleared.

Each repair emits an error diagnostic at the cleared `parentId` path. Cycle entity IDs
start with the lexicographically smallest member and follow parent edges once around
the cycle. The diagnostic includes the closed path in structured details. Repairs do
not reorder or omit tasks, and unrelated trees remain unchanged. Stable codes are
`reference.task-parent-self`, `reference.task-parent-kind`, and
`reference.task-parent-cycle`.

Strict commands never repair intent. `task.add` and `task.update` reject a missing
parent, self-parent, non-summary parent, or descendant-parent cycle. Changing a
summary with children into a task or milestone rejects unless earlier commands in the
same ordered transaction first remove or reparent those children. Converting a leaf
to a summary is valid. Strict reparenting expands affected references to the moved
task and its descendants plus the old and new ancestor chains, because depth and
summary presentation can change throughout those sets.

### Extend only the project view with tree queries

The public project definition gains synchronous pure filter and comparator hooks:

```ts
export type GanttProjectTaskFilter = (task: TaskRecord) => boolean;
export type GanttProjectTaskComparator = (
  left: TaskRecord,
  right: TaskRecord,
) => number;

export interface ProjectViewDefinition {
  readonly kind: "project";
  readonly filter?: GanttProjectTaskFilter;
  readonly sort?: GanttProjectTaskComparator;
}
```

Hooks receive frozen canonical records, run only during pure view resolution, and
must not read the DOM, clock, host locale, or mutable external state. They are not
serialized. Callback identity is an invalidation input. A throw or non-finite
comparator result rejects project-view resolution with a structured `view.*`
diagnostic. Applications needing async data, persisted query definitions, grouping,
or a different topology continue to supply a custom view.

Filtering includes each direct match and its complete ancestor chain. It does not
include unmatched descendants merely because their summary matches. While a filter
is active, ancestors of direct matches are force-expanded for projection without
changing committed expansion state. Resolved rows distinguish `direct`, `ancestor`,
and unfiltered status. Sorting is sibling-local; comparator ties use canonical
sibling order. Neither operation rewrites task arrays, parents, order, schedules, or
dependencies.

Expansion is committed project session state:

```ts
interface GanttProjectSessionState {
  readonly collapsedTaskIds: readonly EntityId[];
}

interface GanttSessionState {
  // existing selection, focus, and vertical viewport
  readonly project?: GanttProjectSessionState;
}
```

An omitted `project` value means no collapsed branches, preserving the flat project's
current all-visible behavior and making newly added summaries visible by default.
Unknown, duplicate, or leaf IDs normalize away when an uncontrolled session is
adopted. Controlled sessions remain authoritative and receive one reconciled complete
session proposal. Collapse removes descendants from the visible occurrence catalog;
selection and focus reconcile through the existing occurrence rules, with one
localized announcement when the focused item becomes hidden.

Project rows are depth-first pre-order. Their lane and placement keys retain the M3
task-derived key for the same task, so expansion, filtering, sorting, and
virtualization do not change occurrence identity. Document, resource, and custom
views do not interpret task hierarchy or project query hooks.

### Derive summary geometry without persisting a Community rollup

Every project task resolves one presentation kind and optional presentation interval.
Instant schedules use their epoch boundaries. All-day boundaries convert to start-of-
day instants in the explicit instance `timeZone`; conversion is calendar- and DST-
aware and never uses the host zone.

An ordinary task uses its canonical schedule. A summary with at least one resolvable
child presentation interval uses the minimum child start and maximum child end,
recursively and independently of collapse or filtering. An empty summary, or one with
no resolvable child interval, falls back to its own canonical schedule. Unscheduled or
partially scheduled descendants do not prevent the usable descendants from producing
a span, but counts and diagnostics remain available to accessible details.

Summary progress is never calculated in Community. If canonical summary progress is
present, it is rendered read-only across the presentation span; if absent, no progress
is shown. The built-in properties surface may edit summary title, description,
appearance, parent, order, and kind, but summary schedule and progress remain read-
only. Derived spans and progress are never written back by rendering, filtering,
dependency changes, or zoom. Automatic schedule/progress rollups remain Pro.

A milestone renders as a point/diamond at its canonical start. Its valid schedule has
equal instant endpoints or equal all-day dates. Permissively parsed unequal milestone
schedules are preserved, diagnosed, and presented at the start; strict add/update or
kind conversion rejects an unequal result. Milestone progress is preserved as
canonical data but is not rendered or edited. The built-in properties surface may
edit the milestone point by writing equal endpoints, plus title, description,
appearance, parent, order, and kind. Milestones and summaries do not expose ordinary
move, resize, or direct-progress handles.

Scene and public task summaries carry semantic `kind`, `depth`, `hasChildren`,
`expanded`, optional filter-match status, and whether the interval is `canonical` or
`descendants`. Renderers consume those values; they do not rediscover hierarchy or
rollup policy.

### Analyze dependencies without moving task dates

The Community graph indexes incoming and outgoing links and traverses the directed
edge `fromTaskId -> toTaskId` for every dependency type. All four canonical types and
positive, zero, or negative lag values remain preservable. Elapsed lag is editable in
the built-in Community properties surface but has no scheduling effect. Working lag
is preserved and displayed read-only with an unsupported-Community diagnostic; its
calendar interpretation remains Pro.

A semantic duplicate has the same `fromTaskId`, `toTaskId`, and `type`; ID, lag, and
extension fields do not make a second relationship. All task kinds may be dependency
endpoints. Parsed duplicate links and cycles are preserved so the codec never loses
otherwise valid relationship data, but receive deterministic graph diagnostics.
Cycles use normalized strongly connected components and bounded paths independent of
dependency array order.

Strict dependency creation and mutation reject self-links, missing endpoints,
semantic duplicates, and any newly introduced directed cycle. Unrelated commands may
still operate on a document that already contains a diagnosed cycle. Deleting a link
or updating one so that an existing fault is removed is always permitted.

M5 adds the exact update command:

```ts
interface DependencyUpdateCommand {
  readonly type: "dependency.update";
  readonly id: EntityId;
  readonly changes: Readonly<{
    fromTaskId?: EntityIdInput;
    toTaskId?: EntityIdInput;
    type?: DependencyType;
    lag?: DurationInput | null;
    fields?: JsonObject | null;
  }>;
}
```

It produces the same normalized replacement patch, direct inverse, transaction,
history, affected-reference, and entity-change behavior as other updates. Dependency
commands never change task schedules.

### Give dependencies canonical identity and explicit hidden-endpoint behavior

Dependency selection and logical focus use canonical, occurrence-independent targets:

```ts
interface GanttDependencyTarget {
  readonly kind: "dependency";
  readonly dependencyId: EntityId;
}

type GanttInteractionTarget =
  | GanttLaneTarget
  | GanttTaskTarget
  | GanttDependencyTarget;

interface GanttDependencySummary {
  readonly dependency: DependencyRecord;
  readonly fromTitle: string;
  readonly hiddenEndpoint: boolean;
  readonly status: "invalid" | "valid";
  readonly target: GanttDependencyTarget;
  readonly toTitle: string;
}
```

Visible endpoints use kind-appropriate start/finish anchors. A descendant hidden by a
collapsed branch proxies to its nearest visible ancestor summary. A filtered endpoint
proxies only when one of its ancestors is present as filter context; otherwise the
visual path is omitted. A dependency whose two endpoints proxy to the same summary is
omitted visually. In every case the non-visual relationship summary retains the
canonical link and explains hidden endpoints.

Offscreen endpoints in the visible projection keep full content-space routes. The
viewport clips a route only when it intersects the timeline viewport and adds a
continuation marker at each clipped end. A route with no viewport intersection is not
painted. Path keys derive from dependency ID and resolved proxy endpoints, never from
visible array indexes. LTR/RTL changes geometry and marker orientation, not canonical
direction or dependency identity.

The public class/slot surface gains dependency path and marker parts plus a bounded
`DependencyProperties` overlay slot. The selector exposes immutable dependency
summaries, not graph indexes or route nodes. `GanttInteractionState` gains a `linking`
mode and `GanttInteractionAction` gains `dependency`; preview data names canonical
source/target intent without exposing pointer geometry internals.

### Provide one pointer and one non-visual dependency workflow

Pointer, pen, and touch users start a link from a visible task connection handle and
commit on a valid target. The initial type is finish-to-start with no lag; the
properties surface changes type or elapsed lag through `dependency.update`. Link
handles meet the existing coarse-pointer target policy and lose hit precedence to an
active resize or progress handle.

Keyboard users press `L` on a focused task to start the same finish-to-start mode,
navigate eligible visible task targets with the existing row navigation keys, press
Enter to commit, or Escape to cancel. Focused dependencies expose Enter for
properties and Delete/Backspace for removal. A relationships summary lists every
incoming/outgoing link and offers the same inspect, edit, and remove actions without
requiring SVG path focus. Every route produces one command, one acknowledgement, and
one history entry; rejection restores the initiating focus and announces the stable
diagnostic.

### Add clean controlled or uncontrolled range ownership and explicit scale policy

Horizontal range remains independent from `GanttSessionState`, but it becomes an
exclusive controlled/uncontrolled union:

```ts
type GanttRangeOwnership =
  | { readonly range: TimeRange; readonly defaultRange?: never }
  | { readonly range?: never; readonly defaultRange: TimeRange };
```

Exactly one is required. In controlled mode, navigation and zoom propose a range and
wait for the prop. In uncontrolled mode, the runtime adopts the range before emitting
`onRangeChange`. Existing controlled `range` usage keeps its meaning.

The legacy fixed tick props remain a source-compatible fixed-scale branch while the
new `timeScale` branch is explicit:

```ts
type GanttTimeScaleLevel =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

type GanttTimeScaleDefinition =
  | {
      readonly kind: "fixed";
      readonly tickAnchor: EpochMilliseconds;
      readonly tickInterval: number;
    }
  | {
      readonly kind: "adaptive";
      readonly minLevel?: GanttTimeScaleLevel;
      readonly maxLevel?: GanttTimeScaleLevel;
    };
```

`GanttProps` accepts either the existing required `tickAnchor`/`tickInterval` pair
with no `timeScale`, or a required `timeScale` with neither legacy prop. Adaptive
levels order minute to year. Calendar levels use explicit `locale` and `timeZone`;
they do not imply working-time compression. Invalid min/max order rejects the scale
input with a diagnostic and falls back to the nearest valid bound.

Adaptive selection uses range duration and measured timeline width. Before browser
measurement, SSR and the first hydration render use one fixed internal nominal width;
measurement may refine the level only after mount. This prevents markup from
depending on browser globals while avoiding a public fake-width prop.

Range proposals carry an additive typed event:

```ts
interface GanttRangeChangeEvent extends GanttSemanticEvent {
  readonly anchorTime?: EpochMilliseconds;
  readonly reason: "fit" | "pan" | "scroll" | "zoom";
}
```

`onRangeChange` receives this event in both ownership modes. The selector exposes the
accepted range and resolved semantic scale level. Zoom calculations preserve an
explicit anchor time at an explicit `0..1` viewport ratio, defaulting to the midpoint.
Level limits clamp rather than reject a valid zoom request.

The handle gains:

```ts
interface GanttZoomOptions {
  readonly anchorRatio?: number;
  readonly anchorTime?: EpochMilliseconds;
}

interface GanttFitToProjectOptions {
  readonly padding?: number;
}

interface GanttHandle {
  // existing methods
  zoomTo(level: GanttTimeScaleLevel, options?: GanttZoomOptions): boolean;
  fitToProject(options?: GanttFitToProjectOptions): boolean;
}
```

Fit uses every resolvable project presentation interval, including collapsed and
filtered tasks, and ignores dependency route detours. Padding is a finite non-negative
CSS-pixel inset per horizontal side and defaults to 24. An empty or wholly unscheduled
project is a localized announced no-op. Toolbar controls and plain `+`, `-`, and `0`
keys provide zoom in, zoom out, and fit. Alt/Option-wheel zooms around the pointer only
when the chart can accept a range change. M5 does not intercept Ctrl/Meta-wheel,
browser-native pinch zoom, or unmodified page-scroll gestures; custom touch pinch is
deferred.

### Localize semantic messages and formatters; require explicit instance direction

`locale` omission deterministically means `en-US`. Invalid locales diagnose and fall
back to `en-US`. Invalid time zones diagnose and fall back to `UTC`. Pure kernels
receive the normalized values and never read process or browser defaults.

The public localization surface combines typed templates and bounded formatter
callbacks:

```ts
type GanttMessageValue = number | string;
type GanttMessageValues = Readonly<Record<string, GanttMessageValue>>;

interface GanttMessageDescriptor {
  readonly defaultMessage: string;
  readonly key: GanttMessageKey;
  readonly values: GanttMessageValues;
}

type GanttMessageKey =
  | "chart.empty"
  | "chart.label"
  | "chart.read-only"
  | "common.cancel"
  | "common.delete"
  | "common.save"
  | "dependency.create"
  | "dependency.delete"
  | "dependency.edit"
  | "dependency.hidden-endpoint"
  | "dependency.incoming"
  | "dependency.invalid"
  | "dependency.lag"
  | "dependency.outgoing"
  | "dependency.relationships"
  | `dependency.type.${DependencyType}`
  | "field.appearance"
  | "field.description"
  | "field.end"
  | "field.kind"
  | "field.lag"
  | "field.lane"
  | "field.order"
  | "field.parent"
  | "field.progress"
  | "field.start"
  | "field.title"
  | "interaction.cancelled"
  | "interaction.committed"
  | "interaction.create"
  | "interaction.link"
  | "interaction.move"
  | "interaction.progress"
  | "interaction.rejected"
  | "interaction.resize"
  | "interaction.selection"
  | "properties.edit"
  | "properties.view"
  | "task.kind.milestone"
  | "task.kind.summary"
  | "task.kind.task"
  | "task.progress"
  | "task.unscheduled"
  | "tree.collapse"
  | "tree.expand"
  | "tree.filtered-ancestor"
  | "tree.hidden-focus"
  | "validation.summary"
  | "zoom.fit"
  | "zoom.in"
  | "zoom.out";

type GanttFormatUse =
  | "dependency-lag"
  | "progress"
  | "task-end"
  | "task-start"
  | "tick-major"
  | "tick-minor";

interface GanttFormatContext {
  readonly direction: "ltr" | "rtl";
  readonly locale: string;
  readonly timeZone: string;
  readonly use: GanttFormatUse;
}

interface GanttFormatters {
  readonly date?: (value: LocalDateString, context: GanttFormatContext) => string;
  readonly dateTime?: (value: EpochMilliseconds, context: GanttFormatContext) => string;
  readonly message?: (descriptor: GanttMessageDescriptor) => string;
  readonly number?: (value: number, context: GanttFormatContext) => string;
}

interface GanttBaseProps {
  readonly messages?: Partial<Readonly<Record<GanttMessageKey, string>>>;
  readonly formatters?: GanttFormatters;
  readonly direction?: "ltr" | "rtl";
}
```

Message keys are a closed union covering chart/tree labels, task kinds, property field
labels and actions, dependency types/actions/relationships, zoom controls, empty and
read-only states, interaction announcements, validation presentation, and focus
reconciliation. Templates use deterministic `{name}` replacement from descriptor
values. The message formatter receives the chosen template as `defaultMessage` and
may replace it. Date/date-time/number formatters receive `locale`, `timeZone`,
`direction`, and a semantic use such as tick, task boundary, progress, or lag. Empty
or throwing formatter output falls back with a `format.*` diagnostic.

Direction omission means `ltr`. M5 intentionally does not accept `auto`: direction
must not depend on a document, body, portal, or user-agent value that differs between
SSR and hydration. The root publishes `dir`, portals inherit the instance's explicit
direction, and all CSS/geometry/input logic uses that instance value. Two opposite-
direction charts on one page remain isolated.

### Keep SSR and package boundaries deterministic

Hierarchy, graph, query, route, scale, range, formatter-context, and RTL coordinate
engines stay React-, DOM-, browser-, clock-, and host-locale-independent. No module
scope reads browser globals. Server markup uses the supplied document, range, view,
locale, time zone, direction, messages, and the nominal adaptive width. Measurement,
media queries, and environment observation start after mount.

Root exports include only the public definitions needed by commands, `GanttProps`,
selectors, slots, and the handle. Hierarchy indexes, graph nodes, strongly connected
components, derived intervals, route geometry, tick candidates, formatter caches,
and coordinate transforms remain private. The package consumer, SSR, and hydration
proofs import only `@gantempo/gantt` and its documented stylesheet subpath.

### Use one reproducible M5 public example and final browser matrix

The public playground route is `/project`. Query parameters select
`ownership=controlled|uncontrolled|read-only`, `locale`, and `direction=ltr|rtl`
without changing the route's document fixture. The fixture contains a deep tree,
nested and empty summaries, instant and all-day milestones, unscheduled tasks,
multiple dependency types, a cycle diagnostic fixture that is opt-in rather than the
default usable graph, filter/sort controls, zoom/fit controls, and a non-visual
relationship summary.

Final Chrome DevTools verification records at least:

- controlled, `en-US`, LTR at 1440x1000;
- uncontrolled, `sr-Latn`, LTR at 390x844;
- read-only, `ar`, RTL at 390x844;
- controlled, `ar`, RTL at 1440x1000;
- reduced-motion and forced-colors emulation on the controlled desktop case;
- coarse-pointer/touch emulation on the controlled narrow case when the installed
  DevTools surface supports it.

Every case records the exact URL, viewport, treegrid and relationship semantics,
keyboard behavior, focus retention, overflow, console, and network state. Unsupported
emulation capability is recorded as unverified rather than silently claimed. SSR,
hydration, and the fresh tarball consumer use the same deterministic fixture inputs.

## Public and Private Boundary

M5 public additions are limited to the optional task order field and its command
input, dependency update command, project filter/sort callbacks, project session
state, dependency target/summary and bounded slot state, range ownership, scale/zoom
types, handle methods, message/formatter types, explicit direction, and semantic
summary fields needed by consumers.

All repair algorithms, indexes, resolved rows, presentation recursion, graph analysis,
route geometry, viewport clipping, scale selection, tick generation, and RTL math are
private pure engines. Public callbacks receive copied frozen semantic data, not those
engines or DOM state.

## Testing Contract

Each implementation slice must keep `mise run ci` green and add focused evidence for
its boundary. Across M5, fixed-seed examples and properties must prove:

- hierarchy recovery, strict reparenting, sibling order, ancestry, and immutability;
- filter/sort/collapse composition and stable occurrence identity;
- summary/milestone presentation across nested, partial, all-day, and boundary cases;
- graph indexes, duplicate/cycle diagnostics, mutation repair, and no date movement;
- dependency routing, clipping, proxy anchors, LTR/RTL parity, and viewport work;
- one-command/one-history pointer, coarse-pointer, and keyboard link workflows;
- zoom anchor invariance, fit padding, scale bounds, and repeated-round-trip stability;
- locale, time-zone, message, formatter, direction, SSR, hydration, and instance
  isolation;
- root-facade containment and fresh packed-package consumption.

Local timing observations remain structural evidence, not release thresholds or
frame-rate claims. M7 owns formal compatibility, conformance, and performance gates.

## Consequences

- Schema version 1 gains a small durable ordering field before publication instead of
  making incidental array position the only reordering mechanism.
- Project filtering and sorting are flexible pure callbacks, so callers own their
  determinism; custom or serializable query systems stay outside the document model.
- Default project expansion remains compatible and newly added branches do not
  unexpectedly disappear.
- Community summary spans are useful without claiming automatic persisted rollups.
- Parsed cycles remain inspectable and repairable, while strict edits cannot create
  new cycles.
- Existing fixed-scale controlled-range consumers remain valid; adaptive and
  uncontrolled behavior are explicit opt-ins.
- Localization and RTL cannot accidentally depend on host defaults, improving SSR and
  two-instance isolation at the cost of deliberately excluding `direction="auto"`.
- Native browser zoom and page gestures take precedence over a custom pinch feature.

## Revisit Triggers

Revisit this decision before:

- publishing a schema version that would require migrating task order;
- persisting expansion, filters, sorting, derived summaries, scale level, or range in
  `GanttDocument`;
- adding automatic schedules, working lag interpretation, persisted rollups, working-
  time compression, or calendars to Community;
- exposing internal hierarchy, graph, route, tick, or coordinate structures;
- adding `direction="auto"` or environment-derived SSR inputs;
- intercepting browser pinch or Ctrl/Meta-wheel zoom;
- claiming a browser, locale, accessibility, or performance matrix broader than the
  evidence actually run.

## Links

- [M5 implementation plan](../plans/2026-07-31-basic-project-gantt-plan.md)
- [M5 roadmap](../ROADMAP.md#m5-basic-project-gantt)
- [Architecture Slice 4](../ARCHITECTURE.md#slice-4-project-gantt-capabilities)
