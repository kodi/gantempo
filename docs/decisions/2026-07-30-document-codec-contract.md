# Decision: Document Codec Contract

Status: Accepted
Date: 2026-07-30
Owners: M1 document-kernel foundation

## Context

M1 introduces the first external-data trust boundary for `@gantempo/gantt`. The
boundary must accept `unknown`, normalize ergonomic JSON-compatible values, report
path-aware diagnostics, preserve unrelated valid records after recoverable failures,
and emit deterministic current-schema JSON. It must remain React-free, deterministic,
small enough for the public package, and usable in browsers, Node, SSR, and workers.

This decision resolves the codec, date, version, recovery, unknown-field, duplicate,
and serialization questions owned by
[`2026-07-30-document-kernel-foundation-plan.md`](../plans/2026-07-30-document-kernel-foundation-plan.md).

## Decision

### Use a small internal codec for schema version 1

M1 will use focused internal decoder functions rather than add a runtime-schema
dependency. Zod 4.4.3 was the credible dependency considered. Its package metadata
reported a 4,558,122-byte unpacked package, while the current package has no runtime
dependencies. Zod provides mature typed schemas and path-bearing issues, but M1 would
still need custom ordered migrations, ID/date normalization, record-level recovery,
duplicate handling, reference validation, and deterministic serialization around it.

The internal option keeps the runtime dependency set unchanged and allows diagnostics
and recovery to follow domain-record boundaries directly. This is not a permanent
rejection of schema libraries: reconsider it if the supported schema surface or
number of external codecs grows enough that duplicated scalar/object validation
becomes a measured maintenance problem.

Implementation helpers, intermediate wire shapes, migrations, validators, and index
builders remain private. The intentional public boundary is:

```ts
interface ParseDocumentResult {
  readonly document?: GanttDocument;
  readonly diagnostics: readonly Diagnostic[];
  readonly sourceSchemaVersion?: number;
}

function parseGanttDocument(input: unknown): ParseDocumentResult;
function serializeGanttDocument(document: GanttDocument): string;
```

### Version inspection and migration

- Schema version `1` is the current and only emitted version.
- The root must be a non-array object with an own `schemaVersion` equal to a positive
  integer.
- A malformed or missing version, a version newer than `1`, or an older version
  without a complete registered migration path is document-fatal.
- The ordered migration registry ships empty. No predecessor fixture is invented
  because no previously published wire schema exists.
- Migrations, when introduced, are pure one-version-to-the-next functions applied
  before current-schema decoding. The parser reports the original accepted version as
  `sourceSchemaVersion`.

### IDs, dates, and schedules

- Wire IDs may be non-empty strings or finite numbers. Numbers normalize with
  JavaScript's locale-independent string conversion. Empty strings, non-finite
  numbers, booleans, bigint values, and objects are invalid IDs.
- Canonical IDs are opaque strings; the codec does not trim, case-fold, or interpret
  them.
- Instant boundaries accept finite epoch-millisecond numbers or ISO-8601 datetime
  strings containing `Z` or an explicit numeric offset. Offset-free datetime strings
  are rejected. Canonical instant boundaries are epoch-millisecond numbers.
- All-day boundaries accept calendar-valid `YYYY-MM-DD` strings only. They remain
  local-date strings and are never converted to instants.
- Canonical M1 task and segment schedules contain an explicit mode and a complete
  half-open interval: `start`/`end` for `instant`, or `startDate`/`endDate` for
  `all-day`. The end must not precede the start. Zero-length task intervals remain
  representable for milestones; the renderer may diagnose non-renderable intervals.
- Host locale, host time zone, current time, `Date` instances, and offset-free parsing
  never affect normalization.

### Recovery and unknown fields

- A malformed root, fatal version failure, or non-array value for a document
  collection leaves `document` absent.
- Missing collections default to new readonly empty arrays.
- A malformed record or an invalid supplied known record field omits that record and
  emits an error diagnostic with its input path. A malformed task segment omits that
  segment rather than its otherwise valid task, with its own path-aware error.
- Invalid document metadata is omitted with an error while otherwise valid
  collections remain available.
- Unknown properties at root, record, schedule, segment, and duration-object levels
  emit warnings and are ignored. Application data is preserved only inside `fields`
  and root `metadata`.
- Extension data must be acyclic JSON-compatible own data made only of `null`,
  booleans, finite numbers, strings, dense arrays, and plain objects. Unsupported
  values and non-plain object instances are rejected rather than coerced.
- Referential validation runs after all structural records are decoded. Dangling or
  incompatible assignment, placement, and dependency records are omitted with error
  diagnostics. Invalid parent references are cleared with an error so the otherwise
  valid primary task, resource, or lane survives. Cycle analysis is deferred.
- Recovery is never silent: each omitted record, segment, metadata object, or cleared
  parent reference has a stable diagnostic code and source path.

### Identity, duplicates, and order

- Collection order is preserved for all accepted records and segments.
- IDs are unique within their entity family after normalization. Task-segment IDs are
  unique within their owning task.
- The first accepted normalized ID wins. Each later duplicate is omitted and receives
  an error diagnostic at its source path.
- Cross-family ID reuse is allowed because entity families remain distinct.

### Stable JSON

- Serialization accepts a canonical `GanttDocument` and returns a JSON string only.
- It always emits schema version `1` and all six collections.
- Root known-field order is `schemaVersion`, `revision`, `tasks`, `resources`,
  `lanes`, `assignments`, `placements`, `dependencies`, `metadata`.
- Record known fields follow their public contract declaration order. Optional known
  fields are omitted when absent; `undefined` is never emitted.
- Arrays preserve canonical domain order. Objects under `fields`, `metadata`, and
  structured diagnostic details are copied recursively with lexically sorted keys.
- Serialization never sorts entity collections, renormalizes IDs or dates, validates
  relationships, or repairs data. Invalid non-JSON extension values are prevented at
  normalization and rejected defensively if an unchecked value reaches the serializer.
- `parse -> serialize -> parse` must preserve canonical document equality, and a
  second serialization must be byte-identical.

## Diagnostic Contract

Diagnostics contain a stable string `code`, `severity`, message, optional
`entityIds`, optional JSON Pointer-like `path`, and optional JSON-compatible
`details`. Tests assert structured fields rather than exact prose.

Initial code families use these prefixes:

- `document.*` for fatal root and collection failures;
- `schema.*` for version and migration failures;
- `value.*` for scalar, JSON, and unknown-property issues;
- `record.*` for malformed or duplicate entities and segments;
- `reference.*` for cross-record integrity failures;
- `render.*` for genuinely render-only conditions.

## Representative Fixture Checklist

Later slices must cover:

- all six collections plus multiple task segments;
- numeric and string IDs that normalize to stable strings;
- instant epoch values, offset-bearing instant strings, negative epochs, and all-day
  dates;
- nested `fields` and root `metadata`, including different source key orders;
- missing collections and empty collections;
- malformed and array roots, invalid/missing/current/future/older schema versions,
  and the empty migration registry;
- malformed records and segments, unknown properties, duplicate normalized IDs,
  invalid dates, non-finite numbers, sparse/cyclic/non-plain extension data;
- dangling parents, assignments, placements, assignment ownership, segment ownership,
  and dependency endpoints;
- unrelated valid records surviving every recoverable failure family;
- byte-identical stable JSON and full-domain parse/serialize/parse equality.

## Consequences

- No runtime dependency or lockfile change is needed for M1.
- The internal decoder will contain more purpose-built code, so focused scalar,
  recovery, and diagnostic-path tests are mandatory.
- Version `1` has no synthetic migration demonstration; migration behavior is proven
  through empty-registry and unsupported-version tests until a real version `0` or
  version `2` contract exists.
- The normalized document is stricter than ergonomic input and is the only model used
  by the serializer, renderer, future commands, and future queries.

## Links

- [Architecture JSON codec](../ARCHITECTURE.md#64-json-codec)
- [M1 roadmap](../ROADMAP.md#m1-document-kernel)
- [M1 implementation plan](../plans/2026-07-30-document-kernel-foundation-plan.md)
