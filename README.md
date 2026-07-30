# Gantempo

React and TypeScript primitives for Gantt charts, resource planning, and scheduling.

Applications using the packaged chart should load its default structural and visual
styles once:

```ts
import '@gantempo/gantt/styles.css';
```

## Toolchain

- [Vite+](https://viteplus.dev/) for formatting, linting, type checking, and tests
- [tsdown](https://tsdown.dev/) through `vp pack` for library bundles
- [mise](https://mise.jdx.dev/) for the Node.js runtime
- pnpm pinned through the workspace `packageManager` field
- React 19 for development, with React 18 and 19 supported as peer versions
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

Local commands, patches, and history preserve `document.revision`. Persistence
adapters remain responsible for server revisions, operation IDs, retries, conflicts,
temporary-ID reconciliation, and translating domain patches to a backend-specific
format such as JSON Patch. M2 does not add React state ownership, interaction events,
semantic scheduling commands, persistent audit history, or collaborative rebasing.

## Local development

Start the React playground:

```sh
pnpm dev
```

The playground exercises the first real read-only rendering pipeline: canonical task,
lane, and placement records pass through deterministic time-scale and scene primitives
before the DOM/SVG renderer draws them. It has two pages:

- `/` keeps the main development scenario at a large, useful size;
- `/matrix` shows a small set of content, density, and theme variants together.

The equivalent mise command is `mise run dev`. To verify the standalone playground
build, run `pnpm build:playground`.

See:

- [Architecture](docs/ARCHITECTURE.md) for system and package boundaries.
- [UI and theming](docs/UI_THEMING.md) for the design-system and Tailwind strategy.
