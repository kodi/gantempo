# M2 Change Kernel Implementation Plan

Status: Active
Date: 2026-07-30
Milestone: M2

## Summary

Build the framework-independent change kernel on top of the verified M1 canonical
document. Typed commands should normalize and validate their payloads, reduce to
deterministic ID-keyed domain patches and ready-to-apply inverse patches, commit
multi-command transactions atomically, and support bounded local undo/redo without
React or the DOM.

This plan is the working handoff record for M2. It starts by fixing the durable patch,
outcome, validation, transaction, and history semantics, then orders implementation
so each slice leaves a separately testable pure boundary. M3 view/layout work and M4
interaction work must not begin until the M2 exit condition is verified.

## Target State

At M2 completion:

- one pure command entry point accepts a canonical `GanttDocument` and typed command;
- unchecked command payloads are defensively normalized or rejected with structured
  diagnostics;
- successful commands return a new canonical document, versioned ID-keyed domain
  patches, inverse patches, and typed affected entity references;
- rejected commands return the original document by identity and no partial changes;
- tasks, resources, lanes, assignments, placements, and dependencies can all be
  changed through the command path needed by the M2 scope;
- every patch sequence can be applied independently and every inverse sequence
  restores the byte-identical serialized base document;
- transactions process children in deterministic order and commit all or none;
- local history treats a transaction as one step, bounds retained entries, clears a
  redo branch after a new commit, and fails closed on stale application;
- the existing document codec, scene builder, React component, playground, and
  package CSS behavior remain unchanged;
- the package build contains only the intentional change-kernel facade and no private
  validators, indexes, or reducer helpers;
- all automated repository gates pass, with browser verification required only if an
  implementation deviation changes React, rendering, styles, or playground output.

## Decisions

The durable decisions are accepted in the
[change-kernel contract](../decisions/2026-07-30-change-kernel-contract.md):

- Core patches use one versioned ID-keyed domain union with `add`, `replace`, and
  `remove` operations.
- JSON Patch is not a second core representation. A persistence adapter may translate
  committed domain patches later.
- Adds carry an insertion index as ordering data; existing records are always located
  by collection and stable ID.
- Replacements contain a complete canonical record. Task replacement is also the
  patch boundary for its owned segments.
- Inverse patches are emitted directly by reducers and are returned in application
  order.
- Affected entities use `{ collection, id }` references because M1 permits the same
  ID in different entity families.
- Command validation is strict and non-repairing. It may share private scalar and
  record-input helpers with the codec but may not use M1 recovery behavior as a
  commit authority.
- Transactions are ordered, flatten nested transactions, and reject atomically.
- Local command and patch application preserve document `revision`; server revision,
  operation, actor, retry, and conflict concerns remain outside M2.
- Local history is immutable session data with an explicit caller-supplied capacity.
- Seeded property tests use `fast-check` as a development-only dependency, with the
  seed, run count, and replay path visible on failure.
- Task deletion rejects dependencies by default; `cascade: true` removes the task
  subtree and incident/owned relationships deterministically.
- Assignment deletion clears optional placement assignment references instead of
  removing otherwise valid placements.

## Scope

### In scope

- The pure command, patch application, transaction, and history modules.
- Public or package-visible type contracts for:
  - the M2 typed command union;
  - document collection and entity-reference types;
  - versioned domain patches;
  - committed and rejected outcomes;
  - local history state and operations.
- Ergonomic command record inputs that reuse M1 normalization semantics without
  reparsing a whole document.
- Strict base/candidate document checks needed to prevent command-time repair.
- Add/update-style commands for tasks, resources, lanes, assignments, placements,
  and dependencies.
- Delete behavior for tasks, assignments, placements, and dependencies.
- Atomic ordered transactions and deterministic no-op behavior.
- Patch inversion examples and seeded property-based coverage.
- README documentation for the pure non-React change flow.
- Package-facade and packed-declaration checks.
- M2 completion evidence in this plan and `docs/ROADMAP.md`.

### Out of scope

- React-controlled or uncontrolled state ownership.
- Pointer, touch, keyboard, toolbar, menu, or imperative-handle integration.
- Async command interception, before/after events, subscriptions, or announcements.
- Semantic task move, resize, and split commands whose policies depend on later time,
  calendar, interaction, or scheduling work. M2 can change canonical schedules through
  `task.update`.
- Resource and lane deletion.
- Metadata-editing or revision-mutating commands.
- Project hierarchy cycle rejection as a product feature, dependency path/cycle
  analysis, automatic summary dates, or scheduling side effects.
- Persistence adapters, JSON Patch translation, optimistic I/O, server ID
  reconciliation, base-revision conflicts, operation IDs, retry policy, or rollback
  orchestration.
- Persistent audit history, coalescing, save points, history serialization,
  collaborative rebasing, or cross-session history.
- Package/workspace splitting.
- Renderer, theme, accessibility-surface, or playground feature work.

## Current State

Observed at planning time on `main` at `d8342a3`:

- The worktree was clean before this plan and decision change.
- M1 is complete and its final gate recorded 10 test files and 57 tests plus a
  successful package build and connected playground regression matrix.
- `packages/gantt/src/model/types.ts` owns the readonly canonical document and six
  domain collection contracts.
- `packages/gantt/src/model/codec.ts` owns private scalar, schedule, extension-value,
  and record decoders. They currently decode only in the whole-document flow.
- `packages/gantt/src/model/validate.ts` intentionally repairs recoverable wire input
  by clearing invalid parent/resource links or omitting invalid relationship records.
  That behavior cannot be used to authorize a command commit.
- `packages/gantt/src/model/indexes.ts` provides deterministic primary and
  relationship maps suitable for command target lookup and cascade discovery.
- `packages/gantt/src/model/serialize.ts` provides the byte-stable comparison boundary
  for round-trip and inversion evidence.
- `packages/gantt/src/index.tsx` exports the React component, document codec, JSON and
  diagnostic contracts, and normalized model types. It exports no command, patch, or
  history surface.
- No `packages/gantt/src/commands/` module, command diagnostics, patch implementation,
  transaction engine, history helper, or patch property test exists.
- No property-testing dependency is present in the root manifest or lockfile.
- The architecture sketch returned raw `affectedIds: EntityId[]`; M1's allowed
  cross-family ID reuse proved that shape ambiguous. The accepted M2 contract replaces
  it with typed entity references.

No runtime, test, package, or browser verification is completed by this planning and
contract pass.

## Behavior to Preserve

- Canonical collection order and stable IDs survive every untouched or inverted
  change.
- Cross-family ID reuse remains legal.
- Command and patch code never mutates caller-owned documents, records, arrays,
  commands, extension objects, or history state.
- A rejected command, rejected transaction, failed undo, or failed redo returns or
  retains the original document by identity.
- Codec recovery remains appropriate for untrusted wire input; no change-kernel code
  weakens or silently changes that boundary.
- Serializer byte stability and the full six-domain M1 round trip remain green.
- Record and relationship separation remains intact: assignments do not imply lanes,
  lanes do not imply resources, and placements do not own task schedules.
- The existing scene builder remains the only render-primitive authority.
- Existing `Gantt` props, diagnostics, DOM/SVG identity, accessibility names, themes,
  CSS export, and `/` and `/matrix` scenarios remain unchanged.
- The public React component remains SSR-safe and imports no browser globals at module
  scope.
- Existing package exports are not renamed or removed.

## Implementation Shape

### Pure change pipeline

```text
canonical GanttDocument + GanttCommand
  -> inspect and normalize command payload
  -> strict target/value/reference validation
  -> reducer emits forward patches + inverse patches + affected references
  -> atomic patch application creates candidate document
  -> strict final integrity check
  -> committed outcome

any failure
  -> rejected outcome
  -> original document identity
  -> structured diagnostics
  -> empty patches, inverse patches, and affected references
```

Reducers should describe change through patches first. They must not mutate a cloned
document and then diff it. `applyGanttPatches` is the one authority that materializes a
candidate document from a patch sequence.

### Contract direction

Exact exported names may be refined before Slice 7, but internal implementation and
tests should converge on this shape:

```ts
interface EntityReference {
  readonly collection: DocumentCollection;
  readonly id: EntityId;
}

type GanttPatch =
  | AddEntityPatch
  | ReplaceEntityPatch
  | RemoveEntityPatch;

type CommandOutcome =
  | {
      readonly status: "committed";
      readonly document: GanttDocument;
      readonly patches: readonly GanttPatch[];
      readonly inversePatches: readonly GanttPatch[];
      readonly affected: readonly EntityReference[];
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "rejected";
      readonly document: GanttDocument;
      readonly patches: readonly [];
      readonly inversePatches: readonly [];
      readonly affected: readonly [];
      readonly diagnostics: readonly Diagnostic[];
    };
```

A committed no-op has empty change arrays and does not enter history. Errors reject;
warnings may accompany a committed outcome only when the command's intended effect is
unambiguous and no value was silently ignored.

### Command input boundary

Command record inputs should be typed ergonomic DTOs rather than unchecked whole
documents or `Partial<CanonicalRecord>`:

- add/set payloads may accept the same documented numeric/string ID and
  instant/all-day schedule forms as the M1 wire codec;
- target IDs in update/delete commands are canonical `EntityId` strings;
- optional fields use explicit clear values where removal is supported;
- IDs cannot be updated;
- unknown command fields, `undefined` persistence values, sparse/cyclic/non-plain
  extension values, invalid dates, and non-finite values reject the command;
- normalization returns fresh frozen canonical records and does not retain mutable
  input references;
- codec and command helpers share private scalar/record behavior, but fatal
  whole-document recovery remains codec-owned.

The extraction must leave existing M1 diagnostic codes and source paths unchanged.
Command paths should be stable and command-relative, including transaction child
indexes.

### Strict integrity boundary

Add a strict, non-repairing integrity check rather than changing
`validateDocumentReferences` semantics. It should verify at minimum:

- unique IDs within each collection and task-local unique segment IDs;
- existing task/resource/lane parents and lane resources;
- assignment task/resource ownership;
- placement task/lane, assignment compatibility, and segment ownership;
- dependency endpoints and non-self relationships;
- patch value ID/collection compatibility;
- no duplicate target creation and no missing replace/remove target.

Command-specific checks should run before reduction when they can give a more useful
diagnostic. The final strict check remains the fail-closed postcondition for a complete
patch set or transaction.

### Patch application and identity

`applyGanttPatches` should:

- validate every patch version and operation shape;
- locate existing records by collection plus ID;
- validate add indexes without treating them as identity;
- clone only the document and touched collections;
- retain untouched record identities and untouched collection identities;
- apply all patches to a private candidate;
- validate final integrity once the full sequence is present;
- freeze returned collections, records created from unchecked patch input, affected
  arrays, patches, inverse patches, and outcomes;
- preserve root `schemaVersion`, `revision`, and `metadata`;
- reject atomically without exposing a partial candidate.

Forward and inverse arrays are already ordered for direct application. Consumers never
reverse an inverse array themselves.

### Deterministic cascade and affected ordering

Patch order follows command order. Within a cascade, traversal and emitted patches use
canonical collection order and record order, never `Map` insertion accidents from a
different source.

Affected references are de-duplicated in first-touch order. They include patch targets
and any parent, lane, resource, task, or relationship identity whose derived output
must be invalidated. Cross-family duplicate IDs remain separate references.

### Transaction and history boundaries

Transactions reduce children sequentially against a private candidate. Nested
transactions flatten in encounter order. A child failure is annotated with its
transaction path and discards every accumulated change.

History is a thin immutable state machine over committed outcomes:

```text
commit non-empty outcome -> append past entry, clear future, trim oldest past
undo -> apply inverse patches, move entry from past to future
redo -> apply forward patches, move entry from future to past
```

History must call the same atomic patch application path; it does not contain a second
patch interpreter.

## Cross-Slice Rules

- Update this plan and `docs/ROADMAP.md` in every M2 change set. Append dated findings
  rather than replacing prior evidence.
- Update `docs/ARCHITECTURE.md` and the M2 decision record in the same change set if
  evidence changes the patch format, command outcome, validation boundary, transaction
  semantics, affected-reference shape, history role, or release acceptance criteria.
- Do not start a later slice until the active slice's focused tests and `vp check`
  pass and their exact outcome is recorded.
- Do not mark a slice done from code inspection alone.
- Keep command, patch, and history modules free of React, DOM types, browser globals,
  current time, randomness outside a seeded test generator, locale defaults, and
  host-time-zone interpretation.
- Use the M1 canonical document as the source of truth. Do not introduce a second
  persistent document type or store derived indexes in command results.
- Use stable collection-plus-ID identity. Do not address existing entities by array
  index.
- Generate forward and inverse patches during reduction. Do not recover them through a
  whole-document diff.
- Reject invalid command changes; never silently omit a requested record or clear a
  requested relationship as codec recovery does.
- A transaction is the only multi-command commit boundary. Never publish partial
  child patches or history entries.
- Keep patch, outcome, diagnostic, and history arrays readonly and deterministic.
- Preserve `revision` until a persistence adapter explicitly owns revision changes.
- Keep the public facade small. Implementation helpers, strict validators, indexes,
  cascade traversal, and history internals remain private.
- Do not change renderer, React, styles, or playground files unless an M2 contract
  limitation is proven and recorded as a deviation first.
- If implementation touches a visual surface or changes serialized scene input,
  perform the repository's connected Chrome DevTools browser matrix and record routes,
  viewports, accessibility findings, console state, and fixes before completion.

## Implementation Slices

### Slice 1: Freeze the change-kernel contract and decision record

Status: `[x]` Done

**Goal**

Resolve patch identity, inversion, affected references, strict validation,
transaction atomicity, revision ownership, initial command scope, and local history
semantics before runtime types make them accidental public behavior.

**Why here**

Every reducer, persistence example, cache invalidation path, transaction, and history
entry depends on these choices. M1 also exposed an ambiguity in the architecture's raw
affected-ID sketch that must be corrected before implementation.

**This slice should implement**

- Add the accepted change-kernel decision record.
- Select one versioned ID-keyed domain patch representation and reject a dual core
  JSON Patch authority.
- Define add/replace/remove ordering and inverse semantics.
- Replace raw affected IDs with collection-qualified entity references.
- Define committed, rejected, and no-op behavior.
- Separate strict command validation from M1 codec recovery.
- Define ordered nested transaction and rollback behavior.
- Define local revision and history ownership.
- Record M2 initial command scope and explicit exclusions.
- Update architecture, roadmap, and this plan together.

**Expected output**

- An accepted M2 decision record linked from architecture, roadmap, and this plan.
- M2 marked in progress with Slice 2 selected as the next runtime work.
- No runtime behavior, dependency, test count, package output, or browser output
  change.

**Verification**

- `git diff --check`
- Explicit existence checks for architecture, roadmap, M2 plan, and M2 decision
  record.
- Focused cross-document read confirming compatible patch, affected-reference,
  validation, transaction, history, milestone status, and next-slice wording.
- No runtime tests are required for this documentation-only slice; record that
  limitation rather than implying runtime proof.

Verification passed on 2026-07-30:

- `git diff --check`
- explicit existence checks for architecture, roadmap, M2 plan, M2 decision record,
  and the linked M1 codec decision
- a focused cross-document search and read confirming compatible versioned ID-keyed
  patch, typed affected-reference, strict-validation, atomic-transaction,
  revision-ownership, bounded-history, M2 status, and Slice 2 wording
- no runtime tests, package build, or browser checks were run for this
  documentation-only slice

**Dependencies**

- Verified M1 document kernel and its accepted codec contract.

### Slice 2: Domain patch application and inversion properties

Status: `[x]` Done

**Goal**

Create the standalone atomic patch interpreter and prove exact inversion before any
command reducer depends on it.

**Why here**

Reducers and history both need one trustworthy change materialization path. Building
and property-testing it first prevents command tests from hiding patch-application or
ordering bugs.

**This slice should implement**

- Add `DocumentCollection`, collection-to-record mapping, `EntityReference`,
  `GanttPatch`, and internal patch-result contracts under
  `packages/gantt/src/commands/`.
- Implement atomic add, replace, and remove application against all six M1
  collections.
- Validate patch version, operation, target collection/ID, add index, record family,
  duplicate add, and missing replace/remove target.
- Add a strict non-repairing final integrity check without changing M1 codec recovery
  output.
- Preserve schema version, revision, metadata, collection order, untouched collection
  identity, and untouched record identity.
- Add focused example tests for cross-family ID reuse, task segments as task-record
  replacement, malformed and stale batches, and multi-patch final-state validation.
- Add `fast-check` as a development-only property-test dependency and a seeded patch
  generator with replay information.
- Prove `apply(base, patches)` and `apply(next, inversePatches)` for generated
  add/remove/replace sequences, including byte-identical M1 serialization after
  inversion.
- Record the dependency and lockfile change in this plan and roadmap.

**Expected output**

- One private patch interpreter usable by reducers and history.
- Versioned JSON-compatible patch types.
- Seeded property coverage for patch application and inversion.
- No command or history API yet.

**Verification**

- `vp test run packages/gantt/src/commands/patches.test.ts packages/gantt/src/commands/patches.property.test.ts packages/gantt/src/model/document-round-trip.test.ts`
- `vp check`

Record the property-test seed/configuration, example count, test count, and exact
outcomes.

Verification passed on 2026-07-30:

- `vp test run packages/gantt/src/commands/patches.test.ts packages/gantt/src/commands/patches.property.test.ts packages/gantt/src/model/document-round-trip.test.ts`
  passed 3 test files and 5 tests.
- `vp check` passed formatting for 50 files and lint/type checking for 39 files with
  no warnings or errors.
- The patch property ran 200 examples with fixed seed `20260730` and
  `endOnFailure: true`; fast-check failure output reports the replay `seed` and
  `path`, which can be copied into the `fc.assert` parameters.
- `fast-check@4.9.0` was added as an exact root development dependency. Installation
  completed with the existing peer-dependency summary warning and no supply-chain
  policy failure.

**Dependencies**

- Slice 1 contract.

### Slice 3: Typed command normalization, validation, and core reducers

Status: `[x]` Done

**Goal**

Reduce the non-delete M2 command set into deterministic forward and inverse patch
sequences through one strict command entry point.

**Why here**

With patch application proven, this slice can focus on command meaning, payload
normalization, and useful diagnostics without conflating them with deletion or
transaction rollback.

**This slice should implement**

- Define typed add/update/set/move command DTOs for the six M1 entity families.
- Extract or introduce private scalar, schedule, record, and JSON-cloning helpers so
  document parsing and command normalization agree without whole-document reparsing.
- Preserve existing M1 codec diagnostic codes, paths, fixtures, and behavior through
  the extraction.
- Add command-owned diagnostic codes for unknown command type, malformed payload,
  missing target, duplicate target, immutable ID, invalid clear, and strict reference
  failure.
- Add the committed/rejected outcome union and pure `applyGanttCommand` reducer entry
  point.
- Implement:
  - `task.add` and `task.update`;
  - `resource.add` and `resource.update`;
  - `lane.add` and `lane.update`;
  - `assignment.set`;
  - `placement.add` and `placement.move`;
  - `dependency.add`.
- Make add ordering explicit and deterministic.
- Prove that reducer patches reproduce the returned document and inverse patches
  restore the original.
- Prove equal frozen inputs return structurally equal ordered outputs without
  retaining mutable payload references.
- Keep the new surface internal until the final facade slice confirms the intentional
  public boundary.

**Expected output**

- A pure non-delete command path across all six document domains.
- Shared normalization behavior without a second whole-document codec.
- Structured strict rejection with no partial candidate exposure.

**Verification**

- `vp test run packages/gantt/src/commands packages/gantt/src/model/codec.test.ts packages/gantt/src/model/document-round-trip.test.ts`
- `vp check`

Verification passed on 2026-07-30:

- `vp test run packages/gantt/src/commands packages/gantt/src/model/codec.test.ts packages/gantt/src/model/document-round-trip.test.ts`
  passed 5 test files and 25 tests.
- `vp check` passed formatting for 53 files and lint/type checking for 42 files with
  no warnings or errors.

**Dependencies**

- Slice 2 patch interpreter and strict final integrity check.

### Slice 4: Referential deletion and deterministic cascade

Status: `[x]` Done

**Goal**

Implement deletion semantics that preserve document integrity and emit complete
deterministic changes across related records.

**Why here**

Deletion is the highest-risk single-command behavior because one target may affect
multiple collections. It should be proven independently before transactions and
history multiply the state paths.

**This slice should implement**

- Implement `task.delete`, `assignment.delete`, `placement.delete`, and
  `dependency.delete`.
- Reject missing targets and a non-cascade task deletion with descendants or incident
  relationships.
- For `task.delete` with `cascade: true`:
  - discover the task subtree with a visited set;
  - remove subtree tasks, owned assignments, owned placements, and incident
    dependencies;
  - preserve resources and lanes;
  - order patches and affected references from canonical document order;
  - produce inverse adds with exact original indexes in ready-to-apply order.
- For `assignment.delete`, replace placements that reference it with otherwise equal
  records whose optional assignment ID is cleared.
- Prove cross-family same-ID records are not accidentally deleted.
- Prove unrelated record identity and order remain unchanged.
- Add generated cascade fixtures for wide/deep task trees, multiple relationships,
  cyclic malformed ancestry termination, no-op boundaries, and exact inversion.
- Record any evidence that requires moving hierarchy cycle policy into M2 before
  changing architecture.

**Expected output**

- Safe deletion coverage for every delete command in M2.
- Exact cascade patch/inverse/affected output with no dangling committed reference.

**Verification**

- `vp test run packages/gantt/src/commands/delete.test.ts packages/gantt/src/commands/delete.property.test.ts packages/gantt/src/model/validate.test.ts`
- `vp check`

Verification passed on 2026-07-30:

- `vp test run packages/gantt/src/commands/delete.test.ts packages/gantt/src/commands/delete.property.test.ts packages/gantt/src/model/validate.test.ts`
  passed 3 test files and 9 tests.
- `vp check` passed formatting for 55 files and lint/type checking for 44 files with
  no warnings or errors.
- The cascade property ran 150 generated wide/deep trees with fixed seed `20260731`
  and `endOnFailure: true`; fast-check reports replay seed and path on failure.

**Dependencies**

- Slice 3 command entry point and indexes.

### Slice 5: Atomic ordered transactions

Status: `[x]` Done

**Goal**

Compose child commands into one all-or-nothing outcome without introducing a second
reducer or exposing intermediate state.

**Why here**

Transactions should reuse already proven single-command semantics. Implementing them
after deletion ensures rollback covers the largest cross-collection patch sets.

**This slice should implement**

- Implement ordered transaction reduction through the same single-command path.
- Let each child observe prior successful child output.
- Flatten nested transactions in encounter order and produce stable transaction child
  diagnostic paths.
- Aggregate forward patches in child order.
- Aggregate inverse patches in reverse child order, with each child's inverse already
  internally ordered.
- De-duplicate affected references in first-touch order.
- Reject the entire transaction when any child rejects and return the original
  document identity with empty change arrays.
- Treat empty and semantically unchanged transactions as committed no-ops.
- Add tests for cross-command dependencies, duplicate IDs introduced within a
  transaction, add-then-update, add-then-delete no-op, failure at first/middle/last
  child, nested transactions, cascade followed by recreate, and deterministic replay.
- Add seeded generated command sequences that prove committed transaction inversion.

**Expected output**

- One atomic transaction boundary over the complete M2 command set.
- No partial events, history, or persistence behavior.

**Verification**

- `vp test run packages/gantt/src/commands/transaction.test.ts packages/gantt/src/commands/transaction.property.test.ts`
- `vp check`

Verification passed on 2026-07-30:

- `vp test run packages/gantt/src/commands/transaction.test.ts packages/gantt/src/commands/transaction.property.test.ts`
  passed 2 test files and 8 tests.
- `vp check` passed formatting for 57 files and lint/type checking for 46 files with
  no warnings or errors.
- The transaction property ran 150 generated ordered command sequences with fixed
  seed `20260732` and `endOnFailure: true`; fast-check reports replay seed and path on
  failure.

**Dependencies**

- Slices 3 and 4 complete command semantics.

### Slice 6: Bounded immutable local history

Status: `[x]` Done

**Goal**

Provide local undo and redo as a small immutable session-state layer over committed
patch and inverse sequences.

**Why here**

History should consume the final single-command and transaction contracts. It must not
influence their reducer design or create another patch path.

**This slice should implement**

- Define immutable history state, entry, capacity, commit, undo, redo, and clear
  helpers.
- Require an explicit positive finite integer capacity.
- Record only committed non-empty outcomes.
- Treat one committed transaction as one entry.
- Clear the redo branch on a new commit after undo.
- Trim the oldest past entries deterministically.
- Reuse atomic patch application for undo and redo.
- Fail closed when a stored patch cannot apply to the present document and retain both
  stacks unchanged.
- Preserve document revision and keep history out of serialization.
- Test no-op/rejected outcomes, capacity 1 and larger bounds, multiple undo/redo,
  branching, transaction grouping, stale present documents, cross-family IDs,
  extension data, cascade restoration, and input immutability.
- Add a generated `commands -> undo all -> redo all` property that proves original and
  final stable serialization.

**Expected output**

- A framework-independent local history helper that later uncontrolled React state can
  own without changing command semantics.

**Verification**

- `vp test run packages/gantt/src/commands/history.test.ts packages/gantt/src/commands/history.property.test.ts`
- `vp check`

Verification passed on 2026-07-30:

- `vp test run packages/gantt/src/commands/history.test.ts packages/gantt/src/commands/history.property.test.ts`
  passed 2 test files and 10 tests.
- `vp check` passed formatting for 60 files and lint/type checking for 49 files with
  no warnings or errors.
- The history property ran 100 generated command/transaction histories with fixed
  seed `20260733` and `endOnFailure: true`; fast-check reports replay seed and path on
  failure.

**Dependencies**

- Slice 5 atomic transaction outcome.

### Slice 7: Intentional facade, documentation, and M2 completion evidence

Status: `[ ]` Not started

**Goal**

Expose only the deliberate non-React change-kernel surface, document its contract, and
prove M2 complete without claiming unperformed visual or persistence behavior.

**Why here**

The package should not commit to command or patch names until reducers, transactions,
history, and property tests have supplied implementation evidence.

**This slice should implement**

- Decide and record whether the pure command and history entry points are stable root
  exports or an explicit experimental surface; do not export both.
- Export the intentional command, patch, affected-reference, outcome, and history
  contracts.
- Keep normalizers, strict validators, patch internals, indexes, cascade traversal,
  and property generators private.
- Add package-facade compile/runtime tests using only the chosen public imports.
- Document:
  - canonical document versus ergonomic command input;
  - committed, rejected, and no-op outcomes;
  - forward/inverse patch application;
  - atomic transactions;
  - bounded local undo/redo;
  - revision preservation and persistence responsibilities;
  - explicit M2 exclusions.
- Run the full automated gate and package/playground builds.
- Inspect packed declarations and bundle output for intentional exports, leaked
  internals, React-free command modules, and unexpected runtime dependencies.
- Run connected browser regression only if any React/render/style/playground file or
  output changed. If not, record that the pure M2 scope made browser verification
  inapplicable and rely on existing SSR/render plus build evidence.
- Update M2 status, completion evidence, this plan, roadmap current focus, and the
  actionable M3 planning handoff only after every required gate passes.

**Expected output**

- A documented, package-tested M2 change kernel.
- Exact final evidence and a concrete M3 planning next action.

**Verification**

- `mise run ci`
- `mise run build-playground`
- Focused package-facade tests through the chosen public import.
- Packed declaration and bundle inspection.
- `git diff --check`
- Explicit linked-document existence checks.
- Focused cross-document read confirming compatible architecture, decision, plan,
  roadmap, README, exports, status, evidence, and next action.
- Triggered connected browser matrix only when the visual-surface condition above is
  met.

The final gate is not replaceable by focused tests. Record the exact command output,
test counts, property-test seed/replay configuration, package artifacts, browser
applicability and evidence, and any warnings before marking M2 done.

**Dependencies**

- Slices 2 through 6 complete and verified.

## Testing Plan

### Focused unit tests

- Patch operation validation, ordering, application, freezing, and atomic rejection.
- Command normalization, target lookup, strict validation, no-op behavior, and
  diagnostics.
- Each reducer's exact forward, inverse, affected, and final-document result.
- Cascade traversal and multi-collection deletion.
- Transaction aggregation and rollback.
- History capacity, branching, undo, redo, and stale failure.

### Seeded property tests

Use `fast-check` with fixed CI configuration and reported replay data.
Generators should create small canonical documents and valid/invalid operation
sequences with:

- all six entity families;
- cross-family duplicate IDs;
- instant and all-day schedules;
- task segments;
- nested extension JSON;
- parent and relationship graphs;
- add/remove/replace patches;
- single and transactional commands;
- cascades and history branches.

Core properties:

1. Same input and seed produce equal ordered output.
2. Inputs remain deep-equal and frozen-state safe.
3. Applying reducer patches equals the returned document.
4. Applying inverse patches restores deep equality and byte-identical stable JSON.
5. Any rejected batch retains original identity and exposes no partial changes.
6. Undo-all restores the initial document; redo-all restores the final document.

Record seed, run count, size limits, and replay syntax in the test or plan so failures
are reproducible.

### Regression tests

- Existing codec, validation, index, serialization, round-trip, scene, facade, and SSR
  tests.
- Full repository formatting, lint, type, test, and package build.
- Playground production build.
- Connected browser matrix only if implementation crosses the pure M2 boundary into a
  rendered surface.

## Likely Files to Add

- `docs/decisions/2026-07-30-change-kernel-contract.md`
- `docs/plans/2026-07-30-change-kernel-plan.md`
- `packages/gantt/src/commands/types.ts`
- `packages/gantt/src/commands/patches.ts`
- `packages/gantt/src/commands/normalize.ts`
- `packages/gantt/src/commands/validate.ts`
- `packages/gantt/src/commands/reduce.ts`
- `packages/gantt/src/commands/history.ts`
- Focused example and property tests beside those modules.

Names may be consolidated when a smaller internal shape is clearer, but command,
patch, strict-validation, and history responsibilities must remain separately
testable.

## Likely Files to Change

- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `packages/gantt/src/index.tsx`
- `packages/gantt/src/index.test.tsx`
- `packages/gantt/src/model/codec.ts`
- `packages/gantt/src/model/diagnostics.ts`
- `packages/gantt/src/model/validate.ts`
- Focused existing model tests affected by private normalization extraction.

React, render, style, and playground files are not expected to change.

## Open Questions

These questions do not block Slice 2:

1. Should the proven pure change entry point and history helpers become stable root
   exports in M2, or remain under one explicit experimental facade until M4 supplies
   the React/runtime consumer? Resolve in Slice 7 from packed declarations and actual
   consumers; do not expose duplicate surfaces.
2. Does implementation evidence justify a narrower command input DTO than the M1
   ergonomic scalar/date boundary? Start by sharing M1 semantics. Any narrowing that
   affects documented consumers requires a decision-record update.
3. Does a real consumer need resource or lane deletion before M4? They remain out of
   M2 unless the milestone exit condition cannot be proven without them.
4. Does record-level replacement become materially too large for measured persistence
   or history fixtures? Do not add field-level patches speculatively; record the
   measurement and introduce a later patch version only if evidence requires it.

## Working Notes

### 2026-07-30 — Planning and contract pass

- M1 is complete at `d8342a3`; no command, patch, transaction, or history module
  exists.
- The patch decision favors one ID-keyed domain format. JSON Patch translation is an
  adapter concern because core array-index paths conflict with stable entity identity.
- M1 permits cross-family ID reuse, so the architecture's original raw affected-ID
  list is replaced by collection-qualified entity references.
- The M1 reference validator is recovery-oriented. M2 needs a strict non-repairing
  check rather than a flag that risks changing codec behavior.
- Record-level replacement keeps nested task segments and inverse generation
  unambiguous while still avoiding whole-document replacement.
- Property-based patch inversion is an explicit architecture requirement, but the
  repository currently has no property-test dependency.
- Browser verification is intentionally trigger-based for M2 because the planned
  runtime is React-free and does not change a rendered surface.
- No runtime test, package build, or browser gate was run for this documentation-only
  slice.
- `git diff --check`, linked-file existence checks, and the focused architecture,
  decision, plan, and roadmap consistency read passed. Slice 1 is complete and Slice 2
  is the actionable next checkpoint.

### 2026-07-30 — Slice 2 patch interpreter and inversion

- Added the collection-qualified patch type map and one atomic interpreter for all six
  canonical collections.
- Patch input is defensively cloned and frozen. Version, operation, target, add index,
  record family, duplicate target, missing target, and final strict integrity failures
  reject the whole batch while retaining the base document by identity.
- Final-state validation runs after the complete batch, allowing coordinated
  relationship changes without exposing an invalid intermediate document.
- Touched collections are cloned once; untouched collections and untouched records
  retain identity. Root schema version, revision, and metadata remain unchanged.
- Inverses are returned in direct application order. Cross-family duplicate IDs,
  task-owned segment replacement, stale batches, coordinated reference updates, and
  byte-identical stable serialization after inversion are covered.
- Added exact development dependency `fast-check@4.9.0`. The fixed-seed property uses
  seed `20260730`, 200 runs, and `endOnFailure: true`; fast-check reports replay seed
  and path on failure.
- Focused verification passed 3 files and 5 tests. `vp check` passed 50 formatted
  files and 39 lint/type-checked files with no warnings or errors.

### 2026-07-30 — Slice 3 typed non-delete commands

- Added typed ergonomic inputs and commands for task/resource/lane add and update,
  assignment set, placement add and move, and dependency add.
- Added a private single-record normalization entry point over the existing M1
  decoders. Document parsing retains its warning-and-recovery behavior, while command
  normalization treats every decoder diagnostic, including unknown properties, as a
  rejecting error without reparsing a whole document.
- Update DTOs use `null` as the explicit clear value. IDs are immutable, explicit
  `undefined` and unknown properties reject, and target IDs remain canonical strings.
- All reducers emit one deterministic add/replace patch and use the Slice 2
  interpreter as the only document materialization and strict-reference authority.
- Committed no-ops retain the document by identity and emit no patches. Mutable input
  extension objects are cloned and frozen, equal inputs produce equal ordered output,
  forward patches replay the result, and inverse patches restore stable bytes.
- No renderer, React, style, playground, architecture contract, or public package
  facade changed.
- Focused verification passed 5 files and 25 tests. `vp check` passed 53 formatted
  files and 42 lint/type-checked files with no warnings or errors.

### 2026-07-30 — Slice 4 referential deletion

- Added task, assignment, placement, and dependency delete commands through the same
  command and patch entry points.
- Task deletion rejects by default when descendants or incident relationships exist.
  `cascade: true` discovers descendants with a visited set and emits removals in
  canonical task, assignment, placement, and dependency record order while preserving
  resources and lanes.
- The visited traversal terminates for malformed cyclic ancestry and can remove the
  complete cycle when it includes the requested target; no architecture change was
  needed because cycle rejection remains out of M2 scope.
- Assignment deletion emits placement replacements that explicitly clear
  `assignmentId`; inverse patches restore both the assignment and placement references
  in direct application order.
- Affected references are collection-qualified, de-duplicated in first-touch order,
  and include direct patch targets plus task/resource/lane identities invalidated by
  removed relationships.
- Cross-family same-ID examples prove placement or dependency deletion cannot remove
  assignments or lanes with the same ID. Unrelated collection and record identities
  remain unchanged.
- The fixed-seed cascade property uses seed `20260731`, 150 runs, and
  `endOnFailure: true`; generated wide/deep trees delete deterministically and invert
  to byte-identical stable JSON.
- Focused verification passed 3 files and 9 tests. `vp check` passed 55 formatted
  files and 44 lint/type-checked files with no warnings or errors.

### 2026-07-30 — Slice 5 atomic transactions

- Added the recursive typed transaction command and composed every child through
  `applyGanttCommand`; no second reducer or patch interpreter was introduced.
- Children observe prior committed child output. Nested transactions flatten their
  forward patches in encounter order, inverse groups prepend in reverse child order,
  and affected references de-duplicate in first-touch order.
- Any child rejection discards accumulated document, patch, inverse, and affected
  state. Diagnostics retain stable nested paths such as
  `/command/commands/0/commands/1/value/id`.
- Empty transactions, all-no-op transactions, and add-then-delete transactions whose
  final document is structurally unchanged return the original document by identity
  with empty change arrays.
- Examples cover first/middle/last failures, cross-command references, nested
  transactions, duplicate targets, add/update, add/delete collapse, and cascade
  followed by recreation.
- The fixed-seed transaction property uses seed `20260732`, 150 runs, and
  `endOnFailure: true`; generated ordered command sequences are deterministic, replay
  through forward patches, and restore stable bytes through transaction inverses.
- Focused verification passed 2 files and 8 tests. `vp check` passed 57 formatted
  files and 46 lint/type-checked files with no warnings or errors.

### 2026-07-30 — Slice 6 bounded local history

- Added immutable history state, entries, explicit positive finite integer capacity,
  commit, undo, redo, and clear helpers.
- Only committed non-empty outcomes enter history. A committed transaction is one
  entry, rejected and no-op outcomes retain state by identity, a new branch clears
  future entries, and past entries trim from the oldest end.
- History verifies that a committed outcome descends from its present document before
  recording it. Undo and redo call `applyGanttPatches`; stale application returns a
  rejected result with the exact document, history object, and stacks unchanged.
- Capacity 1/larger bounds, multiple undo/redo, branching, transaction grouping,
  cross-family IDs, extension data, assignment cleanup, cascade restoration, clear,
  invalid capacities, and input immutability are covered.
- History remains session data outside `GanttDocument`; revision is preserved by the
  shared patch path and history is never serialized.
- The fixed-seed history property uses seed `20260733`, 100 runs, and
  `endOnFailure: true`; undo-all restores initial stable bytes and redo-all restores
  final stable bytes for generated command/transaction histories.
- Focused verification passed 2 files and 10 tests. `vp check` passed 60 formatted
  files and 49 lint/type-checked files with no warnings or errors.

## Progress

- [x] Slice 1: Freeze the change-kernel contract and decision record
- [x] Slice 2: Domain patch application and inversion properties
- [x] Slice 3: Typed command normalization, validation, and core reducers
- [x] Slice 4: Referential deletion and deterministic cascade
- [x] Slice 5: Atomic ordered transactions
- [x] Slice 6: Bounded immutable local history
- [ ] Slice 7: Intentional facade, documentation, and M2 completion evidence
- [ ] Final automated gate
- [ ] Conditional browser gate, only if visual surfaces change

## Next Slice

Begin Slice 7 by selecting one intentional root package facade, adding facade tests,
and documenting the pure change flow in `README.md`. Inspect packed declarations and
bundle output, run `mise run ci` and `mise run build-playground`, and record the final
M2 evidence before changing the plan and roadmap to complete.
