# Zod Runtime Schema Migration Plan

Status: Complete; all slices verified
Date: 2026-07-30
Milestone: Cross-cutting M1/M2 document-kernel hardening

## Summary

Replace the duplicated hand-written structural validation in the Gantempo document
codec and command integrity path with private Zod 4 Mini schemas while preserving the
published schema-version-1 persistence contract exactly.

This is a parity migration, not a document-format redesign. Zod will become the
authoritative implementation for scalar, schedule, record-shape, defaulting, and
canonical-record validation. Gantempo code will continue to own version migration,
partial recovery, stable diagnostics, unknown-property warnings, duplicate policy,
cross-record integrity, immutability, and deterministic serialization.

The migration should finish before another persisted entity family, schema version,
or external document codec expands the current validation surface.

## Target State

At the end of this plan:

- `@gantempo/gantt` has one private executable structural schema definition for each
  supported scalar, schedule, segment, and record family;
- ergonomic wire input and strict canonical runtime data remain distinct schema
  contracts;
- `parseGanttDocument(input: unknown)` retains its current public signature,
  normalization, recovery, diagnostic, ordering, and immutability behavior;
- command and patch validation reuse the same canonical record schemas instead of
  restating keys, required fields, schedules, durations, and scalar rules;
- public TypeScript document types are compile-time proven equivalent to the canonical
  Zod outputs;
- schema-version migration, record-level recovery, duplicate handling, relationship
  validation, and deterministic serialization remain explicit Gantempo orchestration;
- Zod schemas and Zod-specific issue types remain private implementation details;
- ordinary documents validate comfortably at load and external-update boundaries, and
  a fixed-seed 10,000-task/2,000-lane benchmark records the migration cost;
- the package build, a real consumer bundle, Node/SSR import, and the playground prove
  that the runtime dependency is packaged correctly.

## Decisions

### Adopt Zod 4 Mini as a direct runtime dependency

Use the Zod 4 Mini API through `zod/mini`. Select and record the exact Zod 4 release
at implementation time and let the workspace lockfile pin it. Add Zod to
`packages/gantt/package.json` as a direct dependency, not a peer dependency:

- consumers should not need to install or configure Zod themselves;
- schemas are private and consumers do not pass Zod objects across the public API;
- the current Vite+ package configuration uses `deps.neverBundle: true`, so package
  output will reference Zod rather than embed it;
- consumer-bundle verification must therefore measure an application that imports
  `@gantempo/gantt`, not only the library `dist` directory.

Regular Zod 4 is not a fallback selected casually. If Mini lacks a required public API
or makes the final schema implementation materially less maintainable, record the
specific limitation and measured bundle difference in this plan and revise the codec
decision before switching imports.

### Preserve the public codec and persistence contract

The following public boundary remains unchanged:

```ts
interface ParseDocumentResult {
  readonly document?: GanttDocument;
  readonly diagnostics: readonly Diagnostic[];
  readonly sourceSchemaVersion?: number;
}

function parseGanttDocument(input: unknown): ParseDocumentResult;
function serializeGanttDocument(document: GanttDocument): string;
```

Schema version `1` remains the only current and emitted wire schema. This plan does not
add a migration predecessor, schema version `2`, a JSON Schema export, a second parser,
or a Zod-based public API.

### Use Zod for structure, not document-graph policy

Zod owns:

- plain scalar and enum validation;
- numeric/string wire ID normalization to canonical string IDs;
- instant and local-date validation and normalization;
- schedule and duration object shapes;
- record field shapes, required/optional fields, and canonical defaults;
- strict canonical record validation;
- path-bearing structural issues;
- inferred internal wire/canonical types used for compile-time parity checks.

Gantempo continues to own:

- root schema-version inspection and ordered migrations;
- fatal versus recoverable boundary decisions;
- parsing each collection and record independently;
- task-segment recovery that omits one bad segment without omitting its task;
- unknown-property warnings and ignored-property behavior;
- stable diagnostic codes, severities, details, entity IDs, and JSON Pointer-like
  paths;
- first-normalized-ID-wins duplicate behavior;
- parent clearing and relationship-record omission;
- cycle-safe, dense, plain-object JSON extension cloning;
- freezing records, arrays, diagnostics, and results;
- deterministic serialization and known-key order.

### Keep public types deliberate during the migration

Do not immediately replace exported interfaces in `model/types.ts` with direct
`z.infer` aliases. Keep the readable public declarations during the parity migration
and add compile-time bidirectional assignability assertions between each canonical
schema output and its public type.

Only remove or derive a public declaration in a later slice if generated declarations,
API readability, readonly semantics, and exact optional-property behavior remain
clear. Zod must not leak into `dist/index.d.ts`.

### Keep serialization purpose-built

Do not replace `serializeGanttDocument` with `JSON.stringify`, Zod encoding, or schema
serialization. The current serializer owns stable known-field order, lexically sorted
extension keys, canonical-value checks, and byte-identical repeated serialization.
Canonical schemas may replace duplicated shape predicates used before serialization,
but they do not replace serialization itself.

## Scope

### In scope

- A direct Zod 4 runtime dependency.
- Private wire and canonical schemas for:
  - IDs, strings, finite numbers, enums, revision values, and JSON extension values;
  - instant and all-day schedules;
  - durations;
  - task segments;
  - tasks;
  - resources;
  - lanes;
  - assignments;
  - placements;
  - dependencies.
- A stable adapter from Zod issues to existing Gantempo diagnostics.
- Reusing canonical schemas in command and patch integrity validation.
- Removing superseded hand-written scalar, object-shape, required-key, enum, schedule,
  and duration checks after parity is proven.
- Compile-time canonical-schema/public-type equivalence tests.
- Codec performance and consumer bundle measurements.
- Updating the codec decision, architecture, roadmap, and this plan as implementation
  evidence is recorded.

### Out of scope

- Any change to accepted or emitted schema-version-1 JSON.
- Schema version `2` or a synthetic schema version `0`.
- Calendars, baselines, constraints, or other new persisted entity families.
- New interchange formats or remote/query codecs.
- Public export of Zod schemas, Zod types, JSON Schema, OpenAPI, or form schemas.
- Replacing deterministic serialization.
- Replacing cross-record reference validation with schema refinements.
- Moving scheduling, layout, renderer, runtime-session, or interaction rules into
  document schemas.
- Validating on every render, viewport query, pointer move, or animation frame.
- Broad command, runtime, React, or packaging refactors unrelated to schema ownership.

## Current State

### Existing trust and integrity boundaries

- `packages/gantt/src/model/migrations.ts` validates the plain-object root and
  `schemaVersion`, then runs the ordered migration registry before current-schema
  decoding.
- `packages/gantt/src/model/codec.ts` is an approximately 1,100-line purpose-built
  decoder. It owns scalar checks, schedules, durations, extension values, record
  objects, collection recovery, defaults, unknown-property warnings, duplicate
  handling, source paths, freezing, and orchestration.
- `packages/gantt/src/model/validate.ts` applies post-decode relationship recovery.
- `packages/gantt/src/model/serialize.ts` is the deterministic canonical serializer.
- `packages/gantt/src/model/types.ts` declares the canonical public document and
  record types.
- `packages/gantt/src/commands/normalize.ts` reuses codec record normalization for
  command input.
- `packages/gantt/src/commands/validate.ts` separately restates canonical record keys,
  required keys, plain-object rules, schedules, durations, duplicate checks, and
  relationship integrity for strict command/patch validation.
- `packages/gantt/src/runtime/store.ts` serializes and reparses supplied canonical
  documents at the runtime boundary, rejecting a document if canonical cloning
  produces errors.

### Measured duplication to remove

The public types, wire decoder, strict command validator, and serializer independently
know substantial parts of the same field contract. A field addition can currently
require synchronized edits to:

1. public TypeScript types;
2. codec known-key sets and record decoder logic;
3. command strict-key and required-key tables;
4. canonical shape predicates;
5. serializer field order and value checks;
6. fixtures and tests.

The migration is successful when Zod becomes the single executable source for items
2–4 without weakening the distinct serializer and public-type responsibilities.

### Existing package behavior

`packages/gantt/package.json` currently has no direct runtime dependency. React is a
peer dependency. The root Vite+ pack configuration leaves dependencies external with
`deps.neverBundle: true`, targets neutral ESM/ES2022, and emits declarations.

The repository already has fixed-seed 10,000-task/2,000-lane viewport coverage and a
2,000-task/400-lane scene-pipeline benchmark. The codec migration needs its own
boundary benchmark because layout/query measurements do not isolate parse cost.

No Zod implementation or runtime measurement has been completed by this planning
pass.

## Behavior to Preserve

Treat existing model and command tests plus the accepted document codec decision as
the black-box compatibility oracle.

### Root and version behavior

- Only a non-array plain-object root is accepted.
- `schemaVersion` must be an own positive integer.
- Missing, invalid, newer, or incompletely migratable versions are document-fatal.
- A fatal result leaves `document` absent and preserves the current
  `sourceSchemaVersion` rules.
- Each present collection must be an array; a non-array collection is document-fatal.
- Missing collections default to new frozen empty arrays.

### Scalar and normalization behavior

- IDs accept non-empty strings or finite numbers and normalize numbers with `String`.
- IDs are not trimmed, case-folded, parsed, or otherwise interpreted.
- Instant boundaries accept finite epoch milliseconds or ISO datetimes containing
  `Z` or an explicit numeric offset.
- Offset-free datetime strings and `Date` instances remain invalid.
- All-day values accept calendar-valid `YYYY-MM-DD` strings only.
- Instant and all-day end values cannot precede their starts.
- Zero-length schedules remain valid.
- Progress remains within its existing range; allocations/capacities/heights retain
  their existing numeric constraints.
- Optional fields distinguish absence from an invalid supplied value exactly as they
  do today.
- Canonical defaults, including task `kind` and `segments`, remain unchanged.

### Recovery and diagnostic behavior

- One malformed record is omitted without erasing unrelated valid records.
- One malformed task segment is omitted without erasing its otherwise valid task.
- Every omission, cleared parent, ignored unknown property, duplicate, and invalid
  field retains a stable diagnostic code, severity, source path, entity IDs, and
  structured details where currently supplied.
- Unknown root, record, schedule, segment, and duration properties emit warnings and
  are ignored.
- Zod issue codes, messages, classes, and raw paths never become public diagnostic
  contracts.
- Collection and segment order is preserved.
- The first accepted normalized ID wins; later duplicates are omitted.
- References are validated only after all structural records have been decoded.
- Invalid parent references are cleared; invalid relationship records are omitted.

### JSON extension, immutability, and serialization behavior

- `fields` and `metadata` accept only acyclic JSON-compatible own data consisting of
  `null`, booleans, finite numbers, strings, dense arrays, and plain objects.
- Sparse arrays, cycles, unsupported primitives, accessors with unsupported results,
  and non-plain instances remain invalid rather than coerced.
- Extension object keys are copied in lexical order and caller-owned references are
  not retained.
- Canonical documents, records, segments, collections, diagnostics, and returned
  extension structures retain current freezing behavior.
- All six collections are emitted in current known-key order.
- `parse -> serialize -> parse` preserves canonical equality.
- Repeated serialization remains byte-identical.

### Command and runtime behavior

- Command normalization remains strict: any warning or error from record normalization
  rejects the command record rather than applying codec recovery.
- Patch validation remains non-repairing and atomic.
- Duplicate and graph-integrity failures still reject the candidate final state.
- Runtime document cloning and controlled-document reconciliation preserve current
  identity, revision, diagnostic, and history behavior.
- No schema validation is added to frame-sensitive layout, viewport, hit-test, or
  interaction loops.

## Implementation Shape

### Boundary pipeline

```text
unknown input
  -> Gantempo root and schema-version inspection
  -> Gantempo ordered wire migration
  -> root/collection orchestration
  -> per-record Zod wire parsing and normalization
  -> Gantempo issue-to-diagnostic adapter
  -> Gantempo segment/record recovery and duplicate handling
  -> Gantempo reference validation
  -> frozen canonical GanttDocument
  -> purpose-built deterministic serializer
```

The strict command path uses the canonical side of the same definitions:

```text
command or patch candidate
  -> canonical Zod record validation
  -> Gantempo duplicate and relationship validation
  -> atomic commit or rejection
```

### Proposed private module boundary

Likely new files:

- `packages/gantt/src/model/schema/scalars.ts`
  - ID, string, finite-number, revision, enum, date, and duration primitives;
- `packages/gantt/src/model/schema/json.ts`
  - JSON-compatible extension cloning/checking boundary where Zod is useful, with the
    existing explicit cycle/dense-array/plain-object walk retained where necessary;
- `packages/gantt/src/model/schema/schedules.ts`
  - wire and canonical instant/all-day schedule definitions;
- `packages/gantt/src/model/schema/records.ts`
  - wire and canonical shapes for segments and all six record families;
- `packages/gantt/src/model/schema/issues.ts`
  - private path conversion and stable diagnostic mapping;
- `packages/gantt/src/model/schema/index.ts`
  - private schema registry keyed by document collection.

Exact file grouping may be simplified during Slice 2, but schema modules must remain
under `model/`, React-free, and absent from the package public exports.

### Schema-pair rule

Each domain value should make its input/output distinction visible:

- a wire ID schema accepts `string | number` and outputs `EntityId`;
- a canonical ID schema accepts only a non-empty string;
- a wire instant boundary accepts a number or explicit-offset string and outputs epoch
  milliseconds;
- a canonical instant boundary accepts only a finite number;
- a wire record schema applies supported defaults and normalization;
- a canonical record schema accepts only the complete normalized shape and performs
  no repair or coercion.

Prefer sharing scalar definitions and object shapes over maintaining unrelated wire
and canonical trees. Do not hide behavior in generic coercion helpers whose accepted
input is broader than the document codec decision.

### Unknown-property rule

Do not depend implicitly on Zod's default unknown-key behavior. A private object-schema
factory should receive the object shape once and produce:

- the Zod schema;
- the known-key set used by the Gantempo warning collector;
- the intended strip/reject behavior for the wire or canonical boundary.

This prevents a second manual key list while retaining existing warning codes and
paths. Canonical validation rejects unknown keys; wire parsing warns and ignores them.

### Task-segment recovery rule

Do not parse an entire task, including `segments`, as one indivisible schema if that
would cause one bad segment to reject the task.

Parse the task shell and raw segment collection separately, then run the segment wire
schema per item. Preserve valid segment order, omit malformed/duplicate segments with
their current diagnostics, and construct the final frozen task from the valid shell
and recovered segments.

### Issue-adapter rule

Zod issues are implementation evidence, not public diagnostics. The adapter must:

- prefix a schema-relative issue path with the root collection/record/segment path;
- escape JSON Pointer path components with the current `~0`/`~1` rules;
- classify issues into the existing `value.*` and `record.*` codes using the schema
  boundary and field role, not Zod's prose;
- preserve current entity ID attachment once an ID has normalized successfully;
- preserve current aggregate record/segment omission diagnostics;
- make issue ordering deterministic;
- avoid exposing raw Zod issue objects in `details`.

Add focused adapter tests before switching production decoding.

### Type-equivalence rule

Add private compile-time assertions proving both directions for each canonical output:

```text
Zod canonical output assignable to public record type
public record type assignable to Zod canonical input/output contract
```

Assertions must catch missing fields, accidental optionality, widened enums, mutable
arrays, or a schema output that includes `undefined`. Runtime schemas do not by
themselves prove readonly semantics, so construction/freezing and the public readonly
types remain explicit responsibilities.

## Cross-Slice Rules

1. Preserve the accepted document codec decision unless a limitation is recorded in
   this plan, `docs/ROADMAP.md`, the decision record, and architecture where required.
2. Keep `parseGanttDocument` and `serializeGanttDocument` as the only public document
   codec entry points.
3. Do not export schemas or expose Zod in public declarations.
4. Use existing tests as black-box parity tests; do not rewrite expectations merely to
   accommodate Zod defaults or issue formatting.
5. Add a characterization test before changing behavior that is not already captured.
6. Never replace partial recovery with whole-document `safeParse`.
7. Never replace stable diagnostic codes/messages with raw `ZodError` output.
8. Do not move duplicate or cross-record integrity rules into per-record schemas.
9. Preserve explicit freezing and caller-reference isolation.
10. Keep deterministic serialization independent of Zod.
11. Keep validation out of render and interaction hot paths.
12. Keep any side-by-side legacy/schema implementation private and remove it in the
    next dependent slice; do not leave two production validators indefinitely.
13. Record exact verification and findings in this plan and update
    `docs/ROADMAP.md` in every implementation change set.
14. Do not mix concurrent interaction, renderer, scheduler, licensing, or playground
    feature work into this migration.

## Ordered Implementation Slices

### Slice 1: Update the decision and freeze parity/performance baselines

Status: `[x]` Done

**Goal**

Turn the earlier conditional runtime-schema question into a durable Zod decision and
capture the compatibility and measurement gates before production parsing changes.

**Why here**

The existing codec decision explicitly selected an internal decoder. Repository
governance requires that durable choice to be revised before adding a runtime
dependency, and a measured baseline is needed to judge the migration rather than
reasoning from package metadata.

**This slice should implement**

- Update `docs/decisions/2026-07-30-document-codec-contract.md` to:
  - select Zod 4 Mini as the private structural schema engine;
  - explain that unpacked npm package size is not shipped bundle size;
  - preserve custom migrations, diagnostics, recovery, relationships, and serializer;
  - record the direct-dependency and private-schema decision.
- Update `docs/ARCHITECTURE.md` to resolve the open runtime-schema threshold and state
  the enduring schema/Gantempo responsibility split.
- Update `docs/ROADMAP.md` with this plan, migration status, and the active next slice.
- Expand codec/command characterization tests only where an accepted behavior lacks
  black-box coverage.
- Add a fixed-seed codec benchmark that can run both the current decoder and later Zod
  implementation with:
  - a representative ordinary document;
  - 2,000 tasks/400 lanes;
  - 10,000 tasks/2,000 lanes;
  - valid data;
  - bounded malformed data that exercises issue creation and recovery.
- Record baseline environment, seed, entity counts, input byte size, iteration/warmup
  settings, and timing distributions in this plan.
- Record the current packed artifact sizes and a minimal playground/consumer production
  bundle size before adding Zod.
- Set migration-local performance review budgets from the baseline. Do not create a
  cross-machine CI timing threshold before M7.

**Expected output**

- Revised durable codec decision and architecture.
- Linked roadmap and active plan.
- A reusable codec benchmark and missing characterization tests.
- Recorded current-decoder and consumer-bundle baselines.

**Verification**

- `vp test run packages/gantt/src/model/codec.test.ts packages/gantt/src/model/migrations.test.ts packages/gantt/src/model/validate.test.ts packages/gantt/src/model/serialize.test.ts packages/gantt/src/model/document-round-trip.test.ts packages/gantt/src/commands`
- Run the new codec benchmark with its documented fixed seed and sizes.
- `vp pack`
- `vp build apps/playground`
- `vp check`

**Dependencies**

- Accepted M1 document codec decision.
- Completed M1 codec and M2 strict command validation.

### Slice 2: Add Zod and private scalar/schema foundations

Status: `[x]` Done

**Goal**

Introduce the runtime dependency, private schema modules, issue adapter, and
compile-time type checks without routing production document parsing through Zod yet.

**Why here**

Scalar behavior, unknown-key handling, JSON extension safety, issue translation, and
type equivalence are the riskiest reusable foundations. They should be proven in
isolation before six record decoders change together.

**This slice should implement**

- Add the selected Zod 4 release to `packages/gantt/package.json` dependencies and the
  workspace lockfile.
- Add private schema modules under `packages/gantt/src/model/schema/`.
- Implement and test wire/canonical schemas for:
  - IDs;
  - finite numbers and bounded numeric roles;
  - revision;
  - enums;
  - explicit-offset instants;
  - calendar-valid local dates;
  - durations;
  - instant/all-day schedules.
- Implement the object-shape/known-key factory so one shape definition powers both
  structural parsing and unknown-key collection.
- Retain an explicit guarded JSON-value walk where needed to preserve cycle detection,
  sparse-array rejection, plain-object enforcement, lexical copying, and safe path
  reporting; wrap it in the schema boundary without relying on recursive Zod parsing
  for cyclic inputs.
- Implement the private Zod issue adapter and deterministic path conversion.
- Add bidirectional compile-time assertions between canonical schema outputs and
  public scalar/schedule/duration types.
- Keep the existing codec as the only production parser in this slice.
- Record actual Mini API findings, dependency resolution, schema test counts, and any
  deviation in this plan and the roadmap.

**Expected output**

- Zod installed as a correct direct runtime dependency.
- Tested private scalar, schedule, JSON, and issue-adapter foundations.
- No public API or production parse-path change.
- A short-lived side-by-side implementation ready for record integration.

**Verification**

- Focused schema and issue-adapter tests.
- Existing model and command test suites.
- `vp check`
- `vp pack`
- Inspect generated `dist/index.d.ts` and JavaScript imports to confirm schemas are
  private and Zod resolves as the intended external dependency.
- Build the playground/consumer to prove downstream Zod resolution.

**Dependencies**

- Slice 1 baselines and accepted Zod decision.

### Slice 3: Move wire record normalization into Zod schemas

Status: `[x]` Done

**Goal**

Make Zod the production structural engine for task segments and all six record
families while retaining the existing document orchestration and recovery contract.

**Why here**

The shared scalar/issue behavior is already isolated and tested. Record integration
can now focus on field composition, defaults, warning behavior, and recovery rather
than rediscovering foundational semantics.

**This slice should implement**

- Define wire and canonical schema pairs for:
  - task segments;
  - tasks;
  - resources;
  - lanes;
  - assignments;
  - placements;
  - dependencies.
- Derive per-record known-key metadata from the same schema shape definitions.
- Preserve task-shell and per-segment parsing so one invalid segment does not reject
  its task.
- Replace codec scalar/record decoder calls with per-record Zod parsing.
- Keep collection array validation, missing collection defaults, source-path maps,
  duplicate handling, and relationship validation in codec orchestration.
- Preserve the existing `normalizeGanttRecordInput` behavior used by commands.
- Preserve current freezing and deep caller-reference isolation after Zod parsing.
- Remove each superseded hand-written decoder/helper in the same change that switches
  its production consumer; do not keep a hidden fallback path.
- Run the current and Zod paths against the fixed benchmark fixtures during
  development, then remove the legacy benchmark-only decoder once parity is accepted.
- Record diagnostic and performance parity evidence in this plan and the roadmap.

**Expected output**

- Production wire record normalization powered by private Zod schemas.
- Smaller codec code focused on orchestration and domain recovery.
- No change to public output, diagnostics, accepted input, or serialization.
- No remaining legacy scalar/record parser for migrated families.

**Verification**

- All model codec, validation, migration, serialization, and round-trip tests.
- Focused schema/adapter tests.
- Command normalization and update tests.
- Fixed-seed current-versus-Zod parity fixtures for canonical documents and structured
  diagnostics.
- Codec benchmark at ordinary, 2,000/400, and 10,000/2,000 sizes.
- `vp check`

**Dependencies**

- Slice 2 schema and issue-adapter foundations.

### Slice 4: Reuse canonical schemas in strict command and patch validation

Status: `[x]` Done

**Goal**

Remove the second hand-written structural schema from the strict command/patch path
and make canonical Zod schemas the shared record-shape authority.

**Why here**

Wire normalization must be stable first. The strict path can then consume canonical
schemas without conflating repairable external input with atomic command validation.

**This slice should implement**

- Replace `RECORD_KEYS`, `REQUIRED_KEYS`, schedule predicates, duration predicates,
  and equivalent shape checks in `packages/gantt/src/commands/validate.ts` with the
  canonical schema registry.
- Keep strict behavior:
  - unknown keys reject;
  - no ID/date coercion occurs;
  - no defaults repair incomplete patch values;
  - any structural issue rejects the atomic operation.
- Keep duplicate, segment-duplicate, and cross-record relationship validation as
  explicit strict graph validation.
- Reuse canonical record schemas in patch replacement/addition integrity checks.
- Confirm command input normalization still rejects warnings that the document codec
  would otherwise report while recovering.
- Consider a private canonical-document structural helper only if it removes real
  duplication without turning graph integrity into one giant Zod refinement.
- Record deleted duplication and focused verification evidence.

**Expected output**

- One canonical record-shape authority shared by codec, commands, and patches.
- Strict atomic graph validation retained as Gantempo domain code.
- Removed duplicated key/required/schedule/duration tables and predicates.

**Verification**

- `vp test run packages/gantt/src/commands packages/gantt/src/model/codec.test.ts packages/gantt/src/model/document-round-trip.test.ts`
- Existing property suites for commands, patches, transactions, and history.
- Focused negative tests proving canonical schemas do not coerce or default command
  candidates.
- `vp check`

**Dependencies**

- Slice 3 production record schemas.

### Slice 5: Prove type ownership and remove residual structural duplication

Status: `[x]` Done

**Goal**

Finish the schema-source consolidation, prove public declaration quality, and remove
remaining obsolete structural validation without broadening Zod's responsibility.

**Why here**

Only after both wire and strict paths use the schemas can residual duplication be
classified safely as obsolete, intentional serializer defense, or public type
documentation.

**This slice should implement**

- Audit `model/types.ts`, `model/codec.ts`, `model/serialize.ts`,
  `model/validate.ts`, `commands/normalize.ts`, and `commands/validate.ts` for repeated
  structural rules.
- Remove obsolete structural checks and constants whose authority now belongs to the
  schema modules.
- Retain serializer checks that defend byte-stable canonical output and produce useful
  serialization errors.
- Retain migration, recovery, duplicate, reference, freezing, and JSON-copy logic that
  remains intentionally domain-owned.
- Complete bidirectional schema/public-type assertions for all record and document
  types.
- Inspect emitted declarations and keep explicit public interfaces if inference makes
  the API less readable or weakens readonly/exact-optional semantics.
- Confirm neither Zod nor schema modules are added to `packages/gantt/src/index.tsx`
  exports.
- Add a code comment only where the schema/domain split is not evident from the code.
- Record the final ownership map and removed duplication in this plan.

**Expected output**

- No accidental second structural schema.
- Clear intentional boundaries between Zod schemas, domain graph validation,
  serializer defense, and public types.
- Stable, readable public declarations with no Zod leakage.

**Verification**

- Focused model and command suites.
- `vp check`
- `vp pack`
- Inspect `packages/gantt/dist/index.d.ts`.
- Inspect built ESM for expected Zod import shape and absence of duplicate validator
  modules.

**Dependencies**

- Slices 3 and 4.

### Slice 6: Complete package, performance, compatibility, and documentation gates

Status: `[x]` Done

**Goal**

Prove the migration in the environments and sizes promised by the package, update all
durable documentation, and close the temporary migration state.

**Why here**

The final schema ownership and production paths must exist before bundle size,
end-to-end performance, SSR behavior, and durable consequences can be assessed
honestly.

**This slice should implement**

- Run the codec benchmark with the same generator, seeds, sizes, warmup, iterations,
  and hardware metadata captured in Slice 1.
- Compare ordinary valid input, 10,000-task valid input, and bounded malformed input
  against the baseline budgets selected in Slice 1.
- Measure:
  - `@gantempo/gantt` packed artifact contents;
  - downstream production bundle raw/gzip size;
  - whether multiple Zod copies appear;
  - tree-shaking behavior for a minimal consumer;
  - Node/SSR import and render behavior.
- Run the playground build and scoped browser smoke only if package/runtime behavior
  changed in a way that needs browser confirmation; no visual change is expected.
- Run the complete local CI gate.
- Update:
  - `docs/decisions/2026-07-30-document-codec-contract.md`;
  - `docs/ARCHITECTURE.md`;
  - `docs/ROADMAP.md`;
  - this plan's slice statuses, findings, deviations, exact evidence, and next action.
- Confirm no temporary legacy parser, comparison switch, benchmark-only production
  export, or unused schema dependency remains.

**Expected output**

- Verified Zod-backed structural validation with documented cost.
- Correct package and consumer dependency behavior.
- Complete migration documentation and no temporary dual implementation.
- A closed architecture open decision.

**Verification**

- `mise run ci`
- Focused codec benchmark with recorded output and metadata.
- `vp build apps/playground`
- Consumer production bundle analysis.
- Node/SSR package import and existing SSR tests.
- `git diff --check`

**Dependencies**

- Slices 1–5.

## Testing Plan

### Structural schema tests

Test wire and canonical schemas independently:

- accepted and rejected ID forms;
- negative, zero, fractional, non-finite, and bounded numbers;
- explicit-offset and offset-free datetime strings;
- negative epoch milliseconds;
- leap years and invalid local calendar dates;
- instant/all-day discriminants and interval ordering;
- duration units, modes, and signed lag behavior;
- missing, optional, defaulted, and explicitly invalid properties;
- plain, null-prototype, array, class-instance, sparse, and cyclic inputs;
- strict canonical rejection of coercible wire values.

### Codec parity tests

Retain or add coverage for:

- all six collections and task segments;
- missing collections and task defaults;
- root/schema fatal behavior;
- malformed record and segment recovery;
- unknown property warning paths;
- normalized duplicate IDs;
- dangling and incompatible references;
- extension-data cloning and sorted keys;
- diagnostic ordering and structured fields;
- object/array/result freezing;
- caller-reference isolation;
- parse/serialize/parse equality and byte stability.

### Command and patch tests

Retain or add coverage for:

- add/update normalization;
- unknown field rejection;
- invalid supplied optional values;
- no canonical coercion/defaulting;
- duplicate and reference rejection;
- atomic multi-patch final-state validation;
- transaction rollback;
- history round trips;
- fixed-seed property suites.

### Packaging and compatibility tests

Verify:

- Zod is declared as a direct dependency;
- `vp pack` succeeds with external dependencies;
- a fresh consumer resolves the dependency without manual installation;
- public declarations mention no Zod type;
- minimal consumer and playground production bundles contain one expected Zod
  implementation;
- Node and SSR imports have no browser-global dependency;
- existing supported browser targets can execute the emitted code.

### Performance evidence

Use a versioned deterministic generator. Record at minimum:

- generator version and seed;
- schema implementation version;
- Zod version and import path;
- Node/Vite+ versions;
- hardware and operating system;
- entity counts and serialized byte size;
- valid versus malformed scenario;
- warmup and iteration counts;
- distribution rather than one timing;
- downstream raw/gzip bundle delta.

Parsing is a load/external-update boundary. Do not convert migration-local results into
a frame-rate claim or a portable CI threshold. A serious regression or unacceptable
consumer-bundle delta must be recorded as a deviation and resolved before Slice 6 is
marked complete.

## Expected File Changes

### Files to add

- `packages/gantt/src/model/schema/scalars.ts`
- `packages/gantt/src/model/schema/json.ts`
- `packages/gantt/src/model/schema/schedules.ts`
- `packages/gantt/src/model/schema/records.ts`
- `packages/gantt/src/model/schema/issues.ts`
- `packages/gantt/src/model/schema/index.ts`
- focused `*.test.ts` files beside the schema modules
- `packages/gantt/src/model/codec.bench.ts` or an equivalently scoped versioned codec
  benchmark

### Files likely to change

- `packages/gantt/package.json`
- workspace lockfile
- `packages/gantt/src/model/codec.ts`
- `packages/gantt/src/model/types.ts`
- `packages/gantt/src/commands/normalize.ts`
- `packages/gantt/src/commands/validate.ts`
- existing model and command tests
- `docs/decisions/2026-07-30-document-codec-contract.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- this plan

### Files to change only if evidence requires it

- `packages/gantt/src/model/json.ts`
- `packages/gantt/src/model/serialize.ts`
- `packages/gantt/src/model/validate.ts`
- `packages/gantt/src/runtime/store.ts`
- root `vite.config.ts`
- playground or a dedicated package-consumer fixture

Do not edit render, viewport, interaction, scheduler, licensing, or Pro modules for
this migration unless a direct verified dependency is first recorded as a deviation.

## Risks and Mitigations

### Zod defaults silently change wire behavior

Mitigation: make unknown-key handling, defaults, coercion, and optionality explicit;
use existing tests as the oracle; never rely on an undocumented default.

### One bad segment causes a whole task to disappear

Mitigation: keep task-shell and segment parsing separate and test mixed valid/invalid
segment arrays before switching production parsing.

### Raw Zod diagnostics leak into the public contract

Mitigation: use a private deterministic adapter and assert Gantempo diagnostic
structures rather than Zod issue prose.

### Recursive JSON input hangs or overflows on cycles

Mitigation: retain the guarded ancestor-aware JSON walk instead of delegating cyclic
input traversal to an unguarded recursive schema.

### Schema inference weakens public readonly types

Mitigation: retain deliberate public interfaces and use bidirectional compile-time
assertions; inspect generated declarations before considering inferred exports.

### Canonical validation starts repairing command input

Mitigation: keep distinct wire and canonical schemas; canonical schemas never coerce
or apply missing-field defaults.

### Dependency size is measured incorrectly

Mitigation: measure a downstream production bundle because `neverBundle: true` leaves
Zod external in the library artifact; report raw and gzip deltas and duplicate copies.

### Validation enters a frame-sensitive path

Mitigation: limit whole-document parsing to trust/replacement boundaries and
record-level schemas to command normalization; add no validation in render, layout,
viewport, hit-test, or gesture loops.

### Temporary dual implementations drift

Mitigation: use the existing decoder only as a one-slice parity oracle and remove each
legacy production helper when its Zod replacement switches on.

### Concurrent milestone work causes unrelated edits

Mitigation: keep commits path-scoped, re-read touched files before editing, preserve
unrelated working-tree changes, and do not combine interaction/runtime work with this
plan.

## Open Questions

Resolve these with Slice 1 or Slice 2 evidence rather than leaving them implicit:

1. What exact Zod 4 release is selected and locked?
2. Does Zod Mini provide the needed codec/transform/error APIs with a maintainable
   schema expression, or is a documented switch to regular Zod justified?
3. What ordinary and 10,000-task parse budgets follow from the current-decoder
   baseline on the recorded reference environment?
4. Should the consumer bundle measurement reuse the playground or use a smaller
   dedicated fixture that isolates `@gantempo/gantt` plus Zod?
5. Can one object-shape factory provide both schemas and known-key metadata without
   relying on unstable Zod internals?
6. Which current serializer checks remain intentionally defensive after canonical
   schemas become authoritative?
7. Do public explicit interfaces remain preferable after generated declaration
   inspection, or can selected internal types safely derive from schemas?

None of these questions permits a schema-version-1 behavior change without a recorded
decision and synchronized architecture/roadmap update.

## Working Notes

### 2026-07-30 — Slice 1 started

- Selected and verified the current Zod release as `4.4.3`; the implementation will
  import the Mini entry point through `zod/mini`.
- Updated the accepted codec decision and architecture before adding the dependency.
- Baseline measurement uses a versioned fixed-seed codec benchmark plus the existing
  packed library and playground production build.

### 2026-07-30 — Slice 1 complete

- Environment: arm64 Apple M2 Max with 32 GiB memory on Darwin 25.5.0; fixed
  generator `codec-v1`, seed `20260730`, Vitest `4.1.10`, Vite+ `0.2.6`, pnpm
  `11.18.0`, and the repository Node 24 toolchain.
- The reusable benchmark uses Vitest's default warmup/sample policy and records:
  - ordinary valid, 50 tasks/10 lanes, 11,833 bytes: mean `0.1564 ms`, p75
    `0.1546 ms`, p99 `0.3108 ms`;
  - medium valid, 2,000 tasks/400 lanes, 486,433 bytes: mean `6.2054 ms`, p75
    `6.3354 ms`, p99 `6.8992 ms`;
  - large valid, 10,000 tasks/2,000 lanes, 2,459,593 bytes: mean `37.9509 ms`, p75
    `37.5208 ms`, p99 `63.9192 ms`;
  - large bounded malformed, 10,000 tasks/2,000 lanes, 2,459,564 bytes and 33
    diagnostics: mean `33.9599 ms`, p75 `34.6266 ms`, p99 `37.1967 ms`.
- Migration-local review budgets are an ordinary-input mean below `1 ms`, a
  10,000-task valid-input mean below `100 ms`, and no worse than `3x` the recorded
  large-input baseline. These are local review guides, not CI thresholds.
- `vp pack` produced `index.js` 269.76 kB raw/52.12 kB gzip, `index.d.ts` 35.45
  kB raw/6.02 kB gzip, CSS 6.67 kB raw/1.63 kB gzip, and 879.00 kB reported total.
- `vp build apps/playground` produced one application JS bundle of 356.21 kB
  raw/101.29 kB gzip and CSS of 13.42 kB raw/3.44 kB gzip.
- Characterization verification passed 77 tests across 16 focused model and command
  files. Existing coverage was sufficient; no expectations were changed.
- Exact commands passed: the Slice 1 focused `vp test run ...` command, `vp test
  bench packages/gantt/src/model/codec.bench.ts --run`, `vp pack`, `vp build
  apps/playground`, and `git diff --check`.

### 2026-07-30 — Slices 2–5 complete

- Added direct dependency `zod@4.4.3` and confirmed Zod 4 Mini exposes the required
  public object, strict-object, transform, pipe, check, discriminated-union, exact
  optional, readonly, and safe-parse APIs. No switch to regular Zod was needed.
- Added private scalar, guarded JSON-clone, schedule, duration, object-pair,
  issue-adapter, segment, record, registry, and type-equivalence modules under
  `model/schema/`.
- One shape definition now supplies each wire schema, strict canonical schema, and
  known-key set. Wire schemas strip only after Gantempo records stable unknown-property
  warnings; canonical schemas reject unknown keys and do not coerce or default.
- Replaced the production codec's hand-written scalar and record decoders with
  per-record Zod parsing. Task shells retain opaque raw segments and parse each segment
  independently, preserving partial recovery and order.
- Replaced strict command `RECORD_KEYS`, `REQUIRED_KEYS`, plain-object, calendar-date,
  schedule, duration, and equivalent predicates with `canonicalRecordSchemas`.
  Duplicate and relationship validation remains explicit domain code.
- Removed 759 legacy codec lines while adding 189 orchestration/adapter lines; removed
  133 strict-validator lines while adding 3 schema-registry lines. Searches confirm no
  residual legacy scalar/schedule/duration/key-table validator names.
- Kept explicit public interfaces because they preserve readable readonly and exact
  optional contracts. Bidirectional compile-time assertions cover all schedules,
  durations, segments, and six record families.
- Focused verification passed 86 tests across 18 model/command files; the production
  parity subset passed 62 tests across 14 files; type checking passed across 116 files.
- `vp pack` emits the expected external `import * as z from "zod/mini"` in JavaScript,
  while `dist/index.d.ts` contains no Zod or private schema reference.
- Implementation finding: validating the wire output a second time through the
  canonical schema raised the large-valid mean to `113.23 ms`. The production wire
  schema already outputs canonical structural data, so the redundant second parse was
  removed; canonical schemas remain authoritative at strict command/patch boundaries.
  This restored the large-valid mean to `81.2168 ms`, within both review budgets.

### 2026-07-30 — Slice 6 complete

- Final fixed-seed Zod benchmark:
  - ordinary valid mean `0.3523 ms`, p75 `0.3521 ms`, p99 `0.5323 ms`;
  - medium valid mean `15.3975 ms`, p75 `15.8055 ms`, p99 `17.0860 ms`;
  - large valid mean `81.2168 ms`, p75 `80.5702 ms`, p99 `103.08 ms`;
  - large bounded malformed mean `74.0846 ms`, p75 `74.6337 ms`, p99 `75.7891 ms`.
- Compared with baseline, ordinary mean is `2.25x` and large-valid mean is `2.14x`;
  both remain inside the migration-local budgets and validation remains a
  load/external-update boundary rather than a frame-sensitive path.
- The packed library remains external-dependency based: final `index.js` is 268.53 kB
  raw/52.54 kB gzip, declarations remain 35.45 kB raw/6.02 kB gzip, and one
  `zod/mini` import is present.
- The playground consumer JS bundle is 370.32 kB raw/106.68 kB gzip: a delta of
  +14.11 kB raw/+5.39 kB gzip from baseline. pnpm reports exactly one resolved
  `zod@4.4.3` version.
- A direct Node import of the packed ESM and schema-version-1 numeric-ID parse passed
  without browser globals. The production playground build passed with 139 transformed
  modules.
- `mise run ci` passed from the completed implementation: formatting checked 127
  files; lint/type checking found no warnings or errors across 116 files; 237 tests
  passed across 49 files; and the package build completed.
- No temporary legacy parser, comparison switch, production benchmark export, public
  schema export, or unused runtime dependency remains.

### 2026-07-30 — Planning baseline

- Selected a Zod 4 Mini parity migration rather than waiting for schema version `2` or
  another persisted record family.
- Current evidence shows structural contract knowledge repeated across public types,
  the wire codec, strict command validation, and serializer defenses.
- Kept migrations, partial recovery, diagnostic stability, duplicate/reference
  policy, extension cloning, freezing, and deterministic serialization outside Zod.
- Identified `deps.neverBundle: true` as the reason a downstream consumer bundle—not
  only package output—must own size verification.
- Identified per-segment task recovery, cyclic JSON extension input, unknown-property
  warnings, and strict command non-repair as the highest-risk parity areas.
- No implementation, dependency, lockfile, architecture, roadmap, test, benchmark, or
  source change was made by this planning slice.

## Progress

- [x] Slice 1: Update the decision and freeze parity/performance baselines
- [x] Slice 2: Add Zod and private scalar/schema foundations
- [x] Slice 3: Move wire record normalization into Zod schemas
- [x] Slice 4: Reuse canonical schemas in strict command and patch validation
- [x] Slice 5: Prove type ownership and remove residual structural duplication
- [x] Slice 6: Complete package, performance, compatibility, and documentation gates

## Next Slice

Migration complete. Keep the worktree unmerged until the user explicitly approves
integration.
