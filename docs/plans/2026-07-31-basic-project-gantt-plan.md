# M5 Basic Project Gantt Implementation Plan

Status: In progress; Slice 1 complete, Slice 2 next
Milestone: M5
Architecture mapping: Slice 4 — Project Gantt capabilities
Last updated: 2026-07-31

## Summary

M5 turns the completed document, change, view/layout/viewport, interaction, and item-
properties foundations into a complete Community project Gantt. The target is one
public React path that supports task trees, summary and milestone presentation, basic
dependency analysis and editing, adaptive zoom, filtering and sorting, localization,
RTL, accessibility, and SSR without introducing Pro scheduling behavior or a second
state model.

This document is the durable implementation handoff for M5. It fixes the dependency
order, records the intended boundaries, names the contract questions that must be
settled before behavior changes, and gives each slice a focused verification gate.

## Target State

At M5 completion, a Community consumer can:

- render a project task tree from canonical `TaskRecord.parentId` relationships;
- expand and collapse task branches while retaining stable occurrence identity,
  focus, selection, and virtualized navigation;
- distinguish ordinary tasks, summaries, and milestones visually and accessibly;
- inspect and edit hierarchy, task kind, and the supported summary/milestone fields
  through the same typed command, acknowledgement, history, and persistence path as
  existing task changes;
- validate a basic dependency graph, diagnose cycles and invalid links, render
  dependency paths, and create, update, or remove links with pointer and keyboard
  parity;
- filter and sort a project view without mutating canonical document order;
- use fixed or adaptive time scales, zoom around a stable anchor, fit the project,
  and retain controlled or uncontrolled session ownership;
- localize dates and built-in messages, render either LTR or RTL, and preserve
  equivalent interaction and geometry semantics;
- import and render in SSR environments without browser globals, hydrate
  deterministically, and consume the packed public package rather than source
  internals.

The milestone is complete only when these behaviors compose in the same default
Community component and the final automated, package, SSR, responsive, accessibility,
console, and network evidence is recorded.

## Planning Decisions

These decisions follow the accepted architecture and completed M1–M4 contracts. Slice
1 formalizes the remaining exact public shapes in the accepted
[`basic project Gantt contract`](../decisions/2026-07-31-basic-project-gantt-contract.md)
before runtime implementation begins.

### 1. Extend the existing canonical model and command path

M5 uses the existing `TaskRecord.kind`, `TaskRecord.parentId`, `TaskRecord.schedule`,
`TaskRecord.progress`, and `DependencyRecord` fields. It does not introduce a parallel
tree, summary, milestone, or link model. Persistent edits continue through typed
commands, deterministic patches, transactions, history, controlled acknowledgement,
and `GanttDocumentChange` projection.

Because the package is unpublished pre-alpha software, Slice 1 accepts one deliberate
schema-version-1 correction: optional finite `TaskRecord.order`, plus matching add and
update inputs, provides durable sibling order. No migration or version bump is needed
because no version-1 package has shipped. This deviation is synchronized with the
architecture, roadmap, and accepted decision before implementation continues.

### 2. Keep canonical order separate from projected view order

Canonical task array order, optional sibling order, and parent relationships remain
document data. Expansion, filters, sorting, and zoom remain session/view state.
Filtering and sorting derive a project view and never rewrite task arrays, sibling
order, parent IDs, schedules, or dependencies.

Task and occurrence IDs keep their current meanings. View keys remain distinct from
canonical IDs, so collapse, filtering, sorting, and virtualization can reconcile
selection and focus without pretending that a task has only one possible occurrence.

### 3. Keep free scheduling manual and diagnostic

Community M5 owns graph construction, dependency-type validation, cycle detection,
diagnostics, paths, and link editing. It does not automatically move task dates,
interpret working calendars, propagate lag through a schedule, calculate critical
path/slack, or persist derived rollups. Those are M6 Pro capabilities.

Summary and milestone presentation must be deterministic from canonical data and
explicit M5 policy. M5 may derive read-only presentation values for a visible summary
from its descendants, but it must not silently write schedules or progress back to
the document. Automatic summary recalculation and persisted rollup behavior remain
Pro scope.

### 4. Keep pure engines below React

Hierarchy projection, graph validation, dependency geometry, adaptive tick selection,
range/zoom calculations, filtering, sorting, and RTL coordinate conversion belong in
pure TypeScript modules. React owns DOM lifecycle, event mapping, accessible surfaces,
measurement, focus transfer, and controlled/uncontrolled orchestration. Renderers
consume semantic primitives and do not infer project-management rules.

### 5. Preserve M4 ownership and compatibility

M5 additions must remain source-compatible with the completed controlled and
uncontrolled document/session contracts unless Slice 1 documents a justified additive
transition. All built-in edits use the existing command bus. Imperative APIs remain
orchestration helpers, not a second data-binding path. Custom views, resource views,
slots, class hooks, overlays, persistence envelopes, and the legacy `taskVariants`
fallback continue to work.

### 6. Treat accessibility, localization, RTL, and SSR as contracts

Hierarchy uses real treegrid levels and expansion state. Dependency linking and
removal have keyboard and non-visual workflows. Built-in text is localizable; dates
use explicit locale and time-zone inputs; direction is instance-scoped rather than
read from unrelated global state. Server markup is deterministic and does not depend
on current time, measurements, browser globals, or the host locale.

## Scope

### In scope

- task-parent integrity, hierarchy-cycle diagnostics, reparenting, and stable sibling
  order;
- project-tree projection, expansion/collapse, ancestor-aware filtering, stable
  sorting, and focus/selection reconciliation;
- summary and milestone semantics, primitives, rendering, properties behavior, and
  interaction restrictions;
- dependency graph construction, validation, cycles, diagnostics, geometry,
  rendering, selection, creation, update, and removal;
- adaptive scale levels and ticks from minute through year granularity where the
  existing epoch/time-zone contract can support them without working-calendar math;
- controlled and uncontrolled zoom/range/session policy, `zoomTo`, and
  `fitToProject`;
- localized built-in messages and date/tick formatting;
- instance-scoped LTR/RTL layout and interaction parity;
- treegrid and dependency accessibility, live announcements, focus retention, and a
  non-visual relationship summary;
- production playground consumers and SSR/hydration/package examples;
- selective pipeline invalidation and fixed-seed structural/performance evidence for
  the new kernels.

### Out of scope

- working calendars, holidays, shifts, working-duration arithmetic, and time-zone-
  aware schedule propagation;
- automatic scheduling, constraints, lead/lag propagation, critical path, slack,
  baselines, variance, resource capacity, workload, and leveling;
- persisted automatic summary rollups or Pro scheduling results;
- split-task authoring, advanced WBS/grouping, cross-project links, and server-backed
  lazy tree loading;
- PDF, image, spreadsheet, or project-planning export/import;
- release compatibility matrices, formal performance thresholds, and full
  accessibility conformance certification owned by M7;
- a second React component, renderer authority, document model, or Pro-specific fork.

## Current State and Behavior to Preserve

- `TaskRecord` already carries `kind`, optional `parentId`, optional schedule, optional
  progress, and segments. `DependencyRecord` already carries endpoints, type, optional
  lag, and fields.
- The codec preserves these records, clears missing parent references, rejects invalid
  dependency endpoints/self-links, serializes deterministically, and keeps the public
  model React-free.
- M2 already provides `task.update` for `kind` and `parentId`, `dependency.add`,
  `dependency.delete`, transactions, patches, inverses, history, and cascade deletion.
  It does not yet provide a dependency-update command or hierarchy-cycle policy.
- M3 intentionally resolves flat project, document, resource, and custom views. It
  preserves stable view keys and provenance but does not interpret hierarchy,
  expansion, filtering, sorting, or dependencies.
- The scene currently exposes lanes, task bars, progress, ticks, and grid lines. It
  has no summary/milestone-specific or dependency-path primitives. Fixed interval
  ticks already accept explicit locale and time zone.
- M4 owns one controlled/uncontrolled per-instance runtime, occurrence-aware
  selection/focus, viewport measurement, vertical virtualization, pointer/touch/
  keyboard interaction, range proposals, overlays, customization, and a narrow
  imperative handle. `range`, `tickAnchor`, and `tickInterval` are currently explicit
  props; adaptive zoom and fit policy were deliberately deferred.
- The M4 appendix exposes semantic appearance and progress. Milestones do not expose
  progress editing, and the accepted M5 policy keeps explicit summary progress read-
  only without deriving a Community rollup.
- Existing source/facade, SSR/hydration, resource/custom-view, interaction, overlay,
  appearance, persistence, and playground behavior must remain green throughout M5.

## Recommended Implementation Shape

```text
canonical document + view/session inputs
  -> hierarchy and dependency indexes
  -> project-tree projection (expand/filter/sort)
  -> summary/milestone presentation resolution
  -> interval and stack layout
  -> dependency route geometry
  -> viewport query and semantic primitives
  -> DOM/SVG treegrid and dependency surfaces

range + scale policy + locale + direction
  -> pure adaptive scale/ticks and zoom proposal
  -> existing range/session ownership path
  -> the same scene and interaction mapping
```

Likely new pure boundaries:

- `packages/gantt/src/hierarchy/` for task-tree indexing, validation, and projection;
- `packages/gantt/src/scheduler/` for Community dependency graph analysis only;
- `packages/gantt/src/layout/` additions for dependency routing;
- `packages/gantt/src/time/` additions for adaptive scale levels, ticks, and zoom;
- additive view/runtime/render/interaction/React types at their existing boundaries.

The accepted M5 decision owns exact public names and behavior. Internal module paths
remain provisional and are not public API.

## Cross-Slice Rules

- Do not import private modules from the playground, examples, package consumers, or
  tests intended to prove the public facade.
- Keep every kernel React-, DOM-, browser-, clock-, and host-locale-independent.
- Use stable canonical IDs and resolved view keys; never use visible array indexes as
  persistent identity.
- Preserve immutable/frozen outputs and deterministic diagnostic order.
- Fail invalid hierarchy or graph operations before patches commit; do not repair
  command intent silently.
- Collapse, filtering, sorting, and zoom do not enter `GanttDocument`.
- Do not move task dates merely because a dependency is added or changed.
- Keep custom/resource/document views source-compatible; project-tree behavior must
  not leak into view kinds that do not opt into it.
- Reconcile selection/focus to a deterministic visible occurrence or clear it with an
  accessible announcement when a branch/filter removes the target.
- Preserve deterministic SSR markup. Measurement and environment observation begin
  only after mount.
- Add property-based tests for graph, tree, range, and coordinate invariants where
  example tests would miss combinatorial failures.
- Record actual verification and material findings in this plan after every slice;
  update `docs/ROADMAP.md` whenever status, scope, evidence, or the next action changes.
- Commit each completed slice separately with a Conventional Commit subject and run
  `mise run ci` before marking it done.

## Ordered Implementation Slices

### Slice 1: Freeze the M5 public and engine contracts

Status: `[x]` Done

**Goal**

Accept one focused decision record for hierarchy, summary/milestone semantics,
dependency analysis/editing, view queries, range/zoom ownership, localization, RTL,
accessibility, and SSR.

**Why here**

M4 deliberately deferred several public policies. Implementing any one of them first
would force adjacent types and interaction semantics by accident.

**This slice should implement**

- audit the packed M4 declarations and current root exports rather than internal
  source types alone;
- prototype the smallest pure type shapes needed to settle the open questions below;
- decide hierarchy-cycle handling at codec, document-validation, and strict-command
  boundaries;
- decide project-view expansion defaults, filter ancestor behavior, stable sorting,
  and controlled/uncontrolled session ownership;
- decide manual versus derived read-only summary schedule/progress presentation and
  milestone schedule normalization without crossing into Pro rollups;
- decide dependency update shape, supported Community link fields, cycle rejection
  versus document diagnostics, and accessible linking workflow;
- decide adaptive scale levels, zoom limits/anchors, fit padding, range ownership,
  and imperative/callback contracts;
- decide localized message and formatter overrides plus explicit direction semantics;
- write `docs/decisions/2026-07-31-basic-project-gantt-contract.md` and synchronize
  architecture and roadmap only where the accepted contract refines durable text.

**Expected output**

- an accepted M5 contract linked from this plan, architecture, and roadmap;
- exact names and ownership rules for later slices;
- characterized package/API/SSR baselines and no runtime behavior change.

**Completed in this slice**

- accepted and cross-linked the exact M5 public/engine contract;
- recorded the pre-publication schema-version-1 task-order correction and all 13
  resolved policy questions;
- characterized the packed M4 facade and preserved runtime behavior unchanged.

**Verification**

- `git diff --check`
- focused link and terminology search across the decision, architecture, roadmap, and
  this plan
- packed declaration inspection after `vp pack`
- `mise run ci`

**Dependencies**

- completed M1–M4 and M4 appendix contracts.

### Slice 2: Add hierarchy integrity, indexes, and strict reparenting

Status: `[ ]` Not started

**Goal**

Make task hierarchy a validated, indexed, deterministic model/query boundary and make
reparenting safe through the existing command path.

**Why here**

Tree projection, summary resolution, accessibility levels, and branch operations all
depend on correct ancestry and stable order.

**This slice should implement**

- pure hierarchy indexes for parent, ordered children, roots, depth, and descendants;
- add optional finite task sibling `order` to the unpublished schema-version-1 model,
  codec, serializer, add/update inputs, root facade, and package declaration;
- diagnostics for self-parenting and hierarchy cycles, including deterministic paths
  and entity IDs;
- strict `task.update` reparent validation that rejects missing parents, self-parent,
  descendant-parent cycles, and invalid kind relationships according to Slice 1;
- affected-reference expansion for old/new parents and descendants where derived
  presentation changes;
- codec/document recovery behavior consistent with the accepted decision without
  losing unrelated tasks;
- fixed-seed and property tests for arbitrary task order, deep trees, forests,
  malformed cycles, reparenting, transactions, patches, inverses, history, and
  entity-change projection.

**Expected output**

- a reusable pure hierarchy boundary;
- safe canonical reparenting with deterministic diagnostics and persistence changes;
- no visual tree behavior yet.

**Verification**

- focused model/index/command/property/facade tests
- existing codec, serialization, transaction, history, and persistence projection
  suites
- `mise run ci`

**Dependencies**

- Slice 1.

### Slice 3: Resolve project trees, expansion, filtering, and sorting

Status: `[ ]` Not started

**Goal**

Turn the flat project view into a pure visible-tree projection without mutating the
document or weakening existing view identity/provenance rules.

**Why here**

Rendering and interaction need one authoritative visible hierarchy before summary
geometry and treegrid semantics can be correct.

**This slice should implement**

- additive project-view query/session inputs accepted in Slice 1;
- deterministic depth-first flattening with stable sibling order and depth metadata;
- resolve canonical siblings by explicit order, then canonical array position and ID
  tie-breaks, before applying any view-only comparator;
- expansion/collapse projection with accepted default behavior;
- ancestor-aware filtering and stable sorting with explicit tie-breaking;
- visible match/ancestor metadata needed by renderers without exposing private
  indexes;
- distinct diagnostics for invalid view query input versus invalid document topology;
- property tests for permutation stability, ancestor retention, collapse behavior,
  filter/sort composition, identity stability, immutability, and custom/resource/
  document-view non-regression.

**Expected output**

- a renderer-independent project tree with stable visible lane/placement keys;
- pure query behavior ready for runtime/session integration.

**Verification**

- focused `view`, hierarchy, and property suites
- M3 resolved-view/layout/viewport parity suites
- fixed-seed 10,000-task/2,000-lane structural observation with no release threshold
- `mise run ci`

**Dependencies**

- Slice 2.

### Slice 4: Resolve summary and milestone presentation semantics

Status: `[ ]` Not started

**Goal**

Produce explicit summary and milestone presentation data and geometry without
silently scheduling or mutating canonical records.

**Why here**

Dependency anchors and React interaction restrictions need stable kind-specific
geometry first.

**This slice should implement**

- pure task-kind presentation resolution from canonical records and the accepted M5
  policy;
- milestone point/diamond geometry with deterministic instant/all-day handling;
- summary bracket/bar geometry, descendant span, and read-only progress behavior as
  accepted in Slice 1;
- structured diagnostics for missing/invalid kind-specific schedule inputs;
- semantic kind/progress data in scene primitives and selective invalidation for
  ancestor-affecting task changes;
- property tests for descendant spans, empty summaries, nested summaries, milestones
  at range boundaries, clipping, virtualization, and immutable output.

**Expected output**

- kind-specific semantic primitives and scene output;
- no DOM/SVG presentation or interaction changes yet.

**Verification**

- focused hierarchy/layout/scene/property tests
- existing interval, stack, viewport, appearance, and progress suites
- `mise run ci`

**Dependencies**

- Slice 3.

### Slice 5: Integrate hierarchical task kinds with React and accessibility

Status: `[ ]` Not started

**Goal**

Render and operate the project tree, summaries, and milestones through the public
React component with correct treegrid, keyboard, properties, and focus behavior.

**Why here**

This proves the hierarchy and kind contracts end to end before dependency UI adds a
second relationship interaction mode.

**This slice should implement**

- treegrid `aria-level`, `aria-expanded`, and branch-control semantics;
- instance-owned expand/collapse actions, callbacks, session updates, and selector
  summaries according to Slice 1;
- branch-aware keyboard navigation and deterministic focus/selection reconciliation
  across collapse, filter, sort, and virtualization;
- kind-specific DOM/SVG parts, accessible names, hit targets, tooltip/content
  summaries, properties fields, and supported kind conversion/reparenting workflows;
- milestone and summary restrictions for move, resize, progress, and schedule editing
  with stable disabled/rejection reasons;
- slots/class hooks that extend current customization without exposing private tree
  indexes.

**Expected output**

- a usable, accessible project tree with summary and milestone surfaces;
- public runtime/session and customization additions accepted in Slice 1.

**Verification**

- focused React DOM, keyboard, properties, selector, controlled/uncontrolled,
  hydration, and axe suites
- existing M4 interaction, overlay, occurrence-lifetime, appearance, and progress
  suites
- `mise run ci`

**Dependencies**

- Slice 4.

### Slice 6: Add the Community dependency graph and cycle diagnostics

Status: `[ ]` Not started

**Goal**

Provide a pure, deterministic basic dependency engine without automatic scheduling.

**Why here**

Rendering and editing should consume one graph result rather than each reimplementing
endpoint, type, or cycle rules.

**This slice should implement**

- indexed incoming/outgoing links and deterministic graph traversal;
- Community dependency-type validation and explicit elapsed lag preservation without
  schedule propagation;
- self-link, duplicate semantic link, missing endpoint, hierarchy/kind restriction,
  and cycle diagnostics according to Slice 1;
- deterministic strongly connected component or equivalent cycle analysis with
  bounded, explainable diagnostic paths;
- an additive `dependency.update` command if accepted, including normalization,
  patches, inverses, history, transactions, affected references, and entity changes;
- property tests for DAGs, disconnected graphs, parallel links, arbitrary input
  order, deep chains, cycles, mutation rejection, and immutability.

**Expected output**

- one React-free graph analysis boundary for validation, rendering, and editing;
- complete command support for the accepted basic link editor.

**Verification**

- focused scheduler/graph/model/command/property/facade tests
- existing codec/serialization/delete/transaction/history/persistence suites
- fixed-seed long-chain and cyclic-graph observations with no release threshold
- `mise run ci`

**Dependencies**

- Slice 1; may start after Slice 2, but integration assumes Slice 5 kind semantics.

### Slice 7: Route and render dependency paths

Status: `[ ]` Not started

**Goal**

Project validated dependencies into deterministic viewport-aware semantic paths and
render them accessibly in SVG.

**Why here**

Editing needs stable anchors, path identity, hit targets, and diagnostics before it
can map gestures to commands.

**This slice should implement**

- kind- and direction-aware anchors for all supported dependency types;
- deterministic orthogonal routing, marker orientation, collision offsets, clipping,
  and z-order over variable-height and virtualized lanes;
- explicit policy for hidden/collapsed/filtered/offscreen endpoints, including when a
  path is omitted versus clipped to a continuation indicator;
- dependency path/marker/hit primitives carrying canonical and occurrence identity;
- SVG rendering, selected/focused/invalid/pending states, forced-colors behavior,
  reduced motion, and pointer-independent accessible relationship summaries;
- selective pipeline invalidation for endpoint geometry, graph, view, viewport,
  direction, and theme changes.

**Expected output**

- visible basic dependency paths with semantic diagnostics and no edit mode yet.

**Verification**

- focused graph/layout/scene/SVG/style/property tests
- clipping, virtualization, nested-summary, milestone, RTL-preparatory, appearance,
  SSR, and forced-colors regressions
- `mise run ci`

**Dependencies**

- Slices 5 and 6.

### Slice 8: Add dependency selection and editing workflows

Status: `[ ]` Not started

**Goal**

Create, inspect, update, and remove basic links through the same public command and
interaction lifecycle for pointer, touch, and keyboard users.

**Why here**

The graph, commands, anchors, hit targets, and route primitives must exist before an
editor can propose valid semantic intent.

**This slice should implement**

- dependency interaction targets, selection/focus summaries, hit precedence, and
  occurrence-independent identity;
- link creation mode with source/target validation, preview path, cancellation,
  controlled acknowledgement, rejection, and exact one-command/one-history behavior;
- touch/pen target sizing and gesture arbitration against task move/resize/progress;
- keyboard creation/removal and accessible relationship inspection/editing;
- default link properties/menu surfaces for type and supported lag fields, plus
  consumer overrides through bounded slots/hooks;
- live announcements and deterministic focus restoration after commit, reject,
  collapse, filter, scroll, and virtualization;
- public-facade, two-instance, read-only, controlled, uncontrolled, persistence, and
  history coverage.

**Expected output**

- complete basic dependency editing with pointer/touch/keyboard parity;
- no automatic task-date changes.

**Verification**

- focused pure interaction, React DOM, keyboard, touch/pen, overlay, command,
  selector, history, persistence, and axe suites
- existing M4 gesture and item-properties matrices
- `mise run ci`

**Dependencies**

- Slice 7.

### Slice 9: Add adaptive scales, zoom, and fit-to-project

Status: `[ ]` Not started

**Goal**

Replace the fixed-interval-only public experience with explicit fixed/adaptive scale
policy and accessible controlled/uncontrolled zoom orchestration.

**Why here**

Zoom must operate over final M5 task and dependency extents, but it is independent of
locale direction until the following slice.

**This slice should implement**

- pure scale-level selection, major/minor ticks, deterministic calendar labels from
  explicit locale/time zone, and collision-aware tick density;
- pure zoom-in/out/to-level and fit-range calculations with finite limits, stable
  anchor time, padding, and empty/unscheduled-document behavior;
- the accepted range/session ownership extension, callbacks, selector summaries, and
  controlled acknowledgement semantics;
- additive imperative `zoomTo` and `fitToProject` orchestration plus accessible
  built-in controls/key bindings as accepted in Slice 1;
- pointer/wheel/pinch behavior only where it composes with existing page/browser zoom
  and pan contracts without intercepting unrelated native gestures;
- selective scene/cache invalidation and property tests for anchor invariance,
  monotonic scales, round trips, extreme epochs, bounds, fit padding, and repeated
  zoom drift.

**Expected output**

- configurable fixed/adaptive time scales and complete basic zoom behavior;
- no working-time compression or calendar-aware snapping.

**Verification**

- focused time/range/runtime/interaction/React/property tests
- existing pan, viewport, SSR, hydration, and scene pipeline suites
- fixed-seed large-range zoom observations with no release threshold
- `mise run ci`

**Dependencies**

- Slice 8.

### Slice 10: Complete localization and RTL parity

Status: `[ ]` Not started

**Goal**

Make all built-in M5 surfaces localizable and mirror layout and interaction correctly
per instance.

**Why here**

Localization and RTL must cover the final hierarchy, dependency, and zoom vocabulary
and geometry rather than retrofit incomplete surfaces multiple times.

**This slice should implement**

- the accepted built-in message catalog and bounded formatter override contract;
- localized tick/date/number/progress/dependency labels with explicit fallback and
  invalid-locale diagnostics;
- instance-scoped `ltr`/`rtl`/accepted auto policy across time scale, tick order,
  task/milestone/summary geometry, dependency markers/routes, scrolling, zoom anchor,
  drag/resize/progress, keyboard direction, overlays, and columns;
- logical CSS properties and mirrored icons/affordances without leaking direction
  between chart instances;
- deterministic SSR/hydration under non-default locale, time zone, and direction;
- representative pseudolocale, Serbian/English, Arabic/RTL, long-text, and Unicode
  test fixtures without claiming a full locale matrix.

**Expected output**

- localizable built-in UI and verified LTR/RTL functional parity;
- no dependency on browser or process default locale/direction.

**Verification**

- focused formatter/time/scene/interaction/React/style/SSR/hydration/axe tests
- two-instance opposite-direction isolation tests
- `mise run ci`

**Dependencies**

- Slice 9.

### Slice 11: Prove selective integration and Community boundary

Status: `[ ]` Not started

**Goal**

Ensure M5 features compose through the existing selective pipeline and remain a
complete Community boundary without Pro behavior or private API leakage.

**Why here**

Cross-feature invalidation, occurrence lifetime, and customization bugs become visible
only after hierarchy, dependencies, zoom, filtering, and RTL coexist.

**This slice should implement**

- dependency maps from task hierarchy, graph endpoints, query/session inputs, scale,
  locale, and direction to the minimum affected pipeline stages;
- cold/cached parity and safe broad fallbacks when dependency analysis is uncertain;
- focus/selection/history/pending-command reconciliation across simultaneous
  collapse, filter, sort, dependency, and range updates;
- root-facade type tests proving only accepted public M5 contracts escape;
- source inspection/tests proving no React/browser dependency in pure kernels and no
  Pro package, licensing, calendar, auto-scheduling, or resource-leveling behavior;
- fixed-seed work counters/benchmarks for representative tree, dependency, filter,
  and zoom updates without creating M7 release thresholds.

**Expected output**

- one integrated, selective Community runtime with explicit safe fallbacks;
- measured structural evidence and no unsubstantiated performance claims.

**Verification**

- focused pipeline/cache/runtime/property/benchmark/facade tests
- complete existing M1–M4 regression matrix
- `mise run ci`

**Dependencies**

- Slice 10.

### Slice 12: Add public consumers, SSR examples, and package proof

Status: `[ ]` Not started

**Goal**

Demonstrate the complete M5 product through public imports in production, SSR, and a
fresh packed consumer.

**Why here**

Examples should validate the accepted final API rather than become an experimental
design surface that implementation follows accidentally.

**This slice should implement**

- a focused project-Gantt playground route or update accepted in Slice 1 showing a
  deep tree, summaries, milestones, dependencies, filter/sort, zoom, locale, and RTL;
- controlled, runtime-owned, and read-only cases where their ownership differences
  materially affect M5 behavior;
- SSR static-render and hydration examples using only root package imports and
  explicit deterministic inputs;
- fresh tarball-consumer install, runtime/type import, stylesheet subpath, peer,
  tree-shaking, and no-browser-global checks;
- concise public documentation for the new APIs, supported Community behavior, and
  deliberate M6 deferrals.

**Expected output**

- reproducible public Community examples and clean package consumption;
- no playground or workspace-source dependency in consumer proof.

**Verification**

- focused playground DOM and SSR/hydration tests
- `mise run build-playground`
- `vp pack` at repository root, then `npm pack`/temporary tarball consumer checks
- root-facade and packed-declaration inspection
- `mise run ci`

**Dependencies**

- Slice 11.

### Slice 13: Run final browser, accessibility, package, and milestone gates

Status: `[ ]` Not started

**Goal**

Collect the exact evidence required to mark M5 complete and hand off M6 planning.

**Why here**

Milestone completion is a product-level claim that requires the final composed public
surface, not only focused unit tests.

**This slice should implement**

- run the complete automated, package, production-build, SSR, and tarball-consumer
  gates;
- use Chrome DevTools MCP for the accepted desktop, narrow, touch/coarse-pointer,
  reduced-motion, forced-colors, LTR/RTL, locale, controlled, runtime-owned, and
  read-only route matrix;
- inspect treegrid/dependency accessibility, keyboard-only creation/removal,
  announcements, focus retention, zoom anchor/fit, clipping, overflow, console, and
  network state;
- record routes, viewport sizes, locale/direction inputs, findings, fixes, exact test
  counts, package artifacts, and any capability Chrome DevTools could not exercise;
- update architecture/decisions only for accepted durable deviations;
- mark M5 and its slices complete only after all evidence passes, update the roadmap,
  and name M6 detailed planning as the next action.

**Expected output**

- verified M5 completion evidence;
- synchronized plan/roadmap/architecture/decision state;
- actionable M6 planning handoff.

**Verification**

- focused final regression suites for issues discovered during browser inspection
- `mise run ci`
- `mise run build-playground`
- repository-root `vp pack` plus fresh tarball-consumer proof
- `git diff --check`
- recorded Chrome DevTools MCP browser/accessibility/console/network matrix

**Dependencies**

- Slice 12.

## Testing Plan

### Per-slice confidence

- pure tree, graph, geometry, time, range, and coordinate tests for deterministic
  kernels;
- fixed-seed property tests for hierarchy and dependency graphs, filter/sort
  composition, zoom invariants, RTL transforms, patches, and inverses;
- DOM tests for accessible semantics, focus, pointer/touch/keyboard parity,
  controlled acknowledgement, cancellation, rejection, and instance isolation;
- SSR/static-render and hydration tests with browser globals absent and explicit
  locale/time-zone/direction inputs;
- facade and packed-declaration tests for public API containment;
- production playground tests for consumer-owned behavior rather than private
  runtime inspection.

### Final confidence

- complete `mise run ci` after every completed slice and at final closure;
- `mise run build-playground` for consumer production integration;
- repository-root `vp pack` and a temporary tarball consumer when runtime imports,
  exports, peers, or stylesheet behavior change;
- `git diff --check` for every slice;
- Chrome DevTools MCP responsive/accessibility/console/network verification for the
  routes and matrices accepted in Slice 1.

M7 owns formal cross-machine thresholds and full release compatibility/conformance.
M5 records reproducible structural observations only and does not turn local timing
into a product claim.

## Likely Files to Add

The accepted contract fixes public names; internal filenames may still change while
preserving the intended ownership:

- `docs/decisions/2026-07-31-basic-project-gantt-contract.md`
- `packages/gantt/src/hierarchy/*`
- `packages/gantt/src/scheduler/dependency-graph.ts`
- `packages/gantt/src/layout/route-dependencies.ts`
- `packages/gantt/src/time/adaptive-time-scale.ts`
- focused model/view/layout/render/runtime/interaction/React/SSR/property tests
- one public playground/SSR example and its consumer tests

## Likely Files to Change

- `packages/gantt/src/model/{types,codec,serialize,diagnostics,indexes,validate}.ts`
- `packages/gantt/src/model/schema/*`
- `packages/gantt/src/commands/{types,normalize,reduce}.ts`
- `packages/gantt/src/view/{types,resolve-view}.ts`
- `packages/gantt/src/render/{primitives,scene-pipeline}.ts`
- `packages/gantt/src/runtime/{types,session,range-proposals}.ts`
- `packages/gantt/src/interaction/*`
- `packages/gantt/src/react/{types,runtime,Gantt,surfaces}.tsx`
- `packages/gantt/src/styles.css`
- `packages/gantt/src/index.tsx`
- `apps/playground/src/*`
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, public usage documentation, and this
  plan as status/evidence changes
- package manifests/lockfile only if a justified consumer, SSR, or test dependency is
  required

The current planning change does not touch the pre-existing local modifications in
`packages/gantt/src/styles.css` or `packages/gantt/src/styles.test.ts`. A future slice
that needs those files must inspect and preserve the user's changes before editing.

## Risks and Mitigations

- **Hierarchy recovery can lose meaning.** Clear only the invalid edge selected by the
  accepted deterministic rule, preserve every task and unrelated branch, diagnose the
  repair, and never silently accept strict invalid intent.
- **Summary semantics can cross the Community/Pro boundary.** Keep M5 presentation
  derivation read-only and prohibit automatic persisted rescheduling/rollups.
- **Filtering can orphan context.** Define ancestor retention and focus reconciliation
  in Slice 1, then property-test filter/sort/collapse composition.
- **Dependency paths can defeat virtualization.** Route from indexed visible geometry,
  define hidden/offscreen behavior explicitly, and observe work counters before UI
  integration.
- **Link gestures can conflict with task gestures.** Fix hit precedence, explicit
  modes, cancellation, and coarse-pointer target geometry before DOM implementation.
- **Zoom can create ownership loops.** Keep calculations pure and proposals distinct
  from accepted controlled range/session state.
- **RTL can be cosmetic but functionally wrong.** Mirror scale, geometry, markers,
  scroll, pointer, keyboard, and zoom anchors together; test opposite-direction
  instances on one page.
- **Localization can destabilize SSR.** Require explicit inputs and deterministic
  fallbacks; never use environment defaults for server markup.
- **M5 can become too large to review.** Keep every numbered slice independently
  green, commit it separately, and add a numbered follow-up slice only when a real
  bounded deviation emerges.

## Resolved Slice 1 Questions

The accepted
[`basic project Gantt contract`](../decisions/2026-07-31-basic-project-gantt-contract.md)
owns the full shapes and rationale. In summary:

1. parsing clears self/non-summary-parent edges and one lexicographically selected
   edge per cycle with diagnostics; strict commands reject the same intent;
2. omitted project expansion state means all branches expanded, while committed
   session state records collapsed task IDs;
3. project filter and sort are synchronous pure callbacks; matches retain ancestors,
   matching paths force-expand without mutating session, and sorting is sibling-local;
4. unpublished schema version 1 gains optional finite task `order`, with canonical
   array position and ID as deterministic tie-breakers;
5. summaries derive read-only spans from usable descendants, fall back to their own
   schedule when empty, and render only explicit canonical progress read-only;
6. milestones require equal instant endpoints or all-day dates for strict edits;
   permissive unequal input is diagnosed and presented at its start;
7. duplicate identity is source, target, and type; parsed duplicates/cycles survive
   with diagnostics while strict dependency edits reject new faults;
8. `dependency.update` can change endpoints, type, lag, and fields; built-in Community
   editing writes elapsed lag and preserves working lag read-only;
9. collapsed endpoints proxy to visible ancestor summaries, filtered endpoints proxy
   only through retained context, and offscreen routes clip with continuation markers;
10. range becomes an exclusive controlled `range` or uncontrolled `defaultRange`
    union, while fixed legacy ticks and explicit fixed/adaptive `timeScale` branches
    remain mutually exclusive;
11. toolbar, imperative, plain-key, and Alt/Option-wheel zoom are supported; browser
    pinch, Ctrl/Meta-wheel, and unmodified page-scroll gestures are not intercepted;
12. localization combines typed message templates with bounded formatters; direction
    is explicit `ltr`/`rtl` with deterministic LTR default and no `auto`;
13. `/project` is the public example, with controlled/uncontrolled/read-only,
    English/Serbian/Arabic, desktop/narrow, LTR/RTL, media-emulation, accessibility,
    console, and network cases fixed in the decision.

## Progress

- [x] Slice 1: Freeze the M5 public and engine contracts
- [ ] Slice 2: Add hierarchy integrity, indexes, and strict reparenting
- [ ] Slice 3: Resolve project trees, expansion, filtering, and sorting
- [ ] Slice 4: Resolve summary and milestone presentation semantics
- [ ] Slice 5: Integrate hierarchical task kinds with React and accessibility
- [ ] Slice 6: Add the Community dependency graph and cycle diagnostics
- [ ] Slice 7: Route and render dependency paths
- [ ] Slice 8: Add dependency selection and editing workflows
- [ ] Slice 9: Add adaptive scales, zoom, and fit-to-project
- [ ] Slice 10: Complete localization and RTL parity
- [ ] Slice 11: Prove selective integration and Community boundary
- [ ] Slice 12: Add public consumers, SSR examples, and package proof
- [ ] Slice 13: Run final browser, accessibility, package, and milestone gates
- [ ] Final automated/package/SSR gate
- [ ] Final browser/accessibility/console/network gate

## Working Notes

- 2026-07-31: Planning audited the current roadmap, architecture Slice 4, Community/
  Pro boundary, M3/M4 decisions, completed M4 appendix handoff, canonical model,
  command facade, flat view resolver, scene primitives, runtime session, React props,
  time ticks, repository scripts, and current file layout.
- 2026-07-31: The canonical records already contain most durable M5 data. The highest-
  risk work is policy and derived behavior, so the plan starts with a cross-boundary
  decision rather than a schema expansion.
- 2026-07-31: Existing `dependency.add` and `dependency.delete` commands prove the
  persistence path but do not provide graph/cycle analysis, paths, edit interaction,
  or update semantics.
- 2026-07-31: The current project view is deliberately flat and the runtime session
  contains only selection, focus, and vertical viewport intent. Expansion, filter,
  sort, scale, and range ownership must be added without changing document data.
- 2026-07-31: `locale` and `timeZone` already reach fixed tick and task-date formatting,
  but built-in messages and direction are not yet public instance contracts.
- 2026-07-31: Planning changed documentation only. No runtime behavior was
  implemented or verified, so M5 remains `[ ]` and every implementation slice remains
  not started.
- 2026-07-31: Planning validation passed the tracked `git diff --check`, a clean
  trailing-whitespace scan of the new plan, linked-file existence checks, a focused
  stale-current-handoff search, and a structure check confirming 13 slices with all
  six required handoff sections. The code/test/build suite was not run because this
  change only adds and links planning documentation.
- 2026-07-31: Slice 1 audited the clean `main` checkout at `26a94b4`, current root
  exports, source public types, and a fresh four-artifact `vp pack`. The packed M4
  declaration is 44.51 kB and confirms that task sibling order, dependency update,
  project queries/session, adaptive scale/range ownership, localization/direction,
  and dependency targets are not yet public.
- 2026-07-31: The user confirmed that the package is unpublished pre-alpha software
  and authorized schema-version-1 rework where it improves the durable contract.
  Slice 1 therefore accepts optional finite task sibling `order` in schema version 1
  rather than making array position the only durable tree-order mechanism. This is a
  substantive deviation from the plan's no-schema-change expectation, but it needs no
  migration or version bump because no version-1 artifact has shipped.
- 2026-07-31: The accepted M5 decision resolves all 13 contract questions, including
  deterministic hierarchy repair, collapsed-ID session state, pure project query
  callbacks, read-only summary spans, milestone points, graph/update policy, proxy and
  clipped dependency paths, keyboard linking, range/scale ownership, zoom gesture
  exclusions, deterministic localization/RTL, SSR behavior, and the `/project`
  acceptance matrix. Runtime behavior remains unchanged in this docs-only slice.
- 2026-07-31: Slice 1 verification passed on the final contract state. `mise run
  check` covered 160 formatted files and 149 lint/type files. Focused decision/plan/
  architecture/roadmap link and stale-handoff searches passed, `git diff --check`
  passed, and `vp pack` produced four artifacts including the 44.51 kB packed M4
  declaration. Full `mise run ci` passed 68 test files / 357 tests, formatting,
  lint/types, and the same four package artifacts. No runtime code changed.

## Next Slice

Start Slice 2 in `packages/gantt/src/model/types.ts`, the private record schemas and
codec/serializer, `packages/gantt/src/model/{diagnostics,indexes,validate}.ts`, and
`packages/gantt/src/commands/{types,normalize,reduce,validate}.ts`. Add optional finite
task `order`, build the pure hierarchy indexes/recovery boundary, and enforce strict
add/update parent and kind rules with affected old/new ancestor and descendant
references. Preserve every unrelated parsed task and existing dependency faults. Add
fixed-seed properties for order, forests, cycles, reparenting, transactions, patches,
inverses, history, facade types, and entity-change projection; then record focused
evidence and run `mise run ci` before the Slice 2 commit. Do not begin visible tree
projection in Slice 3 until Slice 2 is verified.
