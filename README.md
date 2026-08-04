# Gantempo

React and TypeScript primitives for Gantt charts, resource planning, and scheduling.

Applications using the packaged chart should load its default structural and visual
styles once:

```ts
import '@gantempo/gantt/styles.css';
```

## Themes and density

Select the packaged light, dark, or high-contrast theme per chart. Density is a
separate renderer-backed choice, so compact and touch modes update layout, scrolling,
and hit geometry together with presentation:

```tsx
<Gantt theme="dark" density="compact" {...props} />
```

Use a typed semantic definition for an application theme:

```tsx
import { defineGanttTheme, Gantt } from '@gantempo/gantt';

const brandTheme = defineGanttTheme({
  id: 'brand-night',
  mode: 'dark',
  tokens: {
    'color.surface': '#101714',
    'color.text': '#f4fff9',
    'color.accent': '#65d6ae',
    'color.focus': '#8bbcff',
    'overlay.zIndex': 1200,
  },
});

<Gantt theme={brandTheme} density="comfortable" {...props} />;
```

`className` remains available for stylesheet-based `--gt-*` token overrides and
strict-CSP integrations. `classNames` continues to customize typed component parts
and states; neither prop is required to select a built-in theme. Theme preferences
belong to application view state, not `GanttDocument`.

## Toolchain

- [Vite+](https://viteplus.dev/) for formatting, linting, type checking, and tests
- [tsdown](https://tsdown.dev/) through `vp pack` for library bundles
- [mise](https://mise.jdx.dev/) for the Node.js runtime
- pnpm pinned through the workspace `packageManager` field
- React and React DOM 19 for development, with React and React DOM 18/19 supported as
  peer versions
- TypeScript 7

## Setup

Install the Vite+ `vp` CLI once, then bootstrap the pinned environment and dependencies:

```sh
mise install
vp install
```

Run the development checks:

```sh
vp check
vp test run
vp pack
```

The same commands are available as mise tasks:

```sh
mise run ci
```

## Document boundary

Treat external JSON and the normalized runtime document as different contracts.
`parseGanttDocument` accepts `unknown`, checks schema version 1, normalizes numeric IDs
and offset-bearing instant strings, fills missing collections, validates references,
and returns structured diagnostics without silently discarding unrelated valid
records.

```ts
import { parseGanttDocument, serializeGanttDocument, type GanttDocument } from '@gantempo/gantt';

const result = parseGanttDocument({
  schemaVersion: 1,
  tasks: [
    {
      id: 42,
      title: 'Release',
      schedule: {
        mode: 'instant',
        start: '2026-07-30T09:00:00Z',
        end: '2026-07-30T12:00:00Z',
      },
    },
  ],
});

if (!result.document) {
  throw new Error(`Document rejected: ${result.diagnostics[0]?.code ?? 'unknown'}`);
}

const document: GanttDocument = result.document;
const stableJson = serializeGanttDocument(document);
```

Fatal root or schema failures leave `result.document` absent. Recoverable record and
reference failures return a partial canonical document plus path-aware diagnostics;
every omission or cleared reference is reported. Canonical documents use opaque
string IDs, epoch milliseconds for instant schedules, `YYYY-MM-DD` strings for
all-day schedules, readonly arrays for all six collections, and JSON-compatible
extension data under `fields` and `metadata`.

Serialization emits the current schema only. It preserves task/resource/lane and
relationship array order, uses fixed known-field order, sorts extension-object keys
recursively, and rejects unchecked non-JSON values instead of coercing them. Passing
the result through parse, serialize, and parse again is idempotent.

The React `Gantt` component accepts the normalized `GanttDocument`; parsing does not
run inside React. Keep the external trust boundary in application loading or
persistence code, then pass the accepted document to the component.

## React ownership and interaction runtime

`Gantt` has exactly one document owner for its lifetime. Use `document` for a
controlled application store, or `defaultDocument` when the chart instance should own
local document and history state. Both modes route toolbar, imperative, pointer,
touch, keyboard, menu, editor, undo, and redo actions through the same command bus.

### Controlled with direct React state

A controlled consumer must adopt each `onDocumentChange` candidate immediately.
Remote persistence is a later side effect of the same immutable change envelope; it
must not delay local acknowledgement.

```tsx
import { useRef, useState } from 'react';
import {
  Gantt,
  parseGanttDocument,
  type GanttDocumentChange,
  type GanttHandle,
} from '@gantempo/gantt';

const parsed = parseGanttDocument(apiResponse);
if (!parsed.document) throw new Error('Invalid planning document');

function toWriteRequest(change: GanttDocumentChange) {
  return {
    operationId: crypto.randomUUID(),
    baseRevision: change.baseRevision ?? null,
    changes: change.entityChanges,
  };
}

export function ControlledPlan() {
  const [document, setDocument] = useState(parsed.document);
  const gantt = useRef<GanttHandle>(null);

  function acceptCandidate(change: GanttDocumentChange) {
    setDocument(change.document); // acknowledge locally first
    persistenceQueue.enqueue(toWriteRequest(change)); // asynchronous application concern
  }

  return (
    <>
      <button
        onClick={() =>
          gantt.current?.dispatch(
            { delta: 86_400_000, id: 'release', type: 'task.move' },
            { source: { kind: 'toolbar' } },
          )
        }
      >
        Move release one day
      </button>
      <Gantt
        document={document}
        onDocumentChange={acceptCandidate}
        range={range}
        ref={gantt}
        tickAnchor={range.start}
        tickInterval={7 * 86_400_000}
        timeZone="Europe/Belgrade"
      />
    </>
  );
}
```

Each entity change says which canonical collection-plus-ID row was created, updated,
or deleted. Updates include explicit `before` and `after` rows, so ordinary database
adapters do not need to pair forward and inverse patches. The write request
deliberately omits the full document, local proposal/source metadata, DOM events, and
runtime objects.

A transaction remains one callback, one ordered `entityChanges` batch, one immutable
patch batch, and one local history entry. Raw patches and inverses remain available
on the change envelope for replay and rollback. Operation IDs, transport retries,
server revisions, temporary-ID reconciliation, and conflict policy belong to the
application persistence adapter.

### Controlled with an external store

The same contract maps directly to an external store. Subscribe to its immutable
document snapshot, synchronously install the candidate, then enqueue persistence:

```tsx
const document = useSyncExternalStore(planStore.subscribe, planStore.getDocument);

<Gantt
  document={document}
  onDocumentChange={(change) => {
    planStore.setDocument(change.document);
    planStore.persistence.enqueue(toWriteRequest(change));
  }}
  range={range}
  tickAnchor={range.start}
  tickInterval={WEEK}
  timeZone="UTC"
/>;
```

Do not maintain a second toolbar reducer beside the chart. Use `GanttHandle.dispatch`,
`undo`, and `redo` so external controls and direct manipulation share interception,
history, events, and persistence semantics.

### Runtime-owned document and session

Use `defaultDocument` and `defaultSession` for an isolated instance-owned workflow.
`onDocumentChange` remains available as an observer after the runtime has adopted the
document:

```tsx
const gantt = createRef<GanttHandle>();

<Gantt
  defaultDocument={parsed.document}
  defaultSession={{ selection: [], viewport: { verticalStart: 0 } }}
  onDocumentChange={(change) => audit(change)}
  range={range}
  ref={gantt}
  tickAnchor={range.start}
  tickInterval={WEEK}
  timeZone="UTC"
/>;

await gantt.current?.undo();
await gantt.current?.redo();
```

Session ownership is independent from document ownership. Supply `session` plus
`onSessionChange` to control selection, focus, and vertical viewport intent, or
`defaultSession` to keep them local. Range ownership is independent too: use `range`
plus `onRangeChange` for controlled navigation, or `defaultRange` for an
instance-owned viewport.

### Timeline navigation

Horizontal navigation changes a semantic time range; it does not scroll a wide DOM
canvas. Keep `range` in application state and acknowledge `onRangeChange` for a
controlled chart, or supply `defaultRange` to let the runtime adopt wheel, trackpad,
mouse-grab, keyboard-page, edge-auto-pan, and imperative navigation:

```tsx
const [range, setRange] = useState({
  start: Date.UTC(2026, 0, 1),
  end: Date.UTC(2026, 2, 26),
});

<Gantt
  document={document}
  onRangeChange={setRange}
  range={range}
  tickAnchor={range.start}
  tickInterval={14 * 86_400_000}
  timeZone="UTC"
/>;
```

A horizontal wheel or trackpad gesture pans time. `Shift` plus a vertical wheel is
the mouse-wheel fallback; diagonal trackpad input preserves its vertical component.
Primary-button drag on the time header and middle-button drag on the timeline grab
the viewport. Primary empty-body drag pans only when no creation mapper owns that
gesture. `Ctrl`/`Meta` wheel input remains browser zoom and is not claimed.

`PageUp`/`PageDown` move vertically with one lane of overlap.
`Alt+PageUp`/`Alt+PageDown` move one time range with a small overlap. Arrow,
`Home`, and `End` task navigation can reveal occurrences outside the current painted
viewport while preserving logical focus and selection. Document read-only state
still permits viewport navigation.

Continuous wheel/grab proposals are coalesced per frame and do not create document
commands, history entries, or per-frame live announcements. Each chart instance owns
its proposed range independently. If `onRangeChange` is omitted, horizontal input
passes through and imperative horizontal reveal fails closed.

The public handle is occurrence-aware and intentionally narrow:
`dispatch`, `undo`, `redo`, `canUndo`, `canRedo`, `focusTask`, `scrollToTask`,
`scrollToTime`, `zoomTo`, `fitToProject`, `getDocument`, `getSelection`, and
`getSession`. Occurrence targets
come from semantic callbacks such as `onFocusChange`, `onTaskActivate`, and
`onSelectionChange`; their `viewKey` values are opaque.

### Interception and lifecycle events

Interceptors run in order before the change kernel and may asynchronously allow,
reject, or replace a command. A replacement still uses the same proposal ID, source,
queue, reducer, and ownership boundary:

```ts
import type { GanttCommandInterceptor } from '@gantempo/gantt';

const policy: GanttCommandInterceptor = async (proposal) => {
  const result = await applicationPolicy.check(proposal.command);
  if (!result.allowed) {
    return {
      kind: 'reject',
      diagnostic: {
        code: 'command.unsupported-target',
        message: result.reason,
        severity: 'error',
      },
    };
  }
  return result.replacement ? { kind: 'replace', command: result.replacement } : { kind: 'allow' };
};
```

`onDocumentChange` delivers a candidate. `onCommandCommitted` fires only after
uncontrolled adoption or exact controlled acknowledgement.
`onCommandRejected` reports policy, command, stale-base, divergence, and history
failures. `onRuntimeError` reports host callback failures that are not command
rejections. Event values are frozen data-only snapshots and include proposal,
operation, source, optional target, and applicable command/change data.

### Typed customization and derived-view mapping

Content slots stay inside library-owned focusable task/lane wrappers, so replacing
visual content does not discard pointer, keyboard, ARIA, or hit-test behavior.
Columns are read-only and align with the semantic treegrid:

```tsx
import type { GanttLaneColumn, GanttSlots } from '@gantempo/gantt';

const slots = {
  TaskContent: ({ task, pending }) => (
    <span>
      {task.title}
      {pending ? ' · saving' : ''}
    </span>
  ),
  LaneHeader: ({ lane }) => <strong>{lane.title}</strong>,
} satisfies GanttSlots;

const columns = [
  { id: 'name', header: 'Team', width: 160 },
  {
    id: 'resource',
    header: 'Resource ID',
    width: 120,
    renderCell: ({ lane }) => lane.target.resourceId ?? '—',
  },
] satisfies readonly GanttLaneColumn[];
```

Project, resource, custom, segment, and ambiguous occurrence moves fail closed unless
an application `moveOccurrence` mapper returns an explicit command or transaction.
For example, a resource-view mapper can combine `task.move` and `assignment.set` in
one transaction. Empty-lane creation similarly requires a `createTask` mapper because
IDs and relationship semantics are application policy.

Built-in movement, resizing, and editing apply only to unsegmented instant schedules.
All-day schedules remain canonical model records but do not produce instant bars and
are never coerced into instants; calendar-aware rendering and all-day interaction
belong to a later scheduling layer.

### Item properties, semantic appearance, and progress

Tasks and lanes may persist one semantic appearance ID. The instance registry maps
those IDs to coordinated task, progress, text, border, and restrained lane tokens;
documents never store raw colors or theme objects. An explicit task appearance
follows every occurrence and overrides the lane default. Without that override, the
same task may inherit a different appearance in each lane:

```tsx
import { Gantt, type GanttAppearanceVariantOption, type GanttDocument } from '@gantempo/gantt';

const appearanceVariants = [
  {
    id: 'delivery',
    label: 'Delivery',
    tokens: {
      'lane.accent': '#2563eb',
      'task.fill': '#3b82f6',
      'task.progressFill': '#1e40af',
      'task.text': '#ffffff',
    },
  },
  {
    id: 'risk',
    label: 'At risk',
    tokens: {
      'lane.accent': '#b45309',
      'task.fill': '#f59e0b',
      'task.progressFill': '#92400e',
      'task.text': '#111827',
    },
  },
] satisfies readonly GanttAppearanceVariantOption[];

const document: GanttDocument = {
  schemaVersion: 1,
  resources: [],
  assignments: [],
  dependencies: [],
  lanes: [
    { id: 'build', title: 'Build', appearance: { variant: 'delivery' } },
    { id: 'release', title: 'Release', appearance: { variant: 'risk' } },
  ],
  tasks: [
    {
      id: 'handoff',
      kind: 'task',
      title: 'Handoff',
      description: 'Prepare the release handoff.',
      progress: 0.65,
      segments: [],
      schedule: { mode: 'instant', start, end },
    },
  ],
  placements: [
    { id: 'handoff-build', taskId: 'handoff', laneId: 'build' },
    { id: 'handoff-release', taskId: 'handoff', laneId: 'release' },
  ],
};

<Gantt
  appearanceVariants={appearanceVariants}
  document={document}
  features={{ properties: true }}
  onDocumentChange={acceptCandidate}
  range={range}
  tickAnchor={range.start}
  tickInterval={WEEK}
  timeZone="UTC"
/>;
```

Activating a task or persisted lane opens the standard properties surface. Task
fields cover title, description, instant start/end, elapsed duration, progress,
appearance, an unambiguous persisted lane, and deletion; lane fields cover title and
appearance. IDs, task kind, and linked resource identity remain read-only.
`slots.ItemProperties` may replace the complete presentation through
`GanttItemPropertiesProps`, but receives frozen values and lifecycle callbacks—not a
mutable document or private runtime.

Progress remains canonical task data in `0..1`. The field displays integer
percentages. Drag the visible progress marker with mouse, pen, or touch, or focus a
task and press `P`: arrows adjust one percentage point, `Shift` plus an arrow adjusts
ten, and `Home`/`End` propose 0/100. `Enter` commits exactly one `task.update`;
`Escape` cancels. Milestone and summary progress is read-only. Unknown valid
appearance IDs survive round trips and render through deterministic fallback while
remaining visible as unavailable in the properties picker.

Supplying `document` without `onDocumentChange` creates a read-only chart: activation
still opens inspection, but mutation controls and direct progress editing are
disabled.

### Overlay boundaries

Tooltips, context menus, and the task editor portal to one instance-owned fixed
wrapper under the Gantt root's owning document body by default. This lets them cross
rounded cards, scrolling containers, and ancestor stacking contexts while preserving
the owning instance's resolved Gantt theme.

Use the existing chart boundary only when confinement is intentional:

```tsx
<Gantt {...props} overlayContainer="root" />
```

Supply an application overlay element or an SSR-safe callback to integrate with a
design-system layer or shadow root:

```tsx
const applicationOverlays = document.querySelector('#application-overlays');

<Gantt {...props} overlayContainer={() => applicationOverlays} />;
```

The package owns and cleans up only the wrapper it appends; it does not change the
consumer container. Set `--gt-z-overlay` on the Gantt theme to align the wrapper with
the application's layer scale. A portal covers only its owning document, so a Gantt
inside an iframe cannot present over the parent page without explicit host messaging
and a parent-owned modal.

## Views and layout

`Gantt` defaults to persisted document lanes and placements. Its optional data-only
`view` prop can instead derive one flat lane per task, derive resource lanes from
assignments, or consume application-defined lane and placement descriptors:

```tsx
import { Gantt, type GanttViewDefinition } from '@gantempo/gantt';

const view: GanttViewDefinition = {
  kind: 'custom',
  id: 'delivery-phases',
  lanes: [
    { key: 'shape', title: 'Shape the work', minimumHeight: 72 },
    { key: 'ship', title: 'Ship the work' },
  ],
  placements: [
    { key: 'requirements', laneKey: 'shape', taskId: 'requirements' },
    {
      key: 'campaign-part-1',
      laneKey: 'ship',
      taskId: 'campaign',
      segmentId: 'campaign-part-1',
    },
  ],
};

<Gantt
  document={document}
  range={{ start: Date.UTC(2026, 6, 29), end: Date.UTC(2026, 7, 27) }}
  tickAnchor={Date.UTC(2026, 6, 29)}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  view={view}
/>;
```

Built-in `{ kind: 'project' }` resolves `parentId` into an accessible tree and follows
canonical sibling order unless the view supplies a pure filter or sort. Ancestors of
matching descendants remain visible. Summary intervals and progress are derived from
descendants, empty summaries remain present, milestones render as points, and
collapsed IDs live in session state rather than the document. Built-in
`{ kind: 'resource' }` follows resource and assignment order. Custom descriptors
follow caller order and require non-empty stable keys; they remain derived input and
are never serialized into `GanttDocument`.

Resolved view identity is separate from canonical entity identity. Rendered lanes and
bars always expose `data-view-key`; persisted or derived canonical provenance is also
exposed through the applicable `data-task-id`, `data-lane-id`, `data-resource-id`,
`data-assignment-id`, `data-placement-id`, and `data-segment-id` attributes.

Renderable instant intervals use half-open `[start, end)` semantics. An explicit
`segmentId` selects that segment; otherwise a placement uses its task schedule.
All-day schedules are resolved against the explicit time zone for presentation; the
canonical date-only values are preserved. Missing or invalid individual intervals
emit structured diagnostics without removing usable siblings.

## Basic project Gantt

Community project charts compose hierarchy, summary and milestone presentation,
manual dependency relationships, adaptive calendar zoom, localization, and per-chart
LTR or RTL direction through the package root. Dependency analysis reports cycles and
unsupported working-time lag without moving dates automatically. The fixed message
catalog has deterministic fallback, while caller-provided `locale`, `timeZone`, and
`messages` keep formatting explicit and SSR-safe.

Use `document` for controlled or read-only ownership, or `defaultDocument` for a
runtime-owned editable document. Pair either with controlled `range` or
`defaultRange`. Server rendering and hydration must receive the same document, view,
locale, direction, time zone, messages, and initial range; none are inferred from
browser globals during render.

The deterministic `/project` playground route exercises the full composition. Its
query parameters select `ownership=controlled|uncontrolled|read-only`,
`locale=en-US|sr-Latn|ar`, `direction=ltr|rtl`, and the optional `cycle=1` diagnostic
fixture.

Overlapping bars use deterministic stacking and grow the lane beyond its minimum
outer height when necessary. Touching intervals may share a track. Variable lane
height, interval indexing, and viewport intersection are pure derived kernels; the
React runtime composes those kernels into measured vertical viewport, selection,
focus, hit testing, preview, and command behavior without exposing private indexes or
caches.

## Pure change flow

The root package also exports a synchronous framework-independent change kernel.
Commands accept ergonomic record inputs at the mutation boundary, normalize them to
the canonical document contract, and either commit a complete change or reject it
without mutating or replacing the original document.

```ts
import {
  applyGanttCommand,
  applyGanttPatches,
  type GanttCommand,
  type GanttDocument,
} from '@gantempo/gantt';

const command: GanttCommand = {
  type: 'transaction',
  commands: [
    {
      type: 'task.add',
      value: {
        id: 42,
        title: 'Release',
        schedule: {
          mode: 'instant',
          start: '2026-07-30T09:00:00Z',
          end: '2026-07-30T12:00:00Z',
        },
      },
    },
    {
      type: 'task.update',
      id: '42',
      changes: { progress: 0.5 },
    },
  ],
};

const outcome = applyGanttCommand(document, command);
if (outcome.status === 'rejected') {
  throw new Error(outcome.diagnostics[0]?.message ?? 'Command rejected');
}

const nextDocument: GanttDocument = outcome.document;
const replay = applyGanttPatches(document, outcome.patches);
const restored = applyGanttPatches(nextDocument, outcome.inversePatches);
```

Committed outcomes contain deterministic collection-plus-ID patches, inverse patches
already ordered for direct application, and collection-qualified affected references.
A committed no-op has empty change arrays and retains the input document by identity.
A rejected command or transaction has structured diagnostics, empty change arrays,
and the original document by identity. Transactions run children in order and commit
all or none.

Optional fields in update commands use `null` as an explicit clear value; `undefined`
is rejected as persistence data. Add and set commands accept the same documented
numeric/string ID and instant/all-day schedule forms as the document codec, while
update and delete targets use canonical string IDs.

Bounded local undo and redo are immutable session state:

```ts
import {
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
} from '@gantempo/gantt';

let history = createGanttHistory(document, 50);
const committed = commitGanttHistory(history, outcome);
if (committed.status === 'applied') {
  history = committed.history;
}

history = undoGanttHistory(history).history;
history = redoGanttHistory(history).history;
```

Only committed non-empty outcomes enter history, and one transaction is one history
step. A new commit after undo clears the redo branch. Stale patch application fails
closed without moving either stack.

Local commands, patches, entity changes, and history preserve `document.revision`.
Persistence adapters remain responsible for server revisions, operation IDs, retries,
conflicts, temporary-ID reconciliation, and translating entity changes or domain
patches to a backend-specific format such as SQL writes or JSON Patch. The interaction
runtime adds local ownership and semantic events, but not persistent audit history or
collaborative rebasing.

## Local development

Start the React playground:

```sh
vp dev apps/playground
```

The playground exercises the canonical model, pure change kernel, resolved
view/layout/viewport pipeline, interaction runtime, public facade, and DOM/SVG
renderer. It has six routes:

- `/` keeps the default persisted document view at a large, useful size and
  acknowledges navigation in local scenario state;
- `/matrix` shows project, resource, custom, segment, overlap, density, theme,
  clipping, and empty variants together, with independent local ranges;
- `/interactive` is a controlled application store with one shared command/history
  path, explicit range acknowledgement, and a ten-entry expandable network-free
  API-shaped row-change log;
- `/uncontrolled` owns its default document/session while demonstrating async
  allow/reject/replace interception, derived resource mapping, lifecycle events, and
  imperative focus/scroll with an acknowledged controlled range;
- `/navigation` is a deterministic two-axis stress surface with 144 scheduled events
  across 36 lanes, a fixed 18-month UTC period, and a 12-week initial range;
- `/project` is the package-root M5 consumer for deep hierarchy, summaries,
  milestones, four dependency types, adaptive zoom, controlled/runtime-owned/read-only
  ownership, localization, RTL, SSR, and opt-in cycle diagnostics.

The equivalent mise command is `mise run dev`. To verify the standalone playground
build, run `pnpm build:playground`.

See:

- [Architecture](docs/ARCHITECTURE.md) for system and package boundaries.
- [UI and theming](docs/UI_THEMING.md) for the design-system and Tailwind strategy.
