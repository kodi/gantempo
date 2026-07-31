# Architecture: React Gantt and Scheduling Library

Status: Architecture baseline
Last updated: 2026-07-30

## 1. Executive summary

This repository will contain a React and TypeScript library for building:

- traditional project Gantt charts;
- resource and capacity planners;
- scheduling timelines with multiple entries per lane;
- read-only roadmaps and interactive planning applications.

The library must not model a lane as a task. Tasks, lanes, resource assignments, and
visual placements are separate concepts. This is the most important decision in the
architecture: it allows a task tree to be displayed one way in a project view and the
same data to be displayed across resource lanes in a scheduling view.

The implementation is divided into four layers:

1. A framework-independent, serializable data model.
2. Pure engines for commands, time calculations, scheduling, and layout.
3. A renderer-independent viewport made from render primitives.
4. React components, hooks, editors, themes, and accessibility surfaces.

The free and Pro editions use the same public model and extension system. Pro features
are installed as capabilities rather than implemented as conditionals scattered
throughout the free codebase.

## 2. Product goals

### 2.1 Required capabilities

The initial architecture must be capable of supporting:

- arbitrary numbers of lanes and entries;
- zero, one, or many entries in a lane;
- task hierarchies, summary tasks, and milestones;
- dependency links;
- task creation, editing, deletion, movement, and resizing;
- movement between lanes;
- controlled and uncontrolled React usage;
- JSON-compatible persistence and schema migration;
- custom columns, cells, bars, tooltips, editors, and menus;
- design-system integration through scoped tokens, stable parts, and typed slots;
- horizontal and vertical virtualization;
- React 18 and 19;
- SSR environments such as Next.js;
- responsive and compact layouts;
- equivalent pointer, touch, and keyboard workflows;
- keyboard and assistive-technology access;
- local undo/redo;
- extensible scheduling, calendars, resources, analytics, and export.

### 2.2 Product commitments

The architecture commits to the following product properties:

- Resource lanes and project task trees are both first-class views of the same model.
- Multiple entries per lane are supported from the first release.
- Core state and scheduling logic do not depend on React or the DOM.
- All user changes pass through typed, interceptable commands.
- Changes can be persisted as patches instead of requiring full-data replacement.
- Time zones and daylight-saving changes are explicit model concerns.
- The default renderer is accessible even when a high-performance canvas layer is used.
- Rendering, scheduling, persistence, and licensing are independent boundaries.
- Basic performance, accessibility, and API access are not artificially restricted in
  the free edition.

### 2.3 Non-goals for the initial release

- Building a complete project-management SaaS.
- Owning authentication, billing, or multi-tenant storage.
- Providing real-time collaboration in the first stable release.
- Supporting every scheduling constraint and interchange format immediately.
- Making application-specific business rules part of the core.

## 3. Architectural principles

### 3.1 Serializable state is the source of truth

Persistent state must contain plain data only. It must not contain React elements,
functions, DOM references, class instances, or mutable date objects.

### 3.2 Engines are pure and deterministic

Given the same document, command, configuration, and time-zone data, an engine must
produce the same result. Pure engines are easier to test, run in a worker, use on a
server, and integrate with collaborative systems.

### 3.3 Commands change data; queries derive data

User interactions never mutate records directly. They propose typed commands. Commands
are validated and reduced into a new document plus a patch set. Layout, visibility,
resource load, and critical path are derived queries.

### 3.4 Rendering consumes primitives

Renderers do not interpret business rules. They receive visible primitives such as
lane rectangles, task rectangles, handles, dependency paths, grid lines, and labels.

### 3.5 Capabilities are composable

Advanced features register commands, validators, derived queries, render layers, UI
contributions, or exporters through a stable capability registry.

### 3.6 Public APIs are deliberately small

Only package entry-point exports are public. Internal modules must not be imported by
consumers. Experimental APIs live under an explicit `experimental` export.

## 4. High-level system

```mermaid
flowchart LR
    A["Application data / JSON"] --> B["Codec and normalization"]
    B --> C["Document state"]
    C --> D["Indexes and derived state"]
    D --> E["Time and scheduling engines"]
    D --> F["Lane and item layout"]
    E --> F
    F --> G["Viewport virtualizer"]
    G --> H["Render primitives"]
    H --> I["DOM / SVG renderer"]
    H --> J["Canvas renderer"]
    I --> K["React Gantt"]
    J --> K
    K --> L["User interaction"]
    L --> M["Typed command bus"]
    M --> N["Validation and interception"]
    N --> C
    M --> O["Patch stream / persistence"]
```

## 5. Repository and package structure

Use one public, mixed-license monorepo. Internal packages preserve architectural
boundaries, but the initial public installation experience exposes only two primary
packages:

- `@gantempo/gantt`, the MIT Community edition;
- `@gantempo/gantt-pro`, one commercially licensed bundle of paid capabilities.

Pro is additive: applications keep the Community component, model, document, and state
ownership, then install and register Pro capabilities. The Pro package is not a fork,
replacement component, or separately owned copy of the public model.

```text
.
├── apps/
│   ├── docs/                    # Documentation website
│   ├── playground/              # Interactive development playground
│   └── benchmarks/              # Repeatable performance scenarios
├── examples/
│   ├── basic-gantt/
│   ├── resource-planner/
│   ├── controlled-state/
│   ├── nextjs/
│   └── persistence/
├── packages/
│   ├── model/                   # Records, IDs, schemas, codecs, migrations
│   ├── commands/                # Command bus, reducers, patches, history
│   ├── time/                    # Scales, time zones, snapping, calendar primitives
│   ├── layout/                  # Lane, item, label, and dependency layout
│   ├── viewport/                # Virtualization and spatial indexes
│   ├── scheduler/               # Basic dependency graph and validation
│   ├── renderer-svg/            # Default DOM/SVG renderer
│   ├── renderer-canvas/         # Optional high-density renderer
│   ├── react/                   # Components, hooks, editors, accessibility
│   ├── theme-default/           # CSS variables and default visual theme
│   ├── adapters/                # REST and persistence interfaces
│   └── gantt/                   # Public free-edition facade
├── pro/
│   ├── scheduling/              # Calendars, constraints, auto-scheduling
│   ├── resources/               # Assignments, utilization, workload
│   ├── analytics/               # Critical path, slack, baselines, variance
│   ├── import-export/           # PDF, PNG, XLSX, MS Project
│   ├── audit/                   # Persistent history and audit utilities
│   └── gantt-pro/               # Public Pro facade and capability bundle
├── tooling/
│   ├── eslint/
│   ├── test-data/
│   └── release/
└── ARCHITECTURE.md
```

Internal packages may be workspace-only initially. They should be separately
publishable later without requiring a rewrite.

The repository root identifies the mixed-license layout, and each publishable package
carries its own license file and matching package metadata. Community-owned sources
must not inherit a commercial restriction, and Pro-owned sources must not accidentally
inherit an MIT grant from an ambiguous root license. Commercial EULA, redistribution,
OEM, and source-use terms require qualified legal review before the first Pro release.

The source, package, activation, release, and customer-deployment contracts are fixed
by the
[Community and Pro distribution and licensing decision](decisions/2026-07-30-community-pro-distribution-licensing.md).

## 6. Domain model

### 6.1 Work, capacity, and presentation are separate

A `Task` describes work. A `Resource` describes a person, asset, room, or capacity
pool. An `Assignment` connects work to a resource and records allocation. A `Lane`
describes where work is displayed. A `Placement` maps a task, assignment, or task
segment into a lane. A `Segment` describes an execution interval within a task.

These entities must not be collapsed into one row record. In particular, an assignment
does not imply a lane and a lane does not imply a resource. A resource-oriented view
may associate a lane with a resource, while status, team, portfolio, and other views
may use lanes that have no resource.

This supports all of the following without changing the source task records:

- one task per row;
- multiple tasks in a resource lane;
- one task assigned to multiple resources;
- one task or assignment displayed in multiple views;
- task grouping by status, team, priority, or arbitrary fields;
- switching between task-tree and resource-planning views;
- split tasks.

Views may derive placements from tasks or assignments. Persisted placements are used
only when the application needs an explicit, stable display mapping. Layout always
consumes normalized `ResolvedPlacement` values, regardless of whether they were
persisted or derived.

The M3 view boundary accepts data-only document, flat project, flat resource, and
application-defined views. Resolved view keys are distinct from canonical entity IDs,
and explicit provenance is retained through layout and rendering. Ambiguous view
topology fails closed, while an invalid individual interval is omitted with a
structured diagnostic. These identity, ordering, interval, and error semantics are
fixed by the
[view, layout, and viewport kernel contract](decisions/2026-07-30-view-layout-viewport-kernel-contract.md).

### 6.2 Persistent document

```ts
export interface GanttDocument {
  schemaVersion: number;
  revision?: string | number;
  tasks: TaskRecord[];
  resources?: ResourceRecord[];
  lanes?: LaneRecord[];
  assignments?: AssignmentRecord[];
  placements?: PlacementRecord[];
  dependencies?: DependencyRecord[];
  calendars?: CalendarRecord[];
  baselines?: BaselineRecord[];
  metadata?: Record<string, JsonValue>;
}

export interface TaskRecord {
  id: EntityId;
  title: string;
  description?: string;
  kind?: "task" | "summary" | "milestone";
  parentId?: EntityId;
  schedule?: TaskSchedule;
  progress?: number;
  appearance?: GanttAppearanceReference;
  segments?: TaskSegment[];
  calendarId?: EntityId;
  constraint?: TaskConstraint;
  fields?: Record<string, JsonValue>;
}

export type TaskSchedule =
  | {
      mode: "instant";
      start?: EpochMilliseconds;
      end?: EpochMilliseconds;
      duration?: DurationValue;
      durationMode?: "elapsed" | "working";
    }
  | {
      mode: "all-day";
      startDate?: LocalDateString;
      endDate?: LocalDateString;
      durationDays?: number;
      durationMode?: "elapsed" | "working";
    };

export interface TaskSegment {
  id: EntityId;
  schedule: TaskSchedule;
}

export interface LaneRecord {
  id: EntityId;
  title: string;
  appearance?: GanttAppearanceReference;
  parentId?: EntityId;
  resourceId?: EntityId;
  order?: number;
  height?: number;
  calendarId?: EntityId;
  fields?: Record<string, JsonValue>;
}

export interface GanttAppearanceReference {
  variant: string;
}

export interface ResourceRecord {
  id: EntityId;
  title: string;
  parentId?: EntityId;
  capacity?: number;
  calendarId?: EntityId;
  fields?: Record<string, JsonValue>;
}

export interface AssignmentRecord {
  id: EntityId;
  taskId: EntityId;
  resourceId: EntityId;
  allocation?: number;
  effort?: DurationValue;
  role?: string;
  fields?: Record<string, JsonValue>;
}

export interface PlacementRecord {
  id: EntityId;
  taskId: EntityId;
  laneId: EntityId;
  assignmentId?: EntityId;
  segmentId?: EntityId;
  order?: number;
  fields?: Record<string, JsonValue>;
}

export interface DependencyRecord {
  id: EntityId;
  fromTaskId: EntityId;
  toTaskId: EntityId;
  type: "finish-to-start" | "start-to-start" | "finish-to-finish" | "start-to-finish";
  lag?: DurationValue;
}
```

### 6.3 Model rules

- IDs are opaque strings at runtime. Numeric input IDs are normalized to strings.
- Intervals are half-open: `[start, end)`.
- Instant schedules persist time as epoch milliseconds.
- All-day schedules persist ISO local dates and are not coerced to midnight instants in
  the document.
- An IANA time-zone ID is supplied separately for display and calendar calculations.
- Persisted state never contains JavaScript `Date` objects.
- A schedule may provide its start and end or its start and duration. Normalization
  resolves this to a canonical interval and reports conflicting inputs.
- Elapsed and working durations are distinct. Calendar rules affect only working
  durations.
- Milestones have zero duration.
- Summary dates are either manual or derived; the selected policy is explicit.
- Assignments always reference a task and a resource; they never reference a lane.
- Allocation and capacity use the same non-negative unit scale; `1` represents one
  full-capacity unit unless an application documents a different scale.
- A lane may reference a resource, but non-resource lanes are equally valid.
- A lane calendar controls presentation, snapping, or collision behavior. Scheduling
  uses task, resource, and project calendars according to explicit precedence.
- A placement always references a task and lane. Its optional assignment must belong to
  that task, and its optional segment must belong to that task.
- Task and segment intervals are scheduling truth. Placements do not carry independent
  dates; layout resolves their intervals from the referenced task or segment.
- Derived placements are session/derived data and are not serialized. Persisted
  placements have stable IDs and participate in commands and patches.
- All extension fields must be JSON-compatible.
- Referential integrity is checked during normalization and command validation.

### 6.4 JSON codec

The codec boundary accepts ergonomic wire formats such as ISO-8601 strings and returns
the canonical runtime document. It is responsible for:

- validation;
- ID normalization;
- date parsing;
- default values;
- schema-version migrations;
- actionable diagnostics;
- serialization back to stable JSON.

Do not mix parsing logic into React components.

The accepted schema-version, wire-date, recovery, duplicate, unknown-field, and
deterministic-serialization rules are fixed by the
[document codec contract](decisions/2026-07-30-document-codec-contract.md). Private
Zod 4 Mini schemas are the executable authority for scalar, schedule, duration,
segment, and record structure. Gantempo orchestration remains authoritative for
migrations, partial recovery, stable diagnostics, unknown-property warnings,
duplicates, relationships, JSON extension cloning, freezing, and deterministic
serialization. Runtime schemas do not enter render, layout, viewport, or interaction
hot paths and are not part of the public API.

## 7. State architecture

Each interaction-runtime instance keeps five categories distinct. Only document state
is persistent business data; committed session fields may be persisted separately by
an application when useful.

### 7.1 Document state

Serializable business data:

- tasks;
- resources;
- lanes;
- assignments;
- explicit placements;
- dependencies;
- calendars;
- baselines;
- user-defined fields.

### 7.2 Session state

Committed user-interface state:

- selected and logically focused view occurrences;
- expanded task and lane IDs;
- application-meaningful viewport intent and zoom level;
- column widths;
- temporary filters and sorting.

Applications may choose to persist selected session fields, but they do not belong to
the document by default.

### 7.3 Transient interaction state

Per-instance operational values that never enter document or committed session state:

- active pointer or keyboard gesture;
- drag and resize previews;
- pending command/interceptor and controlled-acknowledgement state;
- active editor, tooltip, and menu state;
- element measurement and scheduled browser publication;
- focus reconciliation and live announcement text.

### 7.4 History state

Bounded forward/inverse patch entries, undo/redo branches, and controlled
acknowledgement metadata are local operational state. They are not serialized into
`GanttDocument` or treated as a persistent audit log.

### 7.5 Derived state

Recomputable data:

- entity indexes;
- visible flattened trees;
- scheduled dates;
- resource load;
- critical path and slack;
- resolved placements;
- lane stacks;
- dependency geometry;
- render primitives.

Derived state is cached by document revision and relevant configuration. It must never
be serialized as authoritative data.

The exact M4 ownership and public-snapshot boundary is fixed by the
[interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md).

## 8. Commands, patches, and events

### 8.1 Command model

Every mutation is represented by a discriminated union:

```ts
export type SchedulePoint = EpochMilliseconds | LocalDateString;

export type GanttCommand =
  | { type: "task.add"; task: TaskInput; parentId?: EntityId }
  | { type: "task.update"; id: EntityId; changes: Partial<TaskRecord> }
  | { type: "task.move"; id: EntityId; start: EpochMilliseconds; delta?: never }
  | { type: "task.move"; id: EntityId; delta: number; start?: never }
  | {
      type: "task.resize";
      id: EntityId;
      edge: "start" | "end";
      time: EpochMilliseconds;
    }
  | { type: "task.split"; id: EntityId; at: SchedulePoint }
  | { type: "task.delete"; id: EntityId; cascade?: boolean }
  | { type: "resource.add"; resource: ResourceInput }
  | { type: "resource.update"; id: EntityId; changes: Partial<ResourceRecord> }
  | { type: "lane.add"; lane: LaneInput }
  | { type: "lane.update"; id: EntityId; changes: Partial<LaneRecord> }
  | { type: "assignment.set"; assignment: AssignmentInput }
  | { type: "assignment.delete"; id: EntityId }
  | { type: "placement.add"; placement: PlacementInput }
  | { type: "placement.move"; id: EntityId; laneId: EntityId }
  | { type: "placement.delete"; id: EntityId }
  | { type: "dependency.add"; dependency: DependencyInput }
  | { type: "dependency.delete"; id: EntityId }
  | { type: "transaction"; commands: GanttCommand[] };
```

### 8.2 Command lifecycle

```text
propose
  -> normalize
  -> before-command interceptors
  -> validate
  -> reduce
  -> schedule/derive affected records
  -> produce patches
  -> project changed entity rows
  -> produce an immutable document-change candidate
  -> deliver the candidate to controlled/uncontrolled ownership
  -> adopt in uncontrolled mode or acknowledge through the controlled document prop
  -> commandCommitted or commandRejected
  -> application persistence hook or persistence adapter
```

Interceptors can:

- allow a command;
- reject it with a typed reason;
- modify it;
- replace it with a transaction.

Reducer acceptance and authoritative runtime commitment are distinct in controlled
mode. `onDocumentChange` delivers the accepted candidate and its immutable change
envelope. A controlled consumer acknowledges it by updating local React or external
store state; it must not wait for an HTTP request. `commandCommitted` fires only after
uncontrolled adoption or controlled prop acknowledgement. A later server revision is
an external authoritative document update, not the first acknowledgement of the local
candidate.

Before-command interceptors express command policy and validation. Persistence I/O
runs after candidate delivery and must not be implemented as an interceptor that
blocks local controlled acknowledgement.

### 8.3 Patch format

The core uses one versioned ID-keyed domain patch format. Existing entities are
located by collection plus stable ID; add patches carry an insertion index only to
preserve canonical collection order. A replacement contains one complete canonical
record, including a task's owned segments.

```ts
export type DocumentCollection =
  | "tasks"
  | "resources"
  | "lanes"
  | "assignments"
  | "placements"
  | "dependencies";

export interface EntityReference {
  readonly collection: DocumentCollection;
  readonly id: EntityId;
}

export type DomainRecord =
  | TaskRecord
  | ResourceRecord
  | LaneRecord
  | AssignmentRecord
  | PlacementRecord
  | DependencyRecord;

export type GanttPatch =
  | {
      readonly patchVersion: 1;
      readonly op: "add";
      readonly target: EntityReference;
      readonly index: number;
      readonly value: DomainRecord;
    }
  | {
      readonly patchVersion: 1;
      readonly op: "replace";
      readonly target: EntityReference;
      readonly value: DomainRecord;
    }
  | {
      readonly patchVersion: 1;
      readonly op: "remove";
      readonly target: EntityReference;
    };

export interface CommandResult {
  readonly document: GanttDocument;
  readonly patches: readonly GanttPatch[];
  readonly inversePatches: readonly GanttPatch[];
  readonly affected: readonly EntityReference[];
  readonly diagnostics: readonly Diagnostic[];
}
```

Reducers emit forward and ready-to-apply inverse patches directly; they do not diff
whole documents after mutation. Patch batches apply atomically and are strictly
validated on their final candidate document. Rejected commands retain the original
document and return empty patch, inverse, and affected arrays.

Every non-empty runtime document-change envelope also includes a frozen
`entityChanges` projection. It identifies each first-touched collection-plus-ID once
as a `create`, `update`, or `delete`; updates contain explicit canonical `before` and
`after` rows. Repeated patches to one entity inside a transaction collapse to the
operation's base and final row values. Undo and redo describe the row direction being
applied now. This is an application-facing persistence view over the existing
patch-authoritative result, not another reducer or inversion format.

The entity family is part of the affected identity because IDs may repeat across
families. Local commands preserve the document revision; persistence adapters own
base revisions, operation IDs, server revisions, retries, and conflict handling.

RFC 6902 JSON Patch is not a second core representation because array-index paths do
not provide stable entity identity. An external persistence adapter may translate a
committed domain patch batch when a backend requires JSON Patch.

These semantics are fixed by the
[change-kernel contract](decisions/2026-07-30-change-kernel-contract.md). Patches make
undo/redo, optimistic persistence, audit trails, and future collaboration possible
without coupling the library to a specific state manager.

The additive row-oriented projection is fixed by the
[persistence entity-change decision](decisions/2026-07-31-persistence-entity-change-projection.md).

### 8.4 Events

Expose two event levels:

- semantic events such as `taskClick`, `selectionChange`, and `viewportChange`;
- command events such as `beforeCommand`, document-change candidate delivery,
  `commandCommitted`, and `commandRejected`.

Do not create separate mutation pathways for toolbar, context-menu, keyboard, and API
operations. They must dispatch the same commands.

Gestures that change more than one domain concept dispatch transactions. For example,
moving work to a different resource may update an assignment and a placement, while a
pure visual regrouping changes only the placement. The interaction layer must not hide
those differences inside a generic row move.

M4 movement and resize are instant-only. Calendar-aware or all-day movement remains a
later command specialization. Ownership, interception, candidate acknowledgement,
event ordering, history replay, occurrence targeting, and mapper semantics are fixed
by the
[interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md).

## 9. Public React API

### 9.1 Controlled usage

```tsx
<Gantt
  document={document}
  range={range}
  onDocumentChange={(change) => {
    setDocument(change.document); // acknowledge locally without waiting for the server
    persistenceQueue.enqueue(change);
  }}
  onRangeChange={setRange}
  view={{ kind: "resource" }}
  timeZone="Europe/Belgrade"
/>
```

The change envelope includes row-oriented `entityChanges`, a local proposal ID, base
revision, original and final commands, source, patches, inverse patches, and affected
references. Ordinary database adapters should begin with `entityChanges`; patches
remain available for atomic replay and rollback. The proposal ID correlates runtime
callbacks and controlled acknowledgement; it is not the backend's retry-safe
operation ID.

### 9.2 Uncontrolled usage

```tsx
<Gantt
  defaultDocument={document}
  range={range}
  onDocumentChange={(change) => persist(change.entityChanges)}
/>
```

Document ownership is an exclusive `document`/`defaultDocument` union. Committed
selection, logical focus, and vertical viewport intent use one independently
controlled or uncontrolled session value. M4 keeps the existing horizontal `range`
controlled and uses `onRangeChange` for edge-pan, imperative, wheel, trackpad,
mouse-grab, and keyboard-page requests; it does not add `defaultRange` before M5
fixes adaptive zoom policy.

#### 9.2.1 Timeline navigation

Horizontal navigation pans the semantic time range rather than a wide DOM canvas.
Accepted pixel deltas preserve the finite positive range duration and are coalesced
through one transient per-instance proposed-range accumulator. A chart without
`onRangeChange` does not claim horizontal navigation input, and read-only document
state does not disable viewport navigation.

The derived pipeline keeps a private viewport-independent occurrence catalog beside
viewport-filtered render primitives. The full catalog owns selection and logical
focus existence, offscreen reveal, and keyboard geometry; visible primitives remain
the only paint, hit-test, and public selector surface. Viewport exclusion therefore
does not mean occurrence deletion, and horizontal or vertical navigation reuses
completed topology, interval, and layout work.

Wheel/trackpad axis and modifier handling, pointer conflict rules, focus handoff,
keyboard paging, browser-zoom exclusion, and the private/public occurrence boundary
are fixed by the
[timeline navigation interaction contract](decisions/2026-07-30-timeline-navigation-interaction-contract.md).
Zoom, pinch, uncontrolled range ownership, semantic horizontal scrollbars, and
calendar-aware navigation remain M5 work.

### 9.3 Imperative handle

The component ref may expose orchestration methods, not a second state model:

```ts
export interface GanttHandle {
  dispatch(command: GanttCommand): Promise<GanttDispatchResult>;
  getDocument(): GanttDocument;
  getSession(): GanttSessionState;
  getSelection(): readonly GanttInteractionTarget[];
  focusTask(target: GanttTaskTarget): boolean;
  scrollToTask(target: GanttTaskTarget, options?: GanttScrollOptions): boolean;
  scrollToTime(time: EpochMilliseconds, options?: GanttScrollOptions): boolean;
  undo(): Promise<GanttDispatchResult>;
  redo(): Promise<GanttDispatchResult>;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

M4 deliberately omits `fitToProject` and `zoomTo`; M5 owns those policies.

### 9.4 Customization

Customization is provided through typed slots and contribution registries:

- semantic theme tokens;
- stable part and state attributes;
- typed `classNames` and portable appearance resolvers;
- task and milestone content;
- lane headers;
- grid cells and columns;
- tooltips;
- task editor tabs;
- toolbar and context-menu actions;
- time headers;
- non-working-time backgrounds;
- dependency markers;
- empty-lane content.

Prefer component slots receiving data and behavior props over arbitrary HTML strings.
Visual customization must not require consumers to target undocumented DOM structure.
The detailed contract is defined in [UI and theming](UI_THEMING.md).

### 9.5 Item properties and progress

The post-M4 item-properties appendix adds one selection-driven task/lane properties
surface on the existing runtime and command bus. Canonical task description and
task/lane semantic appearance remain plain optional schema-version-1 data. The
surface edits ordinary instant tasks and canonical persisted placements only; IDs,
task kind, derived duration, linked resource identity, ambiguous topology, milestone
progress, and summary progress remain read-only where policy is incomplete.

Progress remains the task's finite `0..1` numeric value. Properties, pointer, and
keyboard workflows produce `task.update` through the same interception,
acknowledgement, patch, history, and event lifecycle. Semantic variant resolution
coordinates task, progress, text, border, and restrained lane treatments without
persisting theme values. The exact persistence, precedence, compatibility, editor,
and accessibility contract is fixed by the
[item-properties, semantic-appearance, and progress decision](decisions/2026-07-31-item-properties-semantic-appearance-progress.md).

The public interaction summary names direct progress explicitly: pointer preview is
`progressing`, keyboard mode/action is `progress`, and the preview carries the
proposed canonical fraction. The visible `progress-handle`, its typed class hook, and
the `progressing` class state are public; renderer hit geometry and enlarged
coarse-pointer targets remain private.

### 9.6 Subscriptions and React ownership

The public API remains declarative in controlled and uncontrolled modes. Internally,
React surfaces subscribe to the smallest useful state slice:

```ts
export function useGanttSelector<T>(
  selector: (state: GanttSelectorSnapshot) => T,
  isEqual?: (previous: T, next: T) => boolean
): T;
```

The public selector snapshot contains authoritative document/session values and narrow
interaction, history-capability, viewport, and visible-occurrence summaries. Private
resolved views, layouts, viewport indexes, caches, queues, and history entries are not
selector state. A command affecting one task or lane must not force every visible cell
and bar to re-render. The imperative handle remains limited to commands, viewport
orchestration, focus, and reading snapshots; it is never the primary data-binding API.

## 10. Rendering and layout

### 10.1 Rendering pipeline

```text
normalized document
  -> filtered/sorted view
  -> flattened visible lanes
  -> resolved placements and scheduled intervals
  -> overlap/stack layout
  -> viewport intersection
  -> render primitives
  -> renderer
```

### 10.2 Default renderer

Use a hybrid DOM/SVG renderer initially:

- DOM for the grid, lane headers, editors, menus, and accessible focus targets;
- SVG for task bars, dependencies, grid overlays, and interaction handles;
- CSS transforms for movement during drag;
- React portals for tooltips and dialogs.

Portals must cross accidental chart clipping and stacking boundaries by default.
Each React instance owns a themed fixed overlay wrapper under its owning document
body, while a public container contract supports application overlay roots, shadow
roots, and an explicit chart-local mode. Menus and tooltips use collision-adjusted
coordinates in the selected boundary; modal editors cover and isolate that boundary.
An iframe remains a document boundary and requires host integration to present UI in
its parent. The durable behavior is fixed in the
[overlay boundary contract](decisions/2026-07-30-overlay-boundary-contract.md).

SVG is the default because it offers easier customization, hit testing, text handling,
and accessibility than canvas during the early releases.

### 10.3 Canvas renderer

Keep layout and hit testing renderer-independent so a canvas renderer can be added for
high-density scenarios. The canvas renderer should:

- consume the same primitive list;
- use a spatial index for hit testing;
- retain a DOM accessibility overlay for focused and visible items;
- share editors and menus with the default renderer;
- be selected through a renderer capability, not a different component API.

The canvas renderer should be promoted to the default only if benchmarks demonstrate a
material improvement without reducing accessibility or customization.

### 10.4 Theming and design systems

The theming promise is **Tailwind-native without Tailwind lock-in**. Tailwind users get
a first-class token bridge, stable selectors, and utility-friendly React slots, while
the library itself has no Tailwind runtime or peer dependency.

The architectural rules are:

- required structural CSS and optional visual themes are separate;
- semantic CSS custom properties are scoped to each Gantt root, never global;
- documented `data-gt-part`, kind, variant, and state attributes are public contracts;
- typed slots and `classNames` customize React surfaces without exposing internal DOM;
- a portable appearance API, rather than DOM CSS alone, drives canvas and export;
- one resolved semantic theme feeds DOM, SVG, canvas, portals, and visual export;
- built-in themes include light, dark, and high-contrast modes plus density presets;
- paint-token changes do not invalidate layout, while metric-token changes do so
  explicitly;
- strict Content Security Policy usage does not require runtime style injection.

Themes belong to view configuration, not the persistent `GanttDocument`. Multiple
instances with different themes must coexist, and portalled UI must retain the theme of
its owning instance. See [UI and theming](UI_THEMING.md) for tokens, packages, Tailwind
integration, renderer parity, and acceptance criteria.

Documents may persist only bounded semantic appearance IDs on tasks and lanes. The
instance registry resolves those IDs to coordinated task fill, progress fill, text,
border, lane accent, and lane surface tokens. Resolution uses theme/kind defaults,
lane appearance, a source-compatible view-only `taskVariants` fallback, persisted task
appearance, then derived system state. Unknown valid IDs survive document round trips,
fall back deterministically, and are diagnosed once per ID and registry revision. The
accepted contract is recorded in the
[item-properties, semantic-appearance, and progress decision](decisions/2026-07-31-item-properties-semantic-appearance-progress.md).

### 10.5 Lane overlap strategies

Each lane can select an overlap policy:

- `stack`: assign overlapping entries to subrows;
- `overlay`: render entries in the same vertical space;
- `compress`: reduce entry height to fit;
- `reject`: prevent overlapping moves through command validation;
- custom policy supplied by a capability.

Layout returns the effective height of each lane, allowing virtual scrolling with
variable-height rows.

M3 implements deterministic `stack` first. It assigns half-open intervals to the
lowest available track in start, end, source-order, and stable-key order. Persisted
and application-defined lane heights are minimum outer heights, so dense stacks grow
instead of clipping.

### 10.6 Virtualization

Virtualize both dimensions:

- vertically by flattened lane range;
- horizontally by time-window intersection.

Maintain:

- prefix sums for variable lane heights;
- interval indexes for tasks intersecting the visible time range;
- a spatial index for visible primitives;
- overscan tuned separately for scrolling and dragging.

Only dirty lanes, tasks, dependencies, and time ranges should be recalculated after a
command.

The M3 viewport kernel is immutable and renderer-neutral: it uses variable-height lane
boundary data plus augmented interval indexes, returns absolute vertical geometry,
and leaves horizontal normalization to primitive generation. Viewport session state,
overscan policy, and hit testing remain interaction-runtime concerns. The exact query
and boundary semantics are fixed by the
[view, layout, and viewport kernel contract](decisions/2026-07-30-view-layout-viewport-kernel-contract.md).

## 11. Time and calendar architecture

Time handling is a dedicated package.

### 11.1 Time scale

The scale converts between time and pixels:

```ts
export interface TimeScale {
  timeToX(time: number): number;
  xToTime(x: number): number;
  getTicks(range: TimeRange, level: ScaleLevel): ScaleTick[];
  snap(time: number, context: SnapContext): number;
}
```

It must support:

- minute through year units;
- custom headers;
- locale-aware labels;
- zoom anchored under the pointer;
- fixed and adaptive scales;
- right-to-left layout;
- optional non-linear working-time compression.

### 11.2 Calendar engine

Calendar math must operate on an IANA time zone and explicit working intervals. It must
not assume that a day is always 24 hours.

The calendar engine supports:

- weekly working rules;
- holidays and exceptions;
- shifts;
- task calendars;
- resource calendars;
- adding and subtracting working duration;
- calculating working duration between instants.

The core defines calendar interfaces and simple continuous-time behavior. Advanced
working calendars are installed by Pro.

## 12. Scheduling architecture

Scheduling is independent of rendering and React.

### 12.1 Basic free scheduler

The free scheduler provides:

- dependency graph construction;
- link-type validation;
- cycle detection;
- dependency visualization;
- diagnostics for invalid links;
- manual task dates.

### 12.2 Pro scheduling pipeline

The Pro engine runs ordered stages:

1. Normalize tasks, constraints, dependencies, and calendars.
2. Validate graph and constraint consistency.
3. Calculate task working durations.
4. Propagate all dependency types, including positive and negative lag.
5. Apply project and task constraints.
6. Recalculate summary intervals and progress.
7. Calculate early and late dates.
8. Calculate critical path and slack.
9. Calculate baselines and schedule variance.
10. Calculate resource utilization.

Stages implement a common interface and publish diagnostics. This allows additional
constraint types without turning the scheduler into one large function.

The scheduler accepts an explicit `direction: "forward" | "backward"` policy. The
direction, project anchor, summary policy, calendar precedence, and conflict policy are
inputs to the calculation and never inferred from UI state.

### 12.3 Explainable schedule results

A successful calculation returns more than final dates:

```ts
export interface ScheduleResult {
  document: GanttDocument;
  changes: ScheduleChange[];
  explanations: ScheduleExplanation[];
  diagnostics: Diagnostic[];
}

export interface ScheduleExplanation {
  code: string;
  entityId: EntityId;
  message: string;
  causeEntityIds?: EntityId[];
  previous?: JsonValue;
  next?: JsonValue;
  details?: Record<string, JsonValue>;
}
```

Explanations cover dependency or constraint propagation, calendar intervals skipped,
capacity violations, rejected requested dates, and changes between schedule revisions.
Their codes and structured details are stable enough for application UI and tests;
human-readable messages may be localized. Fatal graph or constraint problems remain
diagnostics and prevent an authoritative commit.

### 12.4 Worker execution

The engine must be able to run synchronously or through a Web Worker. Worker messages
contain serializable documents, configuration, commands, and patches only.

Use optimistic drag previews in the UI and reconcile them with the authoritative worker
result after the pointer is released.

## 13. Free and Pro capability boundaries

### 13.1 Free edition

The free package should include:

- the canonical document model, codec, diagnostics, and migrations;
- React and TypeScript APIs;
- arbitrary lanes and multiple entries per lane;
- task tree, summaries, and milestones;
- basic dependencies and cycle diagnostics;
- task and lane CRUD;
- drag, resize, reorder, and cross-lane movement;
- basic snapping and collision policies;
- configurable time scales and zoom;
- filtering and sorting hooks;
- custom columns, renderers, tooltips, menus, and editors;
- JSON codec and migrations;
- REST/persistence interfaces;
- DOM/SVG rendering and virtualization;
- local undo/redo;
- themes, localization, RTL, and accessibility;
- SSR compatibility.

Community must parse, validate, preserve, and serialize general canonical records
needed by the shared model even when an advanced calculation or view requires Pro.
Removing Pro never silently discards or rewrites those records.

### 13.2 Pro edition

Pro capabilities may include:

- working calendars, shifts, and exceptions;
- automatic dependency scheduling;
- lag, lead, and advanced constraints;
- critical path and slack;
- baselines and variance;
- rollups and derived summary automation;
- resource assignment, capacity, and workload views;
- task and resource calendars;
- split and unscheduled tasks;
- advanced grouping and WBS;
- cross-project planning;
- persistent audit history;
- PDF, PNG, spreadsheet, and project-planning interchange capabilities;
- supported persistence integrations;
- priority support.

### 13.3 Capability registry

```ts
export interface GanttCapability {
  id: string;
  version: string;
  requires?: CapabilityRequirement[];
  setup(context: CapabilityContext): void | CapabilityCleanup;
}

export interface CapabilityContext {
  commands: CommandRegistry;
  validators: ValidatorRegistry;
  queries: QueryRegistry;
  renderLayers: RenderLayerRegistry;
  slots: SlotRegistry;
  exporters: ExporterRegistry;
  diagnostics: DiagnosticRegistry;
}
```

Rules:

- Capability IDs are unique.
- Dependencies and version requirements are checked during initialization.
- Registration order is deterministic.
- Conflicting contributions produce a clear initialization error.
- Free packages never import Pro packages.
- Pro extends one resolved Community runtime and never bundles a second component,
  model, codec, command path, or renderer authority.
- License enforcement occurs at the Pro package boundary, not inside model or renderer
  hot paths.
- Pro packages support offline activation and do not require runtime network calls.
- License scope is independent of deployment domain, server, tenant, or end-user count.
- Activation data must not contain customer project data or deployment identifiers.
- Free and Pro packages with incompatible versions fail early with an actionable error.

### 13.4 Distribution, activation, and entitlement

Both packages are publicly downloadable from the normal npm registry. The launch
product does not require a private registry, customer npm login, or download token.
`@gantempo/gantt-pro` may expose tree-shakeable named capabilities or subpath exports,
but those are not separately purchased launch products.

Community and Pro are published from the same tagged source state with the same
semantic version. Pro declares a strict supported Community range and repeats the
compatibility check during capability initialization before registering anything.

Pro activation uses a signed entitlement verified locally:

- verification material may ship in Pro, but signing material never does;
- a commercial entitlement identifies its payload version, product or edition,
  stable license reference, update-entitlement end date, and signature;
- evaluation uses a separately signed entitlement with an explicit expiry;
- license values are public application configuration and may appear in browser
  bundles;
- validation performs no production call-home;
- entitlements do not bind to domains, servers, tenants, end users, deployments, or
  customer project data.

Commercial entitlement applies to Pro package release dates. A package version
released on or before the update-entitlement date remains licensed and continues to
build and run after that date. Versions released later require renewal. Renewal buys
new releases and support; expiry never disables or degrades an already entitled
deployment.

Missing, malformed, expired-evaluation, wrong-product, post-entitlement-version, or
incompatible-package activation returns stable diagnostics. Pro may decline
capability registration or show documented evaluation UI, but Community remains
usable and the source document remains intact.

Gantempo publishes packages; customers bundle and deploy them through their own
browser, worker, SSR, or Node build. The launch library neither downloads executable
Pro code at runtime nor depends on Gantempo infrastructure during application startup
or use. Future hosted services require separate service contracts rather than
weakening this offline library guarantee.

## 14. Persistence and backend integration

The component does not own storage. It exposes adapters:

```ts
export interface PersistenceAdapter {
  load(signal?: AbortSignal): Promise<GanttDocument>;
  apply(
    entityChanges: GanttEntityChange[],
    context: { baseRevision?: string | number; operationId: string }
  ): Promise<{ revision: string | number; idMap?: Record<string, string> }>;
}
```

Required behaviors:

- optimistic updates;
- temporary client IDs and server ID reconciliation;
- conflict reporting;
- retry-safe operation IDs;
- batched transactions;
- cancellation;
- rollback using inverse patches.

The interaction runtime freezes the persistence-ready change envelope but does not
make storage part of document ownership. Controlled applications load and normalize
API data outside React, acknowledge accepted candidates in local state immediately,
and enqueue its row-oriented entity changes for asynchronous persistence. Raw patches
and inverses remain available when an adapter needs replay or rollback. The
persistence layer supplies retry-safe operation IDs and applies later server
revisions as external controlled document updates. Uncontrolled mode can observe the
same entity changes, but controlled mode is the recommended authoritative-backend
integration until an adapter owns rollback, conflict handling, and ID reconciliation.

The first release should provide examples for REST, GraphQL, Redux, Zustand, and direct
React state. State-manager-specific packages are unnecessary unless examples prove
insufficient.

### 14.1 Partial-data loading

Virtualization limits rendering work; it does not by itself limit data transfer or
memory. Large and hierarchical documents may use a separate query adapter:

```ts
export interface GanttQueryAdapter {
  loadChildren(
    request: { entity: "task" | "lane"; parentId?: EntityId; cursor?: string },
    signal?: AbortSignal
  ): Promise<QueryPage>;
  loadWindow(
    request: { laneIds: EntityId[]; start: number; end: number; cursor?: string },
    signal?: AbortSignal
  ): Promise<QueryPage>;
}
```

The runtime distinguishes `unloaded`, `loading`, `loaded-empty`, and `failed` ranges or
children. Query results pass through the same codec and ID normalization as the initial
document. Overlapping requests are deduplicated, stale responses cannot overwrite
newer revisions, and retries are safe. Commands that depend on unloaded context either
load that context first or require authoritative server validation; they never assume
that missing data means empty data.

## 15. Collaboration readiness

Real-time collaboration is not required initially, but the architecture must not block
it.

Prepare for it by:

- giving every command an operation ID and actor metadata;
- producing small patches and inverse patches;
- separating document and session state;
- keeping reducers deterministic;
- supporting base revisions;
- exposing conflict diagnostics;
- avoiding array indexes as persistent identity.

Do not commit to a CRDT until concurrent editing requirements are validated. A
revisioned command stream with server conflict resolution is sufficient for the first
collaborative implementation.

## 16. Accessibility

Accessibility is an architectural requirement, not a renderer enhancement.

The React layer must provide:

- treegrid semantics for task and lane grids;
- keyboard navigation between rows, cells, and bars;
- keyboard movement and resizing with configurable increments;
- keyboard creation and removal of dependency links;
- announced selection, movement, resize, and validation results;
- visible focus indicators;
- reduced-motion behavior;
- high-contrast theme tokens;
- accessible editor labels and error messages;
- a non-visual summary/table for inspecting task dates, relationships, and validation
  state without using the timeline;

If canvas is used, visible or focused items receive synchronized DOM proxies. The
screen-reader experience must not depend on canvas pixel inspection.

M4 represents each visible lane as one flat treegrid row with a row header and one
timeline grid cell. Task occurrences are buttons inside the timeline cell rather than
false spreadsheet cells. Roving focus, mode-based keyboard move/resize, live
announcements, virtualization focus retention, and the exact M4 key bindings are
fixed by the
[interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md).
Post-M4 paging, offscreen task reveal, DOM-focus handoff, and silent continuous
navigation are fixed by the
[timeline navigation interaction contract](decisions/2026-07-30-timeline-navigation-interaction-contract.md).

## 17. SSR and browser boundaries

- Packages must not read `window`, `document`, or element dimensions at module scope.
- The initial server render produces deterministic grid and placeholder structure.
- Measurement starts after mounting.
- The library exposes a stable skeleton height to reduce layout shift.
- Browser-only exporters and workers load lazily.
- Hydration must not depend on current time unless the application supplies it.

## 18. Performance targets

Performance claims must be backed by versioned benchmarks.

M3 establishes a reproducible structural baseline for the pure view/layout/viewport
path. It records fixed-seed 10,000-task/2,000-lane cold construction, warm query
timings, exact brute-force parity, and query-work observations without creating a
cross-machine threshold or claiming browser frame rate. Stable thresholds remain M7
work.

Initial targets:

- 10,000 tasks and 2,000 lanes in the default benchmark document;
- 100,000 total entries in the high-density canvas benchmark;
- no work proportional to the full dataset during ordinary viewport scrolling;
- 60 frames per second during steady-state pan on reference hardware;
- less than 16 ms main-thread work for optimistic drag frames;
- incremental command processing proportional to affected graph and lanes;
- no unbounded retained render primitives after viewport changes.

Benchmark scenarios must cover:

- flat tasks;
- deep task trees;
- dense lane overlaps;
- long dependency chains;
- resource view;
- frequent live updates;
- zooming across large date ranges.

Performance regression thresholds run in CI on a stable benchmark environment.
Each result records the data-generator version and seed, full and visible entity
counts, build mode, browser, hardware profile, interaction latency percentiles, and
frame-rate distribution. A single maximum-item count is not a sufficient performance
claim.

## 19. Testing strategy

### 19.1 Unit and property tests

- command reducers and inverse patches;
- graph validation and cycle detection;
- interval and overlap layout;
- scale conversion round trips;
- working-time arithmetic;
- DST gaps and repeated hours;
- elapsed-time versus working-time duration semantics;
- all-day versus instant-based task semantics;
- cross-zone display, editing, and resource calendars;
- scheduler invariants;
- schema migrations.

Use property-based testing for interval math, dependency graphs, and patch inversion.

### 19.2 Integration tests

- controlled and uncontrolled React modes;
- pointer, touch, and keyboard interactions;
- async command interception;
- optimistic persistence and rollback;
- worker and synchronous engine parity;
- free and Pro capability compatibility.

### 19.3 Visual and accessibility tests

- visual regression for scales, bars, dependencies, themes, and RTL;
- theme contract fixtures for default CSS, custom tokens, and Tailwind integration;
- semantic-theme parity across DOM/SVG, canvas, portals, and visual export;
- automated accessibility checks;
- manual screen-reader scenarios for core workflows;
- high-contrast and reduced-motion checks.

### 19.4 Compatibility tests

- React 18 and 19;
- current evergreen browsers;
- Next.js SSR and hydration;
- TypeScript minimum and current versions;
- ESM bundlers and tree shaking.

## 20. Diagnostics and developer experience

All recoverable problems return typed diagnostics:

```ts
export interface Diagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  entityIds?: EntityId[];
  path?: string;
  details?: Record<string, JsonValue>;
}
```

Examples include:

- malformed dates;
- duplicate IDs;
- dangling assignments;
- dependency cycles;
- impossible constraints;
- missing capabilities;
- incompatible free/Pro versions;
- unsupported export fields.

Development builds may show a diagnostic panel. Production behavior is configurable,
but the library must not silently discard invalid data.

## 21. Security and content safety

- Never evaluate user-provided strings as code.
- Avoid raw HTML customization APIs.
- Render custom content through React slots.
- Sanitize any optional rich-text content at an explicit adapter boundary.
- Keep export services opt-in and document what data leaves the browser.
- Support strict Content Security Policy environments.
- Do not put customer data, domains, or project metadata into telemetry by default.

## 22. Versioning and releases

- Use semantic versioning for public packages.
- Version Community and Pro facades together and publish them from the same tagged
  source state.
- Test Community alone and Community plus Pro before publishing either artifact.
- Treat a partial two-package publish as an incomplete release with a documented
  forward-recovery path.
- Verify packed package contents, declarations, licenses, installation, activation,
  compatibility, tree shaking, and SSR behavior rather than trusting workspace builds.
- Publish public npm artifacts through trusted publishing with short-lived OIDC
  credentials and provenance when supported.
- Publish a machine-readable capability manifest.
- Declare and enforce a strict supported version range between Community and Pro.
- Retain or make recoverable entitled package artifacts so perpetual-version rights
  remain practical after the update window closes.
- Maintain JSON schema migrations for persisted documents.
- Keep deprecations for at least one minor-release cycle before removal.
- Generate API reports in CI to detect accidental public-surface changes.
- Offer ESM builds and TypeScript declarations; add other formats only when demand is
  demonstrated.

## 23. Initial implementation slices

### Slice 1: Contracts and model

- Monorepo and package boundaries.
- Record types, codecs, diagnostics, and schema versioning.
- Document, session, and derived-state separation.
- Command bus, patch format, transactions, and history.

Exit condition: tasks, resources, lanes, assignments, placements, and dependencies can
be loaded, validated, mutated, serialized, undone, and redone without React. Their
domain boundaries remain intact throughout the round trip.

### Slice 2: Time, layout, and basic React rendering

- Linear time scale and ticks.
- Lane flattening and variable heights.
- Multiple-entry overlap stacking.
- Two-dimensional viewport.
- DOM/SVG renderer.
- Structural styles, semantic theme tokens, and the default theme.
- Read-only React component.

Exit condition: a large, read-only task and resource document can be navigated smoothly.

### Slice 3: Interaction and public API

- Selection, drag, resize, creation, deletion, and cross-lane movement.
- Controlled and uncontrolled modes.
- Command interception.
- Component ref.
- Slots, columns, tooltips, menus, and basic editor.
- Keyboard workflows.

Exit condition: applications can implement full CRUD through the same command API used
by built-in UI.

The slice's durable ownership, acknowledgement, occurrence-target, accessibility, and
minimum customization choices are fixed by the
[interaction-runtime and public-API contract](decisions/2026-07-30-interaction-runtime-public-api-contract.md).
The accepted post-M4 correction adds ordinary timeline navigation and
viewport-independent occurrence lifetime without changing this slice's public
ownership boundary; see the
[timeline navigation interaction contract](decisions/2026-07-30-timeline-navigation-interaction-contract.md).

### Slice 4: Project Gantt capabilities

- Task hierarchy.
- Summary and milestone rendering.
- Dependency paths and editing.
- Cycle detection.
- Filtering, sorting, zooming, and localization.
- SSR examples.

Exit condition: the free edition is a complete basic Gantt library.

### Slice 5: Pro scheduling and resources

- Working calendars.
- Auto-scheduling and constraints.
- Critical path, slack, and baselines.
- Resource assignment and workload.
- Split tasks and grouping.
- Worker execution.

Exit condition: Pro covers advanced scheduling and resource-planning use cases.

### Slice 6: Export, hardening, and release

- Export/import capabilities.
- Performance regression suite.
- Accessibility conformance.
- Compatibility matrix.
- Documentation, examples, migration guide, and licensing boundary.

Exit condition: both editions have stable APIs and reproducible release artifacts.

## 24. Architecture acceptance criteria

Before the first stable release:

- A task can appear in a project tree and one or more resource lanes without duplicating
  the task record.
- Resource assignment and visual placement can change independently.
- Multiple overlapping entries can render and be edited in one lane.
- The same command produces identical results in the browser, worker, and Node tests.
- Every built-in mutation is interceptable and emits patches.
- Persisted state round-trips through JSON without losing meaning.
- Scheduling results explain date changes and rejected constraints with stable,
  structured codes.
- Free and Pro capabilities can be installed without changing the React component API.
- Community-to-Pro upgrade adds activation and capabilities without replacing
  Community imports or migrating the source document.
- Community and Pro packed artifacts have the same version and their intended separate
  licenses.
- Signed activation accepts exactly the Pro releases covered by the update entitlement
  without a runtime network request.
- Previously entitled Pro versions continue to build and run after the update window
  closes, while later versions require renewal.
- Missing or rejected Pro activation leaves Community usable and document data intact.
- A renderer can be replaced without changing scheduling or persistence code.
- A semantic theme can be shared by DOM/SVG, canvas, portals, and visual export.
- Tailwind integration works without making Tailwind a library dependency.
- Keyboard users can perform the primary task-editing workflows.
- SSR import and hydration succeed without browser globals at module scope.
- Performance benchmarks and thresholds are published and reproducible.

## 25. Open decisions

These decisions should be resolved through small prototypes or architecture decision
records:

1. Whether the canvas renderer ships in the first stable release.
2. The minimum supported TypeScript and browser versions.
3. The first supported project-planning interchange format.
4. Whether resource leveling is included in the initial Pro scheduler.
