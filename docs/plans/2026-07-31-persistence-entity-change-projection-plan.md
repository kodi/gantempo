# Persistence Entity-Change Projection Plan

Status: Complete
Date: 2026-07-31
Owners: Post-M4 persistence ergonomics

## Summary

Make the document-change hook answer the application developer's first persistence
question directly: which canonical entity row was created, updated, or deleted, and
what were its before and after values?

The existing command, patch, inverse, proposal, source, and lifecycle data remains
available for policy, history, rollback, conflict handling, and diagnostics. A new
immutable `entityChanges` projection becomes the primary application-facing write
shape, and the controlled `/interactive` example will display one concise API request
instead of candidate/API-write/committed telemetry.

## Decisions

- The durable public contract is recorded in the
  [persistence entity-change decision](../decisions/2026-07-31-persistence-entity-change-projection.md).
- Add `entityChanges` to `GanttDocumentChange` as an ordered, immutable projection of
  the accepted base and candidate documents.
- Each changed collection-plus-ID appears once as `create`, `update`, or `delete`.
- `create` carries `after`, `delete` carries `before`, and `update` carries both
  complete canonical row values. Patches remain the mutation and inversion
  authority.
- Preserve first-touch patch order so transactions and cascades remain deterministic.
- Keep backend operation IDs, server revisions, retries, conflicts, and database DTO
  translation application-owned.
- Make the playground log retain only the persistence-relevant operation ID, base
  revision, and human-readable entity changes. Internal proposal IDs, pointer source,
  lifecycle phases, and raw patches leave the primary log.
- Render instant schedule times as ISO strings in the example adapter. The canonical
  public model remains epoch milliseconds.

## Scope

In scope:

- public data-only entity-change types and `GanttDocumentChange.entityChanges`;
- one private pure projection used by dispatch, undo, and redo;
- root-facade, runtime, transaction, immutability, and history-direction coverage;
- README and durable architecture/decision synchronization;
- a concise `/interactive` API-change log with live desktop and narrow verification.

Out of scope:

- a network client or persistence queue;
- database-schema-specific SQL, REST, GraphQL, or JSON Patch adapters;
- server acknowledgement, retries, conflicts, rollback orchestration, or ID mapping;
- changing command, patch, inverse, history, or controlled-acknowledgement semantics;
- persistent audit logging of runtime lifecycle events.

## Behavior To Preserve

- Controlled owners acknowledge `change.document` synchronously before remote work.
- Uncontrolled owners adopt before observing the change.
- Patches and inverse patches remain deterministic, atomic, and ready to apply.
- No-op and rejected commands produce no document-change candidate.
- Undo and redo describe the row direction being applied now.
- Collection-qualified identity remains authoritative when IDs repeat across
  collections.

## Slices

### Slice 1: Accept and synchronize the projection contract

Status: `[x]` Done

- record the additive public contract in a focused decision;
- update architecture and roadmap ownership;
- constrain the implementation and verification path in this plan.

Verification:

- `vp check docs/ARCHITECTURE.md docs/ROADMAP.md docs/decisions/2026-07-31-persistence-entity-change-projection.md docs/plans/2026-07-31-persistence-entity-change-projection-plan.md`
- `git diff --check`

Dependencies: none.

### Slice 2: Implement the canonical entity-change projection

Status: `[x]` Done

- add collection-specific create/update/delete types;
- derive one entry per patched collection-plus-ID from the captured base and final
  candidate;
- attach the frozen projection to dispatch, undo, and redo envelopes;
- export the public types from the root facade;
- cover create/update/delete, same-entity transactions, cross-family IDs,
  immutability, and reverse history direction.

Verification:

- focused runtime and root-facade tests;
- package type check and build.

Dependencies: Slice 1.

### Slice 3: Replace protocol telemetry with meaningful API writes

Status: `[x]` Done

- adapt `entityChanges` into concise example DTOs;
- show ISO schedule before/update values for task movement;
- keep operation ID and base revision but omit proposals, pointer source, phases, and
  patches from the primary log;
- update README examples and explanatory copy.

Verification:

- focused consumer tests;
- playground production build;
- live `/interactive` mouse drag at desktop and narrow viewports;
- inspect accessibility, console, and failed requests.

Dependencies: Slice 2.

### Slice 4: Close verification and documentation evidence

Status: `[x]` Done

- run the full repository gate and `git diff --check`;
- record exact automated and live evidence here and in the roadmap;
- leave the queued item-properties appendix as the next action.

Verification:

- `mise run ci`
- `mise run build-playground`
- `git diff --check`

Dependencies: Slices 1–3.

## Working Notes

### 2026-07-31 — User-reported persistence opacity

- A same-lane mouse drag of `interactive-task-1` from
  `2026-07-29/2026-08-02` to `2026-08-03/2026-08-07` produced three primary log
  records dominated by dispatch, proposal, pointer, and lifecycle metadata.
- The raw replacement patch exposed only the complete after row, so the visible log
  did not directly state the old and new dates.
- Inspection confirmed that `GanttDocumentChange` already captures the authoritative
  base and candidate while building the envelope, so the row projection can be
  derived without making consumers pair forward and inverse patches.

### 2026-07-31 — Markdown-only Vite Plus checks are excluded

- The planned path-scoped `vp check` stopped before analysis because this checkout's
  check pipeline excludes Markdown-only target sets.
- A direct path-scoped `vp fmt --check` confirmed the formatter also excludes
  Markdown. Documentation verification therefore uses `git diff --check`, exact
  link-target checks, and focused terminology inspection; the complete source-aware
  `vp check` remains covered by `mise run ci`.

### 2026-07-31 — Cascade fixture follows reducer patch order

- The first focused projection run passed update/coalescing, inverse-direction, root
  facade, and type checks, but one new assertion assumed assignment deletion would
  preserve the fixture placement.
- Existing task-cascade behavior deletes the task first, followed by the owned
  assignment, placement, and dependency. The projection correctly preserves that
  reducer patch order; the test expectation was corrected without changing runtime
  behavior.

### 2026-07-31 — Public projection and concise example adapter implemented

- `GanttDocumentChange.entityChanges` now exposes frozen create/update/delete rows
  derived from the captured base and accepted candidate in first-touch patch order.
- Repeated transaction patches to one entity coalesce to one base/final row change;
  structurally restored rows are omitted.
- The playground adapter turns a schedule-only task update into
  `task.schedule.updated` with ISO `before` and `update` dates. Generic entity changes
  retain concise changed fields.
- The primary log no longer records proposal IDs, pointer source, candidate/committed
  phases, or raw patches.

### 2026-07-31 — Chrome DevTools profile was already locked

- The repository-preferred Chrome DevTools connection could not list pages because
  its dedicated profile was already owned by another running browser instance.
- No browser process was terminated. Live verification uses the built-in Browser
  fallback, which also provides the coordinate drag required for the exact same-lane
  movement check.

### 2026-07-31 — Live fallback has no request ledger

- The built-in Browser exposes console logs and observed page assets but not a
  request/status ledger equivalent to Chrome DevTools Network.
- Live verification can prove the loaded route, application console state,
  accessible structure, responsive geometry, and interaction output. It does not
  claim a separate failed-request ledger check while the preferred Chrome profile is
  unavailable.

### 2026-07-31 — Full task writes must retain schedule mode

- Final review found that the ISO formatter used by full task create/delete records
  omitted the canonical schedule `mode`, even though the date-only move projection
  was correct.
- The short schedule-only form is limited to updates whose before/after modes match.
  Full task rows and mode-changing updates retain `mode`; focused coverage and final
  gates must be repeated before completion.

## Verification Evidence

- Slice 1 documentation passed `git diff --check`, exact linked-file existence checks,
  and focused cross-document terminology inspection on 2026-07-31.
- Markdown-only `vp check` and `vp fmt --check` were attempted and excluded all
  supplied targets before analysis, as recorded in Working Notes.
- Slices 2 and 3 passed four focused files / 25 tests, full formatting/lint/type
  checking across 147/136 files, and `mise run build-playground` with 1,914 modules
  transformed and a 425.05 kB JavaScript / 27.83 kB CSS production output before
  compression.
- A live desktop mouse drag moved `interactive-task-1` within its lane and produced
  one request containing `baseRevision`, `operationId`, and one
  `task.schedule.updated` change. It showed ISO dates from
  `2026-07-29/2026-08-02` to `2026-08-02/2026-08-06` with no proposal, pointer,
  lifecycle, or patch fields.
- The accessible snapshot retained the labelled persistence region, clear action,
  labelled read-only log, committed task state, and move announcement.
- Desktop 1,440 × 900 and narrow 560 × 900 checks had no page-level horizontal
  overflow; the log measured 1,309.81 pixels and 517 pixels wide respectively, and
  the console contained no warnings or errors.
- The initial full gate passed 60 test files / 293 tests before final review found the
  full-task schedule-mode omission.
- After the correction and focused create-payload coverage, final `mise run ci`
  passed 60 test files / 294 tests, formatting across 147 files, lint/type checking
  across 136 files, and the four-file package build. The package emitted 330.81 kB
  JavaScript, 20.78 kB CSS, and 41.13 kB declarations before compression.
- Final `mise run build-playground` transformed 1,914 modules and emitted 425.25 kB
  JavaScript / 27.83 kB CSS before compression. All pre- and post-gate
  `git diff --check` runs passed.

## Next Slice

This correction is complete. Execute Appendix Slice A1 in
[`2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md`](2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md):
freeze the canonical appearance, description, and progress contract before changing
the model or renderer.
