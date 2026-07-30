# Decision: Persistence Entity-Change Projection

Status: Accepted
Date: 2026-07-31
Owners: Post-M4 persistence ergonomics

## Context

The M2 patch contract and M4 document-change envelope intentionally carry enough data
for atomic application, inverse application, local history, controlled
acknowledgement, retries, and conflict handling. The controlled playground exposed
that complete internal protocol as its primary persistence example.

For an application developer handling a task drag, that example answered how the
runtime processed the gesture but did not directly answer which database row changed
or show its old and new schedule. Requiring every consumer to correlate forward and
inverse patches would duplicate error-prone adapter work and make the easiest
integration unnecessarily opaque.

This decision extends the
[interaction runtime and public API contract](2026-07-30-interaction-runtime-public-api-contract.md)
without replacing the
[change-kernel contract](2026-07-30-change-kernel-contract.md).

## Decision

### Add one row-oriented projection to every non-empty document change

`GanttDocumentChange` includes an immutable `entityChanges` array:

```ts
type GanttEntityChange =
  | {
      readonly kind: "create";
      readonly collection: DocumentCollection;
      readonly id: EntityId;
      readonly after: DomainRecord;
    }
  | {
      readonly kind: "update";
      readonly collection: DocumentCollection;
      readonly id: EntityId;
      readonly before: DomainRecord;
      readonly after: DomainRecord;
    }
  | {
      readonly kind: "delete";
      readonly collection: DocumentCollection;
      readonly id: EntityId;
      readonly before: DomainRecord;
    };
```

The actual public type preserves the collection-specific record relationship.

The projection is derived once from the command bus's captured authoritative base,
accepted candidate, and first-touch patch targets. Repeated patches to one target in
a transaction collapse into one entry from the operation's original row to its final
row. Cross-collection identical IDs remain distinct.

Dispatch reports base to candidate. Undo and redo report the direction being applied
now, so an undo of a creation is a delete and an undo of a deletion is a create.

### Keep patches as the mutation and inversion authority

`entityChanges` is an application-facing projection, not a second reducer or patch
format. The runtime still:

- reduces semantic commands exactly once;
- applies and validates the existing patch batch atomically;
- retains ready-to-apply inverse patches;
- records history from the accepted patch/inverse pair;
- uses exact controlled candidate acknowledgement.

Consumers that need patch replay, rollback, or a backend-specific patch protocol may
continue using `patches` and `inversePatches`. Consumers that need ordinary row writes
can start from `entityChanges`.

### Keep operational metadata separate from business changes

Local `proposalId`, input `source`, and candidate/committed lifecycle phases remain
available for runtime correlation and diagnostics. They are not database row changes
and should not dominate the primary persistence example.

The controlled playground will show one request per accepted change containing:

- an application-owned retry-safe operation ID;
- the base revision when present;
- concise create/update/delete DTOs derived from `entityChanges`.

The example renders instant schedules as ISO strings and may reduce before/after rows
to the changed fields. That formatting is an application adapter, not a change to the
canonical epoch-millisecond model.

## Consequences

Benefits:

- a task drag directly identifies the task row and old/new schedule;
- add, update, delete, cascade, transaction, undo, and redo share one understandable
  projection;
- consumers no longer need to pair or reverse patches for ordinary database writes;
- internal lifecycle and persistence mechanics remain available without becoming the
  default integration story.

Costs:

- each change envelope retains a small frozen array and row references already owned
  by its base or candidate documents;
- the public envelope gains an additive contract that must remain deterministic;
- backend-specific column mapping still belongs to the application.

## Rejected Alternatives

### Replace patches with entity changes

Rejected because entity changes do not replace atomic patch application, inverse
ordering, or local history.

### Expose only the semantic command

Rejected because a delta-based task move does not state the final persisted dates,
interceptors may replace commands, cascades affect additional entities, and history
replay needs the direction applied now.

### Keep the projection only in the playground

Rejected because every real consumer would still need to reconstruct the same
before/after row relationship from patches.

### Add database- or transport-specific writes to the core

Rejected because SQL columns, REST DTOs, GraphQL inputs, and JSON Patch paths belong
to application adapters.

## Completion Evidence

- Runtime and root-facade coverage proves create, update, delete, same-entity
  transaction coalescing, structurally restored-row omission, cross-collection
  identity, inverse direction, immutability, and the simplified write boundary.
- Playground adapter coverage proves ISO task schedule before/update values and
  explicit placement lane changes.
- `mise run ci` passes 60 test files / 294 tests, formatting across 147 files,
  lint/type checking across 136 files, and the package build.
- `mise run build-playground` transforms 1,914 modules successfully.
- A live same-lane mouse drag at 1,440 × 900 produces one
  `task.schedule.updated` request with no local proposal, input-source, lifecycle, or
  raw-patch fields. The same labelled log has no page overflow at 560 × 900, and the
  application console contains no warnings or errors.
- Chrome DevTools network inspection was unavailable because its dedicated profile
  was already locked. The built-in Browser fallback does not expose a failed-request
  ledger, so no separate network-status claim is made.
- Full task create/delete DTOs retain canonical schedule `mode`; the compact
  date-only projection is limited to same-mode schedule updates.

## Links

- [Architecture commands, events, and persistence](../ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md)
- [Implementation plan](../plans/2026-07-31-persistence-entity-change-projection-plan.md)
