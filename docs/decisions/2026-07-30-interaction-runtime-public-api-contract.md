# Decision: Interaction Runtime and Public API Contract

Status: Accepted; persistence envelope amended 2026-07-31
Date: 2026-07-30
Owners: M4 interaction runtime and public API

## Context

M4 composes the completed document, change, view, layout, and viewport kernels into
one per-instance interaction runtime. The runtime must support controlled and
uncontrolled React consumers without becoming a second document reducer or exposing
the private M3 indexes. Pointer, pen, touch, keyboard, menu, editor, toolbar, and
imperative mutations must share one command path.

This decision resolves the ownership, acknowledgement, event, target, viewport,
accessibility, and minimum customization questions in
[`2026-07-30-interaction-runtime-public-api-plan.md`](../plans/2026-07-30-interaction-runtime-public-api-plan.md).
It extends, without replacing, the
[M2 change-kernel contract](2026-07-30-change-kernel-contract.md) and the
[M3 view/layout/viewport contract](2026-07-30-view-layout-viewport-kernel-contract.md).

## Decision

### Keep five runtime state categories separate

Each mounted `<Gantt>` owns one React-free runtime with five independently reasoned
state categories:

1. **Document state** is the canonical `GanttDocument`, supplied by a controlled prop
   or owned by an uncontrolled runtime.
2. **Committed session state** contains selection, logical focus, and vertical
   viewport intent. It is controlled or uncontrolled independently from the
   document.
3. **Transient interaction state** contains gesture state, previews, pending
   proposal state, focus reconciliation, measurement, overlay state, and live
   announcements. It is always runtime-owned.
4. **History state** contains bounded M2 patch entries and controlled
   acknowledgement metadata. It is operational state and is never serialized with
   the document.
5. **Derived state** contains validation/index results, resolved views, intervals,
   layout, viewport queries, primitives, and hit-test data. It is private,
   reproducible cache state.

The public selector snapshot exposes only immutable data needed by rendered
descendants. It never exposes mutable collections, DOM nodes, React elements, M3
resolved keys, prefix sums, interval nodes, work counters, or hit-test nodes.

### Use discriminated document ownership and one combined session value

Document ownership is a required exclusive union:

```ts
type GanttDocumentOwnership =
  | {
      readonly document: GanttDocument;
      readonly defaultDocument?: never;
      readonly onDocumentChange?: GanttDocumentChangeHandler;
    }
  | {
      readonly document?: never;
      readonly defaultDocument: GanttDocument;
      readonly onDocumentChange?: GanttDocumentChangeHandler;
    };
```

Supplying both or neither document input is a type error. In controlled mode the
`document` prop is always the rendered authority. A controlled instance without
`onDocumentChange` remains the existing source-compatible read-only path; built-in
and imperative mutations reject with `runtime.read-only`.

Session ownership uses one immutable object because selection, logical focus, and
vertical viewport intent must reconcile atomically:

```ts
interface GanttViewportIntent {
  readonly verticalStart: number;
}

interface GanttSessionState {
  readonly selection: readonly GanttInteractionTarget[];
  readonly focused?: GanttInteractionTarget;
  readonly viewport: GanttViewportIntent;
}

type GanttSessionOwnership =
  | {
      readonly session: GanttSessionState;
      readonly defaultSession?: never;
      readonly onSessionChange?: GanttSessionChangeHandler;
    }
  | {
      readonly session?: never;
      readonly defaultSession?: Partial<GanttSessionState>;
      readonly onSessionChange?: GanttSessionChangeHandler;
    };
```

Omitting both session inputs is equivalent to an uncontrolled `defaultSession` with
an empty selection, no logical focus, and `verticalStart: 0`. `defaultSession` is
read only once. Controlled session actions propose the complete next session through
`onSessionChange`; the prop remains authoritative. Selection and focus callbacks
observe an adopted session and are not alternate ownership callbacks.

`verticalStart` is a finite non-negative content-space CSS-pixel offset. Measured
client width/height, scroll DOM nodes, pointer coordinates, and overscan are derived
or transient values and are not part of `GanttSessionState`.

### Keep the existing horizontal `range` controlled throughout M4

M4 keeps the required `range: TimeRange` prop as the single controlled horizontal
time window. It does not add `defaultRange`, duplicate the range inside session
state, or infer zoom policy. This preserves current usage and avoids fixing a second
range-ownership contract immediately before M5 introduces adaptive scale and zoom.

M4 adds `onRangeChange(nextRange, event)` as the request boundary for horizontal
edge-panning and imperative scroll-to-time/task operations. The requested range
preserves the current finite positive duration and changes only its start/end.
Without `onRangeChange`, horizontal viewport commands are disabled and return
`false`; they never mutate the prop internally. `onViewportChange` observes an
adopted range prop or committed vertical session change and is not a second range
mutation callback.

### Address visible occurrences, not raw entity IDs

Public targets are copied data-only occurrence identities:

```ts
interface GanttLaneTarget {
  readonly kind: "lane";
  readonly viewKey: string;
  readonly laneId?: EntityId;
  readonly resourceId?: EntityId;
}

interface GanttTaskTarget {
  readonly kind: "task";
  readonly viewKey: string;
  readonly laneViewKey: string;
  readonly taskId: EntityId;
  readonly placementId?: EntityId;
  readonly laneId?: EntityId;
  readonly resourceId?: EntityId;
  readonly assignmentId?: EntityId;
  readonly segmentId?: EntityId;
}

type GanttInteractionTarget = GanttLaneTarget | GanttTaskTarget;
```

The M3 occurrence key is exposed as an ordinary immutable string snapshot, not as the
private branded key type. A target key plus its `kind` is its selection identity.
Selection preserves insertion order, removes duplicates by that identity, and does
not collapse two occurrences of the same task. Logical focus is zero or one target
and is independent from selection.

After a document or view change, an uncontrolled session removes missing selected
occurrences. Missing focus moves to the nearest surviving task in the same lane by
horizontal center, then to the nearest task in the next visible lane by absolute
geometry, then to the chart root. A controlled stale target is ignored for rendering
and one complete reconciled session is proposed through `onSessionChange`; the
runtime never mutates the controlled value.

Imperative focus and scroll methods accept `GanttTaskTarget`, not a raw task ID,
because one task may have more than one visible occurrence.

### Add explicit instant-only move and resize commands

M4 extends `GanttCommand` with these exact semantic shapes:

```ts
type TaskMoveCommand =
  | {
      readonly type: "task.move";
      readonly id: EntityId;
      readonly delta: number;
      readonly start?: never;
    }
  | {
      readonly type: "task.move";
      readonly id: EntityId;
      readonly start: EpochMilliseconds;
      readonly delta?: never;
    };

interface TaskResizeCommand {
  readonly type: "task.resize";
  readonly id: EntityId;
  readonly edge: "start" | "end";
  readonly time: EpochMilliseconds;
}
```

`task.move` changes only the task-level instant schedule and preserves its exact
elapsed duration. `task.resize` changes exactly one task-level instant boundary.
Finite zero movement and an unchanged resize boundary are successful no-ops.
Non-finite values, missing tasks, unscheduled tasks, all-day schedules, zero-width or
reversed results, and segment-directed default interaction reject with stable
`command.*` diagnostics. Snapping happens before dispatch and is visible in these
payloads; the M2 reducer reads no pixels, tick labels, locale, time zone, or browser
state.

### Make ambiguous placement meaning an explicit mapper boundary

The built-in intent mapper has the following fixed behavior:

- horizontal movement of an unsegmented instant task occurrence maps to
  `task.move`;
- an edge resize maps to `task.resize`;
- vertical movement of a document-view occurrence with canonical `placementId` and
  destination `laneId` maps to `placement.move`;
- combined horizontal and persisted vertical movement maps to one ordered
  `transaction`;
- project-view cross-lane movement is disabled because its lanes are derived tasks;
- resource/custom cross-lane movement and segment manipulation are disabled unless
  an application mapper returns an explicit command or transaction;
- empty-lane creation requires an application mapper because IDs, initial task data,
  and optional placement/assignment semantics are application policy.

M4 exposes two synchronous mapper hooks:

```ts
interface GanttInteractionCommandMappers {
  readonly createTask?: (
    intent: GanttCreateTaskIntent,
  ) => GanttCommandMappingResult;
  readonly moveOccurrence?: (
    intent: GanttMoveOccurrenceIntent,
  ) => GanttCommandMappingResult;
}

type GanttCommandMappingResult =
  | { readonly status: "mapped"; readonly command: GanttCommand }
  | { readonly status: "rejected"; readonly diagnostic: Diagnostic };
```

Mapper inputs are frozen data-only intent snapshots with source/destination targets,
snapped time, and delta where relevant. They receive no document mutator, DOM event,
node, layout index, or dispatch function. A mapped command still runs through the
normal interceptor and M2 reducer path.

### Serialize command proposals per instance

Every document command enters one per-instance FIFO queue. A proposal captures the
current authoritative document, allocates an opaque instance-local `proposalId`, and
freezes its source and optional occurrence target:

```ts
type GanttCommandSource =
  | { readonly kind: "imperative" }
  | {
      readonly kind: "pointer";
      readonly pointerType: "mouse" | "pen" | "touch";
    }
  | { readonly kind: "keyboard" }
  | { readonly kind: "toolbar" }
  | { readonly kind: "context-menu" }
  | { readonly kind: "editor" }
  | { readonly kind: "history"; readonly action: "undo" | "redo" };

interface GanttCommandProposal {
  readonly proposalId: string;
  readonly document: GanttDocument;
  readonly command: GanttCommand;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
}
```

`proposalId` is unique only within the runtime instance and lifetime. It correlates
callbacks and acknowledgement but is not stable across remounts, retries, or backend
requests.

The runtime snapshots the interceptor list at proposal start and invokes each
interceptor exactly once in registration order:

```ts
type GanttCommandInterception =
  | { readonly kind: "allow" }
  | { readonly kind: "reject"; readonly diagnostic: Diagnostic }
  | { readonly kind: "replace"; readonly command: GanttCommand };

type GanttCommandInterceptor = (
  proposal: GanttCommandProposal,
) => GanttCommandInterception | Promise<GanttCommandInterception>;
```

Each later interceptor sees the latest replacement. A replacement may be a
transaction, but it does not restart the chain and an interceptor never sees its own
replacement twice. Invalid results, thrown/rejected interceptors, controlled base
changes during interception, disposal, and internal cancellation reject with stable
`runtime.*` diagnostics. The runtime races async work against disposal/cancellation,
settles the public dispatch promise, ignores late interceptor results, and never
retains a dangling queue item.

Only after interception does the runtime call `applyGanttCommand`, exactly once, with
the captured authoritative base and final command. Interceptors and callbacks never
mutate a document.

### Distinguish candidates from authoritative commits

Every non-empty reducer-accepted document candidate produces one deeply immutable
change envelope:

```ts
interface GanttDocumentChange {
  readonly proposalId: string;
  readonly operation: "dispatch" | "undo" | "redo";
  readonly document: GanttDocument;
  readonly baseRevision?: string | number;
  readonly originalCommand: GanttCommand;
  readonly command: GanttCommand;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
  readonly entityChanges: readonly GanttEntityChange[];
  readonly patches: readonly GanttPatch[];
  readonly inversePatches: readonly GanttPatch[];
  readonly affected: readonly EntityReference[];
  readonly diagnostics: readonly Diagnostic[];
}

type GanttDocumentChangeHandler = (change: GanttDocumentChange) => void;
```

`originalCommand` is the initially proposed command and `command` is the final
intercepted command. For undo/redo, runtime history retains those commands from the
acknowledged entry; `operation` identifies replay direction, `patches` contains the
batch being applied now, and `inversePatches` contains its inverse. Undo and redo do
not add fake command variants to `GanttCommand`.

The envelope is JSON-compatible and is the only document candidate callback value.
A controlled consumer first adopts `change.document` in local React or external
store state, then may enqueue the same envelope for application-owned persistence.
Such a queue supplies its own retry-safe operation ID. M4 does not perform, await, or
model network persistence, rollback, retries, server acknowledgement, revision
conflicts, or temporary-ID reconciliation.

The additive `entityChanges` field identifies canonical creates, updates, and deletes
with explicit row values; patches remain the mutation and inversion authority. The
exact projection contract and simplified primary persistence example are fixed by the
[2026-07-31 persistence entity-change decision](2026-07-31-persistence-entity-change-projection.md).

No-op commands emit a committed command lifecycle result with no change envelope,
do not call `onDocumentChange`, and do not enter history.

### Use exact controlled acknowledgement and fail closed on divergence

Controlled mode allows at most one unacknowledged document proposal. A second
mutation rejects with `runtime.pending-proposal`; it is not reduced against a stale
prop.

After `onDocumentChange` receives a candidate, dispatch resolves as `proposed`.
Uncontrolled adoption resolves as `committed`. Reducer, interceptor, ownership, and
history failures resolve as `rejected`; ordinary rejections do not throw.

The next controlled document prop acknowledges the proposal only when its stable M1
serialization is byte-equal to the candidate serialization. A matching prop:

- becomes the authoritative rendered document;
- records the non-empty runtime history entry;
- clears the pending proposal;
- publishes `commandCommitted` with the same `proposalId`.

A different prop is an authoritative external replacement. It cancels the pending
proposal and publishes `commandRejected` with
`runtime.controlled-proposal-diverged`; it never overwrites the prop.

External replacement history rules are conservative and exact:

- a revision-only replacement with byte-equal canonical content excluding
  `revision` rebases the history present document and keeps both stacks;
- any other external document replacement clears past and future because M2
  whole-record patches cannot prove a conflict-free rebase;
- an acknowledged local proposal appends one entry and clears redo through the M2
  history contract.

The candidate must be acknowledged before applying a later server revision. A
revision-bearing server response is a subsequent external replacement, not a local
proposal acknowledgement.

### Keep event phases ordered and immutable

The command lifecycle order is:

```text
proposal queued
  -> interceptors
  -> M2 rejection
     or document candidate
  -> uncontrolled adoption or controlled onDocumentChange delivery
  -> commandCommitted after adoption/acknowledgement
     or commandRejected on failure/divergence
```

The intentional React event props are:

- `onDocumentChange` for candidate delivery;
- `onCommandCommitted` and `onCommandRejected` for command lifecycle observation;
- `onSessionChange` for controlled session proposals and uncontrolled session
  observation;
- `onSelectionChange`, `onFocusChange`, and `onViewportChange` for adopted semantic
  state;
- `onTaskActivate` for activation meaning;
- `onRuntimeError` for host callback exceptions and runtime faults that are not
  command rejections.

Payloads are deeply frozen, data-only snapshots and never expose React synthetic
events or native DOM events. Pointer modifiers or coordinates needed by interaction
are normalized into explicit scalar intent before a public callback.

Uncontrolled document/session state is adopted before its corresponding callback, so
snapshot reads inside the callback see the new authority. Controlled callbacks
propose a value and do not cause optimistic rendered state. Callback exceptions are
captured so the queue settles, reported through `onRuntimeError`, and rethrown in a
microtask. They never manufacture rollback or a second mutation.

### Compose bounded history without hiding it in the command union

Runtime history has a documented default capacity of 100 entries.
`historyCapacity={0}` disables it; a positive finite integer selects another bound.
Rejected and no-op commands never enter history.

Uncontrolled mode records a non-empty outcome when it adopts the document. Controlled
mode records it only after exact prop acknowledgement. `undo()` and `redo()` are
explicit queued runtime operations that apply the stored inverse/forward M2 patch
batch and pass their candidate through the same ownership/acknowledgement boundary.
They do not rerun command interceptors because they replay an already intercepted,
acknowledged command. One transaction remains one history entry and one replay
candidate.

### Keep the imperative handle narrow and occurrence-aware

The M4 handle is:

```ts
interface GanttHandle {
  dispatch(
    command: GanttCommand,
    options?: GanttDispatchOptions,
  ): Promise<GanttDispatchResult>;
  getDocument(): GanttDocument;
  getSession(): GanttSessionState;
  getSelection(): readonly GanttInteractionTarget[];
  focusTask(target: GanttTaskTarget): boolean;
  scrollToTask(target: GanttTaskTarget, options?: GanttScrollOptions): boolean;
  scrollToTime(
    time: EpochMilliseconds,
    options?: GanttScrollOptions,
  ): boolean;
  undo(): Promise<GanttDispatchResult>;
  redo(): Promise<GanttDispatchResult>;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

Snapshot methods return the current frozen authority. Focus and scroll methods call
runtime operations and return whether a proposal/action was possible. They do not
write records or DOM attributes directly. `fitToProject`, `zoomTo`, adaptive scale,
and calendar-aware scroll policy remain M5 work and are not shipped as M4 no-ops.

### Expose selector state without exporting runtime internals

`useGanttSelector(selector, isEqual?)` is public for descendants of the owning
`<Gantt>` instance and throws `runtime.selector-outside-provider` outside that
context. Its selector input is a narrow immutable `GanttSelectorSnapshot` containing:

- authoritative `document`;
- committed `session`;
- public interaction status and active target/preview summary;
- `canUndo` and `canRedo`;
- adopted horizontal `range` and measured vertical viewport summary;
- visible occurrence summaries needed by built-in slots.

The snapshot does not expose the runtime constructor/store, dispatch queue, history
entries, controlled acknowledgement record, derived-cache stages, layout/index
objects, hit-test data, or work counters. External sibling controls use event props
or `GanttHandle`, not a global runtime registry.

### Use a flat treegrid with task controls inside timeline cells

M4 uses a labelled `treegrid` for the hybrid DOM/SVG chart. Each visible lane is one
`row` at `aria-level="1"`, with one `rowheader` and one timeline `gridcell`. Multiple
task occurrences inside a timeline cell are keyboard-operable controls with
`role="button"`; they are not falsely represented as spreadsheet cells. M5 may add
deeper `aria-level`, expansion, and hierarchical row semantics without changing task
target identity.

Exactly one task occurrence is in the roving tab order. The chart root is the
fallback tab stop when no task is focusable. Focused occurrences are retained in the
rendered overscan set until focus moves or reconciliation selects the root, preventing
virtual scrolling from discarding the active element.

The later
[timeline navigation interaction contract](2026-07-30-timeline-navigation-interaction-contract.md)
supersedes only the viewport-lifetime implementation detail: logical focus is
reconciled against a private full occurrence catalog, while DOM focus hands off to
the chart root when the focused occurrence is outside the rendered window. The
public target and session ownership contracts remain unchanged.

The fixed M4 keyboard contract is:

- `Tab` enters or leaves the chart once;
- arrow keys move logical focus by visual geometry;
- `Home`/`End` move to the first/last occurrence in the focused lane;
- `Space` toggles occurrence selection;
- `Enter` activates the task and opens the default editor when enabled;
- `M` enters move mode, `S` enters start-resize mode, and `E` enters end-resize mode;
- arrows adjust the active preview by the configured snap step, and move mode also
  permits vertical lane changes;
- `Enter` commits and `Escape` cancels an active preview;
- `N` requests creation at the focused lane and viewport time when a mapper exists;
- `Delete` or `Backspace` requests deletion;
- platform undo/redo chords call runtime `undo()`/`redo()`.

The mode-based editing keys avoid browser-history and assistive-technology modifier
conflicts. Built-in help text and `aria-keyshortcuts` make them discoverable.
Pointer-only resize handles have these keyboard equivalents.

One polite atomic live region per instance announces adopted interactive selection,
move, resize, create, delete, undo, and redo results plus validation rejection. It
does not announce imperative background updates by default. Built-in styles preserve
visible focus, forced-colors boundaries, reduced-motion behavior, and minimum touch
hit targets.

### Add a focused jsdom interaction test stack

The current server-render-only test setup cannot prove focus movement, delegated
events, controlled prop acknowledgement across renders, or accessible names and
states. The React integration slice therefore adds direct development dependencies
on `jsdom`, `@testing-library/react`, `@testing-library/user-event`, and `axe-core`.
Tests use a jsdom Vitest environment only for DOM-focused files; pure M1–M4 kernel
tests keep the default Node environment.

Testing Library supplies React `act` integration and user-level keyboard/pointer
dispatch. `axe-core` provides a focused automated semantic smoke check, not an
accessibility-conformance claim. Tests install deterministic local adapters for
`ResizeObserver`, `PointerEvent` gaps, pointer capture, animation-frame scheduling,
and `getBoundingClientRect`. Those adapters live in test support and are never
production polyfills.

Synthetic layout and pointer behavior cannot prove real browser geometry, touch
emulation, focus rendering, the accessibility tree, forced colors, reduced motion,
console state, or network state. The required Chrome DevTools gate remains the
authority for those behaviors.

### Ship only the M4 customization surface needed for CRUD composition

The first customization contract contains:

- content slots for `TaskContent` and `LaneHeader`, while the built-in wrapper retains
  focus, hit testing, ARIA, and event behavior;
- surface slots for `Tooltip`, `ContextMenu`, and `TaskEditor`, whose props include
  required refs, roles, labels, focus-return behavior, and event bindings;
- `classNames` keys for root, chart, lane, lane header, timeline cell, task, task
  content, resize handle, tooltip, context menu, editor, and live region;
- class callback state containing target plus selected, focused, dragging, resizing,
  pending, invalid, and disabled flags;
- small lane-column definitions with stable `id`, header content, optional width, and
  a read-only lane-cell renderer;
- context-menu items that either invoke a named built-in semantic action or dispatch
  a typed `GanttCommand`;
- a basic instant-task editor that submits typed `task.update`, `task.move`, or
  `task.resize` commands through the runtime;
- the creation and ambiguous-move mapper hooks fixed above.

Content slots cannot replace the interactive task wrapper in M4, so visual
replacement cannot accidentally discard keyboard or pointer behavior. Surface slots
receive behavior props that must be spread onto their owning element; development
diagnostics report missing required bindings where detection is possible. No slot,
class hook, column, menu item, tooltip, or editor receives a mutable document or an
alternate record setter.

Portable appearance, arbitrary editor tabs, dependency handles, hierarchy columns,
time-header replacement, theme manifests, canvas styling, export styling, and full
design-system primitives remain governed by
[`UI_THEMING.md`](../UI_THEMING.md) and later milestones.

### Keep the package facade smaller than the runtime implementation

M4 exports only the component/hook and the public types required by props, slots,
events, commands, mappers, selectors, and the imperative handle. Store constructors,
acknowledgement helpers, cache invalidators, geometry indexes, hit-test structures,
gesture reducers, scheduler adapters, and test/benchmark counters remain private.

## Testing Contract

Implementation slices must prove:

- controlled/uncontrolled document and session ownership type exclusivity;
- no mutation of document, command, session, target, event, or mapper inputs;
- exact acknowledgement, one-pending-proposal rejection, stale async rejection, and
  divergent external replacement;
- interceptor ordering, bounded replacement, thrown/rejected async handlers,
  cancellation, disposal, and queue settlement;
- one M2 reduction per accepted command and no alternate mutation path;
- candidate, acknowledgement, commit, rejection, semantic-event, and callback-error
  ordering;
- history entry timing, capacity, transaction grouping, undo/redo proposals, and
  revision-only versus content-changing external replacements;
- cross-family IDs and repeated task occurrences remain unambiguous;
- deterministic session pruning/focus reconciliation and controlled session
  proposals;
- task move/resize instant-only semantics and mapper fail-closed behavior;
- imperative methods, selectors, and slots cannot expose or mutate private kernels;
- pointer, pen, touch, keyboard, menu, editor, and imperative parity;
- flat treegrid/task-control accessibility, roving focus, live announcements,
  forced-colors, reduced-motion, and focus retention under virtualization;
- jsdom integration adapters stay test-only and focused accessibility checks do not
  replace the live Chrome gate;
- SSR import and deterministic pre-measurement markup without browser globals.

## Completion Evidence

Base M4 completed on 2026-07-30 without revising this accepted contract:

- controlled and uncontrolled React consumers use the same per-instance command bus
  for toolbar, imperative, pointer, keyboard, context-menu, editor, and history
  actions;
- the controlled playground acknowledges candidates immediately and derives a
  network-free persistence request containing application operation identity, base
  revision, and concise row-oriented entity changes without a full document, local
  proposal/source metadata, lifecycle telemetry, raw patches, DOM events, or runtime
  objects;
- the runtime-owned resource-view consumer proves asynchronous allow/reject/replace
  interception, application-mapped atomic resource reassignment, useful mapper
  rejection, document/session defaults, semantic events, typed slots/columns, and
  occurrence-aware imperative focus/scroll for viewport-rendered targets;
- root-facade consumer, ownership, runtime, pointer, keyboard, customization, SSR,
  hydration, and accessibility tests pass as part of 50 test files and 238 tests;
- the packed module exports exactly the intended component, selector hook,
  parse/serialize, change-kernel, patch, and history values, while declarations expose
  no React runtime, runtime store, scene pipeline, or hit-test index;
- fixed-seed `m4-scene-v1` and `m4-runtime-v1` evidence records cache, viewport,
  runtime construction, controlled adoption, focus, preview, command, and hit-test
  observations for 2,000 tasks and 400 lanes without a release threshold;
- Chrome DevTools verified the main, matrix, controlled, and runtime-owned routes at
  1440 × 900, 900 × 900, and 560 × 900 with aligned geometry, no page overflow,
  complete labelled interaction surfaces, focus retention, live results, high
  contrast, media-rule inspection, no application console error, and no failed local
  request;
- `mise run ci`, the production playground build, packed-artifact inspection,
  linked-document checks, and `git diff --check` pass.

Detailed commands, timings, browser geometry, tool limitations, and deviations are
recorded in the
[completed M4 implementation plan](../plans/2026-07-30-interaction-runtime-public-api-plan.md).

## Consequences

- Controlled consumers must acknowledge a candidate locally before asynchronous
  persistence; server latency never blocks local rendering.
- Keeping range controlled makes M4 horizontal orchestration explicit but requires an
  `onRangeChange` callback for panning. M5 can introduce adaptive range/zoom ownership
  with evidence instead of inheriting a premature `defaultRange`.
- A combined session value produces one ownership callback for selection, focus, and
  vertical viewport intent. Selector equality keeps that public grouping from forcing
  broad rendering work.
- Conservative history reset on content-changing external replacement sacrifices
  local undo branches rather than overwriting unproven server changes.
- Flat treegrid rows preserve the architecture's hierarchy direction while avoiding
  false cell semantics for multiple task occurrences.
- M4 slots are intentionally smaller than the long-term theming surface; the
  interactive wrapper remains library-owned until a wrapper-slot contract can prove
  accessibility and behavior parity.

## Revisit Triggers

Revisit this decision before:

- allowing more than one controlled proposal in flight;
- rebasing history over content-changing external documents;
- adding backend operation IDs, retries, rollback, or conflict resolution;
- introducing uncontrolled horizontal range or adaptive zoom;
- making task segments directly editable by the built-in renderer;
- exposing a wrapper-replacement task slot;
- exporting private runtime, layout, viewport, or hit-test structures;
- replacing the flat treegrid with hierarchical M5 semantics or a canvas
  accessibility overlay.

## Links

- [Architecture state, commands, events, React API, rendering, and accessibility](../ARCHITECTURE.md)
- [M4 roadmap](../ROADMAP.md#m4-interaction-runtime-and-public-api)
- [M4 implementation plan](../plans/2026-07-30-interaction-runtime-public-api-plan.md)
- [Post-M4 timeline navigation contract](2026-07-30-timeline-navigation-interaction-contract.md)
- [M2 change-kernel contract](2026-07-30-change-kernel-contract.md)
- [M3 view/layout/viewport contract](2026-07-30-view-layout-viewport-kernel-contract.md)
