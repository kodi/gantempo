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
the document codec, command, patch, history, resolved-view, or viewport foundations
required by later interaction and scheduling work.

## Milestone Map

| Milestone | Architecture mapping | Outcome | Status | Detailed plan |
| --- | --- | --- | --- | --- |
| M0: Read-only chart primitives | First vertical subset of Slice 2 | Real time-based lanes and task bars render through one public React path | `[x]` | [Completed plan](plans/2026-07-30-simplest-chart-primitives-plan.md) |
| M1: Document kernel | Slice 1 foundation | Canonical records can be normalized, validated, indexed, migrated, and serialized without React | `[ ]` Next | [Active plan](plans/2026-07-30-document-kernel-foundation-plan.md) |
| M2: Change kernel | Remainder of Slice 1 | Typed commands produce deterministic patches, inverse patches, transactions, and local history | `[ ]` | Not yet created |
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
M1 document kernel
  |
  v
M2 change kernel
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

The completed M0 vertical slice proves the renderer direction. The immediate task is
to return to the skipped architecture Slice 1 foundations before adding interaction
or broadening the public React API.

## Current Focus

### M1: Document kernel

**Status:** `[-]` In progress

**Target outcome**

Create a framework-independent canonical document boundary that accepts external data,
reports actionable diagnostics, preserves domain separation, and produces stable data
for commands, queries, layout, persistence, workers, and SSR.

**Minimum capabilities**

- a general diagnostic contract below model and renderer layers;
- canonical records for tasks, lanes, placements, resources, assignments, and
  dependencies;
- distinct wire/input and normalized document contracts;
- schema-version validation and migration boundaries;
- ID and date normalization;
- referential-integrity validation;
- stable document indexes;
- deterministic JSON serialization and round trips;
- adaptation of the existing scene pipeline to consume normalized or resolved data
  without widening the public scene API.

**Exit condition**

A React-free test can parse a representative document containing tasks, resources,
lanes, assignments, placements, and dependencies; normalize and validate it; build
stable indexes; serialize it; parse it again; and prove that no domain meaning or
identity was lost. Invalid input returns structured diagnostics without silently
discarding unrelated valid data. The existing read-only playground remains unchanged
and all repository gates pass.

**Next action**

Execute Slice 7 of
[`2026-07-30-document-kernel-foundation-plan.md`](plans/2026-07-30-document-kernel-foundation-plan.md):
document the public boundary, run the final automated and browser regression gates,
and record complete M1 milestone evidence.

## Later Milestone Outcomes

### M2: Change kernel

- Define the typed command lifecycle and validation boundary.
- Choose and record the patch representation.
- Produce patches, inverse patches, affected IDs, and structured diagnostics.
- Make transactions atomic and deterministic.
- Provide local undo/redo with patch-inversion property tests.
- Keep the entire engine independent of React and the DOM.

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

### M7: Hardening and release

- Add versioned performance benchmarks and regression thresholds.
- Complete accessibility and compatibility matrices.
- Add export/import capabilities and public examples.
- Add API reports, migration guidance, release automation, and license boundaries.

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
- Do not begin interaction work before the document and change kernels are verified.
- Do not claim performance, accessibility, compatibility, or scheduling behavior
  without evidence at the scope of the claim.
- Every repository change and every discovered deviation must be recorded in the
  active detailed plan and reflected in this roadmap in the same change set.

## Decision Queue

Decisions remain open until a focused prototype or decision record resolves them.
The document wire-format decisions resolved for M1 are recorded in the
[document codec contract](decisions/2026-07-30-document-codec-contract.md).

1. ID-keyed domain patches, JSON Patch, or an adapter supporting both.
2. The threshold for splitting internal modules into workspace packages.
3. The measured threshold for revisiting the M1 internal codec in favor of a runtime
   schema dependency.

Decision records should live under `docs/decisions/` when their consequences cross
more than one implementation plan.

## Roadmap Change Log

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
