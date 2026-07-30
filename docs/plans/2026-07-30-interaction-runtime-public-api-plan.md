# M4 Interaction Runtime and Public API Implementation Plan

Status: Active; Slices 1–10 complete, Slice 11 next
Date: 2026-07-30
Milestone: M4

## Summary

Build one per-instance interaction runtime that composes the verified M1 document
kernel, M2 command/history kernel, and M3 view/layout/viewport kernel. Controlled and
uncontrolled React consumers should reach the same interceptable command bus used by
pointer, touch, keyboard, toolbar, menu, editor, and imperative actions. Document,
session, transient interaction, and derived state must remain separate.

This plan is the working handoff record for M4. It begins by fixing the durable
ownership, event, target-identity, interception, accessibility, and public-facade
contracts. The implementation slices then add the missing semantic task commands, a
React-free runtime store, async command orchestration, incremental derived-state
invalidation, viewport measurement, hit testing, interaction parity, customization
surfaces, and final public examples. No slice may weaken the completed M1–M3
contracts or silently pull M5 project-Gantt behavior into M4.

## Target State

At M4 completion:

- one instance-scoped runtime owns document, session, interaction, history, and
  derived snapshots according to explicit controlled/uncontrolled rules;
- controlled `document` input remains authoritative and uncontrolled
  `defaultDocument` input seeds runtime-owned immutable document/history state;
- the existing controlled read-only `document` path remains source-compatible;
- controlled and uncontrolled session inputs can govern selection, logical focus,
  and viewport intent independently from document ownership;
- drag preview, active pointer state, element measurement, pending interception, and
  live announcements remain transient runtime state rather than document fields;
- pointer, touch, keyboard, menu, editor, toolbar, and imperative mutations all call
  one async command bus, which delegates final domain validation and reduction to the
  M2 command kernel;
- interceptors can allow, reject, replace, or transact a proposed command without
  introducing a second mutation path;
- task movement and resize use explicit semantic command variants with deterministic
  instant-time behavior, while placement-only and cross-domain moves remain explicit
  transactions;
- selection and focus use stable view occurrence identity plus canonical provenance,
  so the same task may be independently addressed in multiple lanes or views;
- an immutable visible-primitive hit-test index supports task bodies, resize edges,
  lanes, and empty timeline locations without exposing M3 prefix or interval indexes;
- measured vertical viewport queries, overscan, focus retention, and drag preview use
  the M3 absolute geometry and rebuild only the affected derivation stages;
- the React facade exposes intentional event props, controlled/uncontrolled props,
  selector access for rendered slots, and a narrow imperative handle;
- every reducer-accepted document candidate exposes one immutable, persistence-ready
  change envelope with a local proposal ID, base revision, original and final
  commands, source, patches, inverse patches, and affected references;
- controlled applications acknowledge document candidates through local state before
  asynchronous persistence, while later server revisions remain authoritative
  external document updates rather than command acknowledgements;
- the default DOM/SVG renderer exposes stable interaction state attributes, visible
  focus, keyboard-operable task targets, a live region, and equivalent core pointer,
  touch, and keyboard workflows;
- minimal typed slots, class hooks, columns, tooltip, context menu, and basic task
  editor surfaces can reuse built-in behavior and accessibility bindings rather than
  reconstructing interaction logic;
- uncontrolled and controlled playground consumers demonstrate create, select, move,
  resize, cross-lane placement, edit, delete, undo, and redo through the public
  package facade;
- the controlled playground demonstrates the backend seam with a read-only debug
  textarea that records API-shaped change/event payloads without performing network
  I/O or claiming persistence-adapter behavior;
- fixed-seed interaction/invalidation evidence, focused integration tests, full CI,
  package inspection, production playground builds, SSR regression, and the required
  Chrome DevTools matrix pass before M4 is marked complete.

## Decisions

These planning decisions are formalized by the accepted
[`interaction-runtime and public-API contract`](../decisions/2026-07-30-interaction-runtime-public-api-contract.md).
The decision record fixes the exact M4 boundary; later slices must not quietly choose
different semantics.

### 1. Keep five runtime state categories distinct

Each `<Gantt>` instance has one runtime with separately observable categories:

1. **Document state**: the canonical `GanttDocument`, owned by a controlled prop or by
   the uncontrolled runtime.
2. **Committed session state**: selection, logical focus, and viewport intent, owned
   through independent controlled or uncontrolled session props.
3. **Transient interaction state**: active pointer/keyboard gesture, drag or resize
   preview, pending command/interceptor status, focus reconciliation, and live
   announcement text. This is always runtime-owned.
4. **History state**: bounded M2 patch/inverse entries and pending controlled
   acknowledgement metadata. It is operational runtime state, not persistent
   document data.
5. **Derived state**: document indexes, resolved view, intervals, lane layout,
   viewport kernel/query, hit-test index, and semantic primitives. These are private,
   reproducible caches.

No persistent document record may contain session, interaction, DOM, history, or
derived data. No public session value may contain DOM nodes, React elements, event
objects, promises, or mutable collections.

### 2. Make document and session ownership independently explicit

Document ownership is a discriminated prop contract:

- controlled mode accepts `document` and never mutates or replaces that prop
  internally;
- uncontrolled mode accepts `defaultDocument` once and owns later immutable document
  snapshots;
- providing both or neither is a type error after the M4 transition;
- the current `document`-only read-only usage remains valid and simply has no enabled
  built-in mutation path unless a change callback is supplied.

Session ownership is independent:

- a controlled session prop is authoritative for committed selection, focus, and
  viewport intent;
- a `defaultSession` seeds runtime-owned session state;
- omitting both creates a frozen empty/default session;
- transient gesture and measurement state remains internal even when committed
  session state is controlled.

The existing required `range` remains the controlled horizontal time-window contract.
M4 may add `defaultRange` for runtime-owned panning, but must not overload
`GanttDocument` or view definitions with viewport state. M5 owns adaptive zoom levels,
calendar-aware scales, and user-facing zoom policy.

### 3. Treat controlled command results as proposals until the prop acknowledges them

The command bus always reduces against the latest authoritative base document.

- In uncontrolled mode, a committed M2 outcome is adopted immediately, recorded in
  bounded history when non-empty, published to subscribers, and then reported to
  callbacks.
- In controlled mode, a committed outcome is sent through `onDocumentChange`; the
  prop remains the rendered authority. The outcome is a reducer-accepted candidate,
  not an authoritative runtime commit until the prop acknowledges it.
- At most one controlled document proposal may await acknowledgement. A second
  mutation against the same stale prop rejects with a stable runtime diagnostic
  rather than losing or reordering a change.
- Each candidate receives an opaque, instance-local `proposalId`. This ID correlates
  the callback, controlled acknowledgement, lifecycle events, and debug tooling; it
  is not a retry-safe backend operation ID.
- When the next controlled document equals the proposed candidate at the stable M1
  serialization boundary, before any server-revision replacement, the history entry
  is acknowledged.
- Controlled consumers must adopt an accepted candidate in local React or external
  store state without awaiting HTTP persistence. A later server response that adds a
  revision is a new authoritative external document input, not the first
  acknowledgement of the candidate.
- A divergent external replacement cancels the pending proposal and clears only
  history branches that cannot be replayed safely. It never overwrites the external
  document.
- Async interception captures its base. If that base changes before reduction, the
  proposal rejects as stale; interceptors are not silently replayed against new data.

Callbacks throwing after a commit are host errors. They are surfaced predictably but
do not mutate a document again or manufacture rollback semantics.

### 4. Use one async command bus for every mutation source

All built-in mutation surfaces call the same runtime `dispatch` operation with a
typed source context. The lifecycle is:

```text
propose command + source + interaction target
  -> enqueue per instance
  -> capture authoritative document
  -> run before-command interceptors in registration order
  -> allow | reject | replace | replace with transaction
  -> reject if captured controlled base became stale
  -> call applyGanttCommand exactly once
  -> produce rejected result or immutable document-change candidate
  -> call onDocumentChange with the candidate
  -> adopt immediately in uncontrolled mode
     or await matching controlled document prop
  -> publish commandCommitted only after adoption/acknowledgement
     or commandRejected when the proposal cannot commit
  -> announce user-visible result when the source was interactive
```

Interceptors do not mutate documents. Replacement is bounded and does not recursively
restart the same interceptor chain. Rejection uses structured diagnostics. Aborted
gestures, unmount, stale controlled props, thrown interceptors, and invalid replacement
values all settle the returned promise; none may leave an indefinitely pending
dispatch.

`onDocumentChange` is the single candidate-delivery hook in both ownership modes.
`commandCommitted` is an observation of authoritative local adoption, not a second
request to change the document. Persistence may observe the immutable change envelope,
but persistence I/O is never a before-command interceptor and never delays controlled
local acknowledgement.

Semantic events such as task activation, selection change, focus change, and viewport
change report interaction meaning but never carry an alternate document mutation
callback.

### 5. Reuse M2 history without turning undo/redo into hidden commands

Uncontrolled history directly composes `createGanttHistory`,
`commitGanttHistory`, `undoGanttHistory`, and `redoGanttHistory`.

Controlled history records only acknowledged proposals. Undo and redo propose the
corresponding patch result through the same controlled-document acknowledgement
boundary and fail closed on external divergence. They are explicit runtime history
operations, not fake `GanttCommand` variants and not direct record mutation.

Rejected and no-op commands do not enter history. One gesture that changes multiple
domain concepts dispatches one M2 transaction and therefore occupies one history
entry. Selection, focus, viewport, tooltip, editor-open, and drag-preview changes do
not enter document history.

### 6. Add semantic instant task movement and resize commands

M2 intentionally deferred `task.move` and `task.resize`. M4 adds them to the pure
command union before gesture code depends on them:

- `task.move` shifts an instant task schedule by an explicit epoch-millisecond delta
  or absolute start while preserving duration;
- `task.resize` changes one instant boundary with an explicit time;
- reducers remain pure, deterministic, strict, atomic, and patch-based;
- invalid, zero-width, reversed, unscheduled, all-day, or unsupported segment edits
  reject with stable diagnostics;
- snapping happens in interaction intent before dispatch and is visible in the
  proposed command; the reducer does not read pixels, ticks, locale, time zone, or
  browser state.

A horizontal task gesture emits a semantic task command. A pure visual lane move emits
`placement.move`. A gesture that changes schedule plus persisted placement emits one
transaction. Resource-derived and custom placements require an application-supplied
typed command mapper when provenance does not identify one unambiguous persisted
change. The runtime must never disguise assignment or resource changes as a generic
row move.

### 7. Address rendered occurrences, not raw IDs

Public interaction targets use the stable M3 occurrence key and copied canonical
provenance:

```ts
type GanttInteractionTarget = GanttLaneTarget | GanttTaskTarget;

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
```

Selection is an ordered, de-duplicated list of occurrence targets. Logical focus is
zero or one target. Cross-family same IDs and one task rendered multiple times remain
unambiguous. Targets are data-only snapshots; public types do not expose resolved
views, prefix sums, interval nodes, layout objects, or mutable primitive references.

When an uncontrolled target disappears after document/view change, selection is
pruned and focus moves deterministically to the nearest surviving visible target or
the chart root. Controlled stale targets are ignored for rendering and reported
through the normal session proposal without mutating the prop.

### 8. Keep gesture intent renderer-independent

The runtime builds a private immutable hit-test index from visible semantic
primitives and measured viewport geometry. It resolves:

- task body;
- task start and end resize edges;
- lane/timeline cell;
- empty timeline position;
- canonical provenance and snapped epoch-millisecond time.

DOM/SVG event delegation may provide an initial candidate key, but command meaning is
resolved through the same target/geometry layer used by keyboard operations and a
future canvas renderer. Pointer Events provide mouse, pen, and touch input. Pointer
capture, a movement threshold, explicit cancel/Escape behavior, and touch-sized edge
targets prevent accidental commits.

Drag/resize previews are immutable transient overlays. They do not modify canonical
records, M2 history, M3 layout, or the controlled document before command commit.
Preview state is cleared on commit, rejection, cancellation, view replacement,
unmount, and loss of the active pointer.

### 9. Stage and invalidate derived work privately

The current `buildChartScene` compatibility composer rebuilds validation, view
resolution, interval resolution, layout, viewport indexes, and primitives together.
M4 splits the internal pipeline into cached stages while preserving
`buildChartScene` behavior for direct internal tests:

```text
canonical document
  -> strict/read validation + primary indexes
  -> resolved view/provenance topology
  -> resolved placement intervals grouped by lane
  -> per-lane stack layout + cumulative geometry
  -> immutable viewport kernel
  -> measured viewport query + overscan
  -> semantic primitives
  -> visible hit-test index
```

M2 `affected` references plus previous/new indexes identify dirty tasks, placements,
assignments, resources, and lanes. Unknown external controlled document replacement,
view-definition change, layout-metric change, or failed dependency analysis falls
back to a safe broader rebuild. Session selection/focus changes are paint-only.
Vertical scroll re-queries the existing kernel. Horizontal range changes rebuild
ticks/query/primitives but not topology or stacking. Drag preview updates only the
preview/hit-test presentation required for that gesture.

Internal work counters and fixed fixtures prove reuse; they remain test/benchmark
details. M4 does not export M3 kernels or make a portable frame-rate claim.

### 10. Keep the imperative handle narrow

The first public handle may expose:

- `dispatch(command, options?)`;
- `getDocument()`;
- `getSession()` and `getSelection()`;
- `focusTask(...)`;
- `scrollToTask(...)` and `scrollToTime(...)`;
- `undo()`, `redo()`, and capability snapshots such as `canUndo`/`canRedo`.

Methods call runtime operations; they do not write DOM attributes or records
directly. Snapshot reads return frozen current values. `scrollToTime` and
`scrollToTask` update/propose M4 viewport intent. Adaptive `zoomTo` and
`fitToProject` policy may be added in M5 after the scale/zoom contract is fixed rather
than shipping M4 no-ops.

### 11. Ship a minimal coherent customization and CRUD surface

M4 implements the Architecture Slice 3 customization needed to prove public
interaction composition:

- typed task content and lane header slots;
- typed `classNames` contexts carrying selected, focused, dragging, invalid, and
  disabled state;
- a small column definition contract for the lane/grid side;
- built-in tooltip and context-menu surfaces;
- a basic instant-task editor;
- typed creation and derived-placement command mappers;
- required behavior, refs, ARIA properties, and event bindings in slot props.

The built-in UI dispatches typed commands. Applications replacing visual content do
not need to reimplement hit testing, focus, keyboard, or command dispatch. Full theme
manifest work, portable canvas appearance, dependency UI, arbitrary editor tabs, and
advanced column/tree features remain later work under `docs/UI_THEMING.md` and M5–M7.

### 12. Freeze a persistence-ready seam without making M4 own storage

M4 does not implement the architecture's persistence adapter, but its public change
contract must be sufficient for direct React state, external stores, and
application-owned persistence queues:

```ts
interface GanttDocumentChange {
  readonly proposalId: string;
  readonly document: GanttDocument;
  readonly baseRevision?: string | number;
  readonly originalCommand: GanttCommand;
  readonly command: GanttCommand;
  readonly source: GanttCommandSource;
  readonly patches: readonly GanttPatch[];
  readonly inversePatches: readonly GanttPatch[];
  readonly affected: readonly EntityReference[];
}
```

Exact naming remains a Slice 1 decision, but these semantics are required:

- the envelope is immutable, data-only, and JSON-compatible, including the canonical
  document snapshot already accepted by the public model;
- one reducer-accepted transaction produces one envelope and one history entry;
- a controlled consumer first adopts `document` locally, then enqueues `patches` with
  `baseRevision` for persistence;
- an application persistence queue supplies its own retry-safe operation ID and
  serializes or batches writes according to backend policy;
- a later server revision is applied as an external controlled document replacement;
- interceptors handle command policy and validation, not storage I/O;
- M4 surfaces enough data for an application to log, save, or diagnose a change, but
  it does not claim automatic rollback, conflict resolution, retries, temporary-ID
  reconciliation, or server acknowledgement.

Until a persistence adapter owns those later behaviors, controlled mode is the
recommended backend-connected path. Uncontrolled mode may observe committed patches,
but it is not the authoritative-server synchronization path.

## Scope

### In scope

- A React-free per-instance runtime store and immutable runtime snapshots.
- Public data-only types for committed session state, interaction targets, runtime
  command context/results, event payloads, slot props, class hooks, columns, and the
  imperative handle.
- Controlled and uncontrolled document ownership.
- Independently controlled and uncontrolled committed session ownership.
- Controlled proposal acknowledgement and stale-base rejection.
- Async before-command interception with allow/reject/replace/transaction outcomes.
- Ordered command lifecycle events and semantic interaction/session events.
- An immutable persistence-ready document-change envelope with local proposal
  correlation and explicit candidate-versus-commit event phases.
- Runtime integration with bounded M2 history and controlled undo/redo proposals.
- Pure instant `task.move` and `task.resize` commands plus focused property coverage.
- Stable selection and logical focus across view occurrences.
- Vertical measurement, scrolling, focus retention, viewport overscan, and viewport
  change subscriptions.
- Horizontal viewport intent based on the existing epoch-millisecond `range`, including
  imperative scroll-to-time/task and drag edge panning.
- Private staged derived-state caching and affected-reference invalidation.
- Renderer-independent visible hit testing and deterministic neighbor navigation.
- Pointer/mouse/pen/touch selection, task move, resize, persisted cross-lane placement
  movement, empty-lane creation where command mapping is unambiguous, and deletion.
- Equivalent keyboard selection, activation, create, move, resize, cross-lane move,
  delete, cancel, undo, and redo operations.
- Drag/resize preview, pending/rejected states, stable interaction attributes, and live
  announcements.
- Roving focus, treegrid/task semantics appropriate to the hybrid DOM/SVG renderer,
  visible focus, reduced-motion handling, forced-colors coverage, and touch target
  sizing.
- A minimal typed slot/class/column/tooltip/context-menu/basic-editor contract.
- Intentional package exports, README/API examples, controlled and uncontrolled
  playground routes, an API-shaped debug event/change log, SSR regression, and
  browser evidence.
- Plan, roadmap, architecture, and decision synchronization when implementation
  evidence changes a durable contract.

### Out of scope

- Task/lane hierarchy, expansion, summaries, milestone-specific interaction, filtering,
  sorting, and dependency graph/path editing; M5 owns them.
- Adaptive tick selection, public zoom levels/controls, calendar intervals, working
  time, time-zone-aware snapping, all-day editing, and DST-aware movement; M5/M6 own
  them.
- Direct manipulation of task segments in the default UI. Segment provenance remains
  visible and application command mappers may opt in without changing M3 identity.
- Automatic resource reassignment semantics for derived resource/custom views.
- Overlap policies other than M3 `stack`.
- Optimistic persistence adapters, rollback orchestration, server revisions,
  operation IDs, collaboration, retries, and conflict resolution.
  M4 still exposes the candidate/change envelope needed by application-owned state
  and persistence code; it does not own the corresponding I/O lifecycle.
- Persistent history, audit logs, history serialization, coalescing, or collaborative
  rebasing.
- Query adapters and partial-data loading.
- Dependency creation/removal keyboard workflow until M5 supplies dependency geometry
  and graph validation, despite the broader long-term accessibility commitment.
- Canvas rendering or a canvas accessibility overlay.
- Full UI-theming manifest, all built-in themes/densities, portable appearance,
  portal theme replication, visual export, or Tailwind package work.
- General-purpose toolbar, application menu system, form library, or design-system
  primitives.
- Public export of M3 resolved views, layout, viewport indexes, work counters, hit-test
  nodes, caches, or reducer internals.
- Workspace package splitting, Pro capability work, release automation, or public
  versioning promises beyond the intentional Community facade.
- M7 accessibility conformance, browser compatibility, performance thresholds, or
  release-grade regression claims.

## Current State

Observed during planning on `main` at `03722f6`:

- The worktree was clean before this plan and roadmap synchronization.
- M1, M2, and M3 are complete and verified according to their detailed plans and
  decision records.
- The latest recorded full gate passed 29 test files and 125 tests, and built four
  package artifacts. This plan does not claim to have rerun that implementation gate.
- `packages/gantt/src/react/Gantt.tsx` accepts only a controlled immutable `document`
  plus required `range`, time-zone, and tick inputs. It owns no runtime store,
  session, history, measurement, selection, focus, or interaction state.
- The component recomputes `buildChartScene` with `useMemo`, reports diagnostics from
  an effect, and renders one static DOM/SVG scene.
- Task `<g>` elements expose stable view and canonical provenance attributes but use
  `role="img"` and have no event bindings, tab stop, focus model, handles, or state
  attributes.
- `packages/gantt/src/render/build-chart-scene.ts` already composes validation, view
  resolution, interval resolution, stacking, immutable viewport construction/query,
  ticks, and primitives, but creates those stages together on every relevant input
  change.
- `BuildChartSceneOptions.viewport` can query a vertical subset, but the React renderer
  does not measure or pass a viewport and does not render virtual spacers/offsets for
  a non-zero vertical start.
- M3 keeps resolved keys, layout, prefix sums, interval indexes, viewport kernels,
  query work, and oracles private. Absolute lane/task `y` geometry and copied
  provenance reach semantic primitives.
- M2 publicly exposes strict `applyGanttCommand`, versioned patches/inverses, typed
  affected references, atomic transactions, and explicit-capacity immutable history.
- The current command union includes task add/update/delete and placement
  add/move/delete, but no semantic `task.move` or `task.resize`.
- No async interceptor, command queue, runtime event, controlled acknowledgement,
  runtime diagnostic, selector store, `useSyncExternalStore` adapter, or imperative
  handle exists.
- `packages/gantt/src/styles.css` contains a focus token and a dormant focus rule, but
  rendered task groups are not focusable. There are no selection, dragging, resize
  handle, pending, invalid, forced-colors, touch-density, or reduced-motion states.
- The completed `/interactive` playground route is an application-owned controlled
  toolbar proof. It composes public M2 history with the read-only M3 component but
  deliberately contains no chart-owned interaction or public M4 contract.
- There is no browser-DOM interaction test stack beyond server-rendered React tests,
  and no `ResizeObserver` or Pointer Event test harness.

## Behavior to Preserve

- M1 normalization, recovery diagnostics, canonical immutability, cross-family ID
  reuse, stable serialization, and six-domain round trips remain unchanged.
- M2 commands remain the only document mutation authority. Runtime code may propose,
  intercept, enqueue, and observe commands, but may not edit canonical arrays or
  records directly.
- M2 reducers and history remain React-, DOM-, browser-, locale-, clock-, and
  time-zone-independent.
- M3 view definitions remain data-only. Stable occurrence keys and canonical
  provenance survive through layout, primitives, targets, DOM attributes, events, and
  tests.
- M3 half-open interval, deterministic stack, minimum lane-height, absolute vertical
  coordinate, viewport intersection, and immutable index semantics remain intact.
- Document, project, resource, and custom views continue through one resolver/layout
  path rather than interaction implementations per view kind.
- All-day or otherwise unsupported task bars remain read-only and receive an explicit
  disabled/rejected interaction reason; the runtime does not guess a time zone or
  convert date-only schedules.
- The current controlled read-only `<Gantt document={...}>` use, default labels,
  diagnostics callback, semantic primitives, DOM identity, theme variants, CSS
  subpath, `/`, `/matrix`, and `/interactive` output remain compatible until a slice
  intentionally changes and verifies them.
- Server rendering never reads `window`, `document`, `ResizeObserver`,
  `getBoundingClientRect`, current time, or element dimensions at module scope.
- Measurement begins only after mount, and pre-measurement output remains
  deterministic.
- Rejected commands, rejected controlled proposals, canceled gestures, failed undo,
  and failed redo retain the current authoritative document by identity.
- A drag preview is never persisted, serialized, patched, or included in history.
- Internal DOM class names and nesting remain private. Only intentional
  `data-gt-part`, state, identity, and documented slot/class contracts are public.
- Community remains the component, document, codec, command, runtime, and basic
  interaction authority. No M4 code adds Pro conditionals.

## Implementation Shape

### Runtime ownership

```text
controlled document prop ──────┐
                               ├─> per-instance runtime snapshot
uncontrolled document/history ─┘        │
                                        ├─ document snapshot
controlled/default session ─────────────┤
                                        ├─ committed session snapshot
pointer/keyboard/measurement ───────────┤
                                        ├─ transient interaction snapshot
M1–M3 pure derivation ──────────────────┤
                                        └─ private derived snapshot
                                                │
                                                v
                                      useSyncExternalStore selectors
                                                │
                                                v
                                      React DOM/SVG and typed slots
```

The React component creates exactly one runtime per mounted instance and updates its
controlled inputs through explicit methods. It does not recreate the store for each
render. Runtime snapshots are immutable and subscriber notification is deferred until
the complete operation state is consistent.

### Public prop direction

Slice 1 should refine a discriminated union close to:

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

`onDocumentChange` observes a committed candidate and its original command, final
intercepted command, source, local proposal ID, patches, inverses, affected references,
diagnostics, and base document identity/revision metadata. It does not receive a
mutable event object. “Committed candidate” means accepted by the pure reducer;
`commandCommitted` remains reserved for uncontrolled adoption or controlled prop
acknowledgement.

Controlled consumers acknowledge the candidate by synchronously scheduling their
local React or external-store update. Persistence starts from the same envelope but
does not gate that acknowledgement. Server revisions arrive later as external
controlled document input.

High-frequency measured dimensions are derived and read-only. Committed viewport
intent contains only application-meaningful values; it does not require consumers to
control `clientWidth`, `clientHeight`, pointer coordinates, or DOM scroll event
objects.

### Runtime snapshot and selectors

The internal state should be explicit enough for focused equality:

```ts
interface GanttRuntimeState {
  readonly document: GanttDocument;
  readonly session: GanttSessionState;
  readonly interaction: GanttInteractionState;
  readonly history: GanttRuntimeHistoryState;
  readonly viewport: MeasuredViewportState;
  readonly derived: GanttDerivedSnapshot;
}
```

The runtime exposes `getSnapshot`, `subscribe`, and operation methods. React uses
`useSyncExternalStore`. `useGanttSelector` is public for descendants rendered through
typed slots and throws a clear error outside the owning Gantt context. External
sibling controls use event props and the imperative handle; M4 does not add a global
runtime registry.

Selector equality must prevent a selection or tooltip change from rerendering every
bar. Visible task/lane components subscribe by occurrence key. Removed keys unsubscribe
cleanly.

### Invalidation matrix

| Change | Required invalidation |
| --- | --- |
| External document with no trusted affected metadata | validation through hit testing |
| Acknowledged M2 outcome | affected index entries, dependent topology/interval lanes, geometry suffix if heights move, viewport query, primitives, hit testing |
| View definition | topology through hit testing |
| Layout metric or measured lane-column width | lane layout/geometry through hit testing |
| Horizontal `range`, tick, locale, or time-zone display input | viewport time query, ticks/labels, primitives, hit testing as applicable |
| Vertical scroll/extent | viewport query, visible primitives, hit testing |
| Selection/focus/pending state | affected visible presentation and accessibility state only |
| Drag/resize preview | preview primitives and relevant hit-test/auto-pan state only |
| Paint class/token change | React/CSS presentation only |

When dependency analysis is uncertain, correctness wins through a documented broader
rebuild. Work counters must distinguish a safe fallback from the common selective
path.

### Interaction command mapping

```text
task body horizontal move
  -> task.move

task start/end edge
  -> task.resize

persisted placement vertical move
  -> placement.move

schedule + persisted lane change
  -> transaction(task.move, placement.move)

empty persisted document lane creation
  -> typed create mapper
  -> transaction(task.add, placement.add)

resource/custom/derived occurrence
  -> application command mapper
  -> explicit command/transaction or disabled reason
```

Snapping uses an explicit positive epoch-millisecond interaction step and anchor.
Keyboard and pointer paths call the same intent-to-command function. The hit-test layer
never calls `applyGanttCommand` directly.

### Accessibility and focus shape

- The chart exposes coherent grid/treegrid, row, cell, and task-control semantics
  appropriate to multiple entries per lane.
- One task occurrence participates in roving tab order; arrow keys navigate by stable
  visual geometry without depending on DOM order alone.
- Selection and logical focus are distinct and reflected through documented state
  attributes and ARIA state where valid.
- Keyboard move/resize uses the same snap step and command mapping as pointer input.
- A polite, atomic live region announces selection, move, resize, create, delete,
  validation rejection, undo, and redo results without duplicating task labels.
- Focused or actively dragged occurrences remain in overscan or receive a stable focus
  proxy while virtualization changes.
- Pointer-only handles have keyboard equivalents. Touch-sized hit geometry does not
  require visually oversized bars.
- Escape cancels preview/editor/menu state without committing a command.
- Reduced motion disables drag/scroll animation, and forced-colors preserves visible
  focus and interaction boundaries.

## Cross-Slice Rules

- Update this plan and `docs/ROADMAP.md` in every M4 change set. Append dated findings
  and exact verification evidence; do not replace prior notes.
- Update `docs/ARCHITECTURE.md` and the M4 decision record in the same change set if
  evidence changes public ownership, command/event lifecycle, target identity,
  renderer boundaries, accessibility commitments, public API, or release acceptance
  criteria.
- Do not start a later slice until the active slice's focused tests and `vp check`
  pass and their exact outcomes are recorded.
- Do not mark a slice done from source inspection, type checking, browser appearance,
  or benchmark output alone.
- Keep M1–M3 pure modules free of React and browser imports. Runtime state may remain
  React-free even when it models browser-derived numeric measurements.
- Never mutate controlled props, canonical records, commands, session values, event
  payloads, history entries, primitives, or slot contexts.
- Route every document mutation through the runtime command bus and then the M2
  reducer or patch/history operation. No component, hook, slot, menu, editor, or
  imperative method may splice records directly.
- Keep session and semantic events out of document history.
- Preserve stable occurrence keys and copied canonical provenance through interaction
  targets, selection, focus, previews, DOM attributes, events, and tests.
- Reject ambiguous resource/custom cross-lane gestures unless a typed command mapper
  returns explicit domain intent.
- Keep snapping deterministic and explicit. Do not read current time, host locale,
  host time zone, device pixel ratio, or frame timing to decide a command.
- Use Pointer Events with capture and cancellation; do not maintain separate mouse and
  touch reducers that can drift semantically.
- Keep M3 indexes and runtime caches private. A public callback receives data-only
  snapshots, not internal nodes or mutable maps.
- Coalesce scroll/resize publication to one scheduled browser update without dropping
  the final state. Tests must be able to drive the scheduler deterministically.
- Preserve SSR output and do not branch initial markup on dimensions unavailable
  during server render.
- Any React, primitive, style, scenario, or playground change triggers the connected
  Chrome DevTools verification required by `AGENTS.md`. Record routes, viewport sizes,
  accessibility findings, console/network state, and live issues fixed in this plan.
- Use fixed seeds and reported replay paths for property tests. Keep local benchmark
  timings as baselines, not portable performance claims.
- Keep the package facade smaller than the internal runtime. Export a type or helper
  only when the component, a typed slot, or a demonstrated controlled consumer needs
  it.

## Implementation Slices

### Slice 1: Freeze the M4 runtime and public API contract

Status: `[x]` Done

**Goal**

Create one durable decision record for ownership, controlled acknowledgement,
interception, history, session/target identity, viewport intent, interaction command
mapping, accessibility, customization, and the minimum public facade.

**Why here**

These choices cross every runtime, renderer, event, and consumer boundary. Changing
them after pointer, keyboard, and imperative integrations land would multiply public
APIs and invalidate behavior tests.

**This slice should implement**

- Add
  `docs/decisions/2026-07-30-interaction-runtime-public-api-contract.md`.
- Prototype only the uncertain type relationships needed to settle the contract; do
  not leave production runtime behavior in this docs/contract slice.
- Fix the controlled/uncontrolled document and session prop union.
- Fix controlled proposal acknowledgement, one-pending-proposal behavior, stale-base
  rejection, and external replacement history behavior.
- Fix the opaque local `proposalId`, persistence-ready change envelope, and separation
  between local controlled acknowledgement, authoritative commit notification, and
  later server-revision replacement.
- Fix interceptor input/output, replacement bounds, ordering, exception, abort, and
  unmount semantics.
- Fix command and semantic event ordering and payload immutability.
- Fix session target identity, selection ordering, focus reconciliation, and viewport
  intent.
- Fix task move/resize command payloads and instant-only rejection semantics.
- Fix the default command-mapping boundary for persisted, resource-derived, and custom
  occurrences.
- Fix imperative handle methods and explicitly defer unsupported M5 zoom policy.
- Fix accessibility roles, keyboard bindings, announcement responsibilities, and
  virtualization focus retention.
- Fix the minimum slot/class/column/menu/tooltip/editor surface required for the M4
  exit condition.
- Link the decision from architecture, roadmap, and this plan. Update architecture
  only where the accepted contract changes or materially narrows the baseline.

**Expected output**

- A linked cross-plan decision record with examples precise enough for implementation
  and public type tests.
- Updated architecture/roadmap/plan text with M4 still not started at runtime level.

**Verification**

- `vp check`
- `git diff --check`
- Explicit linked-file existence checks.
- Focused read across architecture Sections 7–10, 16–19, Architecture Slice 3, the M2
  and M3 decisions, the M4 decision, this plan, and the roadmap.
- No runtime, package, interaction, benchmark, or browser claim for this docs-only
  slice.

**Dependencies**

- Verified M1–M3 completion.
- This planning pass and the controlled playground proof.

### Slice 2: Add pure semantic task move and resize commands

Status: `[x]` Done

**Goal**

Complete the minimum React-free M2 command vocabulary that pointer and keyboard task
geometry changes require.

**Why here**

Gesture code must target stable domain intent. Implementing pixels or schedule edits in
the runtime before the pure reducer exists would create a second mutation path.

**This slice should implement**

- Extend the command types with the accepted `task.move` and `task.resize` variants.
- Normalize and strictly validate all payload values without reading view or browser
  state.
- Implement instant schedule movement with exact duration preservation.
- Implement start/end resize with half-open, positive-width interval enforcement.
- Emit deterministic task replacement patches, direct inverses, affected task
  references, and stable diagnostics.
- Reject unscheduled, all-day, malformed, zero-width, reversed, missing, and
  unsupported segment targets without mutation.
- Cover command input immutability, cross-family same IDs, transaction nesting,
  patch replay, inverse byte identity, no-op behavior, and fixed-seed round trips.
- Export only the two command contracts through the root facade.

**Expected output**

- Pure task move/resize reducers ready for any runtime source.
- Focused root-import coverage without interaction or React dependencies.

**Verification**

- `vp test run packages/gantt/src/commands`
- Focused root-facade tests for the new command variants.
- `vp check`
- `vp pack`
- Inspection confirming the command sources import no React, DOM, browser, locale,
  clock, or time-zone modules.

**Dependencies**

- Slice 1 accepted command payload and diagnostic semantics.
- Existing M2 normalize/reduce/patch/history contracts.

### Slice 3: Build the React-free runtime store and ownership state machine

Status: `[x]` Done

**Goal**

Create one immutable instance runtime with document/session ownership, snapshots,
subscriptions, and deterministic controlled input reconciliation before adding async
commands or DOM behavior.

**Why here**

Every command, selector, measurement, and gesture needs one state authority. Ownership
bugs are easier to prove without React effects or pointer events obscuring them.

**This slice should implement**

- Add private runtime snapshot, ownership, session, interaction, history metadata,
  and subscription types.
- Implement instance creation, immutable `getSnapshot`, subscribe/unsubscribe, and
  batched publication.
- Implement controlled document replacement and uncontrolled initialization/update
  boundaries without retaining mutable consumer input.
- Implement controlled/default session normalization and deterministic selection,
  focus, and viewport reconciliation.
- Implement one-pending-controlled-proposal metadata and acknowledgement comparison at
  the M1 stable serialization boundary.
- Implement external controlled document divergence handling and fail-closed history
  invalidation metadata.
- Add selector/equality helpers without React and prove unrelated state slices retain
  referential identity.
- Cover two independent runtime instances, cross-family/occurrence target identity,
  view removal, stale controlled inputs, frozen snapshots, unsubscribe during publish,
  and reentrant subscriber safety.

**Expected output**

- A framework-independent runtime store with no DOM or React imports.
- Deterministic ownership state-machine tests that later React adapters can treat as
  the source of truth.

**Verification**

- Focused runtime store/state tests.
- Fixed-seed operation-sequence properties for ownership and immutability.
- `vp check`
- Source inspection proving no React/browser dependency in the runtime store.

**Dependencies**

- Slice 1 ownership/session contract.
- M1 serializer and canonical model.

### Slice 4: Add the async command bus, events, and bounded history orchestration

Status: `[x]` Done

**Goal**

Route imperative and future UI commands through one ordered, interceptable lifecycle
that correctly adopts uncontrolled outcomes or proposes controlled outcomes.

**Why here**

Pointer, keyboard, menus, and editors should consume a proven bus rather than each
implementing async/stale/history behavior.

**This slice should implement**

- Add runtime `dispatch`, interceptor result, command source/context, lifecycle event,
  and runtime rejection contracts.
- Serialize per-instance dispatch and settle every promise on commit, rejection,
  thrown interceptor, abort, stale base, controlled proposal pending, or disposal.
- Implement allow, typed reject, one replacement, and explicit transaction
  replacement without recursive interceptor loops.
- Delegate final validation/reduction exactly once to `applyGanttCommand`.
- Adopt and publish uncontrolled outcomes with M2 bounded history.
- Propose controlled candidates, acknowledge matching props, and reject divergent or
  stale bases as fixed in Slice 1.
- Deliver one immutable document-change envelope for every reducer-accepted candidate
  and preserve its proposal ID through controlled acknowledgement.
- Implement controlled/uncontrolled undo and redo through M2 patch/history operations,
  including acknowledgement in controlled mode.
- Publish immutable `commandCommitted` only after uncontrolled adoption or controlled
  prop acknowledgement, and publish `commandRejected` when reduction or proposal
  commitment fails.
- Keep semantic session events separate and make callback failure behavior explicit.
- Add queue, stale, replacement, transaction, no-op, rejection, callback-throw,
  unmount/abort, history-capacity, external-replacement, undo, and redo tests.

**Expected output**

- One tested command lifecycle usable by imperative, pointer, keyboard, menu, editor,
  and toolbar integrations.
- No React facade expansion yet beyond internal test adapters.

**Verification**

- Focused command-bus and history orchestration tests.
- Fixed-seed mixed dispatch/undo/redo/external-replacement sequences.
- `vp check`
- Existing M2 command/history/property tests.

**Dependencies**

- Slices 2–3.

### Slice 5: Stage derived caches and add measured viewport subscriptions

Status: `[x]` Done

**Goal**

Turn the monolithic scene composition into reusable private stages, then connect
measured vertical viewport intent without changing public M3 kernels.

**Why here**

Hit testing and gestures need stable visible geometry. Building them on a full-scene
rebuild per scroll or drag would bake avoidable invalidation into the public
interaction design.

**This slice should implement**

- Refactor validation/index, resolved view, interval, per-lane stack/cumulative
  geometry, viewport kernel/query, tick, and primitive stages behind private
  composition contracts.
- Keep `buildChartScene` as a compatibility composer with existing result parity.
- Add dependency maps from canonical affected references to view occurrences and
  layout lanes.
- Reuse unaffected topology, intervals, lane stacks, viewport indexes, ticks, and
  primitives according to the invalidation matrix.
- Add internal work observations for tests/benchmarks without production exports.
- Add numeric measured viewport state, overscan policy inputs, scroll coalescing, and
  resize scheduling to the runtime without DOM types in the pure store.
- Update React rendering primitives as needed for virtual top/bottom space and
  absolute lane/task offsets while preserving lane/timeline alignment.
- Preserve deterministic pre-measurement/SSR scene output; measurement starts after
  mount in a later React integration slice.
- Cover empty, clipped, variable-height, focused, and out-of-bounds queries plus safe
  full rebuild on unknown external document changes.

**Expected output**

- A reusable private derived pipeline and work-count evidence.
- Correct virtual geometry for non-zero vertical viewport starts.
- Runtime operations ready to receive browser measurement/scroll input.

**Verification**

- Existing M3 view/layout/viewport and scene parity suites.
- Focused cache invalidation tests for task label, task schedule, placement lane,
  assignment/resource, lane metric, view, horizontal range, vertical scroll, and
  unknown external document changes.
- Fixed-seed cached-versus-cold scene parity with reported replay path.
- Focused work-count benchmark; record sizes, visible counts, seed, versions, hardware,
  and distribution without a CI timing threshold.
- `vp check`
- `vp build apps/playground`
- Chrome DevTools geometry regression if React/CSS output changes in this slice.

**Dependencies**

- Slice 3 runtime store.
- Completed M3 kernels and benchmark fixture.

### Slice 6: Add renderer-independent hit testing and interaction intent

Status: `[x]` Done

**Goal**

Resolve pointer coordinates and keyboard targets into the same stable interaction
intent and preview model without dispatching from renderer code.

**Why here**

Pure geometry and command mapping should be proven before browser event capture,
portals, or focus effects are introduced.

**This slice should implement**

- Build a private immutable visible hit-test index from scene primitives, measured
  timeline bounds, and current range.
- Resolve lane cells, empty time positions, task bodies, and start/end resize edges.
- Define mouse/pen and expanded touch hit geometry with deterministic priority for
  overlapping targets.
- Implement coordinate-to-time conversion and explicit snap-step/anchor rules.
- Implement visual-neighbor navigation for up/down/left/right using the same stable
  occurrence targets.
- Add pure gesture intent states for press threshold, move, resize, cross-lane move,
  create, cancel, and commit.
- Map supported intent to `task.move`, `task.resize`, `placement.move`, or one explicit
  transaction.
- Add typed creation and derived/custom command-mapper hooks with fail-closed disabled
  reasons.
- Produce immutable preview primitives and user-facing result descriptions without
  changing the document.
- Cover clipped bars, dense overlaps, variable lanes, multiple occurrences of one
  task, cross-family IDs, ambiguous provenance, all-day/segment rejection, touch edge
  expansion, snap ties, offscreen targets, and cancel/restart.

**Expected output**

- A renderer-neutral hit-test/intent layer shared by pointer and keyboard adapters.
- No event listener or React behavior yet.

**Verification**

- Focused hit-test, navigation, gesture-state, command-mapping, and preview tests.
- Fixed-seed hit-index parity against a brute-force visible primitive oracle.
- `vp check`
- Source inspection confirming the pure layer imports no React or browser globals.

**Dependencies**

- Slices 2 and 5.

### Slice 7: Integrate the React facade, selectors, semantic events, and imperative handle

Status: `[x]` Complete

**Goal**

Replace the read-only component's local scene memo with the instance runtime while
preserving existing controlled rendering and exposing the minimum intentional M4
facade.

**Why here**

The store, command bus, cache, and target geometry are already proven, so React can
remain an adapter instead of becoming a second runtime authority.

**This slice should implement**

- Create exactly one runtime per mounted `<Gantt>` and reconcile controlled props
  through effects/layout effects as accepted by the SSR contract.
- Add the controlled/uncontrolled document and session prop unions without breaking
  existing controlled read-only calls.
- Connect React through `useSyncExternalStore` selectors and instance context.
- Export `useGanttSelector` only for descendants rendered by the owning Gantt/slots;
  provide a clear outside-context error.
- Add immutable command and semantic event props.
- Add `forwardRef` and the accepted `GanttHandle` snapshot, dispatch, focus, scroll,
  undo, and redo methods.
- Begin measurement only after mount using `ResizeObserver`, scroll listeners, and an
  injectable/coalesced scheduler; do not access browser globals at module scope.
- Render selection/focus/pending/disabled state attributes and the hidden polite live
  region.
- Preserve diagnostic reporting and prevent callback identity churn from rebuilding
  derived state.
- Add controlled, uncontrolled, hydration/SSR, selector isolation, ref, two-instance,
  measurement cleanup, scroll coalescing, and callback-order integration tests.

**Expected output**

- A public runtime-backed React component that remains read-only-compatible and is
  ready for event adapters.
- Intentional root exports for types used by real React consumers, with caches and
  geometry internals still private.

**Verification**

- Focused React runtime/facade tests in a DOM-capable test environment.
- Existing server-rendered root, M1, M2, and M3 facade tests.
- SSR render/import check with browser globals absent.
- `vp check`
- `vp pack` plus declaration/bundle inspection.
- `vp build apps/playground`
- Chrome DevTools `/`, `/matrix`, and `/interactive` regression at 1440 × 900 and
  560 × 900 if the rendered surface changes.

**Dependencies**

- Slices 3–6.

### Slice 8: Implement pointer, pen, and touch workflows

Status: `[x]` Done

**Goal**

Make direct manipulation select, move, resize, create, and move persisted placements
through the proven intent and command-bus paths with equivalent Pointer Event
semantics across device types.

**Why here**

The React facade, measurement, hit testing, preview, and dispatch lifecycle are stable
enough that browser events can remain thin adapters.

**This slice should implement**

- Add delegated Pointer Event bindings for task bodies, resize edges, lane cells, and
  empty timeline areas.
- Implement pointer capture, movement threshold, click versus drag distinction,
  source metadata, multi-pointer rejection, pointer cancellation, capture loss, and
  unmount cleanup.
- Select/focus task occurrences without mutating documents.
- Render move/resize/create previews through transforms/overlays without rerunning
  canonical layout on each pointer move.
- Commit semantic task move/resize, persisted placement move, combined transaction, or
  mapped creation only on pointer release.
- Add horizontal edge panning and vertical auto-scroll through viewport session
  operations with distinct drag overscan.
- Keep touch hit targets usable without inflating visible geometry and suppress
  unintended text selection/native drag behavior only while necessary.
- Hold or clearly mark preview while async interception is pending, then reconcile
  commit/rejection and announce the outcome.
- Emit task activation, selection, focus, and viewport semantic events in documented
  order.
- Add state attributes and reduced-motion behavior for pressing, dragging, resizing,
  pending, rejected, selected, and focused states.

**Expected output**

- Mouse, pen, and touch direct manipulation through the same typed command path.
- No keyboard-only behavior regression and no direct DOM/document mutation.

**Verification**

- DOM integration tests for mouse/pen/touch Pointer Events, thresholds, capture,
  cancellation, async interception, controlled acknowledgement, auto-scroll, and
  cleanup.
- Existing command, runtime, cache, hit-test, SSR, and scene suites.
- `vp check`
- `vp build apps/playground`
- Chrome DevTools live pointer and touch-emulation checks on the in-scope route,
  recording viewport, interaction results, layout, console, and network state.

**Dependencies**

- Slices 4–7.

### Slice 9: Add keyboard, focus, and accessibility parity

Status: `[x]` Complete

**Goal**

Provide keyboard and assistive-technology workflows equivalent to the core pointer
operations while retaining focus through virtualization and asynchronous outcomes.

**Why here**

Keyboard bindings can now reuse the same target navigation, command mapping, preview,
and bus rather than encode a parallel interaction model.

**This slice should implement**

- Implement the accepted grid/treegrid, row, cell, task-control, selected, disabled,
  and descriptive relationships for the hybrid DOM/SVG surface.
- Add roving tab stop and deterministic geometric arrow navigation.
- Add documented keys for selection, activation/editor, create, move, resize,
  cross-lane placement move, delete, undo, redo, and Escape cancellation.
- Use the same snap step, target identity, command mapper, transaction, and
  interceptor path as pointer interaction.
- Keep logical focus stable through viewport changes with overscan or a focus proxy;
  reconcile safely when a target disappears.
- Add visible focus for default/high-contrast/forced-colors modes and no
  motion-dependent information.
- Announce selection, movement, resize, creation, deletion, command rejection,
  validation details, undo, and redo once through a polite atomic region.
- Preserve useful task date names and avoid duplicate SVG/image announcements.
- Ensure pointer-only resize affordances have keyboard equivalents and correct
  accessible descriptions.
- Document the intentionally deferred dependency-link and all-day workflows.

**Expected output**

- Equivalent core keyboard mutation behavior and a coherent accessible interaction
  surface.
- Automated semantics plus recorded live accessibility-tree evidence.

**Verification**

- DOM keyboard/navigation/focus/live-region integration tests.
- Automated accessibility checks for empty, populated, selected, focused, dragging,
  pending, rejected, and virtualized states.
- `vp check`
- `vp build apps/playground`
- Chrome DevTools accessibility-tree, keyboard-only, high-contrast/forced-colors,
  reduced-motion, console, and network checks at desktop and narrow viewports.

**Dependencies**

- Slices 6–8.

### Slice 10: Add typed customization, menus, tooltip, columns, and basic editor

Status: `[x]` Complete

**Goal**

Prove that applications can customize and complete basic instant-task CRUD while
reusing runtime behavior, accessibility, and command dispatch.

**Why here**

The default interactions and semantics are established, so slot props can carry
stable behavior rather than making third-party content reconstruct it.

**This slice should implement**

- Add the minimum typed task-content and lane-header slots with stable target,
  behavior, state, ARIA, ref, and event-binding props.
- Add typed task/lane/root `classNames` hooks and intentional documented state/part
  attributes.
- Add a small column definition surface that preserves variable lane geometry and
  virtualization alignment.
- Add a built-in accessible tooltip and context menu that use the owning runtime and
  remain within the themed instance when practical.
- Add a basic instant-task editor for title, start, and end that validates locally and
  dispatches `task.update` or one explicit transaction.
- Add create/edit/delete actions to the default menu and command mapper, with stable
  disabled reasons for unsupported derived/custom/all-day/segment cases.
- Keep portal, focus return, Escape, click-away, pending, error-label, and
  live-announcement behavior consistent.
- Prove custom visual replacements can trigger the same selection, focus, move,
  resize, menu, and editor operations without direct document access.
- Update `docs/UI_THEMING.md` only if implementation evidence changes its durable
  slot/class/state contract.

**Expected output**

- A minimal useful CRUD/customization surface aligned with Architecture Slice 3.
- No general design-system, full theme-manifest, dependency, or project-tree scope.

**Verification**

- Focused slot/class/column/tooltip/menu/editor type and interaction tests.
- Portal focus-return and two-instance isolation tests.
- SSR test proving closed tooltip/menu/editor paths render deterministically.
- `vp check`
- `vp pack` plus public declaration inspection.
- `vp build apps/playground`
- Chrome DevTools CRUD, slot, portal, focus, responsive layout, accessibility-tree,
  console, and network checks.

**Dependencies**

- Slices 7–9.

### Slice 11: Prove consumers, harden the facade, and close M4

Status: `[-]` In progress

**Goal**

Demonstrate the complete public workflow in controlled and uncontrolled applications,
verify selective runtime behavior and package boundaries, and record evidence before
marking M4 complete.

**Why here**

The implementation is not complete until real consumers use only root exports and the
combined automated/browser/package gates verify the milestone outcome.

**This slice should implement**

- Upgrade `/interactive` as the controlled consumer while preserving its external
  toolbar/history proof and adding chart-owned interaction.
- Add a focused uncontrolled consumer route seeded by `defaultDocument` and
  `defaultSession`.
- Demonstrate select, focus, create, move, resize, persisted cross-lane move, edit,
  delete, undo, redo, async allow/reject/replace interception, imperative focus/scroll,
  and one typed slot/column customization.
- Treat the controlled page state as the local application store: adopt each
  `onDocumentChange` candidate immediately, then derive an example API request from
  the same immutable envelope.
- Add an accessible read-only debug textarea labeled `Example API change log`. Append
  deterministic JSON entries for candidate, committed, and rejected lifecycle events
  plus the API-shaped write payload containing an example operation ID, proposal ID,
  base revision, command source, and patches. Do not include DOM events, mutable
  runtime objects, or an unnecessary full-document payload in the example request.
- Make transactions visible as one API-shaped batch entry so add-plus-placement and
  other cross-domain gestures demonstrate atomic persistence intent.
- Keep the debug example network-free and clearly label retry, rollback, server
  revision, ID reconciliation, and conflict handling as later adapter concerns.
- Demonstrate initial API-shaped loading through the canonical parse boundary and
  document how the same controlled contract maps to direct React state and one
  external-store-style consumer.
- Demonstrate an unsupported derived/custom gesture with a useful disabled reason and
  an application mapper that makes one explicit transaction.
- Add README/API examples for controlled, uncontrolled, direct React/external-store
  ownership, API loading, persistence-ready change envelopes, interception, lifecycle
  events, imperative handle, session ownership, slots, and the instant/all-day
  boundary.
- Add focused root-facade compile/runtime tests and inspect packed declarations and
  bundles for private-type leakage.
- Run the fixed-seed runtime/cache/hit-test benchmark and record reproducible metadata,
  work counts, and local timings without a release threshold.
- Run the complete automated, production-build, SSR, responsive browser,
  accessibility, console, and network gates.
- Update this plan, the roadmap baseline/status/current focus/change log, architecture
  only if the accepted target changed, and the M4 decision record with final evidence.
- Mark M4 complete only after every required gate is recorded; select M5 detailed
  planning as the next action.

**Expected output**

- Controlled and uncontrolled public examples that perform the M4 CRUD workflow
  through one command bus.
- An inspectable API-shaped change/event log proving candidate, acknowledgement,
  transaction, and commit ordering without claiming a persistence adapter.
- An intentional package facade with no runtime/cache/index leakage.
- Verified M4 completion evidence and an actionable M5 handoff.

**Verification**

- Focused root-facade tests for controlled/uncontrolled props, session types, command
  interception, semantic events, selectors/slots, and the imperative handle.
- `mise run ci`
- `vp build apps/playground`
- SSR import/render and hydration regression.
- Packed artifact/declaration inspection.
- Fixed-seed runtime/invalidation/hit-test benchmark with environment metadata.
- `git diff --check`
- Linked-file existence and focused architecture/roadmap/decision/plan/API terminology
  checks.
- Chrome DevTools on `/`, `/matrix`, `/interactive`, and the uncontrolled route at
  1440 × 900, 900 × 900, and 560 × 900 where applicable.
- Live pointer, touch-emulation, and keyboard workflows; viewport/lane/task alignment;
  no horizontal page overflow; complete accessible names/roles/states/live results;
  focus retention; high contrast and reduced motion; zero application-authored console
  errors; and no unexpected application network failure.

**Dependencies**

- Slices 1–10.

## Testing Plan

### Unit and property tests

- Pure task move/resize normalization, rejection, patches, inverses, transactions, and
  immutability.
- Runtime ownership state transitions and controlled acknowledgement.
- Immutable snapshots, selector equality, subscriptions, two-instance isolation, and
  disposal.
- Interceptor ordering, replacement, rejection, stale bases, abort, exceptions, and
  queue settlement.
- Controlled/uncontrolled history, no-op behavior, divergence, undo, and redo.
- Proposal ID stability, candidate-versus-commit event order, immediate controlled
  local acknowledgement, and later server-revision replacement.
- Cache dependency analysis, cold/cached parity, work counters, and safe fallbacks.
- Viewport overscan, measurement state, scroll scheduling, and focus retention.
- Hit-test indexed/brute-force parity, touch expansion, snap rules, neighbor
  navigation, intent state, preview, and command mapping.

### React integration tests

- Existing controlled read-only rendering.
- Controlled and uncontrolled document/session modes.
- `useSyncExternalStore` selector isolation.
- Pointer mouse/pen/touch workflows and cancellation.
- Keyboard CRUD, focus, roving tab order, and live announcements.
- Async interception and controlled acknowledgement during UI gestures.
- API-shaped debug event/change logging, transaction batching, and omission of
  runtime-only/DOM values from persistence payloads.
- Virtualized variable-height alignment and imperative scrolling/focus.
- Slots, class hooks, columns, tooltip, menu, editor, portals, and focus return.
- SSR without browser globals and deterministic pre-measurement output.

The slice that adds DOM interaction tests should add the smallest justified
DOM-capable React test dependencies and document why they are needed. Browser gaps in
Pointer Events, `ResizeObserver`, layout measurement, and accessibility must use
explicit deterministic test adapters rather than global production polyfills.

### Performance evidence

- Reuse the M3 fixed generator/seed conventions.
- Compare cached output with a cold oracle after mixed task, placement, assignment,
  lane, view, range, scroll, selection, and preview updates.
- Record invalidated stages and processed/visible counts.
- Measure cold runtime construction, controlled prop adoption, steady scroll query,
  selection/focus update, pointer preview update, and committed task move.
- Record runtime/tool versions, generator version, seed, document/view/visible counts,
  build mode, browser when used, hardware profile, and distribution.
- Do not add a cross-machine wall-clock threshold or claim frame-rate/interaction
  percentiles as release guarantees in M4.

### Browser and accessibility evidence

Use Chrome DevTools MCP as required by `AGENTS.md` and inspect only the in-scope local
playground routes. Record:

- route and exact viewport size;
- controlled versus uncontrolled mode;
- pointer type or touch emulation and every action exercised;
- keyboard-only workflow and focus order;
- desktop, intermediate, and narrow layout/overflow geometry;
- variable-height lane/timeline/preview/handle alignment;
- accessibility-tree roles, names, selected/focused/disabled states, live-region
  output, menu/editor labels, and focus return;
- forced-colors/high-contrast and reduced-motion findings;
- console messages separated into application and browser/extension sources;
- network failures and whether they are application-owned;
- every issue fixed during the gate, recorded first as a plan deviation.

## Likely Files to Add

Exact names may be refined after Slice 1, but the expected boundaries are:

- `docs/decisions/2026-07-30-interaction-runtime-public-api-contract.md`
- `packages/gantt/src/runtime/types.ts`
- `packages/gantt/src/runtime/store.ts`
- `packages/gantt/src/runtime/session.ts`
- `packages/gantt/src/runtime/command-bus.ts`
- `packages/gantt/src/runtime/derived-cache.ts`
- `packages/gantt/src/runtime/hit-test.ts`
- `packages/gantt/src/runtime/interaction-intent.ts`
- `packages/gantt/src/runtime/interaction-commands.ts`
- `packages/gantt/src/runtime/*.test.ts`
- `packages/gantt/src/runtime/*.property.test.ts`
- `packages/gantt/src/react/runtime-context.tsx`
- `packages/gantt/src/react/use-gantt-selector.ts`
- `packages/gantt/src/react/interaction/*.tsx`
- `packages/gantt/src/react/*.test.tsx`
- a focused uncontrolled playground page

## Likely Files to Change

- `packages/gantt/src/commands/types.ts`
- `packages/gantt/src/commands/normalize.ts`
- `packages/gantt/src/commands/reduce.ts`
- focused M2 command/property tests
- `packages/gantt/src/render/build-chart-scene.ts`
- `packages/gantt/src/render/primitives.ts`
- private view/layout/viewport composition modules where staged reuse requires it
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/styles.css`
- `packages/gantt/src/index.tsx`
- root facade/package tests
- `apps/playground/src/Playground.tsx`
- `apps/playground/src/pages/InteractivePage.tsx`
- `apps/playground/src/styles.css`
- `package.json` and the lockfile only if the DOM/a11y test stack requires dependencies
- `README.md`
- `docs/UI_THEMING.md` only if its durable public contract changes
- `docs/ARCHITECTURE.md` when Slice 1 fixes or later evidence changes durable target
  state
- `docs/ROADMAP.md`
- this plan

## Open Questions for Slice 1

1. Should controlled session ownership cover one combined session object or separate
   selection/focus/viewport props? Prefer one immutable object unless render-frequency
   evidence proves the combined callback unusable.
2. Should M4 add `defaultRange` beside the existing controlled `range`, or keep
   horizontal range controlled in both document modes until M5? Prototype imperative
   scroll and edge-pan behavior before fixing this.
3. What is the smallest accessible DOM/SVG structure that represents multiple task
   occurrences per lane without falsely claiming spreadsheet cell semantics?
4. Which keyboard chord set avoids browser/assistive-technology conflicts while
   preserving discoverable move versus resize operations?
5. Which default interactions can be unambiguously generated for document, project,
   resource, and custom views, and where must a typed command mapper be required?
6. Does the current package test environment justify `jsdom`, Testing Library,
   `user-event`, and an automated accessibility checker, or can a smaller DOM harness
   cover the same contract?
7. Which slot/class/column contracts are truly required for the M4 CRUD example, and
   which should stay deferred until M5 or broader UI-theming implementation?

## Risks and Mitigations

- **Controlled lost updates:** allow one unacknowledged proposal and reject stale
  follow-ups; cover acknowledgement and divergence exhaustively.
- **Server latency mistaken for controlled acknowledgement:** require immediate local
  adoption, keep proposal IDs separate from backend operation IDs, and model later
  server revisions as external replacements.
- **Async interceptor races:** capture the base, serialize dispatch, settle on every
  exit, and reject rather than replay after authoritative input changes.
- **Runtime becomes a second reducer:** forbid direct document mutation and require
  M2 outcomes or history patches for every adoption.
- **Session/document coupling:** keep selection, focus, viewport, preview, and
  announcements out of patches and document serialization.
- **Ambiguous cross-lane meaning:** use provenance and typed command mappers; reject
  resource/custom ambiguity rather than guessing assignment changes.
- **All-day/time-zone corruption:** make M4 instant-only movement/resize explicit and
  leave calendar-aware arithmetic to M5/M6.
- **Virtual focus loss:** retain focused items in overscan or a focus proxy and test
  scroll/view/document removal paths.
- **Preview rebuild cost:** update transient preview presentation without rebuilding
  canonical layout per pointer move.
- **Over-broad invalidation:** use affected references and work counters; retain a
  correctness-first full fallback for unknown external documents.
- **Public API expansion:** prove each export through the component, a typed slot, or a
  controlled/uncontrolled example; keep caches and geometry private.
- **Customization scope growth:** implement the minimum CRUD-composition surface and
  defer the complete UI-theming matrix.
- **Synthetic DOM confidence gap:** combine deterministic unit/integration tests with
  connected live Chrome pointer, touch, keyboard, accessibility, console, and network
  evidence.

## Working Notes

### 2026-07-30 — Slice 1 contract implementation

- Added the accepted
  [`interaction-runtime and public-API contract`](../decisions/2026-07-30-interaction-runtime-public-api-contract.md)
  and linked it from architecture, roadmap, and this active plan.
- Fixed one combined controlled/uncontrolled session value and retained the existing
  controlled horizontal `range` with a new request callback rather than adding
  `defaultRange` before M5 zoom policy.
- Fixed occurrence-based selection/focus identity, instant-only task move/resize
  payloads, fail-closed derived-placement mapping, FIFO interception, exact controlled
  acknowledgement, revision-aware history replacement, immutable candidate envelopes,
  event ordering, the occurrence-aware imperative handle, and the narrow selector
  facade.
- Fixed a flat treegrid structure with task controls inside timeline cells,
  mode-based keyboard editing, live announcements, focus retention, and the minimum
  M4 slot/class/column/menu/tooltip/editor contract.
- Selected a focused jsdom, Testing Library, user-event, and direct axe-core
  integration stack for later React slices, with deterministic test-only adapters
  and live Chrome remaining authoritative for real browser behavior.
- Updated durable architecture state categories, command shapes, React ownership,
  imperative, selector, accessibility, and Architecture Slice 3 text to match the
  accepted decision.
- This slice intentionally adds no production runtime, React behavior, package export,
  interaction test, benchmark, or browser claim.
- Verification passed:
  - `vp check` reported all 82 files formatted and no warning, lint, or type error
    across 71 checked files;
  - `git diff --check` passed;
  - the decision file exists and focused heading/link reads confirmed all seven open
    questions are resolved and linked from architecture, roadmap, and this plan;
  - a focused read across architecture Sections 7–10, 16–19, Architecture Slice 3,
    the M2/M3 decisions, this plan, roadmap, and the accepted M4 decision found no
    ownership, event-phase, occurrence-identity, range, accessibility, or public-facade
    conflict;
  - `mise run ci` passed the complete check, 29-test-file/125-test, and four-artifact
    package build gates.

### 2026-07-30 — Planning baseline

- Read the complete `planning-slices` skill and applied its target-state, ordered-slice,
  dependency, verification, working-note, and next-slice structure.
- Reconciled roadmap M4 with architecture state, commands/events, public React API,
  virtualization, accessibility, testing, and Architecture Slice 3.
- Inspected the completed M2/M3 plans and decisions plus the completed controlled
  playground proof.
- Inspected the current command/history types, root facade, React renderer, semantic
  primitives, scene composer, viewport kernel/query, CSS, package scripts, and
  playground file boundaries.
- Confirmed that the existing controlled playground proves application composition but
  not chart-owned runtime behavior.
- Confirmed that M4 needs a pure task move/resize command foundation before gesture
  implementation.
- Confirmed that M3 already supplies private stable identity, absolute geometry, and
  reusable indexes, but current React composition rebuilds them together and does not
  measure/query a live viewport.
- Planning-document verification passed:
  - `vp check` reported all 82 files formatted and no warning, lint, or type error
    across 71 checked files;
  - `git diff --check` passed;
  - explicit architecture, roadmap, and new-plan existence checks passed;
  - a focused status/link/slice read found the active M4 plan in the milestone map and
    current focus, no stale “plan not created” wording, and all eleven slices with
    goal, ordering rationale, expected output, verification, and dependencies.
- No implementation, runtime test, package, benchmark, or browser verification was
  performed by this planning pass.

### 2026-07-30 — State and backend-hook refinement

- Clarified that M4 must distinguish reducer-accepted candidates from authoritative
  commits, keep controlled local acknowledgement independent from server persistence,
  and prove the boundary with an API-shaped interactive log.
- Added the required local proposal ID and immutable change-envelope semantics without
  moving persistence-adapter I/O, retries, rollback, revision reconciliation,
  temporary-ID mapping, or conflicts into M4.
- Expanded Slice 11 with API-shaped loading, direct React/external-store ownership
  guidance, transaction batch logging, and an accessible read-only debug textarea.
- Synchronized the durable lifecycle and persistence boundary in
  `docs/ARCHITECTURE.md` and the active status/change log in `docs/ROADMAP.md`.
- Documentation verification passed:
  - `vp check` reported all 82 files formatted and no warning, lint, or type error
    across 71 checked files;
  - `git diff --check` passed;
  - focused terminology and linked-file checks passed.
- No runtime, playground, network, package, test, benchmark, or browser implementation
  claim was made by this refinement.

### 2026-07-30 — Slice 2 semantic task move and resize commands

- Added the accepted exclusive-delta/absolute-start `task.move` and edge/time
  `task.resize` contracts and exported only those two public command types through the
  root facade.
- Added pure reducer handling that preserves instant duration, changes one resize
  boundary, produces one deterministic whole-task replacement patch plus direct
  inverse/affected references, and retains document identity for valid no-ops.
- Added stable diagnostics for invalid intervals, unsupported schedules, and
  unsupported segment targets while preserving existing missing-target and
  invalid-payload behavior.
- Rejected unscheduled, all-day, zero-width, reversed, non-finite, overflowing,
  malformed, missing, and segment-directed inputs without mutating the base document
  or command.
- Added focused examples and fixed-seed properties covering input immutability,
  cross-family same IDs, nested transactions, replay, byte-identical inversion,
  no-ops, deterministic outcomes, and root-facade type use.
- TypeScript's plain-object type guard narrowed inline object type-alias members
  differently from interface members. The two private move-shape branches therefore
  use interfaces while the exported `TaskMoveCommand` remains the accepted exclusive
  union; this is an implementation-only typing finding and does not change the public
  contract.
- Source inspection confirmed the command types, normalizer, validator, and reducer
  import only model/command modules and no React, DOM, browser, locale, clock, or time
  zone dependency.
- Verification passed:
  - `vp test run packages/gantt/src/commands` passed 11 test files and 39 tests;
  - the focused root-facade test passed;
  - `vp check` reported all 84 files formatted and no warning, lint, or type error
    across 73 checked files;
  - `vp pack` built all four package artifacts;
  - `git diff --check` passed;
  - `mise run ci` passed the complete check, 31-test-file/133-test, and four-artifact
    package build gates.
- No React, primitive, style, scenario, or playground file changed, so this pure
  command slice did not trigger a browser gate.

### 2026-07-30 — Slice 3 React-free runtime store and ownership state machine

- Added private runtime target/session/occurrence, ownership, interaction, history
  metadata, snapshot, selector, and store contracts without expanding the root package
  facade.
- Added canonical document cloning through the stable M1 serialization boundary so
  controlled/default inputs are never retained mutably, plus independent controlled
  and uncontrolled document/session modes.
- Added deeply frozen versioned snapshots, batched publication, safe unsubscribe during
  publication, non-recursive reentrant updates, peer notification when one subscriber
  throws, disposal, and selector equality that skips unrelated state slices.
- Added one-pending controlled proposal staging, stale-base/no-op detection, exact
  serialized acknowledgement, same-base rerender tolerance, divergent replacement,
  revision-only history preservation, and fail-closed content-replacement
  invalidation metadata.
- Added ordered occurrence identity normalization, selection de-duplication/pruning,
  deterministic same-lane/nearest-lane focus reconciliation, controlled full-session
  proposals, repeated-task occurrence identity, and lane/task same-key separation.
- Fixed-seed properties cover controlled acknowledge/revision/external-replacement
  sequences and uncontrolled session cloning/freezing. Focused examples cover two
  instances, mutable inputs, frozen snapshots, stale proposals, view removal,
  subscriptions, selector equality, ownership mode errors, and disposal.
- Source inspection confirmed runtime production files import only M1 model and
  private runtime modules and contain no React, DOM, browser, locale, clock, or time
  zone dependency.
- Verification passed:
  - `vp test run packages/gantt/src/runtime` passed 2 test files and 16 tests;
  - `vp check` reported all 89 files formatted and no warning, lint, or type error
    across 78 checked files;
  - `vp pack` built all four package artifacts;
  - `git diff --check` passed;
  - `mise run ci` passed the complete check, 33-test-file/149-test, and four-artifact
    package build gates.
- No React, primitive, style, scenario, or playground file changed, so this pure
  runtime slice did not trigger a browser gate.

### 2026-07-30 — Slice 4 async command bus, lifecycle events, and bounded history

- Added one private per-instance FIFO command bus with instance-local proposal IDs,
  immutable normalized source/target/command snapshots, bounded registration-order
  interceptors, typed allow/reject/replace outcomes, and transaction replacement
  without recursive interceptor passes.
- Added cancellation that settles active and queued work, disposal that settles active
  work and rejects an unacknowledged controlled proposal, async stale-base detection,
  one-pending controlled rejection, read-only controlled rejection, and stable runtime
  diagnostics for every exit.
- Delegated each allowed dispatch to `applyGanttCommand` exactly once, adopted
  uncontrolled candidates before callbacks, staged controlled candidates without
  optimistic authority, and preserved the proposal ID through exact prop
  acknowledgement or later divergence rejection.
- Added deeply immutable JSON-compatible change envelopes and ordered
  `onDocumentChange`, `commandCommitted`, `commandRejected`, and `onRuntimeError`
  callbacks. Callback and store-subscriber failures are surfaced to a host-error
  reporter without rollback or a second mutation.
- Added runtime history descriptors over the existing M2 bounded history kernel so
  transactions remain one entry, controlled entries appear only after
  acknowledgement, undo/redo use explicit inverse/forward proposals, revision-only
  replacements rebase, and content-changing external replacements clear unsafe
  branches.
- Fixed-seed properties cover mixed controlled dispatch, undo, redo, revision, and
  external-content sequences. Focused examples cover queue order, replacement chains,
  typed/thrown/invalid interceptors, reducer/no-op paths, abort, disposal, stale bases,
  pending proposals, acknowledgement, divergence, callback failures, capacity,
  transaction grouping, controlled/uncontrolled undo/redo, and JSON envelopes.
- Source inspection confirmed command-bus/history production files import only
  M1/M2/private runtime modules and contain no React, DOM, browser, locale, clock, or
  time zone dependency.
- Verification passed:
  - combined focused M2 command and M4 runtime tests passed 15 files and 73 tests;
  - `vp check` reported all 93 files formatted and no warning, lint, or type error
    across 82 checked files;
  - `vp pack` built all four package artifacts;
  - `git diff --check` and framework-boundary import inspection passed;
  - `mise run ci` passed the complete check, 35-test-file/167-test, and four-artifact
    package build gates.
- No React, primitive, style, scenario, or playground file changed, so this pure
  runtime slice did not trigger a browser gate.

### 2026-07-30 — Slice 5 staged derivation and measured viewport

- Replaced the monolithic cold scene implementation with a private staged composer
  covering reference validation/indexing, view topology, interval resolution,
  lane-local stacking, cumulative geometry, viewport indexes/query, ticks, and
  semantic primitives. `buildChartScene` remains the cold compatibility entry point
  and exact cached-versus-cold parity is verified.
- Added canonical affected-reference dependency maps from tasks, resources, lanes,
  assignments, and placements to view occurrence and lane keys. Selective rebuilds
  reuse unaffected topology, intervals, lane-local stacks, positioned suffixes,
  interval indexes, ticks, and individual lane/task primitive objects; external
  documents without trusted affected metadata use an observable full fallback.
- Refactored M3 stacking into lane-local and cumulative positioning stages while
  preserving the existing pure `stackLanes` result, validation behavior, ordering,
  immutability, variable heights, and absolute placement geometry.
- Extended the React-free runtime snapshot with deterministic unmeasured viewport
  state, numeric client/scroll measurements, asymmetric overscan, retained
  focus-range expansion, session-intent reconciliation, injectable scheduling,
  coalesced final scroll/resize publication, explicit flush/clear, disposal
  cancellation, and eager immutable input capture.
- Focused invalidation examples cover task labels and schedules, placement lanes,
  assignments and resources, layout metrics, view definitions, horizontal ranges,
  vertical scroll, clipped/out-of-bounds queries, variable heights, retained focused
  geometry, and unknown external documents. The fixed-seed property uses
  `seed=20260730`, 80 runs, verbose counterexamples, and up to 30 mixed
  label/schedule/placement/vertical-window operations per run.
- The focused `m4-scene-v1` benchmark used seed `20260730`, 2,000 tasks, 400 lanes,
  sparse instant intervals, and alternating viewports with 45/40 visible tasks.
  Vitest `4.1.10` on Node `24.18.1`, arm64 Apple M3 Pro (12 cores, 18 GB) reported:
  cold validation/view/layout/index/primitives 73.851 Hz, mean 13.5408 ms, 38 samples,
  ±4.89%; affected task label 183.00 Hz, mean 5.4646 ms, 92 samples, ±1.85%; vertical
  viewport query 42,058.65 Hz, mean 0.0238 ms, 21,030 samples, ±5.32%. These are local
  structural/work baselines, not CI thresholds or portable speed claims.
- Verification passed:
  - focused pipeline, parity, runtime-store, measured-viewport, and fixed-seed
    property tests passed 5 files and 29 tests;
  - the existing M3 layout and scene subset passed 5 files and 23 tests during the
    refactor;
  - `vp check` reported all 99 files formatted and no warning, lint, or type error
    across 88 checked files;
  - `vp build apps/playground` transformed 46 modules and produced the production
    HTML, CSS, and JavaScript artifacts;
  - `vp pack` built all four package artifacts;
  - `git diff --check` and React/browser import inspection passed;
  - `mise run ci` passed the complete check, 38-test-file/180-test, and four-artifact
    package build gates.
- No React component, CSS, scenario, or playground source changed. Absolute lane/task
  offsets and non-zero viewport queries remain pure scene geometry, while live
  measurement starts in Slice 7; this slice therefore did not trigger a browser gate.

### 2026-07-30 — Slice 6 renderer-independent interaction geometry and intent

- Added a private immutable visible hit-test index that converts absolute scene
  primitives and numeric timeline bounds into lane-grouped task geometry, copied
  occurrence targets, and deterministic coordinate/time resolution.
- Added task-body, start/end edge, and empty timeline-position hits with delegated
  candidate preference, later-paint overlap priority, clipped-edge suppression,
  mouse/pen edge geometry, and touch-expanded 44-pixel vertical/22-pixel edge targets.
- Added explicit positive step/anchor snapping with ties toward the later epoch,
  clamped coordinate-to-time conversion, visual left/right/up/down/home/end
  navigation, empty-lane skipping, and occurrence summaries for runtime
  reconciliation.
- Added a pure pointer-agnostic gesture reducer with per-input movement thresholds,
  press/move/resize/create/cancel/commit/reset states, snapped horizontal and
  cross-lane intent, immutable previews, focus-independent destination resolution,
  and deterministic user-facing descriptions without changing the document.
- Added built-in mapping to `task.move`, `task.resize`, `placement.move`, or one
  ordered transaction, plus frozen synchronous create/derived-occurrence mapper
  inputs, cloned/frozen mapper commands, and fail-closed missing/thrown/invalid mapper
  results.
- Focused examples cover clipped bars, exact edge ties, dense overlaps, variable
  lanes, non-zero vertical starts, expanded touch edges, repeated task occurrences,
  cross-family same keys, offscreen targets, cross-lane moves, creation,
  cancel/restart, ambiguous provenance, all-day schedules, segments, invalid resize
  intervals, mapper immutability, and preview/document separation.
- The hit-test property uses `seed=20260730`, 250 runs, verbose counterexamples, up to
  eight variable-height lanes and 40 dense visible tasks, and matches indexed results
  against an independent brute-force primitive oracle for mouse, pen, and touch.
- Verification passed:
  - focused hit-test, navigation, gesture, command-mapping, and property tests passed
    5 files and 16 tests;
  - `vp check` reported all 109 files formatted and no warning, lint, or type error
    across 98 checked files;
  - `vp pack` built all four package artifacts;
  - `git diff --check` and React/browser-global import inspection passed;
  - `mise run ci` passed the complete check, 43-test-file/196-test, and four-artifact
    package build gates.
- No React component, CSS, scenario, or playground source changed, and the new layer
  contains no event listeners or browser globals. This slice did not trigger a
  browser gate.

### 2026-07-30 — Slice 7 React facade, selectors, semantic events, and imperative handle

- Replaced the read-only component's local scene memo with one per-instance React
  runtime that composes the Slice 3 store, Slice 4 command bus, and Slice 5 staged
  scene pipeline without making React a second document authority.
- Added exclusive controlled/uncontrolled document and session prop unions, retained
  source-compatible controlled read-only rendering, reconciled controlled props in
  layout effects, and preserved canonical input-reference diagnostics in both SSR
  and mounted output.
- Added a frozen public selector snapshot, instance context, `useSyncExternalStore`
  subscriptions with equality reuse and a stable outside-provider error, semantic
  document/session/focus/selection/viewport/range callbacks, and the accepted narrow
  `forwardRef` imperative handle.
- Preserved trusted affected references through uncontrolled adoption and controlled
  acknowledgement so command-driven React updates retain selective scene
  invalidation. External controlled documents continue to use the conservative full
  fallback, while revision-only changes retain derived content.
- Added post-mount scroll/resize measurement with `ResizeObserver`, passive scroll
  listeners, coalesced animation-frame publication, focused-range retention, absolute
  virtual lane geometry, and observer/listener/frame cleanup without module-scope
  browser access.
- Added stable disabled, pending, selected, and focused state attributes plus a hidden
  polite live region. Pointer-operable task controls and treegrid semantics remain
  intentionally owned by Slices 8 and 9.
- Added jsdom only as a test dependency and covered uncontrolled command rendering,
  controlled candidate/acknowledgement order, controlled semantic session proposals,
  ref methods, selector isolation, two instances, Strict Mode replay, hydration,
  measurement coalescing/cancellation, and observer cleanup. Root-facade compile
  tests prove ownership exclusivity and intentional public exports.
- Verification passed:
  - focused facade/runtime/root tests passed 4 files and 24 tests;
  - the existing SSR/M1/M2/M3 facade and kernel subset passed 27 files and 124 tests;
  - `vp check` reported all 115 files formatted and no warning, lint, or type error
    across 104 checked files;
  - `vp pack` built the four public artifacts; declaration inspection found
    `GanttProps`, `GanttHandle`, selector/event/session/target types and no private
    React runtime, store, scene, viewport-index, or hit-test type;
  - `vp build apps/playground` transformed 52 modules and produced the production
    HTML, CSS, and JavaScript artifacts;
  - `git diff --check` passed;
  - `mise run ci` passed the complete check, 46-test-file/213-test, and four-artifact
    package build gates.
- Chrome DevTools verification passed on `/`, `/matrix`, and `/interactive` at
  1440 × 900 and 560 × 900:
  - all chart roots reported zero diagnostics and the document had no horizontal
    overflow; measured root/viewport geometry remained aligned across the main chart,
    five matrix scenarios, and the interactive chart;
  - accessibility snapshots exposed labeled chart regions, accessible task names,
    empty-state text, control status, and the new polite live regions;
  - screenshots showed intact large and narrow layouts, absolute lanes aligned with
    timeline rows, expected compact label clipping, and preserved dark/high-contrast
    variants;
  - the controlled `/interactive` “Add item” flow updated from zero to one rendered
    task with correct live status and enabled undo/remove controls;
  - every local request returned 200 or 304. No application-owned console error or
    warning appeared; Vite connection logs and extension/DevTools CSP, deprecation,
    MaxListeners, ObjectMultiplex, and content-script messages were separated as
    environment noise.

### 2026-07-30 — Slice 8 pointer, pen, and touch workflows

- Connected one delegated Pointer Event adapter on the timeline to the private
  hit-test index, pure gesture reducer, immutable preview, intent mapper, and existing
  per-instance command bus. Pointer input carries numeric DOM geometry and
  mouse/pen/touch source metadata without exposing DOM nodes or events through the
  public runtime facade.
- Added primary-button/primary-pointer admission, capture and guarded release,
  movement thresholds, click activation, secondary-pointer rejection,
  `pointercancel`, capture-loss cancellation, native-drag prevention, and runtime
  disposal settlement. Selection and logical focus update before task activation,
  and document changes remain reducer-owned.
- Added public data-only interaction mapper, snap, preview, and selector-state types.
  Built-in gestures map task movement, resize, persisted placement movement, and
  combined transactions; empty-lane creation and ambiguous derived-occurrence moves
  continue through frozen application mapper inputs.
- Rendered transformed move/resize/create previews without recomputing canonical
  layout on each pointer move. Preview retention expands measured overscan, vertical
  edge motion proposes session scroll, horizontal edge motion requests a controlled
  range, and pending/rejected outcomes retain or reconcile the preview through the
  authoritative command lifecycle.
- Added stable root/task attributes for pressing, dragging, resizing, pending, and
  rejected state; task and preview reduced-motion treatment; forced-colors preview
  treatment; and pointer-gesture-only text-selection suppression. The timeline uses
  `touch-action: none` because Pointer Event gesture negotiation requires that policy
  at pointer-down time, while visible touch hit expansion remains private geometry.
- Updated the controlled `/interactive` consumer to acknowledge chart candidates
  synchronously, supply one-day snapping and mapped task creation, and expose
  chart-originated commit/rejection status without introducing another mutation path.
  The separate playground toolbar history reset remains an example-level concern
  selected for Slice 11's unified consumer proof.
- Focused jsdom coverage proves mouse, pen, and touch move parity, activation/event
  order, resize, persisted placement movement, mapped creation, pointer capture,
  secondary-pointer rejection, cancellation/capture loss, mapper rejection, async
  pending reconciliation, controlled acknowledgement, and vertical/horizontal
  auto-pan. A direct runtime regression covers synchronous controlled acknowledgement
  before the awaiting pointer continuation resumes.
- Verification passed:
  - the final full test gate passed 46 files and 221 tests; the interaction DOM suite
    contains 14 tests including the three pointer-device variants;
  - `vp check` reported all 115 files formatted and no warning, lint, or type error
    across 104 checked files;
  - `vp pack` built the four public artifacts; declaration inspection found the
    intentional mapper/snap/preview/state types and no public runtime store, scene
    cache, or hit-test index;
  - `vp build apps/playground` transformed 55 modules and produced the production
    HTML, CSS, and JavaScript artifacts;
  - `git diff --check` passed;
  - `mise run ci` passed the complete check, 46-test-file/221-test, and four-artifact
    package build gates.
- Chrome DevTools verification passed on `/`, `/matrix`, and `/interactive` at
  1440 × 900 and 560 × 900:
  - accessibility snapshots exposed the expected labeled chart regions, controls,
    task names, status, and polite interaction announcements;
  - screenshots showed intact large and narrow main, five-scenario matrix, and
    interactive layouts with no page-level horizontal overflow or application alert;
  - a live desktop mouse drag moved Work item 1 from 29 Jul–2 Aug to 5–9 Aug, returned
    the root to idle, and announced the controlled commit;
  - touch emulation traversed pressing → dragging with a visible preview, moved Work
    item 1 from 29 Jul–2 Aug to 1–5 Aug, then created Work item 2 in an empty lane and
    announced `Create committed.`;
  - every local request returned 200 or 304. No application-owned console error or
    warning appeared; Vite and extension/DevTools CSP, deprecation, MaxListeners,
    ObjectMultiplex, and content-script messages were recorded as environment noise.
- Live verification found and fixed the synchronous controlled-ack race recorded
  below. Focused event-order review also corrected the controlled semantic-observer
  deviation recorded below; neither change alters the accepted public type or
  architectural boundary.

### 2026-07-30 — Slice 9 keyboard, focus, and accessibility parity

- Added pure keyboard move, start/end resize, and create geometry over the same
  occurrence navigation, snap policy, visible-lane geometry, preview, intent mapper,
  transaction, and command-bus path used by pointer interaction.
- Added roving task focus, visual left/right/up/down/Home/End navigation, Space
  selection, Enter activation/commit, M move, S/E resize, N create,
  Delete/Backspace removal, platform undo/redo, and Escape cancellation. Logical
  focus survives controlled acknowledgement, viewport retention, deletion, undo,
  redo, virtualization, and empty-chart fallback.
- Added a public data-only `GanttInteractionAction` and keyboard interaction-state
  branch without exporting private keyboard reducers, runtime/store classes, scene
  caches, viewport indexes, or hit-test indexes.
- Added a labeled hybrid region/treegrid surface with lane rows, row headers,
  timeline cells, occurrence task buttons, `aria-owns` relationships, useful date
  names, selected/disabled state, shortcut descriptions, one polite atomic
  announcement, and one roving tab stop. The visible SVG remains presentational while
  task controls remain exposed.
- Added visible default and high-contrast focus, forced-colors focus/preview rules,
  and reduced-motion transitions. Dependency-link and all-day editing remain
  explicitly described as deferred.
- Added Testing Library `16.3.2`, user-event `14.6.1`, and axe-core `4.12.1` as exact
  workspace development dependencies with `vp add -Dw`. Six DOM keyboard/accessibility
  cases cover empty, populated, selected, focused, moving/resizing/creating/deleting,
  undo/redo, pending, rejected, dragging, virtualized, and empty-fallback states;
  three pure keyboard-intent cases cover move/lane, resize bounds, and creation.
  Axe's jsdom-unreliable color-contrast rule is disabled only in the synthetic DOM
  suite, while live theme and forced-color presentation remain browser gates.
- Updated the controlled `/interactive` proof with keyboard instructions and
  interaction-runtime wording. The chart-owned keyboard history path is verified;
  unifying the separate playground toolbar history remains selected for Slice 11.
- Verification passed:
  - focused keyboard intent and DOM suites passed 2 files and 9 tests;
  - the final full test gate passed 48 files and 230 tests;
  - `vp check` reported all 118 files formatted and no warning, lint, or type error
    across 107 checked files;
  - `vp pack` built the four public artifacts; declaration inspection found the
    intentional action/state types and no private keyboard reducer, runtime store,
    scene pipeline, command bus, or hit-test index;
  - `vp build apps/playground` transformed 57 modules and produced the production
    HTML, CSS, and JavaScript artifacts;
  - `git diff --check` passed;
  - `mise run ci` passed the complete check, 48-test-file/230-test, and four-artifact
    package build gates.
- Chrome DevTools verification passed on `/`, `/matrix`, and `/interactive` at
  1440 × 900 and 560 × 900:
  - accessibility snapshots exposed one labeled chart region, headers, lane
    relationships, task buttons with dates/shortcuts, selected/focused/disabled
    state, and single polite outcomes without duplicate visible SVG or empty-state
    announcements;
  - live desktop keyboard operation selected and activated a task, navigated between
    occurrences, moved it across time and lane, cancelled and committed resize,
    created and deleted a task, and completed undo/redo while preserving focus;
  - the narrow chart retained focus and committed a keyboard move without page-level
    horizontal overflow; main, five-scenario matrix, high-contrast, empty, and
    interactive screenshots remained intact;
  - every local request returned 200 or 304. No application-owned console error or
    warning appeared; Vite and extension/DevTools CSP, deprecation, MaxListeners,
    ObjectMultiplex, and content-script messages were recorded as environment noise.
- Live verification found and fixed the duplicate visual empty-state announcement
  recorded below. The media-preference tooling limitation and exact non-persistent
  CSS-rule verification are also recorded below.

### 2026-07-30 — Slice 10 typed customization and instant-task CRUD

- Added the bounded public `GanttSlots`, task/lane summaries and content props,
  `GanttClassNames` state callbacks, lane-column definitions, feature toggles,
  context-menu items, overlay bindings, and tooltip/menu/editor props required by the
  accepted M4 contract. No slot, hook, renderer, or menu callback receives the mutable
  document, runtime store, scene cache, geometry index, or direct record setter.
- Kept task focus, ARIA, pointer hit testing, keyboard behavior, and resize geometry
  on the library-owned occurrence wrapper while allowing `TaskContent` and
  `LaneHeader` to replace visual content. Stable task/lane/root/column/overlay state
  and `data-gt-part` hooks remain available to class callbacks and consumer CSS.
- Added one or more read-only lane columns with stable IDs, headers, optional widths,
  renderers, semantic treegrid cells, and a shared computed width for header/body
  alignment across variable-height and virtualized lanes.
- Added opt-in built-in tooltip, context menu, and instant-task editor surfaces plus
  typed replacements. Each instance owns an internal React portal host under its
  themed root; required refs, roles, labels, focus trapping/return, Escape,
  click-away, pending, and labelled validation bindings are passed to surface slots.
  Development builds warn when a custom surface omits its required root binding.
- Added default Create/Edit/Delete task menu actions plus task-derived typed command
  contributions. Creation reuses the existing mapper; delete and contributed
  commands dispatch with `context-menu` source; editor changes dispatch with `editor`
  source and use the same interceptor, controlled acknowledgement, history, commit,
  rejection, and polite-announcement path.
- Added stable disabled reasons for read-only charts, missing create mappers,
  non-persisted lanes, disabled editors, segment occurrences, custom occurrences,
  derived occurrences, all-day tasks, and unscheduled tasks.
- Added a basic instant editor for title plus explicit-offset ISO start/end. Local
  validation rejects blank titles, invalid datetimes, and non-positive intervals;
  valid multi-field changes become one ordered transaction of `task.update`,
  `task.move`, and `task.resize`, so one history entry preserves the submitted end
  after a simultaneous start move.
- Updated `/interactive` with custom task/lane content, two aligned columns,
  state-based class hooks, opt-in tooltip/menu/editor, one task-derived typed menu
  command, and user instructions. `docs/UI_THEMING.md` required no change because the
  implementation realizes rather than revises its existing durable slot/class/portal
  contract.
- Focused coverage includes five new Testing Library/axe cases for content and class
  state, column alignment, tooltip/editor validation and transaction commit,
  default/custom menu commands and focus return, custom portal isolation across two
  instances, and async pending/rejection details. Existing pointer, keyboard,
  controlled runtime, hydration, SSR, and root-facade type suites remain green.
- Verification passed:
  - focused customization plus affected React/SSR/runtime suites passed 6 files and
    44 tests;
  - the final full test gate passed 49 files and 236 tests;
  - `vp check` reported all 120 files formatted and no warning, lint, or type error
    across 109 checked files;
  - `vp pack` built the four public artifacts; declaration inspection found only the
    intentional slot/class/column/menu/editor types in the export list and no public
    React runtime, runtime store, scene pipeline, command bus, or hit-test index;
  - `vp build apps/playground` transformed 58 modules and produced the production
    HTML, CSS, and JavaScript artifacts;
  - `git diff --check` passed;
  - `mise run ci` passed the complete check, 49-test-file/236-test, and four-artifact
    package build gates.
- Chrome DevTools verification passed on `/`, `/matrix`, and `/interactive` at
  1440 × 900 and 560 × 900:
  - default and custom lane headers remained exactly aligned with their body columns
    across the main chart and all five light/dark/high-contrast/empty matrix cases,
    with no page-level horizontal overflow;
  - live focus exposed one tooltip relationship, Shift+F10 opened the owning task
    menu with first-item focus, a task-derived typed command committed and returned
    focus, and Escape returned focus from the editor;
  - the editor exposed one modal dialog with labelled title/start/end fields, accepted
    a controlled title/start/end transaction, closed after synchronous
    acknowledgement, returned focus, updated the accessible task name, and announced
    `Edit committed.`;
  - narrow light and temporarily themed high-contrast menu/editor screenshots showed
    intact boundaries, readable controls, and visible focus. A reload restored the
    unmodified interactive theme before final console/network inspection;
  - every local request returned 200. No application-owned console error or warning
    appeared; Vite and extension/DevTools CSP, deprecation, MaxListeners,
    ObjectMultiplex, and content-script messages were recorded as environment noise.
- Automated accessibility and source inspection found and fixed the editor-landmark
  and narrow column-override deviations recorded below.

## Deviations

### 2026-07-30 — Editor chrome does not create nested page landmarks

- The first axe pass treated the default editor's visual `<header>` and `<footer>` as
  nested banner/contentinfo landmarks and reported that those landmarks were not
  top-level.
- The editor now uses classed generic containers for its visual heading and actions;
  the owning element retains `role="dialog"`, `aria-modal`, label, description,
  focus trap, and field/error relationships.
- The repeated open, valid, pending, and rejected editor axe cases pass. This changes
  no public type, system boundary, milestone order, or release acceptance criterion.

### 2026-07-30 — Playground narrow width must honor the shared column variable

- Source inspection after adding multiple lane columns found an old playground-only
  narrow rule that fixed `.gt-gantt__table` to a 105-pixel lane width while the
  virtual body continued using the library-owned `--gt-lane-column-width`. That rule
  would misalign custom headers and rows below 560 pixels.
- The obsolete override was removed. Both the table and body now consume the same
  computed total column width, while the timeline keeps the remaining responsive
  space.
- Chrome geometry checks prove exact header/body alignment for `/`, all five
  `/matrix` scenarios, and the custom two-column `/interactive` chart at 1440 × 900
  and 560 × 900. This changes no library contract or architecture boundary.

### 2026-07-30 — Visual empty-state copy is presentational

- The first narrow `/matrix` accessibility snapshot exposed both the semantic
  treegrid empty row and the visually rendered empty-state copy, causing the same
  title and description to be announced twice.
- The visual empty-state container is now `aria-hidden`; the semantic treegrid row
  remains the single accessible source and the rendered copy remains unchanged.
- The repeated desktop/narrow accessibility snapshots and automated empty-state axe
  case cover the correction. This changes no public type, system boundary, milestone
  order, or release acceptance criterion.

### 2026-07-30 — Native media-preference emulation was unavailable

- Chrome DevTools exposed viewport and color-scheme emulation but not native
  `forced-colors` or `prefers-reduced-motion` controls. The repository-required
  built-in Browser fallback was checked and returned `No browser is available`.
- The exact shipped nested media rules were therefore activated non-persistently
  through recursive CSSOM inspection in the in-scope Chrome page. Computed styles
  proved zero-second task/preview transitions, system `Canvas` fill,
  system `Highlight` focus/preview outlines, and no preview shadow; a reload restored
  the authored stylesheet before the final browser checks.
- This is exact rule/computed-style evidence, not a claim of native operating-system
  forced-color or reduced-motion emulation. It changes no implementation contract,
  architecture boundary, milestone order, or release acceptance criterion.

### 2026-07-30 — Synchronous controlled acknowledgement wins the pointer continuation

- The first live Chrome mouse drag showed that a controlled owner can acknowledge a
  candidate before the awaiting pointer-release continuation resumes. The
  acknowledgement correctly emitted `commandCommitted` and cleared the preview, but
  the later `dispatch()` result still had the historical `proposed` status and
  restored a stale pending preview.
- Pointer release now retains pending state only when the runtime store still holds
  the matching `proposalId`. If the controlled prop already acknowledged it, the
  authoritative commit callback wins and the continuation does not publish stale
  interaction state.
- A direct synchronous-ack runtime regression and the repeated live Chrome drag cover
  this ordering. The fix preserves exact controlled acknowledgement and changes no
  public type, system boundary, milestone order, or release acceptance criterion.

### 2026-07-30 — Controlled semantic observers wait for session prop adoption

- Slice 7 initially emitted `onFocusChange`, `onSelectionChange`, and
  `onViewportChange` alongside an imperative controlled `onSessionChange` proposal.
  Focused Slice 8 event-order inspection found that this contradicted the accepted
  event contract: the complete controlled session callback is the ownership proposal,
  while the specific semantic callbacks observe adopted authoritative state.
- Controlled session actions now emit only `onSessionChange` at proposal time. When
  the owner supplies the proposed `session` prop, reconciliation publishes
  `onSessionChange` followed by the changed selection, focus, and viewport observers
  with `source: "controlled-prop"`. Uncontrolled actions still adopt first and emit
  the combined and specific observations in one publication.
- Focused runtime and pointer callback-order tests cover both paths. This correction
  restores the accepted contract and does not change the public types, system
  boundary, milestone order, or release acceptance criteria.

### 2026-07-30 — React final disposal is deferred across the Strict Mode replay

- The initial Slice 7 cleanup called final runtime disposal from a layout-effect
  cleanup. React runs that cleanup before passive measurement cleanup and also
  replays it during the development Strict Mode probe while preserving component
  state, so immediate disposal made later measurement cleanup and the paired effect
  setup address an already-disposed store.
- The facade now deactivates synchronously, lets passive observers/listeners clear
  their measurements, and finalizes disposal in a microtask only if no paired
  activation occurred. Direct non-React runtime disposal remains immediate, pending
  frame cancellation remains deterministic, and actual unmount still settles queued
  command work.
- Focused jsdom coverage proves both normal unmount cleanup and retained imperative
  dispatch after Strict Mode effect replay. This lifecycle adaptation does not change
  public ownership, event ordering, package boundaries, milestone order, or release
  acceptance criteria.

### 2026-07-30 — Trusted affected changes retain a conservative validation/index stage

- The initial invalidation matrix described affected index-entry replacement.
  Inspection showed that M1 reference validation may rewrite or filter records across
  collections, while the existing M3 view and interval resolvers intentionally build
  their own complete indexes.
- Slice 5 therefore rebuilds reference validation and the shared document index for
  every changed document, then performs selective reuse from topology onward.
  Trusted task-label changes still skip topology, intervals, lane geometry, viewport
  indexes/query, ticks, and unaffected primitives; unknown external changes rebuild
  every stage.
- The fixed work counters and benchmark make this broader safe boundary visible.
  This does not change a public contract, system boundary, milestone order, or release
  acceptance criterion; later profiling may justify incremental M1 validation/index
  APIs without exposing runtime caches.

### 2026-07-30 — Persistence-ready event boundary clarification

- The initial plan used `commandCommitted` immediately after proposing a controlled
  result, which made candidate acceptance, prop acknowledgement, and remote
  persistence appear to be one phase.
- The refined plan reserves `commandCommitted` for authoritative local
  adoption/acknowledgement, adds an opaque local proposal ID and immutable
  persistence-ready change envelope, and requires controlled consumers to update
  local state before asynchronous persistence.
- Slice 11 now owns a network-free, API-shaped debug textarea and direct
  React/external-store examples. Persistence adapters, server operation IDs, retries,
  rollback, revision reconciliation, and conflicts remain outside M4.

## Progress

- [x] Slice 1: Freeze the M4 runtime and public API contract
- [x] Slice 2: Add pure semantic task move and resize commands
- [x] Slice 3: Build the React-free runtime store and ownership state machine
- [x] Slice 4: Add the async command bus, events, and bounded history orchestration
- [x] Slice 5: Stage derived caches and add measured viewport subscriptions
- [x] Slice 6: Add renderer-independent hit testing and interaction intent
- [x] Slice 7: Integrate the React facade, selectors, semantic events, and imperative
      handle
- [x] Slice 8: Implement pointer, pen, and touch workflows
- [x] Slice 9: Add keyboard, focus, and accessibility parity
- [x] Slice 10: Add typed customization, menus, tooltip, columns, and basic editor
- [-] Slice 11: Prove consumers, harden the facade, and close M4
- [ ] Final automated/package/SSR gate
- [ ] Final browser/accessibility gate

## Next Slice

Start Slice 11. Consolidate the playground and direct React/external-store consumer
proofs, add the API-shaped persistence debug seam, harden the public facade and docs,
and record the final M4 completion evidence before the separate final gates.
