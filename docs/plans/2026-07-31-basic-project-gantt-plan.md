# M5 Basic Project Gantt Implementation Plan

Status: In progress; Slices 1-11 complete, Slice 12 next
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

Status: `[x]` Done

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

**Completed in this slice**

- added optional finite task sibling order across the schema-version-1 model, codec,
  serializer, commands, facade, and packed declaration;
- added iterative pure hierarchy cycle, sibling, root, depth, child, ancestry, and
  subtree-range indexes, including a 5,000-level non-recursive characterization;
- added deterministic parse recovery for missing, self, non-summary-parent, and cyclic
  edges while strict patches/commands reject invalid candidates and permit explicit
  repairs;
- expanded task add/update/delete affected references across descendants and old/new
  ancestor chains, with transaction, patch, inverse, history, and persistence proof.

**Verification**

- focused model/index/command/property/facade tests
- existing codec, serialization, transaction, history, and persistence projection
  suites
- `mise run ci`

**Dependencies**

- Slice 1.

### Slice 3: Resolve project trees, expansion, filtering, and sorting

Status: `[x]` Done and verified

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

Status: `[x]` Done and verified

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

Status: `[x]` Done and verified

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

**Completed in this slice**

- added normalized committed `project.collapsedTaskIds` session state, document-order
  branch reconciliation, controlled complete-session proposals, and project-query
  pipeline invalidation without adding collapse state to the document;
- added pointer and keyboard branch controls, depth/expansion treegrid semantics,
  deterministic hidden-descendant focus/selection recovery, and public selector/slot
  summaries carrying kind, interval source, hierarchy, progress, and descendant data;
- rendered summary bars and canonical progress plus milestone diamonds with semantic
  SVG parts, accessible names, visible focus/selection treatment, centered milestone
  hit targets, and typed branch/summary/milestone class hooks;
- extended the properties surface through `task.update` for kind, parent, and order,
  kept summary schedule/progress and milestone progress read-only, normalized edited
  milestone schedules to one point, and rejected direct summary/milestone move,
  resize, and progress interactions with stable reasons.

**Verification**

- focused React DOM, keyboard, properties, selector, controlled/uncontrolled,
  hydration, and axe suites
- existing M4 interaction, overlay, occurrence-lifetime, appearance, and progress
  suites
- `mise run ci`

**Dependencies**

- Slice 4.

### Slice 6: Add the Community dependency graph and cycle diagnostics

Status: `[x]` Done and verified

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

**Completed in this slice**

- added deterministic incoming/outgoing indexes, iterative reachability, normalized
  strongly connected components, bounded cycle paths, and stable duplicate/cycle/
  working-lag diagnostics without interpreting lag or moving task schedules;
- preserved parsed semantic duplicates, cycles, all four dependency types, all task
  endpoint kinds, and positive/zero/negative elapsed or working lag values while
  keeping invalid missing/self relationships on the existing recovery path;
- added public `DependencyUpdateCommand` normalization, replacement/inverse patches,
  affected old/new endpoints, transactions, history, entity-change projection, null
  clearing, and strict missing/self/semantic-duplicate/new-cycle rejection;
- allowed unrelated commands, dependency deletion, and endpoint repairs to operate on
  documents that already contain diagnosed cycles rather than making graph faults a
  global mutation lock.

**Verification**

- focused scheduler/graph/model/command/property/facade tests
- existing codec/serialization/delete/transaction/history/persistence suites
- fixed-seed long-chain and cyclic-graph observations with no release threshold
- `mise run ci`

**Dependencies**

- Slice 1; may start after Slice 2, but integration assumes Slice 5 kind semantics.

### Slice 7: Route and render dependency paths

Status: `[x]` Complete

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

**Completed in this slice**

- added a React-free orthogonal routing kernel with semantic start/finish anchors for
  all four dependency types, deterministic collision channels, preparatory LTR/RTL
  direction, full content-space geometry, rectangular viewport clipping, and stable
  continuation endpoints;
- projected validated project dependencies into required scene path and relationship-
  summary primitives carrying canonical IDs, source/target occurrence keys, graph
  status, proxy state, route points, and clipping state while leaving repeated-
  occurrence views visual-path-free until they have an explicit pairing contract;
- resolved collapsed descendants and retained filter-context descendants through the
  nearest visible summary, omitted relationships whose endpoints are unavailable or
  collapse to the same proxy, and kept every canonical relationship in the nonvisual
  summary even when no path is painted;
- rendered paths below task geometry with stable SVG parts, oriented end markers,
  continuation dots, noninteractive editing-sized hit segments, invalid/proxy and
  future selected/focused/pending state hooks, reduced-motion behavior, forced-color
  fallbacks, and pointer-independent accessible relationship text;
- reused dependency primitive collections when theme-only scene work leaves semantic
  geometry unchanged, while dependency-only affected invalidation reuses topology,
  lanes, and task primitives and recalculates graph status/routes.

**Verification**

- focused routing/scene/pipeline/SVG/style/SSR/React DOM/axe tests, including all four
  types, deterministic channels, nested-summary collapse and filter proxies,
  same-proxy omission, milestone anchors, vertical virtualization/continuations,
  RTL-preparatory geometry, cycle status, appearance reuse, and selective invalidation;
- existing scene-pipeline/property, interaction-scene fixture, project tree, SSR, and
  stylesheet regressions;
- `mise run ci`: 80 files / 430 tests, 178 formatted files, 167 lint/type files, four
  package artifacts, and a 48.75 kB packed declaration; Mise's user-cache write warning
  remained non-fatal and every repository gate passed.

**Dependencies**

- Slices 5 and 6.

### Slice 8: Add dependency selection and editing workflows

Status: `[x]` Complete

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

**Completed in this slice**

- added the accepted canonical `GanttDependencyTarget`, immutable public dependency
  summaries, selector/session normalization and reconciliation, canonical identity,
  root exports, dependency class states, and logical focus retention independent of
  route occurrence or visibility;
- added finish-to-start link mode from offset 44px task connection handles and the `L`
  keyboard shortcut, visible semantic previews, eligible-task navigation, Enter or
  pointer-release commit, Escape/pointer cancellation, stable unique IDs, and strict
  command rejection without any schedule movement;
- reused one command-bus proposal, acknowledgement, history, persistence, interceptor,
  and diagnostic lifecycle for pointer, touch, keyboard, controlled, and uncontrolled
  creation, update, and deletion; committed creation selects the dependency, rejection
  restores its source task, and deletion restores the canonical source focus;
- made SVG paths focusable/selectable with stable hit precedence and interaction state,
  exposed every canonical link through nonvisual inspect/edit/remove actions, and
  preserved dependency focus when collapse, filtering, viewport clipping, or route
  omission removes visual geometry;
- added a default dependency-properties dialog for all four types and optional elapsed
  lag, direct deletion, read-only inspection, and a bounded `DependencyProperties`
  consumer slot plus dependency path/marker/link-handle class hooks.

**Verification**

- focused runtime/session/React DOM/keyboard/coarse-touch/overlay/selector/history/
  persistence/interceptor/read-only/custom-slot/axe tests, including cancellation,
  controlled acknowledgement, rejection, direct removal, source-focus restoration,
  same-summary visual omission, and collapse-safe logical focus;
- existing M4 gesture, navigation, store, item-properties, SSR/facade, scene, command,
  history, persistence, and style matrices;
- `mise run ci`: 81 files / 443 tests, 179 formatted files, 168 lint/type files, four
  package artifacts, and a 50.78 kB packed declaration; the only warning was Mise's
  known non-fatal user-cache sandbox denial.

**Dependencies**

- Slice 7.

### Slice 9: Add adaptive scales, zoom, and fit-to-project

Status: `[x]` Complete

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

**Completion evidence**

- Pure adaptive selection covers minute through year levels, configured level bounds,
  width-bounded major/minor tick density, explicit locale/time-zone labels, stable
  anchor calculations, finite epoch limits, and symmetric pixel-padded fit ranges.
- Public props now express exclusive controlled/uncontrolled range ownership and
  exclusive legacy-fixed/adaptive scale ownership. Selectors expose the accepted
  range and resolved level; inverted adaptive bounds diagnose and fall back to the
  minimum bound.
- Controlled range changes remain proposals until acknowledgement. Uncontrolled
  changes adopt before callback and retain their accepted value across reconcile.
  `zoomTo` and `fitToProject`, toolbar buttons, plain `+`/`-`/`0`, and pointer-
  anchored Alt/Option-wheel share the same typed range-event lifecycle.
- Fit includes every resolvable project presentation even when collapsed or filtered,
  ignores dependency detours, and announces an empty/unscheduled no-op. Browser
  Ctrl/Meta-wheel, native pinch, and ordinary vertical page scrolling remain native.
- Focused time/scene/runtime/facade/keyboard/wheel/axe suites passed, including fixed-
  seed property runs for monotonic levels, anchor invariance, repeated drift, fit
  padding, collision density, invalid bounds, and extreme epochs. Final `mise run ci`
  passed 82 test files / 454 tests, 182 formatted files, 171 lint/type files, and four
  package artifacts; the packed declaration is 52.35 kB. Mise emitted only the known
  non-fatal user-cache sandbox warning.

**Dependencies**

- Slice 8.

### Slice 10: Complete localization and RTL parity

Status: `[x]` Done

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

Status: `[x]` Done

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
- [x] Slice 2: Add hierarchy integrity, indexes, and strict reparenting
- [x] Slice 3: Resolve project trees, expansion, filtering, and sorting
- [x] Slice 4: Resolve summary and milestone presentation semantics
- [x] Slice 5: Integrate hierarchical task kinds with React and accessibility
- [x] Slice 6: Add the Community dependency graph and cycle diagnostics
- [x] Slice 7: Route and render dependency paths
- [x] Slice 8: Add dependency selection and editing workflows
- [x] Slice 9: Add adaptive scales, zoom, and fit-to-project
- [x] Slice 10: Complete localization and RTL parity
- [x] Slice 11: Prove selective integration and Community boundary
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
- 2026-07-31: Slice 2 implements the accepted hierarchy boundary without visual-tree
  behavior. Parsed self and non-summary-parent edges clear in canonical task order;
  normalized multi-task cycles clear the lexicographically smallest member's parent
  and retain a closed structured path. Strict patches validate the final candidate,
  tolerate only repairable hierarchy faults in the base, and therefore allow ordered
  transaction or deletion repair without accepting unrelated invalid output.
- 2026-07-31: The pure index stores explicit-order/source-order sibling groups, roots,
  depth-first tasks, depths, and half-open subtree ranges. The range representation
  makes descendant lookup contiguous without retaining an O(n squared) descendant
  map. Traversal and cycle detection are iterative; a 5,000-level focused case passes.
- 2026-07-31: Slice 2 focused hierarchy/model/command/property/facade/persistence
  verification passed 9 files / 50 tests before the broader additions, and the full
  suite passed 71 files / 368 tests. Final `mise run ci` passed 164 formatted files,
  153 lint/type files, and four artifacts. The packed declaration is 44.69 kB and
  exposes only task `order` plus its add/update inputs and the three accepted
  diagnostic codes; hierarchy indexes and algorithms remain private.
- 2026-07-31: Slice 3 replaces the flat project projection with deterministic
  depth-first rows derived from the Slice 2 hierarchy. Project lanes now carry frozen
  private depth, child, expansion, and direct/ancestor match metadata while retaining
  the existing task-derived lane and placement keys. Unknown, duplicate, and leaf
  collapse IDs normalize away; matched paths force-open without changing the query.
- 2026-07-31: Public project definitions now accept synchronous filter and sibling-
  local comparator callbacks through the package root. Hooks receive deeply copied,
  frozen task records; callback identity invalidates cached topology; throws,
  non-boolean filters, non-finite comparators, and malformed query state reject with
  distinct structured diagnostics. Comparator ties explicitly fall back to canonical
  explicit-order/source-order/ID sibling order, and matching summaries do not retain
  otherwise unmatched descendants.
- 2026-07-31: Slice 3 focused view/hierarchy/render/layout/viewport/property/facade/
  React-runtime verification passed 17 files / 82 tests. A deterministic 10,000-task
  fixture collapsed 2,000 four-child summaries to exactly 2,000 stable root lanes
  without a timing claim. Full `mise run ci` passed 71 files / 376 tests, 165
  formatted files, 154 lint/type files, and four artifacts. The packed declaration is
  45.05 kB and exposes only the accepted project filter/comparator types; resolved
  tree metadata, query plumbing, and hierarchy engines remain private.
- 2026-07-31: Slice 4 adds a private iterative task-presentation boundary. Summaries
  span every usable descendant presentation recursively, ignore their own schedule
  when such a span exists, fall back to their own schedule otherwise, and expose
  frozen resolved/unresolved descendant counts. A 5,000-level chain verifies that the
  rollup path is non-recursive. Canonical summary progress now paints read-only across
  the resolved span; no progress value is calculated or written back.
- 2026-07-31: All-day boundaries now resolve to the first instant of each canonical
  date in the explicit instance time zone, including verified 23-hour and 25-hour
  Europe/Belgrade days and a structured diagnostic for a date skipped entirely in
  Pacific/Apia. Milestones preserve equal instant/all-day points, diagnose permissive
  unequal parse input and present it at the start, while strict add/update/kind-
  conversion commands reject unequal results without blocking unrelated edits.
- 2026-07-31: Scene primitives now require semantic task presentation data: kind,
  canonical/descendant interval source, bar/summary/milestone geometry, project-tree
  metadata, and summary counts. Point-aware stacking and half-open viewport querying
  include milestones at a range start and exclude them at its end. Selective tests
  verify ancestor summary geometry, callback-sensitive topology, and time-zone
  invalidation. Focused model/command/hierarchy/presentation/time/view/layout/viewport/
  render/interaction/runtime verification passed 51 files / 233 tests. Full `mise run
  ci` passed 75 files / 393 tests, 171 formatted files, 160 lint/type files, and four
  artifacts; the packed declaration is 46.13 kB. Mise also reported a non-fatal
  sandbox denial while refreshing its user cache; every repository gate passed.
- 2026-07-31: Slice 5 commits normalized project expansion to the existing session
  ownership path and feeds it into project topology resolution. Unknown, duplicate,
  and leaf collapse IDs reconcile away in canonical document order. Controlled
  collapse emits one complete proposal, and hiding a focused/selected descendant
  deterministically promotes focus to the collapsing summary and removes hidden
  selections before acknowledgement.
- 2026-07-31: Project React rows now publish one-based treegrid levels and expansion
  state, accessible branch buttons, stable task-derived row identity, branch-aware
  Left/Right navigation, and semantic public occurrence/task summaries. Summary and
  milestone SVG surfaces have distinct stable parts, typed class hooks, accessible
  names, and kind-aware hit geometry; only ordinary tasks expose direct move, resize,
  and progress interaction. The properties surface edits kind, parent, and sibling
  order through one command/history path while enforcing the accepted read-only
  summary/milestone fields.
- 2026-07-31: Focused runtime/session/React/properties/hydration/SSR/hit-test/axe
  coverage passed, including controlled/uncontrolled collapse, hidden-focus recovery,
  tree semantics, public semantic summaries, milestone conversion, point hit targets,
  and unsupported kind interactions. Final `mise run ci` passed 76 files / 401 tests,
  172 formatted files, 161 lint/type files, and four package artifacts; the packed
  declaration is 47.42 kB. Chrome DevTools verified `/interactive` at 1440x1000 and
  the installed narrow minimum of 500x844 with four level-one treegrid rows, no page
  overflow, ordinary-task resize handles intact, and no console warnings/errors. The
  dedicated `/project` browser matrix remains correctly owned by Slice 12/13.
- 2026-07-31: Slice 6 adds one React-free Community graph analyzer. Dependency and
  task iteration order is normalized before indexing and diagnostics; SCC discovery
  and a 5,000-edge chain/cycle characterization are iterative. Cycle paths are capped
  at 32 task IDs with explicit truncation metadata, while complete normalized SCC
  membership remains available internally. Duplicate identity is exactly source,
  target, and type; lag and fields do not make another semantic link.
- 2026-07-31: Parsed valid-endpoint duplicates and cycles survive unchanged with
  deterministic graph diagnostics. Working lag is preserved with a Community warning
  and no scheduling interpretation. Strict add/update commands reject only the new
  missing/self/duplicate/cycle intent; endpoint repairs and unrelated field changes
  remain possible on an already cyclic document. `dependency.update` changes source,
  target, type, lag, and fields through one normalized replacement patch and never
  changes any task schedule.
- 2026-07-31: Focused graph/model/command/transaction/delete/entity-change coverage
  passed 7 files / 38 tests, including fixed-seed arbitrary DAG order, disconnected
  tasks, parallel types, a 5,000-task chain and cycle, all endpoint kinds, inverse
  replay, atomic transactions, history, repair, and persistence projection. Full
  `mise run ci` passed 78 files / 412 tests, 175 formatted files, 164 lint/type files,
  and four package artifacts; the packed declaration is 47.84 kB and adds only the
  public dependency-update command while graph engines remain private.
- 2026-07-31: Slice 7 routes only the single-occurrence project projection. Document,
  resource, and custom views still publish complete nonvisual dependency summaries but
  omit paths because repeated-occurrence endpoint pairing has no accepted M5 contract.
  Project endpoints use canonical task IDs plus resolved occurrence keys; collapsed or
  filtered descendants may substitute only their nearest visible summary context, and
  links whose two endpoints substitute the same summary intentionally have no path.
- 2026-07-31: Routes are constructed over the complete layout catalog before viewport
  projection. A rectangular clip keeps crossing segments and emits start/end
  continuation state, while a route with no timeline/vertical intersection is omitted.
  Five deterministic channel offsets reduce exact overlap without obstacle avoidance;
  later interaction and RTL slices consume the same semantic anchors rather than
  recomputing relationship policy in React.
- 2026-07-31: Focused routing/scene/pipeline/DOM/SSR/style/axe coverage passed,
  including all link types, milestone points, nested collapse/filter proxies,
  same-proxy omission, virtualized offscreen endpoints, cycle diagnostics,
  preparatory RTL direction, theme identity reuse, and dependency-only invalidation.
  Final `mise run ci` passed 80 files / 430 tests, 178 formatted files, 167 lint/type
  files, and four artifacts; the declaration is 48.75 kB. Mise reported only the
  known non-fatal user-cache sandbox warning.
- 2026-07-31: Slice 8 keeps dependency identity canonical even when its route is
  clipped, proxied, filtered, collapsed to the same summary, or outside the viewport.
  Runtime occurrence reconciliation therefore includes nonvisual dependency summaries
  separately from project route occurrences. Removing a focused relationship restores
  its canonical source task when available; other visual changes retain the logical
  dependency target and do not force focus to a proxy path.
- 2026-07-31: Link creation uses an offset 44px handle so the existing resize and
  progress zones retain their established hit policy. Both pointer and keyboard mode
  publish the same canonical source/candidate/type preview, create one deterministic
  unique dependency ID, and dispatch one strict `dependency.add`. The graph command
  remains the final authority for self, missing, duplicate, and new-cycle rejection.
- 2026-07-31: Focused session/runtime/React/keyboard/coarse-touch/properties/selector/
  persistence/history/read-only/custom-slot/axe coverage passed. Controlled creation
  remained pending until acknowledgement and published one dependency entity-change;
  rejection and cancellation created no history. Final `mise run ci` passed 81 files /
  443 tests, 179 formatted files, 168 lint/type files, and four artifacts; the packed
  declaration is 50.78 kB with only the known non-fatal Mise cache warning.
- 2026-07-31: Slice 9 replaces fixed-interval-only orchestration with one pure semantic
  scale/range boundary. Adaptive level selection uses the accepted range and measured
  width after a deterministic 960px SSR baseline; tick density is width bounded and
  calendar labels always receive explicit locale and time-zone inputs. Zoom and fit
  calculations are finite, immutable, anchor stable, and independent from document or
  dependency mutation.
- 2026-07-31: Range ownership is now an exact controlled/default union. Controlled
  gestures and handle calls publish typed proposals and wait; uncontrolled calls
  adopt first and preserve the accepted range through later prop reconciliation.
  Runtime controls, keyboard, and Alt/Option-wheel report runtime semantic sources,
  while public handle calls remain imperative. Ctrl/Meta-wheel, native pinch, and
  unmodified vertical scrolling are not intercepted.
- 2026-07-31: Focused time/property/scene/runtime/facade/keyboard/wheel/customization/
  axe coverage passed. The first full gate exposed and fixed an isolated-declaration
  annotation and an always-present disabled-control compatibility issue; the rerun
  passed 82 test files / 454 tests, 182 formatted files, 171 lint/type files, and four
  artifacts. The declaration is 52.35 kB with only the known non-fatal Mise cache
  warning.
- 2026-07-31: Slice 10 adds the accepted closed message catalog and bounded date,
  date-time, number, and message formatter callbacks. Locale omission is deterministic
  `en-US`; invalid locales diagnose and fall back to `en-US`, while invalid time zones
  diagnose and fall back to `UTC`. Empty or throwing formatter results preserve the
  built-in presentation and emit one stable `format.*` warning. Runtime announcements,
  hierarchy/dependency/zoom labels, properties fields/actions, tooltips, task names,
  ticks, progress, and lag now consume the instance localization boundary without
  reading browser or process defaults.
- 2026-07-31: Direction is an explicit per-instance `ltr`/`rtl` input. Pure scene and
  interaction kernels mirror ticks, bars, summary/milestone points, progress,
  dependency routes, coordinate/time conversion, and semantic resize edges. React
  mirrors handles, previews, zoom anchors, horizontal navigation, branch keys, and
  logical CSS while publishing `dir` on the root and every portaled overlay. Two
  opposite-direction charts remain isolated, and Arabic RTL markup hydrates without
  recoverable errors under the deterministic pre-measurement width.
- 2026-07-31: Focused formatter/scene/pipeline/hit-test/runtime/React/properties/
  keyboard/wheel/SSR/hydration/axe coverage passed 13 files / 126 tests before the
  final fixes. The first full gate exposed and fixed an ambiguous overlapping-edge
  assertion plus compact tooltip-date compatibility. Final `mise run ci` passed 85
  test files / 464 tests, 188 formatted files, 177 lint/type files, and four package
  artifacts; the packed declaration is 54.96 kB. Mise reported only the known
  non-fatal user-cache sandbox warning. Live `/project` responsive and accessibility
  matrices remain deliberately owned by Slices 12 and 13.
- 2026-07-31: Slice 11 closes the formatter-identity gap in the scene-wide cache reuse
  guard and makes dependency primitive work explicit. Locale and formatter-only
  changes now rebuild ticks alone; direction rebuilds ticks, task primitives, and
  dependency geometry without topology/layout/viewport work; collapse/filter/sort
  rebuild topology and downstream projection; dependency-only updates rebuild indexes
  plus dependency summaries/routes without intervals, layout, occurrences, tasks, or
  viewport work; zoom rebuilds ticks, the viewport query, visible task primitives, and
  dependency geometry without rebuilding topology, intervals, layout, or the full
  occurrence catalog. Every case retains exact cold-composer parity.
- 2026-07-31: Fixed-seed property coverage (`20260731`, 50 runs, up to 20 operations)
  composes hierarchy collapse, dependency updates, filters, sorts, locale, direction,
  range, task moves, and titles with cached/cold scene and occurrence parity. A pending
  interactive command remains coherent while collapse, filter, sort, relationship
  projection, and controlled range change simultaneously; focus promotes to the
  visible summary, selection reconciles empty, the command commits once, and undo
  preserves the reconciled session.
- 2026-07-31: Root-facade type coverage accepts the exact M5 localization and direction
  contracts while rejecting `auto`, mixed ownership, mixed scale APIs, and unknown
  message keys. Source inspection confirms private hierarchy, graph, route, pipeline,
  localization, and zoom engines do not escape the root; project kernels have no
  React/DOM/browser/clock/host-locale dependency; Community source has no Pro import,
  licensing gate, working-calendar, auto-scheduling, critical-path, or resource-
  leveling path.
- 2026-07-31: `vp test bench ...scene-project-integration.bench.ts --run` passed the
  `m5-project-v1`/seed `20260731` fixture with 2,000 tasks, 400 summaries, and 1,599
  dependencies. Collapse retained 1,680 visible rows and the even-child filter 1,200.
  Ten-sample local means were 112.94 ms cold, 110.25 ms collapse, 121.37 ms filter,
  103.93 ms dependency-only, and 98.58 ms zoom. These are observations, not thresholds
  or release claims. Final `mise run ci` passed 87 test files / 470 tests, 191 formatted
  files, 180 lint/type files, and four package artifacts; the declaration remains
  54.96 kB with only the known non-fatal Mise cache warning.

## Next Slice

Start Slice 12 by adding the accepted public `/project` consumer and deterministic SSR/
hydration example through package-root imports. Demonstrate the complete deep-tree,
summary/milestone, dependency, filter/sort, zoom, locale, and RTL workflow, document
the public Community boundary, and prove a fresh packed tarball consumer can import
runtime/types/styles without workspace-source or browser-global leakage.
