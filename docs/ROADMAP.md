# Gantempo Roadmap

Status: Active execution roadmap
Last updated: 2026-07-30

## Purpose

This document is the execution-level bridge between
[`ARCHITECTURE.md`](ARCHITECTURE.md) and the detailed working plans under
[`docs/plans/`](plans/).

It answers:

- what has been completed;
- what is active or next;
- which milestones depend on which foundations;
- what proves each milestone complete;
- which detailed plan owns the current implementation work.

It does not redefine the target architecture or contain file-level implementation
checklists. Architecture decisions belong in `ARCHITECTURE.md` or a focused decision
record. Detailed tasks, findings, verification commands, and handoff notes belong in
the active plan.

## Status Legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Done and verified

Only verified work may be marked done.

## Current Baseline

The first real read-only chart path is complete:

- task, lane, and placement records remain separate;
- epoch-millisecond schedules flow through a pure linear scale and scene builder;
- a responsive DOM/SVG renderer consumes semantic primitives;
- the main and matrix playground routes use the real component;
- compact, dark, high-contrast, multiple-entry, clipped, and empty cases are covered;
- package, test, build, responsive visual, and accessibility checks pass.

Completion evidence and implementation findings are recorded in
[`2026-07-30-simplest-chart-primitives-plan.md`](plans/2026-07-30-simplest-chart-primitives-plan.md).

This baseline is a deliberately narrow vertical subset of architecture Slice 2. It
uses only the minimum model contracts required by rendering and does not yet provide
the command, patch, history, resolved-view, or viewport foundations required by later
interaction and scheduling work.

The M1 document kernel is also complete:

- unknown wire input passes through one schema-version-1 parse boundary;
- IDs, instant/all-day dates, collections, JSON extensions, and records normalize to
  one canonical React-free model;
- structured diagnostics preserve unrelated valid records across recoverable failures;
- referential validation and deterministic primary/relationship indexes are verified;
- stable serialization and the full six-domain round trip are byte-idempotent;
- the existing scene, React package, and responsive playground consume the same model.

Detailed completion evidence is recorded in
[`2026-07-30-document-kernel-foundation-plan.md`](plans/2026-07-30-document-kernel-foundation-plan.md).

## Milestone Map

| Milestone | Architecture mapping | Outcome | Status | Detailed plan |
| --- | --- | --- | --- | --- |
| M0: Read-only chart primitives | First vertical subset of Slice 2 | Real time-based lanes and task bars render through one public React path | `[x]` | [Completed plan](plans/2026-07-30-simplest-chart-primitives-plan.md) |
| M1: Document kernel | Slice 1 foundation | Canonical records can be normalized, validated, indexed, migrated, and serialized without React | `[x]` | [Completed plan](plans/2026-07-30-document-kernel-foundation-plan.md) |
| M2: Change kernel | Remainder of Slice 1 | Typed commands produce deterministic patches, inverse patches, transactions, and local history | `[-]` In progress | [Active plan](plans/2026-07-30-change-kernel-plan.md) |
| M3: View, layout, and viewport kernel | Remainder of Slice 2 | Resolved views, overlap stacking, variable lane heights, and two-dimensional viewport queries feed render primitives | `[ ]` | Not yet created |
| M4: Interaction runtime and public API | Slice 3 | Controlled and uncontrolled applications use the same command path as pointer, touch, and keyboard interaction | `[ ]` | Not yet created |
| M5: Basic project Gantt | Slice 4 | Hierarchy, summaries, milestones, dependencies, zoom, filtering, localization, and SSR form a complete free Gantt | `[ ]` | Not yet created |
| M6: Advanced scheduling and resources | Slice 5 | Calendars, constraints, resource planning, explainable scheduling, workers, and Pro capabilities compose with the same model | `[ ]` | Not yet created |
| M7: Hardening and release | Slice 6 | Export, benchmarks, compatibility, accessibility conformance, examples, and release artifacts are reproducible | `[ ]` | Not yet created |

## Dependency Order

```text
M0 read-only vertical slice [done]
  |
  v
M1 document kernel [done]
  |
  v
M2 change kernel [in progress]
  |
  v
M3 view/layout/viewport kernel
  |
  v
M4 interaction runtime
  |
  v
M5 basic project Gantt
  |
  v
M6 advanced scheduling/resources
  |
  v
M7 hardening/release
```

The completed M0 vertical slice proves the renderer direction, and M1 supplies the
canonical document boundary. M2 is finishing architecture Slice 1 with the pure
change path before interaction or a broader public React API begins.

## Current Focus

### M2: Change kernel

**Status:** `[-]` In progress

**Target outcome**

Create a framework-independent mutation boundary in which typed commands strictly
validate their intent, reduce to deterministic domain patches and ready-to-apply
inverse patches, commit transactions atomically, and drive bounded local undo/redo.

**Minimum capabilities**

- one versioned ID-keyed domain patch representation;
- collection-qualified affected entity references;
- strict non-repairing command and final-document validation;
- typed add/update/set/move/delete commands spanning all six M1 domains;
- exact forward and inverse patch generation;
- deterministic relationship-aware task deletion and assignment cleanup;
- ordered nested transactions with all-or-nothing rejection;
- immutable bounded local history;
- seeded patch-inversion and history property tests;
- a deliberately small React-free package surface.

**Exit condition**

A React-free test can apply typed commands and transactions across tasks, resources,
lanes, assignments, placements, and dependencies; prove that emitted patches reproduce
the returned document; apply inverse patches to restore byte-identical stable JSON;
and undo and redo committed transactions as one bounded history step. Invalid commands,
patches, or transaction children return structured diagnostics and retain the original
document without partial changes. The existing codec, scene, React component, and
playground remain unchanged and all repository gates pass.

**Planning and contract evidence**

- The [active M2 plan](plans/2026-07-30-change-kernel-plan.md) orders patch,
  command, deletion, transaction, history, facade, and final-evidence slices.
- The accepted
  [change-kernel contract](decisions/2026-07-30-change-kernel-contract.md) selects one
  versioned ID-keyed domain patch format, rejects a dual JSON Patch core, defines
  strict command validation and atomic transactions, and keeps revision ownership
  outside the local engine.
- M1 permits cross-family ID reuse, so the original raw affected-ID sketch is replaced
  by deterministic collection-qualified entity references.
- Slice 2 provides the atomic six-collection patch interpreter, strict final-state
  integrity check, ready-to-apply inverses, and fixed-seed property evidence.
- Slice 3 provides strict typed add/update/set/move commands across all six domains,
  sharing M1 record normalization without changing codec recovery behavior.
- Slice 4 adds fail-closed referential deletion, deterministic task cascade, placement
  assignment clearing, and exact restoration across relationship-heavy removals.
- Slice 5 composes the full command set into ordered nested all-or-nothing
  transactions with stable child diagnostics and one flattened outcome.
- Slice 6 adds explicit-capacity immutable local history over committed patch pairs,
  with fail-closed stale undo/redo and generated undo-all/redo-all evidence.

**Next action**

Complete Slice 7's intentional package facade, README contract, packed artifact
inspection, and final M2 automated evidence.

## Later Milestone Outcomes

### M3: View, layout, and viewport kernel

- Separate persisted and derived placements.
- Resolve project, resource, and application-defined lane views.
- Apply deterministic filtering, sorting, and lane flattening.
- Stack overlapping entries and return variable effective lane heights.
- Add vertical prefix sums and horizontal interval intersection.
- Emit only viewport-relevant primitives while preserving stable identity.

### M4: Interaction runtime and public API

- Separate document, session, and derived runtime state.
- Add selection, focus, drag preview, viewport, and editor session state.
- Support controlled and uncontrolled React ownership.
- Route pointer, touch, keyboard, toolbar, and imperative operations through commands.
- Add interception, subscriptions, component handles, and accessible announcements.

### M5: Basic project Gantt

- Add task hierarchy, summaries, and milestones.
- Add dependency graph validation, paths, and editing.
- Add zoom, adaptive ticks, filtering, sorting, localization, RTL, and SSR examples.
- Complete the basic free-edition product boundary.

### M6: Advanced scheduling and resources

- Add explicit working calendars and time-zone-aware working arithmetic.
- Add explainable automatic scheduling and constraint stages.
- Add resource assignments, capacity, workload, critical path, and baselines.
- Prove synchronous and worker execution parity.
- Install advanced behavior through capabilities rather than React conditionals.
- Follow the accepted package, compatibility, and activation boundaries in the
  [Community and Pro distribution plan](plans/2026-07-30-community-pro-distribution-licensing-plan.md).

### M7: Hardening and release

- Add versioned performance benchmarks and regression thresholds.
- Complete accessibility and compatibility matrices.
- Add export/import capabilities and public examples.
- Add API reports, migration guidance, synchronized Community/Pro release automation,
  public npm provenance, and verified license boundaries.
- Complete the publishing and entitlement-continuity slices in the
  [Community and Pro distribution plan](plans/2026-07-30-community-pro-distribution-licensing-plan.md).

## Cross-Milestone Rules

- Preserve task, resource, assignment, lane, placement, and segment separation.
- Persistent state remains serializable plain data.
- Commands mutate; queries derive.
- Pure engines do not import React, DOM types, browser globals, or playground code.
- Renderers consume semantic primitives and do not interpret scheduling rules.
- Keep public exports deliberately small; internal contracts stay private until a
  second consumer proves they should be public or experimental.
- Do not split workspace packages until the internal boundaries are proven by real
  consumers.
- Keep Community as the sole component, model, codec, and command authority; Pro is
  installed additively through capabilities.
- Release one public Community package and one public Pro package at the same version.
- Preserve offline, domain-independent, non-destructive commercial entitlement:
  previously entitled versions keep running when their update window closes.
- Do not begin interaction work before the document and change kernels are verified.
- Do not claim performance, accessibility, compatibility, or scheduling behavior
  without evidence at the scope of the claim.
- Every repository change and every discovered deviation must be recorded in the
  active detailed plan and reflected in this roadmap in the same change set.

## Decision Queue

Decisions remain open until a focused prototype or decision record resolves them.
The document wire-format decisions resolved for M1 are recorded in the
[document codec contract](decisions/2026-07-30-document-codec-contract.md). The M2
patch, affected-reference, strict-validation, transaction, revision, and local-history
decisions are recorded in the
[change-kernel contract](decisions/2026-07-30-change-kernel-contract.md).
The repository, package, activation, release, deployment, and update-entitlement
decisions for Community and Pro are recorded in the
[Community and Pro distribution and licensing decision](decisions/2026-07-30-community-pro-distribution-licensing.md).

1. The threshold for splitting internal modules into workspace packages.
2. The measured threshold for revisiting the M1 internal codec in favor of a runtime
   schema dependency.

Decision records should live under `docs/decisions/` when their consequences cross
more than one implementation plan.

## Roadmap Change Log

### 2026-07-30 — M2 Slice 6 bounded local history

- Added explicit-capacity immutable history state with commit, undo, redo, and clear
  operations over committed patch and inverse pairs.
- Only non-empty committed outcomes enter history; transactions are one step, oldest
  entries trim deterministically, and a new branch clears redo state.
- Undo and redo reuse atomic patch application. Stale application rejects without
  changing the present document or either history stack.
- Capacity, branching, grouped transactions, extension data, cross-family identity,
  assignment cleanup, cascade restoration, and input immutability are covered.
- The history property ran 100 examples with seed `20260733`. Focused verification
  passed 2 files and 10 tests; `vp check` passed 60 formatted and 49 lint/type-checked
  files with no warnings or errors.
- Selected the intentional facade, README contract, packed inspection, and final M2
  gate as Slice 7.

### 2026-07-30 — M2 Slice 5 atomic transactions

- Added ordered recursive transactions by composing children through the single
  command reducer and atomic patch interpreter.
- Forward patches flatten in encounter order, inverse child groups reverse, and
  affected references retain deterministic first-touch ordering.
- First, middle, last, and nested child failures retain the original document and
  expose stable transaction-indexed diagnostic paths with empty change arrays.
- Empty and semantically unchanged transactions collapse to identity-preserving
  committed no-ops; cross-command references and cascade/recreate flows commit as one
  outcome.
- The transaction property ran 150 examples with seed `20260732`. Focused verification
  passed 2 files and 8 tests; `vp check` passed 57 formatted and 46 lint/type-checked
  files with no warnings or errors.
- Selected bounded immutable local history as Slice 6.

### 2026-07-30 — M2 Slice 4 referential deletion

- Added task, assignment, placement, and dependency deletion through the single
  command and atomic patch authorities.
- Task deletion rejects dependent state by default and `cascade: true` removes the
  visited subtree plus owned or incident relationships in canonical document order.
- Assignment deletion preserves placements by replacing them without the optional
  assignment reference; direct inverses restore exact order and bytes.
- Cross-family same-ID examples, cyclic malformed ancestry termination, untouched
  identity, and generated wide/deep tree inversion are covered.
- The cascade property ran 150 examples with seed `20260731`. Focused verification
  passed 3 files and 9 tests; `vp check` passed 55 formatted and 44 lint/type-checked
  files with no warnings or errors.
- Selected ordered atomic transactions as Slice 5.

### 2026-07-30 — M2 Slice 3 typed non-delete commands

- Added typed ergonomic task, resource, lane, assignment, placement, and dependency
  commands with canonical string update targets and explicit `null` clears.
- Shared the existing M1 record decoders through a private record-normalization entry
  point while leaving document recovery diagnostics and source paths unchanged.
- Commands reject unknown fields, malformed values, immutable IDs, duplicate or
  missing targets, and strict reference failures without exposing partial candidates.
- Reducer patches replay the returned document and inverses restore stable bytes;
  deterministic no-ops retain the document by identity and mutable payloads are not
  retained.
- Focused verification passed 5 files and 25 tests. `vp check` passed formatting for
  53 files and lint/type checking for 42 files with no warnings or errors.
- Selected referential deletion and deterministic task cascade as Slice 4.

### 2026-07-30 — M2 Slice 2 atomic domain patches

- Added one versioned collection-plus-ID patch interpreter for add, replace, and
  remove across all six canonical collections.
- Atomic final-state integrity validation rejects malformed, stale, duplicate, or
  referentially invalid batches while retaining the original document by identity.
- Ready-to-apply inverses restore byte-identical stable serialization and preserve
  collection order, revision, metadata, and untouched identities.
- Added exact development dependency `fast-check@4.9.0`; the inversion property ran
  200 examples with seed `20260730` and replay seed/path reporting on failure.
- Focused verification passed 3 files and 5 tests. `vp check` passed formatting for
  50 files and lint/type checking for 39 files with no warnings or errors.
- Selected typed non-delete command normalization and reduction as Slice 3.

### 2026-07-30 — Community and Pro distribution contract

- Accepted the
  [Community and Pro distribution and licensing decision](decisions/2026-07-30-community-pro-distribution-licensing.md):
  one public mixed-license monorepo, MIT Community plus one additive commercial Pro
  npm package, synchronized versions, strict compatibility, and signed offline
  activation.
- Fixed commercial entitlement to package release dates: entitled versions continue
  to build and run after the update window closes, while later releases and support
  require renewal.
- Rejected launch-time private-registry credentials, production call-home, deployment
  binding, a replacement Pro component, and separately purchased Pro modules.
- Added the
  [cross-milestone implementation plan](plans/2026-07-30-community-pro-distribution-licensing-plan.md)
  for package licensing, activation, additive Pro packaging, synchronized publishing,
  and entitlement-continuity evidence.
- Documentation verification passed `vp check` across 44 formatted and 33
  lint/type-checked files, `git diff --check`, explicit linked-file existence checks,
  and focused four-document contract searches.
- This documentation-only decision does not change M2 status, implementation scope,
  runtime behavior, package contents, dependencies, or the current next action.

### 2026-07-30 — M2 plan and change-kernel contract

- Created and activated the
  [M2 implementation plan](plans/2026-07-30-change-kernel-plan.md), splitting the
  milestone into patch, command, deletion, transaction, history, facade, and
  final-evidence slices.
- Accepted the
  [change-kernel contract](decisions/2026-07-30-change-kernel-contract.md): one
  versioned ID-keyed domain patch format, ready-to-apply inverse patches, strict
  non-repairing command validation, ordered atomic transactions, revision-preserving
  local changes, and bounded immutable history.
- Replaced the architecture sketch's raw affected-ID list with collection-qualified
  entity references because M1 permits the same ID in multiple entity families.
- Moved M2 to in progress and selected the atomic patch interpreter plus seeded
  inversion properties as the next runtime slice.
- Slice 1 verification passed with `git diff --check`, linked-file existence checks,
  and a focused architecture/decision/plan/roadmap consistency read.
- This planning slice changes documentation only; no M2 runtime, dependency, test,
  package, or browser behavior is yet verified.

### 2026-07-30 — M1 Slice 7 milestone completion

- Documented the public wire-versus-normalized parse/serialize flow in `README.md`.
- `mise run ci` passed clean format/lint/type checking, 10 test files and 57 tests,
  and the package build; `mise run build-playground` transformed 32 modules
  successfully.
- Chrome DevTools `list_pages` timed out, so the plan-authorized built-in Browser
  fallback performed a connected inspection of `/` and `/matrix` at all three
  required viewports.
- The browser gate found aligned headers/lanes/timelines, no horizontal page overflow,
  zero unexpected diagnostics, unchanged entity identities, complete accessible
  regions/groups/task names, empty console logs, and correct light/dark/high-contrast,
  overlap, clipped, compact, and empty scenarios. Both routes and both observed Vite
  assets returned HTTP `200`.
- `git diff --check`, explicit existence checks for architecture, roadmap, completed
  plan, decision record, and README, and the focused cross-document completion/link
  read all passed.
- Marked M1 complete only after final evidence and selected M2 planning as the next
  action.

### 2026-07-30 — M1 Slice 6 scene convergence

- Converged scene construction on the model validator and one `DocumentIndexes`
  instance, leaving only genuinely render-specific schedule diagnostics in the
  renderer.
- Removed the temporary M0 record index/diagnostic helpers and
  `RenderDiagnostic` compatibility alias.
- Exported the intentional parser, serializer, result, normalized model, JSON, and
  diagnostic contracts while keeping migrations, validation, indexing, and scene
  internals private in the packed declaration.
- Render/facade tests passed 11 tests, `vp check` passed cleanly, `vp pack` produced
  the package artifacts, and `vp build apps/playground` built 32 modules successfully.
- Selected documentation and the final automated/browser evidence gate as the next
  slice.

### 2026-07-30 — M1 Slice 5 stable serialization

- Added deterministic current-schema serialization with fixed known-key order,
  preserved domain arrays, recursively lexical extension keys, and defensive
  non-JSON rejection.
- Added the React-free full-domain
  `parse -> validate -> index -> serialize -> parse -> validate -> index` proof,
  including numeric IDs, negative epochs, instant/all-day schedules, task segments,
  Unicode, nested metadata, and every M1 relationship family.
- The serializer suite passed 8 tests, the round-trip suite passed its end-to-end
  test, and `vp check` passed repository formatting, lint, and type checking with no
  warnings after focused formatting and one literal-schema lint correction.
- Selected scene and public-facade convergence as the next slice.

### 2026-07-30 — M1 Slice 4 integrity and indexes

- Added source-path-preserving referential validation. Invalid primary parent/resource
  links are cleared while invalid assignments, placements, and dependencies are
  omitted without removing unrelated valid records.
- Added deterministic primary, hierarchy, segment, assignment, placement, and
  dependency indexes that derive lookup state without filtering or diagnostics.
- Validation and index suites each passed 4 tests, the upstream 16-test codec suite
  remained green, and `vp check` passed repository formatting, lint, and type
  checking after formatting the changed model files.
- Selected stable serialization and the full-domain round trip as the next slice.

### 2026-07-30 — M1 Slice 3 wire codec

- Added fatal root/schema inspection and the explicit empty ordered migration registry
  for the first published schema.
- Added the schema-version-1 decoder with numeric/string ID normalization,
  explicit-offset instant parsing, strict all-day dates, JSON extension cloning,
  canonical defaults, unknown-property warnings, first-seen duplicate recovery, and
  path-aware diagnostics.
- Codec tests passed 16 cases, migration tests passed 9 cases, and `vp check` passed
  formatting, lint, and type checking across the repository after formatting the two
  new codec files.
- Selected referential integrity and stable full-document indexes as the next slice.

### 2026-07-30 — M1 Slice 2 normalized model

- Added the model-owned structured diagnostic contract and JSON-compatible value
  types.
- Expanded the normalized document to tasks, resources, lanes, assignments,
  placements, dependencies, and task segments with required readonly collection
  arrays.
- Adapted the existing renderer and public facade to the general diagnostics and
  normalized types without changing scene output; the render diagnostic name remains
  a temporary compatibility alias until Slice 6.
- Focused model/facade tests passed with 7 tests, and `vp check` passed formatting,
  lint, and type checking across the repository.
- Selected the versioned wire codec and scalar normalization as the next slice.

### 2026-07-30 — M1 Slice 1 codec contract

- Accepted the
  [document codec contract](decisions/2026-07-30-document-codec-contract.md), choosing
  a small internal schema-version-1 codec without a runtime dependency.
- Fixed wire ID/date rules, fatal and recoverable boundaries, unknown and duplicate
  handling, the empty initial migration registry, public parse/serialize shape, and
  stable JSON ordering.
- Moved M1 to in progress and selected normalized diagnostics and record contracts as
  the next slice.
- Verification passed with `git diff --check`, explicit existence checks for the four
  linked documents, and a focused cross-document codec/next-slice consistency read.
- No runtime behavior changed in this slice.

### 2026-07-30 — Commit-message convention

- Named Conventional Commits as the repository commit-message convention and
  required it for every commit in `AGENTS.md`.
- This policy change is owned by Slice 3 of
  [`2026-07-30-roadmap-documentation-governance-plan.md`](plans/2026-07-30-roadmap-documentation-governance-plan.md).
- Verification passed with `git diff --check`, a focused cross-document policy
  search, and inspection of recent commit subjects.
- No milestone order, product scope, or architecture contract changes.

### 2026-07-30 — M1 document-kernel plan

- Created the detailed M1 implementation plan and linked it as the active plan.
- Split the milestone into decision, model/diagnostic, codec/migration,
  integrity/index, serialization/round-trip, renderer-convergence, and final-evidence
  slices.
- Kept M1 at `[ ]` because planning did not implement or verify runtime behavior.
- Selected the codec contract and decision record as the actionable first slice.
- Planning validation passed with `git diff --check`, explicit linked-file existence
  checks, and focused roadmap/plan status and final-gate consistency checks.

### 2026-07-30 — Initial roadmap

- Recorded the completed read-only chart primitives baseline as M0.
- Mapped architecture Slices 1–6 into smaller execution milestones M1–M7.
- Selected the document kernel as the immediate next milestone.
- Recorded the rule that every repository change and deviation updates both its
  active plan and this roadmap.
- This governance change is owned by
  [`2026-07-30-roadmap-documentation-governance-plan.md`](plans/2026-07-30-roadmap-documentation-governance-plan.md).
- Governance verification passed with `git diff --check`, explicit linked-file
  existence checks, and a cross-document ownership/synchronization consistency check.
