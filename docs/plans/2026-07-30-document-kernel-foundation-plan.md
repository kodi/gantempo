# Document Kernel Foundation Implementation Plan

## Summary

Implement M1 as a framework-independent document boundary inside `@gantempo/gantt`.
External JSON-compatible input should pass through one version-aware codec that
normalizes IDs and dates, validates record shape and cross-record references, reports
structured diagnostics, builds deterministic indexes, and serializes a canonical
document back to stable JSON.

This milestone fills in the architecture Slice 1 foundation that the completed
read-only chart deliberately skipped. It does not add mutation yet. M2 will build
commands, patches, transactions, and history on the verified document kernel produced
here.

## Target State

At the end of M1:

- wire/input data and the normalized runtime document are distinct contracts;
- tasks, resources, lanes, assignments, placements, dependencies, and task segments
  retain separate identity and meaning;
- parsing accepts `unknown` at the trust boundary and never requires React, DOM types,
  browser globals, or mutable `Date` objects;
- normalization produces opaque string IDs, canonical instant/all-day date values,
  explicit collection defaults, and JSON-compatible extension data;
- schema-version handling is deterministic, with migrations applied before current
  schema validation;
- malformed roots and unsupported versions fail at the document boundary, while
  recoverable record problems produce path-aware diagnostics and do not erase
  unrelated valid records;
- referential validation enforces the relationships defined in
  `docs/ARCHITECTURE.md` without performing scheduling or layout;
- one stable index set supports ID lookup and the relationship queries required by
  later command, view, and layout milestones;
- canonical serialization is deterministic and parse/serialize/parse is idempotent;
- the existing scene builder consumes the normalized model and general diagnostic
  contract without making scene internals public;
- the current `/` and `/matrix` playground behavior remains unchanged.

## Decisions Already Established

These decisions come from `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and the verified
M0 implementation:

1. **Keep domain records separate.** A task is not a lane, an assignment is not a
   placement, and a placement does not own schedule dates.
2. **Treat normalized document state as serializable plain data.** Runtime document
   state contains no functions, class instances, React elements, DOM references, or
   mutable `Date` values.
3. **Use opaque string IDs in the normalized model.** Ergonomic numeric wire IDs may
   be accepted only through explicit normalization.
4. **Keep instant and all-day schedules distinct.** Instant schedules use epoch
   milliseconds; all-day schedules use ISO local-date strings and are not converted
   to midnight instants.
5. **Use half-open intervals.** Canonical scheduled intervals follow `[start, end)`.
6. **Keep the kernel pure and deterministic.** The same input and schema support must
   produce the same document, diagnostics, indexes, and serialized bytes in Node, a
   browser, SSR, or a future worker.
7. **Keep public exports small.** The normalized record contracts and intentional
   codec entry points may be public; migration helpers, validators, index builders,
   and intermediate wire shapes remain internal until another consumer proves a
   public need.
8. **Do not split workspace packages in M1.** Extend the existing
   `packages/gantt/src/model/` boundary first. Package extraction remains a later
   decision backed by real consumers.
9. **Preserve the read-only renderer contract.** The scene builder remains private,
   and the playground continues to provide normalized records directly.

## Decision Gate Before Implementation

The following choices have consequences beyond M1 and must be recorded in a focused
decision record under `docs/decisions/` before implementation modules are added.
Slice 1 owns the decision record and its required links from this plan,
`docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`.

The recommended starting position is:

- use a small internal codec for schema version 1 rather than adding a runtime schema
  dependency while the supported document surface is still narrow;
- accept finite epoch-millisecond numbers and ISO-8601 datetime strings with an
  explicit offset for instant wire dates; reject offset-free datetime strings instead
  of interpreting them in the host time zone;
- accept only `YYYY-MM-DD` strings for all-day dates;
- treat a non-object root, a missing/invalid schema version, and an unsupported newer
  schema version as document-fatal;
- run registered older-version migrations in order and reject versions for which no
  complete migration path exists;
- treat individual malformed, duplicate, or dangling records as recoverable when a
  valid canonical document can still be formed, emitting an error diagnostic for
  every omitted record and any resulting dangling relationship;
- preserve input collection order and first-seen record identity after normalization;
- emit current-schema JSON with fixed known-field order, lexically ordered extension
  object keys, preserved array order, and no `undefined` values.

Slice 1 should verify these defaults against representative fixtures and the current
package constraints. If it selects a different contract, update the architecture,
roadmap, decision record, and this plan before continuing.

## Scope

### In scope

- A general `Diagnostic` contract below model and renderer layers, including stable
  code, severity, message, entity IDs, input path, and structured JSON details.
- JSON-compatible value types and runtime checks for extension fields and metadata.
- Normalized record contracts for:
  - tasks and task segments;
  - resources;
  - lanes;
  - assignments;
  - persisted placements;
  - dependencies.
- The minimum task schedule variants needed to preserve the architecture's instant
  versus all-day distinction.
- A wire codec accepting `unknown`, normalizing supported ergonomic values, and
  returning a typed result with diagnostics.
- Schema version 1 as the current emitted schema plus an internal ordered migration
  boundary for older supported versions.
- Collection defaults, duplicate-ID handling, structural validation, and
  referential-integrity validation.
- Stable primary and relationship indexes required by M2 and M3.
- Deterministic JSON serialization and representative full-document round trips.
- Adapting the existing render/index path to use normalized records and general
  diagnostics.
- Intentional public exports for the normalized document, diagnostics, parse result,
  parse entry point, and serializer entry point.
- Documentation and final playground regression verification.

### Out of scope

- Commands, reducers, patches, inverse patches, transactions, undo, redo, or
  persistence adapters; these belong to M2.
- Session state, resolved views, derived placements, overlap stacking, variable lane
  heights, viewport indexes, or renderer changes; these belong to M3 and later.
- Dependency graph algorithms, cycle detection, hierarchy cycle detection, critical
  path, or automatic scheduling.
- Working-calendar arithmetic, calendar precedence, constraints, baselines, resource
  capacity calculation, or workload derivation.
- Partial/remote document loading and query adapters.
- React controlled/uncontrolled ownership changes.
- A public JSON Schema artifact or generated validator unless the Slice 1 decision
  record proves it is required.
- New workspace packages or a new runtime dependency without the Slice 1 decision
  record and corresponding lockfile/package changes.

## Current State

- `packages/gantt/src/model/types.ts` contains only the M0 render subset:
  `TaskRecord`, `LaneRecord`, `PlacementRecord`, an instant schedule with required
  start/end values, and a three-collection `GanttDocument`.
- `packages/gantt/src/model/indexes.ts` builds task, lane, and placement maps. It
  preserves first-seen order and diagnoses later duplicate IDs, but its diagnostics
  are coupled to the render layer.
- `packages/gantt/src/render/diagnostics.ts` defines render-only diagnostic codes and
  lacks severity and input path.
- `buildChartScene` accepts a typed object directly, rebuilds the three indexes, and
  performs render-time checks for dangling placements and invalid task intervals.
- `packages/gantt/src/index.tsx` publicly exports the narrow record types and render
  diagnostics; no codec, migration, validation, or serializer API exists.
- The playground constructs normalized-looking objects in TypeScript. There is no
  external `unknown`/JSON trust boundary and no complete-domain fixture.
- The package has no runtime schema-validation dependency. Repository checks are
  exposed through Vite+ and `mise run ci`.

No M1 implementation or runtime verification is completed by this planning pass.

## Behavior to Preserve

- Existing lane, task, and placement IDs and array order produce the same scene
  primitive order.
- Duplicate and dangling records never cause unrelated valid lanes or bars to vanish.
- Invalid document data is reported through returned/callback diagnostics rather than
  printed to the console.
- The scene builder stays pure and does not mutate caller-owned arrays or records.
- The public React component remains SSR-safe and imports no browser globals at module
  scope.
- Existing `Gantt` props, render primitive shape, theme behavior, accessibility names,
  and package CSS entry remain unchanged unless a verified document-contract
  limitation requires a separately recorded deviation.
- `/` and `/matrix` remain the regression surfaces for the M0 renderer.

## Implementation Shape

### Boundary pipeline

```text
unknown JSON-compatible input
  -> root and schema-version inspection
  -> ordered wire migration to current schema
  -> record-shape and scalar normalization
  -> duplicate and referential-integrity validation
  -> canonical GanttDocument + Diagnostic[]
  -> stable DocumentIndexes
  -> deterministic JSON serialization
```

The codec should keep the stages separately testable even if the public API exposes
one parse function. Migration operates on wire data, normalization creates canonical
records, referential validation decides which relationships are admissible, and
indexing never silently repairs the document.

### Result and diagnostic direction

The exact names may change in Slice 1, but implementation should preserve this
contract shape:

```ts
interface Diagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly entityIds?: readonly EntityId[];
  readonly path?: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

interface ParseDocumentResult {
  readonly document?: GanttDocument;
  readonly diagnostics: readonly Diagnostic[];
  readonly sourceSchemaVersion?: number;
}
```

A document-fatal diagnostic leaves `document` absent. Recoverable record diagnostics
may accompany a canonical partial document whose unrelated valid records remain
usable. Every omission must have a stable diagnostic code and source path; recovery
must never be silent.

### Normalized document shape

The normalized document should use required readonly arrays for the six M1
collections, defaulting absent optional wire collections to empty arrays. Record
arrays preserve accepted input order. IDs are unique strings after normalization.
Extension `fields` and document `metadata` contain JSON-compatible values only.

The task contract should include the minimum architecture fields needed to prove
identity and date preservation: task kind, parent ID, instant/all-day schedule,
segments, progress, and extension fields. Resource and lane parent IDs are normalized
but hierarchy cycle analysis is deferred. Assignments connect tasks and resources;
placements connect tasks and lanes and may reference a compatible assignment or task
segment; dependencies connect distinct existing tasks and preserve link type and lag
data.

### Stable indexes

`DocumentIndexes` should own primary `byId` maps for every M1 entity plus the smallest
stable relationship lookups needed by the next milestones:

- task, resource, and lane children by parent ID;
- assignments by task and by resource;
- placements by task, lane, and optional assignment;
- task segments by task and segment ID;
- dependencies by source and target task.

Relationship arrays preserve document order. Index construction must not mutate,
filter, diagnose, or schedule; it receives a validated normalized document and only
derives lookup state.

### Migration and serialization boundary

M1 should emit only the current schema version. Older input versions pass through an
explicit, ordered migration registry before normalization. Each migration is pure,
version-to-version, and fixture-tested; parsing must not guess a version or
best-effort an unsupported future shape.

Serialization should produce a deterministic JSON string from a canonical document.
Known record keys use one documented order, extension object keys are normalized
recursively, arrays preserve domain order, and unsupported JSON values are prevented
by normalization rather than coerced during serialization.

## Cross-Slice Rules

- Update this plan and `docs/ROADMAP.md` in every M1 change set. Append dated findings
  rather than replacing earlier handoff evidence.
- Update `docs/ARCHITECTURE.md` and the M1 decision record in the same change set when
  evidence changes a public contract, system boundary, architectural principle,
  migration rule, or release acceptance criterion.
- Do not start a later slice until the current slice leaves its focused tests and
  `vp check` passing.
- Do not mark a slice done until its exact verification command and outcome are
  recorded under that slice or in Working Notes.
- Keep model, codec, migration, validation, indexes, and serializer modules free of
  React, DOM types, browser globals, current time, locale defaults, and host-time-zone
  interpretation.
- Do not add mutation helpers to make tests convenient; M2 owns all document changes.
- Do not let the renderer become a second validation or normalization authority.
  Temporary defensive checks may remain only until Slice 6 proves codec/index parity.
- Preserve accepted collection order and entity identity through every stage.
- Keep diagnostics stable and structured; human-readable text may evolve, but tests
  should primarily assert code, severity, path, and related identity.
- Do not introduce a second public document type for React. The component and codec
  must converge on the same normalized `GanttDocument`.
- If a temporary compatibility alias is added for `RenderDiagnostic`, remove it in
  Slice 6 unless a public compatibility test proves it must remain.

## Implementation Slices

### Slice 1: Freeze the codec contract and decision record

Status: `[x]` Done

**Goal**

Resolve the cross-milestone wire, schema-version, recovery, dependency, and stable-JSON
rules before they become accidental behavior in implementation.

**Why here**

Every later slice depends on what the codec accepts and what a canonical document
means. Reversing these choices after public exports or migrations exist would create
avoidable compatibility work.

**This slice should implement**

- Create a focused decision record under `docs/decisions/`.
- Compare the recommended internal codec with one credible runtime-schema dependency
  against the representative M1 fixture, package size/runtime constraints, diagnostic
  path requirements, and migration ergonomics.
- Record accepted instant/all-day wire values, host-time-zone rejection behavior,
  current schema version, older migration behavior, unknown future-version behavior,
  recoverable versus fatal failure boundaries, unknown-field policy, duplicate-ID
  policy, and deterministic serialization rules.
- Define the public parse/serialize result shape and the internal stage boundaries.
- Add or identify representative wire fixtures for:
  - all six M1 collections and task segments;
  - numeric and string IDs;
  - instant and all-day schedules;
  - extension fields and metadata;
  - one older supported schema fixture if a real migration is defined;
  - malformed roots, unsupported versions, duplicate IDs, bad dates, and dangling
    relationships.
- Link the decision record from architecture, roadmap, and this plan.
- Record any deviation from the recommended starting position before code begins.

**Expected output**

- One durable decision record and a fixture/contract checklist that later slices can
  implement without reopening boundary semantics.
- No runtime behavior change.

**Verification**

- `git diff --check`
- Explicit link-existence check for the plan, decision record, architecture, and
  roadmap.
- Focused cross-document read confirming that all four documents state compatible
  codec, migration, and synchronization rules.

**Dependencies**

- M0 completion evidence and the current architecture/roadmap only.

### Slice 2: General diagnostics and normalized record contracts

Status: `[x]` Done

**Goal**

Establish the complete React-free normalized type surface that every later document
stage consumes.

**Why here**

The codec and validators need one target type, while renderer-specific diagnostics
must be generalized before model code can report parsing and integrity problems.

**This slice should implement**

- Add `JsonValue` and JSON object/array aliases with readonly normalized forms.
- Move the general diagnostic contract below the renderer and define initial stable
  code families for root, schema, scalar, record, duplicate, and reference failures.
- Expand `EntityId`, schedule, task segment, task, resource, lane, assignment,
  placement, dependency, duration/lag, and `GanttDocument` contracts to the M1 scope.
- Make normalized collection arrays explicit and readonly.
- Document which optional wire values become required/defaulted canonical values.
- Replace render-to-model diagnostic imports with the general contract while keeping
  M0 component tests passing.
- Add compile-time/public-facade tests proving the normalized contracts are importable
  without exporting internal validators or indexes.

**Expected output**

- A general diagnostic foundation and normalized record types.
- The existing renderer compiles against the expanded model without behavior change.

**Verification**

- `vp test run packages/gantt/src/model packages/gantt/src/index.test.tsx`
- `vp check`

**Dependencies**

- Slice 1 decision record.

### Slice 3: Versioned wire codec and scalar normalization

Status: `[x]` Done

**Goal**

Parse `unknown` wire input into structurally valid canonical records using explicit
schema and normalization rules.

**Why here**

Structural parsing and scalar normalization must be proven before cross-record
relationships can be validated reliably.

**This slice should implement**

- Add root/schema inspection and the internal ordered migration registry.
- Add the selected schema-version-1 decoder without leaking intermediate wire types
  into the public facade.
- Normalize numeric/string IDs, instant dates, all-day dates, collection defaults,
  enum values, finite numeric fields, JSON extension fields, and metadata.
- Reject host-dependent, non-finite, or non-JSON values with stable path-aware
  diagnostics.
- Apply the Slice 1 unknown-field and duplicate-ID policies.
- Distinguish document-fatal failures from recoverable record failures.
- Preserve accepted record order and avoid mutating or retaining references to
  caller-owned mutable input.
- Add focused tests for every scalar boundary, collection default, duplicate family,
  fatal root/version case, recovery case, and migration step.

**Expected output**

- A pure current-schema decoder and migration boundary.
- A canonical partial document plus diagnostics when recovery is permitted.

**Verification**

- `vp test run packages/gantt/src/model/codec.test.ts`
- `vp test run packages/gantt/src/model/migrations.test.ts`
- `vp check`

**Dependencies**

- Slices 1 and 2.

### Slice 4: Referential integrity and stable document indexes

Status: `[x]` Done

**Goal**

Prove domain relationships and expose deterministic derived lookups without mixing in
commands, scheduling, or layout.

**Why here**

Primary records must be normalized before references can be evaluated, and
serialization should only receive the validated canonical result.

**This slice should implement**

- Validate task/resource/lane parent references without performing hierarchy cycle
  analysis.
- Validate assignment task/resource references.
- Validate placement task/lane references, assignment ownership, and task-segment
  ownership.
- Validate dependency endpoints and link-type/lag shape without graph cycle analysis.
- Apply the Slice 1 recovery policy consistently to dangling records and diagnose any
  cascade caused by an omitted primary record.
- Replace the M0 three-record index helper with one `DocumentIndexes` boundary.
- Add primary and relationship lookups listed under Implementation Shape.
- Prove lookup order, immutability, no filtering during index creation, and stable
  behavior for empty collections.
- Add a representative integration test showing unrelated valid records survive bad
  assignments, placements, and dependencies.

**Expected output**

- A referentially valid canonical document.
- Stable indexes usable by the future change and view kernels.

**Verification**

- `vp test run packages/gantt/src/model/validate.test.ts`
- `vp test run packages/gantt/src/model/indexes.test.ts`
- `vp check`

**Dependencies**

- Slice 3 normalized records.

### Slice 5: Deterministic serialization and full-domain round trip

Status: `[x]` Done

**Goal**

Prove that a representative canonical document can cross the persistence boundary
without losing identity, domain meaning, or deterministic ordering.

**Why here**

Serialization depends on the final normalized shape and accepted relationship set. It
is the milestone's persistence proof before renderer integration changes.

**This slice should implement**

- Add the intentional public serializer entry point.
- Emit the current schema version and canonical wire values only.
- Apply the Slice 1 known-key, extension-key, array-order, and `undefined` rules.
- Prove byte-identical output for semantically identical normalized extension objects
  whose source keys arrived in different orders.
- Add the full-domain test:
  `parse -> validate -> index -> serialize -> parse -> validate -> index`.
- Assert deep canonical document equality, stable entity/relationship order, stable
  IDs, instant/all-day date preservation, extension-data preservation, and
  byte-identical second serialization.
- Add deterministic empty, Unicode, negative-epoch, nested-metadata, and numeric-ID
  cases.
- Add failure tests proving unsupported JSON values never reach serialization.

**Expected output**

- Stable current-schema JSON serialization.
- The React-free M1 exit-condition test covering all six collections and task
  segments.

**Verification**

- `vp test run packages/gantt/src/model/serialize.test.ts`
- `vp test run packages/gantt/src/model/document-round-trip.test.ts`
- `vp check`

**Dependencies**

- Slices 3 and 4.

### Slice 6: Scene pipeline and public facade convergence

Status: `[x]` Done

**Goal**

Make the existing read-only chart consume the document kernel as its sole normalized
model and diagnostic/index source without changing visible behavior.

**Why here**

The kernel contract must be verified before existing render-time validation is removed
or adapted.

**This slice should implement**

- Adapt `buildChartScene` to the general diagnostics and validated document indexes.
- Remove duplicate render-owned indexing/diagnostic authority once focused parity
  tests prove the model layer covers it.
- Keep render-only diagnostics only for genuinely render-specific conditions such as
  an unscheduled task or non-renderable interval.
- Export the intentional parse, serialize, normalized document, parse-result, and
  diagnostic contracts from `packages/gantt/src/index.tsx`.
- Keep migration functions, validation passes, index builders, and scene construction
  private.
- Preserve the existing `Gantt` props and diagnostic callback behavior.
- Update the playground fixtures only as required to satisfy the normalized document
  contract; do not change their visual content or introduce a wire-codec path into
  JSX.
- Update package facade/component/scene tests for the general diagnostic contract and
  expanded empty collections.
- Remove any temporary `RenderDiagnostic` compatibility alias that no verified public
  contract requires.

**Expected output**

- One normalized document model shared by codec, scene, React, SSR tests, and
  playground.
- No duplicated document normalization in the renderer.
- No public expansion of scene or index internals.

**Verification**

- `vp test run packages/gantt/src/render packages/gantt/src/index.test.tsx`
- `vp check`
- `vp pack`
- `vp build apps/playground`

**Dependencies**

- Slices 2 through 5.

### Slice 7: Documentation, regression gate, and milestone evidence

Status: `[x]` Done

**Goal**

Close M1 with reproducible automated, browser, and documentation evidence before M2
planning begins.

**Why here**

M1 is not complete until the public package still builds, the existing renderer is
unchanged, and the roadmap/plan accurately report the verified outcome.

**This slice should implement**

- Document the public parse/serialize flow and normalized-versus-wire distinction in
  `README.md`.
- Update architecture only for verified deviations or to link the Slice 1 decision
  record; do not turn it into a progress log.
- Run the final React-free full-domain round-trip test and all repository gates.
- Use Chrome DevTools MCP to inspect `/` and `/matrix` at `1440 x 900`, `900 x 900`,
  and `560 x 900`.
- Record route, viewport, alignment/overflow findings, accessibility-tree findings,
  diagnostic counts, console state, and any network/runtime errors in this plan.
- Confirm the main and matrix scenarios render with zero unexpected diagnostics and
  retain their M0 lane/task/placement identities.
- Record exact commands and outcomes in Working Notes.
- Mark M1 done in `docs/ROADMAP.md` only after every exit-condition assertion is backed
  by evidence, and set M2 planning as the actionable next step.

**Expected output**

- Public documentation for the document boundary.
- Complete M1 verification and browser regression evidence.
- Synchronized plan and roadmap status.

**Verification**

- `mise run ci`
- `mise run build-playground`
- HTTP `200` for `/` and `/matrix` from the local playground server.
- Chrome DevTools MCP visual, DOM/computed-style, accessibility-tree, console, and
  network checks at the three named viewports.
- `git diff --check`
- Explicit repository-link existence check for architecture, roadmap, active plan,
  decision record, and README.

**Dependencies**

- Slices 1 through 6.

## Testing Plan

### Per-slice confidence

- Diagnostic/type tests own public type shape, stable code families, and absence of
  renderer imports.
- Codec tests own unknown-input handling, scalar/date/ID normalization, collection
  defaults, duplicate behavior, path reporting, and fatal/recoverable boundaries.
- Migration tests own version detection, ordered step application, unsupported
  versions, source immutability, and deterministic output.
- Validation tests own cross-record relationships and recovery cascades, not graph
  algorithms.
- Index tests own primary/relationship lookup completeness, order, empty behavior, and
  immutability.
- Serialization tests own canonical key/value order and byte stability.
- The full-domain round-trip test owns the M1 black-box exit contract.
- Scene and React tests own compatibility with normalized records and general
  diagnostics, not codec internals.
- Playground browser checks own the claim that M0 visual and accessibility behavior
  remains unchanged.

### Final automated gate

```sh
mise run ci
mise run build-playground
```

The final gate is not replaceable by focused tests. Record the exact command output
summary in this plan before marking Slice 7 or M1 done.

### Final browser gate

Inspect `/` and `/matrix` with Chrome DevTools MCP at `1440 x 900`, `900 x 900`, and
`560 x 900`. Confirm:

- lane headers, time grid, and task bars remain aligned;
- compact, dark, high-contrast, multiple-entry, clipped, and empty scenarios remain
  present and legible;
- chart regions and SVG task groups retain accessible names;
- diagnostic counts are zero for valid playground fixtures;
- no unexpected console or network errors occur.

If Chrome DevTools MCP is unavailable, check its `list_pages` capability before
falling back to the built-in Browser. Do not mark the browser gate complete without an
actual connected inspection.

## Likely Files to Add

- `docs/decisions/2026-07-30-document-codec-contract.md`
- `packages/gantt/src/model/json.ts`
- `packages/gantt/src/model/diagnostics.ts`
- `packages/gantt/src/model/codec.ts`
- `packages/gantt/src/model/migrations.ts`
- `packages/gantt/src/model/validate.ts`
- `packages/gantt/src/model/serialize.ts`
- Focused co-located tests and representative fixtures under
  `packages/gantt/src/model/`.

Exact module names may change if Slice 1 proves a clearer internal boundary. The
facade and architectural boundaries should not.

## Likely Files to Change

- `packages/gantt/src/model/types.ts`
- `packages/gantt/src/model/indexes.ts`
- `packages/gantt/src/model/indexes.test.ts`
- `packages/gantt/src/render/diagnostics.ts`
- `packages/gantt/src/render/build-chart-scene.ts`
- `packages/gantt/src/render/build-chart-scene.test.ts`
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/index.tsx`
- `packages/gantt/src/index.test.tsx`
- `apps/playground/src/scenarios/index.ts` only for normalized empty collections or
  other type-required additions
- `README.md`
- `docs/ARCHITECTURE.md` only for the decision-record link or a verified architecture
  deviation
- `docs/ROADMAP.md`
- this plan
- `packages/gantt/package.json` and `pnpm-lock.yaml` only if the Slice 1 decision
  record justifies a runtime dependency

## Risks and Edge Cases

- **Two meanings for `GanttDocument`:** allowing the same type to mean both unchecked
  wire data and normalized runtime state would let consumers bypass the boundary.
  Keep wire input at `unknown` and document `GanttDocument` as normalized.
- **Host-dependent date parsing:** offset-free datetime strings can produce different
  instants across environments. Reject them unless the decision record proves and
  documents an explicit alternative.
- **Recovery hiding data loss:** a partial canonical document is useful only when
  every omitted record has a stable diagnostic path. Test cascaded reference failures
  and never silently coerce malformed data.
- **Migration without a source schema:** inventing a version for unversioned input
  makes future compatibility ambiguous. Require an explicit version unless the
  decision record defines a narrow legacy format.
- **Serializer determinism versus domain order:** sorting entity arrays would change
  lane or placement meaning. Canonicalize object keys while preserving record arrays.
- **Duplicate validation authorities:** leaving duplicate and reference logic in both
  model and renderer will cause conflicting diagnostics. Slice 6 owns convergence.
- **Overgrown indexes:** M1 indexes should answer proven relationship lookups, not
  become a cache for future scheduling or layout.
- **Premature graph behavior:** parent and dependency existence are M1 integrity
  checks; cycle detection and scheduling consequences remain later work.
- **JSON compatibility holes:** `NaN`, infinities, `undefined`, symbols, functions,
  bigint values, sparse arrays, cyclic objects, and mutable class instances must not
  leak into canonical extension data.
- **Prototype/key hazards:** recursive extension normalization must copy own data into
  safe plain objects rather than merging untrusted input onto shared prototypes.
- **Public-surface creep:** internal migration and index APIs may look reusable but
  should remain private until M2/M3 prove stable consumers.
- **False UI confidence:** passing component tests does not prove the playground
  remained visually and accessibly unchanged; keep the final Chrome gate.

## Open Questions

These questions block implementation after Slice 1 and must be answered in the
decision record:

1. Does a small internal codec meet the required path-aware diagnostics and migration
   ergonomics, or does one runtime-schema dependency materially reduce risk?
2. Which exact instant string grammar is supported beyond finite epoch milliseconds:
   only RFC 3339/ISO strings with `Z` or numeric offset, or a narrower documented
   subset?
3. Does schema version 1 need a real predecessor fixture, or should the migration
   registry ship empty until an actual older schema exists?
4. Are unknown properties errors, warnings, or ignored at each root/record level, and
   how are application-defined values distinguished from typos outside `fields` and
   `metadata`?
5. Should recoverable error diagnostics always omit the offending record, or are
   there field-level cases where dropping one optional field preserves meaning
   without disguising data loss?
6. Does the public parser name use `parseGanttDocument` or a shorter package-level
   name, and does serialization return a JSON string only or also a canonical
   JSON-value object?

None of these questions requires changing the M1 scope or slice order. Any answer that
changes an architecture-level contract must update the linked documents in Slice 1.
All six questions were resolved for M1 by
[`2026-07-30-document-codec-contract.md`](../decisions/2026-07-30-document-codec-contract.md);
they remain here as the preserved decision-gate history.

## Working Notes

### 2026-07-30 — Planning baseline

- The completed M0 plan proves the current read-only scene, React, package, and
  playground path.
- The existing model is intentionally a render subset with three record collections
  and render-owned diagnostics/indexing.
- The repository currently has no runtime codec dependency and no external JSON trust
  boundary.
- `docs/ROADMAP.md` names this plan as the required next action before M1
  implementation.
- Existing repository-standard final gates are `mise run ci` and
  `mise run build-playground`.
- No implementation, test, build, or browser command is marked complete by this
  planning pass.

### 2026-07-30 — Planning verification

- `git diff --check` passed for the final documentation change.
- Explicit existence checks passed for the architecture, roadmap, active M1 plan, and
  completed M0 plan.
- Focused cross-document checks confirmed that the roadmap links this plan, keeps M1
  unstarted, names Slice 1 as the next action, and retains the repository-standard
  final gates.
- No implementation test, build, or browser gate was run because this change only
  creates the implementation handoff.

### 2026-07-30 — Slice 1 contract decisions

- Compared the current no-runtime-dependency package with Zod 4.4.3. Zod provides
  mature typed schemas and path-bearing issues, but its 4,558,122-byte unpacked
  package would not replace the M1-specific migration, normalization, recovery,
  duplicate, reference, or stable-serialization stages.
- Accepted a focused internal schema-version-1 codec with no invented predecessor
  migration, explicit-offset instant strings, strict local dates, first-seen
  duplicate identity, warning-and-ignore unknown properties, record-level recovery,
  and deterministic current-schema JSON.
- Recorded the public `parseGanttDocument`/`serializeGanttDocument` direction and the
  representative fixture checklist in
  [`2026-07-30-document-codec-contract.md`](../decisions/2026-07-30-document-codec-contract.md).
- `git diff --check` passed.
- Explicit existence checks passed for the architecture, roadmap, active plan, and
  decision record.
- A focused `rg` cross-document read confirmed compatible internal-codec,
  schema-version-1, public entry-point, decision-link, and Slice 2 language.
- No runtime implementation changed in this slice.

### 2026-07-30 — Slice 2 normalized model

- Added model-owned `JsonValue` aliases and a general `Diagnostic` contract with
  stable document, schema, value, record, reference, and render code families.
- Expanded the normalized model to all six M1 collections, task segments, instant and
  all-day schedules, duration/lag values, JSON extension fields, task kinds, parent
  identities, and explicit readonly arrays.
- Canonical task `kind` and `segments` are required (`task` and `[]` are the later
  wire defaults); all six document collection arrays are required and missing wire
  collections will normalize to empty arrays in Slice 3.
- Updated model indexing, scene construction, React diagnostics callbacks, public
  type exports, package tests, and playground fixtures without changing visible
  scene behavior. `RenderDiagnostic` remains only as the temporary Slice 6
  compatibility alias allowed by the cross-slice rules.
- `vp test run packages/gantt/src/model packages/gantt/src/index.test.tsx` passed
  (2 files, 7 tests).
- The first `vp check` reported formatting only in
  `packages/gantt/src/index.tsx`; `vp fmt packages/gantt/src/index.tsx` corrected it.
- The rerun of `vp check` passed formatting for 36 files and lint/type checking for
  25 files with no warnings or errors.

### 2026-07-30 — Slice 3 wire codec

- Added fatal plain-root/schema-version inspection and an explicit ordered migration
  registry. Because schema version 1 is the first published wire contract, the
  registry remains empty and no synthetic predecessor format was added.
- Added a pure version-1 decoder for every M1 record family and task segments. It
  normalizes finite numeric/string IDs, explicit-offset instant strings, strict local
  dates, duration values, enums, finite numeric fields, collection/task defaults, and
  recursively cloned/sorted JSON extension data.
- Missing collections default to new readonly empty arrays. Explicit non-array
  collections are fatal. Malformed records and segments are omitted with stable paths,
  while first-seen normalized identity and accepted input order are preserved.
- Unknown structural properties warn and are ignored; extension keys survive only
  inside `fields` and `metadata`. Cyclic, sparse, non-plain, non-finite, and otherwise
  non-JSON values are rejected without retaining caller-owned references.
- `vp test run packages/gantt/src/model/codec.test.ts` passed (1 file, 16 tests).
- `vp test run packages/gantt/src/model/migrations.test.ts` passed (1 file, 9 tests).
- The first `vp check` reported formatting only in `codec.ts` and `codec.test.ts`;
  `vp fmt` corrected both files. The rerun passed formatting for 40 files and
  lint/type checking for 29 files with no warnings or errors.

### 2026-07-30 — Slice 4 integrity and indexes

- Added a pure referential validation stage after structural decoding. Missing
  task/resource/lane parents and missing lane resources are diagnosed and cleared so
  the primary record survives; invalid assignments, placements, and dependencies are
  omitted.
- Placement validation enforces task/lane existence, compatible assignment ownership,
  and task-segment ownership. Dependency validation enforces existing, distinct
  endpoints without adding cycle analysis.
- Structural decoding now carries private entity source paths into validation, so
  cascaded failures retain original paths even when earlier malformed records were
  omitted.
- Replaced the narrow lookup direction with `DocumentIndexes`: primary maps for all
  six entity families, task-local segment maps, hierarchy children, assignment,
  placement, and dependency relationship maps. Relationship arrays retain document
  order and are frozen; construction does not filter, diagnose, schedule, or mutate.
- The three M0 record-index helpers remain internal temporarily for the scene pipeline
  and are removed during the planned Slice 6 convergence.
- `vp test run packages/gantt/src/model/validate.test.ts` passed (1 file, 4 tests).
- `vp test run packages/gantt/src/model/indexes.test.ts` passed (1 file, 4 tests).
- The upstream `vp test run packages/gantt/src/model/codec.test.ts` passed (1 file,
  16 tests) after validation was integrated.
- The first `vp check` reported formatting only in four changed model files; `vp fmt`
  corrected them. The rerun passed formatting for 42 files and lint/type checking for
  31 files with no warnings or errors.

### 2026-07-30 — Slice 5 stable serialization and round trip

- Added a purpose-built current-schema serializer with the exact known root/record key
  order fixed in the codec decision. Optional known values are omitted, all six
  collections are emitted, and domain arrays retain canonical order.
- Extension objects are serialized recursively with code-unit lexical key sorting.
  The custom JSON writer avoids native integer-like property enumeration changing
  keys such as `"10"` and `"2"`.
- Defensive serializer checks reject non-finite values, `undefined`, cycles, sparse
  arrays, and non-plain object instances instead of allowing native JSON coercion or
  omission.
- Added deterministic empty, Unicode, negative-epoch, nested metadata, numeric-ID,
  key-order, record-order, and unchecked-value coverage.
- Added the full six-collection React-free exit proof:
  `parse -> validate -> index -> serialize -> parse -> validate -> index`. It asserts
  canonical document equality, stable entity/relationship order, string identity,
  instant/all-day and segment preservation, Unicode/nested metadata preservation, and
  byte-identical second serialization.
- `vp test run packages/gantt/src/model/serialize.test.ts` passed (1 file, 8 tests).
- `vp test run packages/gantt/src/model/document-round-trip.test.ts` passed (1 file,
  1 test).
- The first `vp check` reported formatting in the serializer and round-trip test.
  After `vp fmt`, a single literal-schema template warning remained; simplifying the
  defensive message removed it. The final `vp check` passed formatting for 45 files
  and lint/type checking for 34 files with no warnings or errors.

### 2026-07-30 — Slice 6 scene and public facade convergence

- Scene construction now runs the model-owned referential validator once, builds one
  `DocumentIndexes`, and consumes its task lookup. Missing reference recovery and
  diagnostics no longer have a renderer-owned implementation.
- Removed the three temporary M0 record-index helpers and their duplicate diagnostic
  behavior. Index creation itself remains a pure derivation with no filtering or
  diagnostics.
- Kept only missing/non-instant schedules, non-finite schedule values, and
  non-renderable intervals as render-owned diagnostic cases.
- Exported `parseGanttDocument`, `serializeGanttDocument`, `ParseDocumentResult`, the
  normalized document/record/date/duration types, JSON types, and general diagnostics
  from the package facade.
- Removed the temporary `RenderDiagnostic`/`RenderDiagnosticCode` aliases and their
  renderer-owned module. No existing test or documented consumer required them.
- `vp test run packages/gantt/src/render packages/gantt/src/index.test.tsx` passed
  (2 files, 11 tests).
- `vp check` passed formatting for 44 files and lint/type checking for 33 files with
  no warnings or errors.
- `vp pack` passed, producing ESM, source map, CSS, and declaration artifacts; the ESM
  output was 56.92 kB (11.31 kB gzip).
- A focused packed-declaration search found the intentional parse/serialize exports
  and confirmed that migration, validation, index, scene, and render-diagnostic
  internals were absent.
- `vp build apps/playground` passed after transforming 32 modules.

### 2026-07-30 — Slice 7 final documentation and automated gates

- Added `README.md` documentation distinguishing unknown wire input from the
  normalized runtime document, showing the public parse/serialize flow, explaining
  fatal versus recoverable results, and keeping parsing outside React.
- The first `mise run ci` attempt passed 10 test files/57 tests and the package build,
  but failed because the new README section needed formatting.
- `vp fmt README.md` corrected that documentation-only issue.
- The final `mise run ci` passed:
  - formatting for 44 files;
  - lint/type checking for 33 files with no warnings or errors;
  - 10 test files and 57 tests;
  - ESM, source-map, CSS, and declaration package output.
- `mise run build-playground` passed after transforming 32 modules.
- The local playground server started at `http://127.0.0.1:5173/`; `/`, `/matrix`,
  `/@vite/client`, and `/src/main.tsx` each returned HTTP `200`. The server emitted no
  runtime errors during inspection.

### 2026-07-30 — Slice 7 connected browser regression gate

- Chrome DevTools MCP `list_pages` was checked first as required and timed out, so the
  plan-authorized built-in Browser fallback performed the actual connected inspection.
  This limitation is recorded explicitly; no Chrome-specific evidence is claimed.
- Inspected `/` and `/matrix` at `1440 x 900`, `900 x 900`, and `560 x 900`.
- Main-route findings at all three viewports:
  - the corner/time headers and lane/timeline regions shared top and height geometry;
  - page scroll width equaled client width, with chart widths adapting from 1323 to
    826 to 530 pixels and no horizontal page overflow;
  - `data-diagnostic-count` was `0`;
  - lane IDs remained `discovery`, `design`, `delivery`, `release`;
  - task IDs remained `requirements`, `wireframes`, `review`, `build`, `qa`, `launch`;
  - all six original placement IDs remained present;
  - the accessibility tree retained the named chart region, `Scheduled tasks` group,
    and six individually named task images;
  - warning/error console logs were empty.
- Matrix-route findings at all three viewports:
  - all four chart regions reported zero diagnostics;
  - every non-empty chart kept aligned header and lane/timeline geometry;
  - scroll width equaled client width at 1425, 885, and 545 pixels after accounting
    for the vertical scrollbar, so no horizontal page overflow appeared;
  - compact and dark scenarios retained the main lane/task/placement identities;
  - resource overlap retained lanes `alex`, `sam`, `taylor`, four named task images,
    and placement IDs `place-alex-a`, `place-alex-b`, `place-sam-a`,
    `place-taylor-a`;
  - the accessibility tree retained four named chart regions, three
    `Scheduled tasks` groups, 16 named task images, and the empty-state text;
  - computed colors distinguished light, dark, and high-contrast roots, and connected
    screenshots confirmed the compact, dark, overlap, clipped, and empty cases at
    wide and narrow layouts;
  - warning/error console logs were empty.
- Browser asset inspection found the Vite client and playground entry script loaded,
  the DOM at `readyState: complete`, and no console-reported network/runtime errors.
- The temporary browser viewport override was reset, the inspection tab was finalized,
  and the local server was stopped after the gate.
- No live browser issue required an implementation change.
- `git diff --check` passed for the final Slice 7 change set.
- Explicit existence checks passed for architecture, roadmap, completed plan, codec
  decision record, and README.
- A focused cross-document read confirmed the completed M1 status, all seven completed
  slices, both completed final gates, public parse/serialize names, decision links,
  and M2 planning as the actionable next step.

## Progress

- [x] Slice 1: Freeze the codec contract and decision record
- [x] Slice 2: General diagnostics and normalized record contracts
- [x] Slice 3: Versioned wire codec and scalar normalization
- [x] Slice 4: Referential integrity and stable document indexes
- [x] Slice 5: Deterministic serialization and full-domain round trip
- [x] Slice 6: Scene pipeline and public facade convergence
- [x] Slice 7: Documentation, regression gate, and milestone evidence
- [x] Final automated gate
- [x] Final browser gate

## Next Slice

M1 is complete and verified. Create a new detailed M2 change-kernel plan before
implementation, beginning with the patch-representation decision and slices for
command normalization/validation, deterministic patches and inverse patches, atomic
transactions, and local undo/redo. Link that plan from `docs/ROADMAP.md` and do not
start M2 implementation until its decision boundary and per-slice gates are recorded.
