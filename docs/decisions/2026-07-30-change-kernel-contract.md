# Decision: Change Kernel Contract

Status: Accepted
Date: 2026-07-30
Owners: M2 change kernel

## Context

M2 adds the framework-independent mutation boundary for `@gantempo/gantt`. Commands
must change the canonical M1 document without mutating caller-owned data, produce a
small deterministic persistence payload, support exact local undo/redo, and reject
invalid multi-record changes atomically.

The M1 model creates constraints that the change contract must preserve:

- each entity family is an ordered array of records with stable string IDs;
- the same ID may legally appear in more than one entity family;
- task segments are owned by their task rather than stored as a seventh document
  collection;
- the document codec accepts ergonomic untrusted wire input, but command validation
  starts from a canonical document and must reject invalid changes instead of
  repairing or omitting them;
- `revision` is optional persistence state owned by an external adapter;
- persistent values, commands, patches, diagnostics, and history entries must remain
  serializable plain data.

This decision resolves the patch-representation question previously listed in
[`ARCHITECTURE.md`](../ARCHITECTURE.md) and
[`ROADMAP.md`](../ROADMAP.md). Its implementation is owned by
[`2026-07-30-change-kernel-plan.md`](../plans/2026-07-30-change-kernel-plan.md).

## Decision

### Use one ID-keyed domain patch format

The core change kernel will emit a versioned, entity-aware patch union:

```ts
type DocumentCollection =
  | "tasks"
  | "resources"
  | "lanes"
  | "assignments"
  | "placements"
  | "dependencies";

interface EntityReference {
  readonly collection: DocumentCollection;
  readonly id: EntityId;
}

type GanttPatch =
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
```

The implementation may use a collection-to-record type map to make the union more
precise in TypeScript. The durable semantics are:

- `target.collection` and `target.id` are the operation identity;
- an `add` patch includes the canonical insertion index needed to preserve collection
  order and to restore a removed record exactly;
- `replace` replaces one complete canonical record and preserves its collection
  position;
- a task replacement is the patch boundary for its owned segments;
- `remove` locates the record by ID rather than by array position;
- `value.id` must equal `target.id`, and the value must match the target collection;
- all patch values are canonical JSON-compatible records;
- a patch sequence is applied atomically and referential integrity is checked on the
  final candidate document;
- invalid patch versions, targets, indexes, values, duplicates, or final references
  reject the complete sequence with structured diagnostics;
- patch application leaves `schemaVersion`, `revision`, and `metadata` unchanged in
  M2.

The insertion index is ordering data, not persistent identity. Existing records are
always found by the ID-keyed target. This preserves M1 array order while avoiding
array indexes as entity identity.

### Do not use JSON Patch inside the core

RFC 6902 JSON Patch addresses records in the current document shape through paths
such as `/tasks/3`. Those paths become stale when an ordered collection changes and
do not identify the entity family and ID independently of array position. A core
adapter that emits both domain patches and JSON Patch would create two mutation
authorities and two inversion contracts.

Persistence integrations may translate a committed domain patch set to JSON Patch,
an API-specific DTO, or state-manager actions at their boundary. Such an adapter must
use the same base revision and must not become a second reducer.

### Return inverse patches ready to apply

For every committed command, the kernel returns forward patches and inverse patches:

- the forward sequence transforms the original document into the committed document;
- the inverse sequence is already in application order and transforms the committed
  document back into the exact original document;
- an add inverts to remove;
- a remove inverts to add with the original record and index;
- a replacement inverts to a replacement containing the original record;
- transaction inverse groups reverse child-command order;
- no-op commands return empty forward and inverse sequences;
- rejected commands return the original document and empty patch sequences.

Patch and inverse generation is reducer output. It is not reconstructed later by
diffing whole documents.

### Identify affected entities by family and ID

`EntityId[]` is not an adequate affected-set contract because M1 permits cross-family
ID reuse. Command outcomes therefore return ordered `EntityReference[]` values.

The affected list is de-duplicated in deterministic first-touch order and includes:

- each direct patch target;
- records removed or replaced by cascade behavior;
- relationship or parent records whose validity or derived output may change.

Callers that only need IDs may project them, but caches, events, history, and future
collaboration code retain the entity family.

### Separate command validation from codec recovery

The command engine assumes its base value is a canonical `GanttDocument`, but it
still verifies the invariants needed for a safe change. It must not call the M1
recovery validator as a commit authority because that validator may omit
relationships or clear references to salvage unrelated wire input.

The command lifecycle for M2 is synchronous and pure:

```text
canonical base document + typed command
  -> normalize and defensively clone command payload
  -> validate command shape, target, and references
  -> reduce directly to forward and inverse domain patches
  -> apply the complete patch sequence to a candidate document
  -> strictly verify final uniqueness and referential integrity
  -> return committed or rejected outcome
```

Unchecked runtime input still receives structured diagnostics. Unknown command
properties and invalid command values are rejected rather than silently ignored.
Record input normalization should share M1 scalar, schedule, and JSON-cloning
semantics through private helpers; it must not serialize and reparse a whole
document.

### Keep transactions ordered and atomic

A transaction is an ordered list of commands. Each child observes the candidate
document produced by prior children. Nested transactions are flattened in encounter
order. If any child rejects, the transaction returns:

- the original document by identity;
- all diagnostics needed to identify the rejected child;
- no forward patches;
- no inverse patches;
- no affected entities.

An empty or semantically unchanged transaction is a successful no-op. A committed
transaction is one local-history entry.

### Keep revision and external coordination outside M2

Local commands and patch application preserve the base document's `revision`. An
external persistence adapter supplies base revisions, operation IDs, server
revisions, conflict handling, temporary-ID reconciliation, retries, and rollback
coordination in a later milestone.

M2 local history is an immutable session-state helper over committed forward and
inverse patch sequences. It is not serialized into `GanttDocument` and is not a
persistent audit log.

## Initial Command Scope

M2 will prove the change boundary with the architecture's canonical record domains:

- add and update tasks, resources, and lanes;
- set assignments by stable assignment ID;
- add and move placements;
- add dependencies;
- delete tasks, assignments, placements, and dependencies;
- compose those operations in transactions.

IDs are immutable after add. Optional update fields use an explicit clear value in
the command DTO; `undefined` is never persistence data. Task schedule changes can be
expressed through `task.update`.

Gesture-oriented commands such as task move, resize, and split remain later
specializations over this kernel because their elapsed/all-day/calendar policies
belong with time and interaction work. Resource and lane deletion, metadata editing,
revision mutation, async interception, events, persistence adapters, conflict
resolution, and scheduling side effects are outside M2.

Task deletion is fail-closed by default when child tasks or relationships depend on
the target. `cascade: true` removes the target task subtree and relationships owned
by or incident to those tasks in deterministic document order. Traversal uses a
visited set so malformed cyclic input cannot make deletion non-terminating.
Assignment deletion preserves otherwise valid placements by clearing their optional
`assignmentId` through explicit replacement patches.

## History Semantics

- History state is immutable plain session data containing the present document,
  past entries, and future entries.
- A caller supplies an explicit positive capacity; the kernel does not hide an
  unbounded default.
- Only committed outcomes with at least one patch create entries.
- A transaction creates one entry.
- A new commit after undo clears the redo branch.
- Undo applies the stored inverse sequence and moves the entry to the future stack.
- Redo applies the stored forward sequence and moves the entry back to the past
  stack.
- Rejected or stale history application fails without moving either stack.
- Trimming drops the oldest past entries deterministically.

Persistent audit history, command coalescing, save points, collaborative rebasing,
and cross-session history are separate capabilities.

## Testing Contract

Focused examples and seeded property-based tests must prove:

- determinism from equal base document and command inputs;
- no mutation of command, document, record, collection, or extension objects;
- forward patches reproduce the returned document;
- inverse patches reproduce deep-equal and byte-identical serialized input;
- add/remove/replace preserve collection ordering;
- cross-family duplicate IDs remain unambiguous;
- malformed or stale patch batches reject atomically;
- transaction failure leaves the original document and empty change sets;
- committed transactions undo and redo as one entry;
- no-op and rejected outcomes do not enter history;
- the engine imports no React, DOM, browser, clock, locale, or host-time-zone state.

Property tests use a fixed reported seed and expose replay information on failure.

## Consequences

- Core patches are more domain-specific than RFC 6902 but remain small,
  JSON-compatible, persistence-friendly, and independent of the document's current
  array positions.
- Whole-record replacement makes inversion and nested task-segment changes
  unambiguous. A measured need for field-level collaboration patches can introduce a
  later patch version without changing command semantics.
- Persistence adapters must translate domain patches when a backend requires JSON
  Patch.
- Strict command validation requires a non-repairing integrity check in addition to
  the M1 wire-recovery validator.
- Typed affected references correct the ambiguous raw-ID shape shown in the original
  architecture sketch.
- M2 does not yet provide the async interceptable command bus used by React
  interaction; it provides the deterministic reducer that bus will call.

## Links

- [Architecture commands, patches, and events](../ARCHITECTURE.md#8-commands-patches-and-events)
- [M2 roadmap](../ROADMAP.md#m2-change-kernel)
- [M2 implementation plan](../plans/2026-07-30-change-kernel-plan.md)
- [M1 document codec contract](2026-07-30-document-codec-contract.md)
