# M4 Appendix: Item Properties, Semantic Color, and Progress Plan

Status: Planned; starts only after the base M4 plan and its final gates are complete
Date: 2026-07-30
Milestone: M4 appendix

## Summary

Add a bounded post-M4 appendix for inspecting and editing the standard properties that
users expect on tasks and lanes, with first-class semantic color variants and complete
progress behavior. This appendix exists so the work does not enter the in-progress M4
interaction-runtime implementation through an unreviewed scope change.

The target is not a universal property framework or a complete project-management
editor. It is the useful intersection proven across mature Gantt and scheduler
products: identity, schedule, duration, progress, description, semantic appearance,
lane placement, and deletion. Every edit must use the same M2/M4 command path as
direct manipulation.

Color must work at task and lane level without collapsing Gantempo's separate task,
lane, and placement concepts. Documents persist semantic variant IDs, not raw CSS
colors or theme configuration. Themes and portable appearance rules resolve those IDs
into coordinated task, progress, text, border, and lane treatments across DOM/SVG,
future canvas rendering, portals, and export.

## Relationship to the Base M4 Plan

This is an additive appendix, not a new slice inserted into
[`2026-07-30-interaction-runtime-public-api-plan.md`](2026-07-30-interaction-runtime-public-api-plan.md).

- Do not implement this appendix while any base M4 implementation slice or final gate
  is active.
- Do not modify base-M4 target contracts merely to make appendix implementation
  easier.
- Begin Appendix Slice A1 from the verified package facade and interaction behavior
  that exist when base M4 closes.
- Record any mismatch discovered at that boundary as an appendix deviation before
  changing architecture, the base runtime, or public APIs.

The appendix may reuse and extend the verified runtime, editor slot, command bus,
semantic events, hit testing, keyboard behavior, and accessibility bindings. It must
not introduce another ownership model, mutation path, or renderer-specific document
format.

## Research Baseline

The competitor intersection informing this plan is:

- DHTMLX and Bryntum support task-level color directly while allowing
  class/template/renderer-derived styling.
- Bryntum exposes an optional task color picker in both its task editor and menu.
- SVAR and Webix primarily distinguish task types through theme-level colors and
  allow applications to extend task data and editors.
- Syncfusion derives taskbar paint from task data during rendering and supports custom
  dialog fields instead of treating color as a required scheduling property.
- FullCalendar and similar resource schedulers allow a resource-level event-color
  default that an explicit event color can override.
- Across mature editors, the consistent basic fields are name, start/end or duration,
  progress, type, and description/notes. Dependencies, resources, calendars,
  constraints, effort, baselines, and segments belong to deeper or specialized tabs.

Primary research references:

- [DHTMLX task coloring](https://docs.dhtmlx.com/gantt/guides/colouring-tasks/)
- [DHTMLX edit-form configuration](https://docs.dhtmlx.com/gantt/guides/default-edit-form/)
- [Bryntum Gantt styling](https://bryntum.com/products/gantt/docs-llm/guide/Gantt/customization/styling.md)
- [Bryntum task editor](https://bryntum.com/products/gantt/docs-llm/api/Gantt/widget/TaskEditor.md)
- [SVAR React Gantt editor](https://docs.svar.dev/react/gantt/guides/ui-layout/editor/)
- [Syncfusion taskbar rendering event](https://ej2.syncfusion.com/documentation/gantt/events)
- [Syncfusion edit-dialog fields](https://ej2.syncfusion.com/documentation/api/gantt/editdialogfieldsettings)
- [Webix Gantt user guide](https://docs.webix.com/gantt__userguide.html)
- [FullCalendar event model](https://fullcalendar.io/docs/event-object)
- [FullCalendar resource model](https://fullcalendar.io/docs/resource-object)

## Target State

At appendix completion:

- a selected task occurrence exposes one accessible properties surface that can
  inspect and edit the supported task and placement properties;
- a selected lane exposes its own bounded properties surface;
- one semantic variant can be persisted on a task and one on a lane;
- a lane variant supplies the default appearance for otherwise unstyled task
  occurrences in that lane;
- an explicit task variant follows the task across views and overrides the lane
  default;
- a task without an explicit variant can render differently in different lanes
  because each occurrence inherits its lane's variant;
- the default theme can use the lane variant for a restrained lane accent/header
  treatment without filling the entire row with saturated color;
- progress is canonical task data, renders as a proportional layer, is editable in
  the properties surface, and has equivalent pointer and keyboard workflows where
  supported;
- progress paint comes from the effective semantic variant rather than an independent
  persisted color;
- title, description, schedule, duration, progress, appearance, lane placement, and
  deletion use typed commands and the M4 dispatch/acknowledgement lifecycle;
- task kind and stable IDs are inspectable; unsupported kind conversions stay disabled
  with an explicit reason until M5 owns their complete semantics;
- unknown application variant IDs survive codec and serialization round trips and
  render through a deterministic fallback;
- controlled and uncontrolled consumers receive the same immutable change envelopes;
- DOM/SVG, SSR, package, accessibility, responsive browser, and forced-colors evidence
  is recorded before the appendix is marked complete.

## Decisions

### 1. Persist semantic variant IDs, never theme configuration

Task and lane records may carry one optional semantic variant ID. Appendix Slice A1
fixes exact public naming, with this intended meaning:

```ts
interface ItemAppearanceReference {
  readonly variant?: string;
}

interface TaskRecord {
  readonly appearance?: ItemAppearanceReference;
}

interface LaneRecord {
  readonly appearance?: ItemAppearanceReference;
}
```

The document stores only an application-meaningful identifier such as `"blocked"`,
`"external"`, `"team-blue"`, or `"release"`. It does not store CSS colors, token maps,
theme objects, React values, or renderer-specific classes.

Variant IDs are trimmed, bounded non-empty strings. Codecs preserve unknown valid IDs
so documents do not lose application meaning when loaded without the full theme. An
unknown variant uses the normal kind/theme fallback and produces at most one
structured appearance diagnostic per distinct unresolved ID, not per frame or
occurrence.

### 2. Use explicit and narrow appearance precedence

Effective item appearance resolves from lowest to highest priority:

```text
theme and task-kind default
  -> lane semantic variant
  -> explicit task semantic variant
  -> derived system state
```

Derived system state includes selected, focused, dragging, resizing, pending, invalid,
disabled, critical, and forced-colors behavior. These states may alter paint or add
non-color indicators, but never replace the persisted variant.

This appendix does not persist placement-, assignment-, or segment-level appearance.
Lane inheritance already permits a task without an explicit variant to appear
differently in different lanes. A future one-off occurrence override requires its own
plan and an explicit placement-update command.

### 3. Give lane color two related but distinct effects

A lane variant:

1. supplies the default semantic appearance of task occurrences in that lane when the
   task has no explicit variant;
2. supplies a restrained lane identity treatment, such as an accent marker, header
   detail, or subtle surface token.

The default theme must not wash the complete timeline row in a strong task color.
Lane and task token families stay separate even when they originate from the same
variant ID.

### 4. Treat progress as task data and variant-resolved paint

`TaskRecord.progress` remains the only persistent progress value. Its normalized range
stays `0..1`; editors present `0..100%`.

Each effective variant coordinates:

```text
task fill
task progress fill
task text
task border
lane accent/surface
```

There is no persistent `progressColor` field. This prevents combinations that break
text contrast or obscure selected, invalid, critical, and forced-colors states.
Data-visualization-specific overrides remain available through the portable appearance
resolver.

Required progress behavior:

- `0` renders no completed layer;
- `1` renders the completed layer across the full eligible task width;
- non-finite values and values outside `0..1` reject through stable command
  diagnostics rather than clamp silently;
- the properties surface edits integer percentages and converts deterministically to
  the canonical fraction;
- pointer adjustment uses a preview and commits one `task.update`;
- keyboard adjustment uses the same intent and command path, with documented normal
  and accelerated steps;
- milestones do not expose progress editing;
- summary progress stays read-only until M5 defines whether it is derived, manually
  owned, or capability-computed;
- progress is announced textually and never communicated by color alone.

### 5. Ship a bounded standard properties intersection

The default task properties surface covers:

- stable task ID, read-only;
- task kind, read-only where conversion semantics are incomplete;
- title;
- description;
- instant start and end;
- derived duration display, with one unambiguous editable duration control if the
  verified time contract supports it without M5 calendar policy;
- progress;
- task semantic variant, including `Inherit lane`;
- current lane/placement;
- delete.

The default lane properties surface covers:

- stable lane ID, read-only;
- title;
- lane semantic variant, including `Theme default`;
- linked resource identity when present, read-only.

The placement section may move an unambiguous persisted placement to an explicit lane
through the existing command/mapping boundary. It does not edit assignments,
resources, or derived/custom topology.

Description is part of the standard intersection and should receive a first-class
optional task field if Slice A1 confirms that it remains a backward-compatible
schema-version-1 extension. The default editor should not hide it inside an
application-specific `fields` convention.

### 6. Build the properties surface on existing M4 selection and editing

The appendix adds one selection-driven properties surface, not a parallel mutation
form:

- selecting a task or lane updates the inspected target;
- task activation, `Enter`, the context menu, or an Edit action can move focus into
  the properties surface;
- the surface may be inline, a side panel, or use the replaceable M4 editor slot, but
  all presentations share one typed value/validation contract;
- closing, Escape, click-away, focus return, pending state, validation labels, and
  announcements reuse verified M4 behavior;
- custom editors receive immutable values and dispatch helpers, never a mutable
  document or record setter.

The default playground proof uses a side panel on desktop and a contained overlay or
stacked panel at narrow width. The package contract does not require that layout.

### 7. Register the editable variant palette outside document data

Documents may preserve any valid variant ID. The editor palette comes from
instance/view configuration:

```ts
interface GanttAppearanceVariantOption {
  readonly id: string;
  readonly label: string;
  readonly tokens?: Partial<Record<PortableVisualToken, string | number>>;
}
```

Exact naming is fixed after M4 closes. Requirements:

- an option can resolve coordinated task, progress, text, border, and lane tokens;
- the picker shows semantic labels and accessible swatches;
- task editing offers `Inherit lane`;
- lane editing offers `Theme default`;
- a persisted unknown variant remains visible as unavailable rather than being erased
  on save;
- applications can replace the palette/editor without replacing resolution or command
  behavior;
- a small accessible demonstration palette may exist, but core scheduling does not
  assign workflow meanings such as priority or status.

### 8. Defer advanced properties deliberately

Out of scope:

- hierarchy and parent changes;
- summary/milestone conversion policy;
- dependency editing;
- assignments, allocation, role, and resource reassignment;
- calendars, constraints, scheduling mode, effort, cost, and capacity;
- baselines, segments, rollups, critical-path configuration, and arbitrary tabs;
- schema-generated forms;
- raw color input, gradients, images, per-pixel styles, or theme authoring;
- persisted placement-, assignment-, dependency-, or segment-level appearance;
- a general workflow/status taxonomy.

M5 owns hierarchy, kinds, dependencies, and complete project-Gantt behavior. M6 owns
resource and advanced scheduling properties.

## Behavior to Preserve

- Existing documents without appearance or description retain byte-stable canonical
  output unless explicitly changed.
- The current `taskVariants` prop remains source-compatible through the transition or
  gets a separate documented deprecation path; it never changes persistent records
  implicitly.
- The same task rendered multiple times keeps one task identity and command target.
- Lane variants never mutate tasks merely because tasks inherit their appearance.
- Changing a lane variant does not rewrite every task in that lane.
- Changing a task variant affects all rendered occurrences of that task.
- Controlled props remain authoritative and property edits remain proposals until
  acknowledged through M4.
- Read-only usage may inspect but cannot mutate.
- Appearance-only changes do not invalidate schedule, interval, stacking,
  lane-height, or viewport geometry.
- Progress changes invalidate only the minimum primitive/accessibility stages proven
  by tests.
- Theme switching and variant resolution remain instance-scoped and SSR-safe.

## Cross-Slice Rules

- Start no implementation before the base M4 final automated/package/SSR and
  browser/accessibility gates are recorded complete.
- Every appendix repository change updates this plan and `docs/ROADMAP.md` together.
- Record deviations here immediately; update architecture and a decision record when
  a deviation changes a durable boundary.
- All mutations use typed commands and the M4 async dispatch path.
- Persistent records contain plain JSON-compatible data only.
- Store semantic IDs, not raw colors or themes.
- Keep progress numeric, deterministic, and independent from paint.
- Never use color alone for progress, selection, validation, criticality, or disabled
  state.
- Preserve renderer portability.
- Keep the surface useful without becoming a form-builder framework.

## Implementation Shape

### Domain and commands

Likely domain changes are optional task/lane appearance references and an optional
task description. Slice A1 determines whether these are additive schema-version-1
fields or need migration. Normalization, diagnostics, stable serialization, cloning,
equality, indexes, commands, patches, inverse patches, transactions, affected
references, and history must stay deterministic.

Preferred command paths:

- `task.update` for title, description, schedule, progress, and task appearance;
- a narrow lane update command for lane title and appearance;
- `placement.move` for an unambiguous persisted lane change;
- `task.delete` for deletion;
- one transaction when one Save changes concepts that must commit atomically.

Do not route canonical appearance through the React-only `taskVariants` prop.

### Appearance resolution and invalidation

Add a pure renderer-independent effective-appearance stage using copied
task/lane/provenance context and configured variants. Publish only the semantic
variant and portable token references needed by primitives.

Invalidation should distinguish:

- lane appearance: rebuild appearance/primitives for visible occurrences in that
  lane, not schedule/layout;
- task appearance: rebuild all visible occurrences of that task, not schedule/layout;
- progress: rebuild progress/accessibility primitives for that task;
- theme/registry: refresh paint resolution without document revision or history.

### Renderer and accessibility

Task primitives need progress geometry and effective variant information without DOM
or CSS types. The DOM/SVG renderer exposes stable task-track, progress, label,
lane-accent, and editing-handle parts.

Accessibility requires:

- task names with schedule and progress;
- a semantic progress value without duplicate SVG announcements;
- keyboard-operable progress changes;
- non-color distinctions for selection, focus, invalid, pending, and forced colors;
- contrast checks for each demonstration variant at partial progress;
- focus retention when the inspected target is virtualized or disappears.

### Properties surface

Build one internal typed property/value contract for the default task and lane
surfaces. It is not a public arbitrary form schema. Slots may replace fields or the
surface while retaining:

- target identity;
- immutable initial/current values;
- dirty and pending state;
- local validation and reducer diagnostics;
- Save, Delete, Cancel, and focus return;
- command dispatch helpers;
- controlled acknowledgement and stale-target handling.

## Slices

### Appendix Slice A1: Freeze the properties and appearance contract

Status: `[x]` Done

**Goal**

Turn this plan into a durable public/domain contract before touching verified M4.

**Why here**

Precedence, progress paint, description persistence, compatibility, and editor
ownership affect every later boundary.

**This slice should implement**

- Audit the final M4 facade, editor slot, events, selectors, and targets.
- Fix names/types for task/lane appearance and registered variant options.
- Decide schema-version handling for description and appearance.
- Fix unknown-variant fallback and diagnostics.
- Fix normal/accelerated progress steps and supported kinds.
- Add or update the decision record, architecture, theming strategy, this plan, and
  roadmap.
- Record any M4 limitation as a deviation rather than silently rewrite it.

**Expected output**

- One accepted persistence, precedence, rendering, editing, accessibility, and
  compatibility contract.
- No runtime change.

**Verification**

- Documentation terminology/link review.
- API sketch review against packed M4 declarations.
- `vp check`

**Dependencies**

- Base M4 final gates complete.

### Appendix Slice A2: Add canonical task/lane properties and commands

Status: `[x]` Done

**Goal**

Make description and semantic variants canonical, serializable, and command-editable
without changing rendering.

**Why here**

UI and appearance need a verified persistence/mutation boundary.

**This slice should implement**

- Add accepted optional task description and task/lane appearance fields.
- Extend parsing, normalization, diagnostics, serialization, cloning, equality, and
  round-trip fixtures.
- Extend `task.update`; add the narrow lane update command.
- Preserve validation, patches/inverses, affected references, transactions, history,
  and controlled envelopes.
- Add fixed-seed properties covering unknown variants, lane inheritance inputs,
  progress boundaries, and unrelated-record preservation.
- Keep facade exports small.

**Expected output**

- A React-free canonical property and command kernel.
- No visual or editor change.

**Verification**

- Focused model/codec/serialization tests.
- Focused command/patch/transaction/history tests.
- Fixed-seed round-trip and update properties.
- `vp check`
- `vp test run`
- `vp pack` plus declaration inspection.

**Dependencies**

- Appendix Slice A1.

### Appendix Slice A3: Resolve appearance and progress primitives

Status: `[x]` Done

**Goal**

Add renderer-independent lane/task variant resolution and canonical progress
primitives with minimal invalidation.

**Why here**

Visual and interaction layers need stable appearance and geometry, not raw records or
ad hoc CSS.

**This slice should implement**

- Add the pure resolver and explicit precedence tests.
- Extend invalidation for lane appearance, task appearance, progress, and registry
  changes.
- Add lane-accent and task-progress primitive data.
- Prove lane inheritance and explicit task override with repeated tasks.
- Add deterministic unknown-variant fallback.
- Preserve state overlays and non-color affordances.
- Replace playground-only index-cycled tones in the appendix proof with real semantic
  data/configuration when introduced.

**Expected output**

- Cold/cached-equivalent appearance and progress scene output.
- No editor yet.

**Verification**

- Unit and fixed-seed precedence/invalidation tests.
- Same-task/multiple-lane fixtures.
- Progress `0`, partial, `1`, unsupported-kind, clipped, and virtualized fixtures.
- Legacy scene compatibility.
- `vp check`
- `vp test run`
- Relevant scene benchmark observation.

**Dependencies**

- Appendix Slice A2.

### Appendix Slice A4: Render accessible semantic color and progress

Status: `[x]` Complete

**Goal**

Publish lane/task variants and progress through DOM/SVG, themes, slots, and
accessibility.

**Why here**

The renderer consumes proven primitives before forms or gestures depend on visual
parts.

**This slice should implement**

- Add stable lane-accent, task-track, progress, and effective-variant parts.
- Add coordinated task, progress, text, border, and lane tokens.
- Preserve class hooks and task/lane/tooltip/editor slots.
- Add textual and assistive progress semantics without duplicate announcements.
- Cover forced colors, high contrast, reduced motion, and all interaction states.
- Keep appearance updates out of geometry/layout work.
- Add SSR coverage.

**Expected output**

- Read-only semantic color and progress across supported states.

**Verification**

- Focused renderer/style/SSR tests.
- Automated progress/state accessibility checks.
- `vp check`
- `vp pack`
- `vp build apps/playground`
- Chrome DevTools desktop/narrow visual, computed-style, accessibility-tree, console,
  and network inspection.

**Dependencies**

- Appendix Slice A3.

### Appendix Slice A5: Add task and lane properties surfaces

Status: `[x]` Complete

**Goal**

Inspect and edit the bounded standard properties through the runtime and command bus.

**Why here**

Canonical properties, commands, rendering, and M4 editor behavior are stable.

**This slice should implement**

- Add selection-driven task and lane surfaces.
- Add task title, description, instant schedule/duration, progress, semantic variant,
  current lane, and delete.
- Add lane title and semantic variant.
- Show IDs, kind, and linked resource read-only where applicable.
- Populate accessible pickers from instance/view configuration.
- Preserve unavailable variants.
- Dispatch one command or transaction per Save.
- Handle acknowledgement, pending, stale targets, rejection, cancellation, Escape,
  focus return, and two-instance isolation.
- Prove custom replacement without mutable document access.

**Expected output**

- Useful task/lane inspection and editing without a form-builder API.

**Verification**

- Focused type and interaction tests.
- Controlled/uncontrolled and stale-target tests.
- Layout/focus-return/two-instance tests.
- Closed-surface and read-only SSR tests.
- `vp check`
- `vp pack` plus declarations.
- `vp build apps/playground`

**Dependencies**

- Appendix Slices A2 and A4.
- Verified M4 selection, editor, event, and dispatch surfaces.

### Appendix Slice A6: Add direct and keyboard progress editing

Status: `[x]` Complete

**Goal**

Give progress the same command, preview, pointer, keyboard, accessibility, and
controlled-state quality as move and resize.

**Why here**

The numeric field path and progress geometry are proven first.

**This slice should implement**

- Add renderer-independent progress hit testing and intent.
- Add immutable preview and one strict `task.update` commit.
- Add pointer, pen, touch, and keyboard operations with normal/accelerated steps.
- Reuse interception, pending, rejection, cancellation, acknowledgement, history,
  announcements, and focus retention.
- Disable unsupported targets with stable reasons.
- Keep the field and gesture on the same canonical fraction/command path.
- Preserve touch targets without dominating compact bars.

**Expected output**

- Complete progress inspection, rendering, field editing, and direct interaction.

**Verification**

- Pure hit-test/intent/preview tests.
- Pointer/pen/touch lifecycle and acknowledgement tests.
- Keyboard-only and live-region tests.
- One gesture to one history-entry proof.
- `vp check`
- `vp test run`
- `vp build apps/playground`

**Dependencies**

- Appendix Slices A4 and A5.

### Appendix Slice A7: Prove consumers and close the appendix

Status: `[ ]` Not started

**Goal**

Prove the public property, semantic color, lane inheritance, and progress contract and
record complete release evidence.

**Why here**

Examples and browser claims must use complete behavior.

**This slice should implement**

- Add/extend controlled and uncontrolled playground consumers through root imports.
- Demonstrate lane defaults, task overrides, repeated tasks, unknown fallback, and
  theme switching.
- Demonstrate all supported properties, lane move, delete, undo, and redo.
- Demonstrate progress by field, pointer/touch, and keyboard.
- Add read-only inspection.
- Record facade, compatibility, bundle, and deferred occurrence-override findings.
- Synchronize architecture, theming, roadmap, plan, examples, and public docs.

**Expected output**

- One verified M4 appendix with no internal/playground dependency.

**Verification**

- Full `mise run ci`.
- Packed artifact install/import and declaration inspection.
- Production playground and SSR regression.
- Chrome DevTools desktop/narrow checks for editing, precedence, repeated tasks,
  progress, undo/redo, acknowledgement, responsive containment, accessibility,
  forced colors, reduced motion, console, and network.

**Dependencies**

- Appendix Slices A1–A6.

## Testing Plan

### Contract and data

- legacy parse and byte-stable serialize;
- new optional property round trips;
- unknown variant preservation;
- strict task/lane command validation;
- patch/inverse/transaction/history parity;
- controlled change-envelope parity.

### Appearance and progress

- theme default, lane default, task override, and state-overlay precedence;
- same task in zero, one, and multiple lanes;
- lane appearance change without task mutation;
- task appearance change across occurrences;
- progress `0`, partial, and `1`;
- unsupported milestone/summary progress;
- clipped, repeated, virtualized, and derived occurrences;
- cached/cold parity and bounded invalidation.

### Properties and interaction

- task/lane selection and activation;
- local validation and reducer rejection;
- save/cancel/delete/lane move;
- controlled/uncontrolled ownership;
- stale target, external replacement, disposal, and multiple instances;
- pointer, pen, touch, keyboard, cancellation, and focus retention;
- one gesture/Save to one intended history entry;
- custom surface without alternate mutation.

### Browser and accessibility

- desktop and narrow layouts;
- light, dark, high-contrast, and forced-colors modes;
- contrast at partial progress for demonstration variants;
- states distinguishable without color;
- progress names, values, descriptions, and announcements;
- no application-authored console errors or failed application requests.

## Likely Files and Systems

Exact paths must be re-audited after M4 closes.

Likely additions:

- `docs/decisions/<date>-item-properties-semantic-appearance-progress.md`
- focused model/command/appearance/progress/property-surface tests
- a playground appendix proof page or example

Likely changes:

- `docs/ARCHITECTURE.md`
- `docs/UI_THEMING.md`
- `docs/ROADMAP.md`
- this plan
- model types, inputs, codec, normalization, serialization, and cloning
- commands, patches, affected references, transactions, and history
- scene/appearance/progress primitives and invalidation
- hit testing, intent, preview, and command mapping
- React facade, renderer, styles, property slots, and accessibility
- playground routes/scenarios/styles
- package exports and public API tests

## Risks

- Task override may surprise users expecting lane identity. `Inherit lane` and an
  effective-appearance preview must make precedence clear.
- Strong lane colors can make dense charts noisy. Default lane treatment stays
  restrained and uses separate tokens.
- Raw colors undermine themes, exports, forced colors, and state overlays. Keep them
  out of the canonical contract.
- A generic property schema would expand the API prematurely. Keep the first
  descriptor internal and public slots narrow.
- Description may require more codec/API change than its UI size suggests. Confirm
  compatibility in A1.
- Progress handles can conflict with move/resize on short bars. Prove target
  precedence and minimum-width behavior first.
- Summary progress varies across products. Keep it read-only until M5 fixes the rule.
- Virtualization can amplify diagnostics. Deduplicate unresolved variants by
  definition/revision, not occurrence.

## Open Questions

Resolved in Appendix Slice A1:

- canonical records use `GanttAppearanceReference`, while instance configuration uses
  `GanttAppearanceVariantOption`, `GanttAppearanceToken`, and
  `appearanceVariants`;
- task `description` and task/lane `appearance` are backward-compatible optional
  schema-version-1 fields;
- the default instant-task surface edits start/end and displays elapsed duration
  read-only, avoiding calendar-aware duration policy before M5;
- keyboard progress uses 1 percentage point normally and 10 with `Shift`, plus
  Home/End for 0/100;
- the demonstration palette stays application/example configuration; core publishes
  no workflow meanings;
- read-only selection updates inspection identity but opens properties only by
  activation;
- `taskVariants` remains a source-compatible renderer-only fallback when canonical
  task appearance is absent and enters a documented deprecation path after the
  appendix.

## Progress

- [x] Appendix Slice A1: Freeze the properties and appearance contract
- [x] Appendix Slice A2: Add canonical task/lane properties and commands
- [x] Appendix Slice A3: Resolve appearance and progress primitives
- [x] Appendix Slice A4: Render accessible semantic color and progress
- [x] Appendix Slice A5: Add task and lane properties surfaces
- [x] Appendix Slice A6: Add direct and keyboard progress editing
- [ ] Appendix Slice A7: Prove consumers and close the appendix
- [ ] Final automated/package/SSR gate
- [ ] Final browser/accessibility gate

## Working Notes

- The current renderer accepts a React `taskVariants` map keyed by task ID and emits
  `data-gt-variant`; the playground assigns variants by task index. This is a useful
  rendering proof, not canonical persistence or editing.
- `TaskRecord.progress` and `task.update` already provide the data/command foundation
  for progress.
- Placement commands add, move, and delete but do not update arbitrary placement
  properties. This supports deferring occurrence-level appearance.
- The theming architecture already prefers semantic variants and coordinated portable
  tokens. This appendix makes them editable and persistable without persisting themes.
- 2026-07-31: Appendix Slice A1 audited the packed base-M4 declaration and confirmed
  the public occurrence target, selector, command lifecycle, `TaskEditor`,
  `features.editor`, and renderer-only `taskVariants` boundaries. The accepted
  decision keeps those source-compatible, adds one `ItemProperties` replacement
  surface and `appearanceVariants` registry, and makes persisted task appearance
  authoritative over the compatibility fallback.
- 2026-07-31: The schema-version-1 record definitions already support additive
  optional fields without a migration. The appendix fixes bounded semantic IDs,
  deterministic unknown fallback with per-instance registry-revision diagnostic
  deduplication, task-only editable progress, 1/10 percentage-point keyboard steps,
  read-only elapsed duration, activation-driven read-only inspection, and an
  example-owned palette.
- 2026-07-31: Appendix Slice A1 verification passed. `vp check` formatted all 149
  files and found no lint/type errors in 138 files. Packed declaration inspection
  confirmed the accepted `GanttInteractionTarget`, selector, `GanttHandle`,
  `TaskEditor`, `features.editor`, and `taskVariants` base-M4 facade. Terminology,
  relative link targets, and `git diff --check` passed. The required full
  `mise run ci` passed 61 test files / 297 tests and produced four package artifacts
  (`index.js`, source map, CSS, and declarations). This docs-only slice makes no
  runtime, rendering, browser, or package-surface implementation claim.
- 2026-07-31: Appendix Slice A2 added canonical optional `description` and
  `GanttAppearanceReference` fields to tasks plus canonical optional appearance to
  lanes without changing schema version 1. Wire parsing trims valid unknown semantic
  IDs; canonical validation enforces 1–64 Unicode code points with no control
  characters. Serialization preserves deterministic record order and rejects
  unchecked non-canonical appearance.
- 2026-07-31: `task.update` and `lane.update` set or explicitly clear the new fields
  through the existing whole-record patch boundary. Add inputs, inverses,
  transactions, bounded history, affected references, and row-oriented controlled
  entity-change envelopes inherit the same normalized frozen records; no alternate
  reducer or envelope path was added.
- 2026-07-31: A2 focused verification passed 10 files / 47 tests for schemas, codec,
  stable round trips, serialization, strict update rejection, fixed-seed independent
  task/lane variants, progress boundaries, unrelated collection identity, patch
  replay/inversion, transactions, history, controlled entity rows, and root imports.
  `vp check` passed 151 formatted files and 140 lint/type-checked files.
  `mise run ci` passed 62 test files / 304 tests. `vp pack` produced four artifacts;
  declaration inspection found only `GanttAppearanceReference` and the accepted
  record/input/update members, with no private schema/normalizer leakage. Rendering
  and browser behavior were not changed, so A2 makes no visual claim.
- 2026-07-31: A3's first `mise run ci` found one order-dependent pre-existing pan DOM
  fixture: `uses empty primary drag for pan only without a creation mapper and cleans
  up capture loss` observed `scrollTop=0` instead of `40`. The isolated case and the
  complete 22-test DOM file passed immediately. Inspection showed the fixture
  installed synthetic geometry after mount without first publishing it through the
  measured scroll/animation-frame path. The test now publishes that geometry before
  pointer input, matching the established deterministic measurement gate. This is a
  test-only deviation; runtime behavior, public API, architecture, and appendix
  contracts are unchanged.
- 2026-07-31: Appendix Slice A3 added a pure instance registry and explicit
  theme/kind, lane, legacy task fallback, canonical task, and derived-state
  precedence. Scene lane/task primitives carry frozen effective variant/token data;
  only `GanttAppearanceToken` and `GanttAppearanceVariantOption` join the root export
  list. Unknown canonical IDs retain their semantic variant with deterministic empty
  token fallback and one structured warning per distinct scene ID. A4 owns
  per-instance callback deduplication by registry revision.
- 2026-07-31: Ordinary unsegmented task primitives now carry canonical progress value
  plus clipped visible x/width. Zero has zero completed width, one covers the full
  eligible visible bar, and partial progress intersects the underlying full task
  interval before viewport clipping. Summary, milestone, and segment primitives do
  not expose editable task progress; segment-level progress semantics remain
  deliberately deferred with direct segment editing.
- 2026-07-31: A3 focused verification passed 5 files / 24 tests for precedence,
  repeated tasks across lanes, task override, source-compatible legacy fallback,
  unknown preservation, registry refresh, `0`/partial/`1`, clipped and virtualized
  progress, unsupported kinds, selective lane/task/progress invalidation, and
  fixed-seed cached/cold parity. The deterministic pan regression passed five
  consecutive isolated runs. The corrected `mise run ci` passed 154 formatted files,
  143 lint/type-checked files, 64 test files / 311 tests, and four package artifacts.
  Packed declarations export only the two accepted appearance registry types; private
  registry/resolver/work-counter implementations are not exported.
- 2026-07-31: The fixed `m4-appendix-scene-v1` benchmark (seed `20260730`, 2,000
  tasks, 400 lanes, 45/40 visible) observed means of `15.2644 ms` cold,
  `6.7870 ms` warm label, `7.0164 ms` warm affected appearance/progress, and
  `0.0328 ms` warm vertical query. These are local observations from this checkout,
  not cross-machine thresholds or release guarantees.
- 2026-07-31: Appendix Slice A4 is in progress. The React runtime now treats
  `appearanceVariants` and the compatibility `taskVariants` map as display inputs
  and passes them into the existing scene pipeline; registry-only changes therefore
  rebuild paint primitives without a document command, revision, or geometry pass.
- 2026-07-31: A4's first live 390 px inspection found the playground navigation's
  intrinsic link width extending the document by 48 px. The chart itself remained
  within its container. The narrow header now lets its nav flex item shrink and
  scroll internally, preserving every route link without page-level horizontal
  overflow. This playground-only responsive deviation does not change a library
  boundary or public contract.
- 2026-07-31: Chrome's desktop inspection also reported the existing theme selector
  without a form identity despite its accessible label. Adding the stable
  `chart-theme` name clears the browser issue while preserving its label, state, and
  interaction behavior; this is playground-only.
- 2026-07-31: Appendix Slice A4 maps the six portable appearance tokens onto
  instance-scoped CSS custom properties and publishes stable `lane-accent`,
  `task-track`, and `task-progress` parts plus effective variant/source/resolution
  attributes. Lane surfaces stay restrained; task focus, selection, rejection,
  pending, drag/resize, forced-colors, and reduced-motion paths retain non-color
  structure. The legacy `taskVariants` map now enters the same scene resolver, while
  task/lane/content/tooltip/editor slots remain source-compatible.
- 2026-07-31: Ordinary task accessible names include the rounded canonical percentage
  exactly once. Progress paint is `aria-hidden`, zero renders no completed SVG layer,
  and SSR/hydration produce the same semantic parts and inline token mapping. Unknown
  appearance callbacks are deduplicated per mounted instance, distinct variant ID,
  and normalized registry signature without removing scene diagnostics.
- 2026-07-31: The playground now supplies one application-owned semantic palette and
  canonical lane/task appearance/progress data instead of index-cycled tones.
  Chrome DevTools inspected `/` at 1440x1000 and 390x844 and `/matrix` at 1440x1000.
  The desktop accessibility tree exposed six task buttons with schedule plus
  `0%`/partial/`100%` text and no progressbar duplication. Computed styles confirmed
  six tracks, five positive-width progress layers, four lane accents, canonical
  lane inheritance, and explicit task overrides. Light, dark, and high-contrast
  partial-progress label checks observed a minimum 4.53:1 contrast. Focus retained a
  2 px non-color stroke; the narrow page had no document overflow after the header
  correction. Console warnings/errors/issues were empty and all 73 inspected
  development requests returned 200. Chrome DevTools does not expose forced-colors
  or reduced-motion emulation; focused stylesheet tests verify both media fallbacks.
- 2026-07-31: A4 focused verification passed 5 files / 51 tests for rendered token
  mapping, stable parts, zero/partial progress semantics, unresolved diagnostic
  revision deduplication, SSR/hydration, system-media CSS, runtime reconciliation,
  and the theme selector. `vp check` passed 156 formatted files and 145 lint/type
  files. `vp pack` produced four artifacts with the accepted
  `appearanceVariants` declaration, and `vp build apps/playground` produced the
  production playground. The required full `mise run ci` passed 65 test files /
  317 tests plus formatting, lint, types, and package output.
- 2026-07-31: Appendix Slice A5 is in progress. The accepted
  `GanttItemPropertiesValue`, `GanttItemPropertiesProps`,
  `GanttSlots.ItemProperties`, and `GanttFeatures.properties` facade has been added
  without changing the legacy `TaskEditor` value or feature flag.
- 2026-07-31: A5 now provides one selection-driven default properties surface for
  persisted tasks and lanes. Task Save maps title, description, instant schedule,
  integer-percent progress, semantic appearance, and an unambiguous placement move
  to one command or transaction; lane Save maps title and appearance to one
  `lane.update`. Stable IDs, task kind, elapsed duration, and linked resource
  identity remain inspectable. Delete uses the same history-capable command path.
- 2026-07-31: The accepted `ItemProperties` replacement receives frozen bounded
  values, overlay bindings, lifecycle callbacks, pending state, and a stable error
  relationship without document or runtime access. The default surface preserves
  unavailable appearance IDs, keeps unsupported topology disabled with a reason,
  and reuses M4 acknowledgement, rejection, stale-target closure, Escape,
  focus-return, modal isolation, and two-instance ownership. The legacy
  `TaskEditor` remains the fallback when properties are not enabled.
- 2026-07-31: A5 focused properties coverage passed 10 tests for task transactions,
  lane updates, controlled acknowledgement and replacement, read-only inspection,
  unavailable variants, custom replacement, validation, deletion/undo, rejection,
  stale targets, focus return, and instance isolation. `vp check` passed 157
  formatted files and 146 lint/type files. `vp pack` produced four artifacts whose
  declarations expose only the accepted properties facade, and
  `vp build apps/playground` completed successfully. The required full
  `mise run ci` passed 66 test files / 328 tests.
- 2026-07-31: Chrome DevTools verified the controlled `/interactive` task and lane
  properties surfaces at 1440x1000 and 390x844, including responsive containment,
  accessible modal structure, controlled Save acknowledgement, lane appearance
  persistence, focus return, and Undo. The read-only `/` proof at 390x844 opened by
  task activation with every data field disabled and only Close available. Console
  warnings/errors/issues were empty and all 74 inspected development requests
  returned 200 or cache-valid 304 responses.
- 2026-07-31: Appendix Slice A6 adds renderer-independent `task-progress` hit,
  intent, immutable preview, keyboard state, and strict command mapping. Ordinary
  tasks expose a visible `progress-handle`; resize edges retain generic hit
  precedence, while targeting the marker or its private coarse-pointer surface
  selects progress deterministically. Pointer values round to percentage points and
  one release maps to one `task.update`. Progress does not trigger edge auto-pan or
  reuse move/resize state.
- 2026-07-31: The additive public interaction summary now names `progress`,
  `progressing`, preview `progress`, the `progressing` class state, and
  `classNames.progressHandle`. This expected direct-interaction contract is recorded
  in the accepted decision, architecture, and theming docs; private hit-test intent
  and coarse-target geometry remain unexported.
- 2026-07-31: Pure progress hit/intent/preview/keyboard/command coverage passed as
  part of 4 files / 21 tests. DOM and keyboard integration passed 2 files / 43 tests
  across mouse, pen, touch, controlled acknowledgement, rejection, cancellation,
  one-command/one-history behavior, 1/10-point adjustment, Home/End, focus
  retention, live announcements, and stable milestone/summary reasons. The broader
  focused matrix passed 10 files / 98 tests. `vp check` covered 157 formatted and
  146 lint/type files; packed declarations and the production playground build
  passed. The required full `mise run ci` passed 66 files / 343 tests and four
  package artifacts.
- 2026-07-31: Chrome DevTools verified `/interactive` at 1440x1000 and 390x844.
  Desktop keyboard preview changed 80% to 81% and then 91%, committed one controlled
  persistence row, retained task focus, and Undo restored 80%. A live pen flow
  exposed `progressing` plus an immutable 47% preview before committing. At narrow
  touch width, the transparent coarse hit surface measured 44x24 px around a 2 px
  marker; touch preview/cancel kept canonical progress at 80%, and the document had
  no horizontal overflow. The console had no warnings/errors/issues and all 76
  inspected requests returned 200 or cache-valid 304 responses.

## Next Slice

Begin Appendix Slice A7 by completing the controlled and runtime-owned consumer
proofs through root imports, documenting field/direct/keyboard progress and
appearance precedence in the playground, and closing the compatibility, packed
artifact, SSR, responsive, accessibility, forced-colors, reduced-motion, console,
network, and final release gates.
