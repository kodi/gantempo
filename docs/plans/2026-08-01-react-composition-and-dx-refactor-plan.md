# React Composition and DX Refactor Plan

Status: In progress; Slice 7 complete
Milestone: Post-M5 foundation cleanup before M6
Architecture mapping: React adapter, default DOM/SVG renderer, and interaction ownership
Last updated: 2026-08-01

## Summary

Refactor the Community React implementation before M6 adds scheduling and resource
capabilities. The target is a small public `Gantt` composition root, cohesive private
renderer components, isolated DOM interaction adapters, and default surfaces that are
easy to find and change. The refactor must preserve the public API, DOM and
accessibility contracts, runtime semantics, scene-pipeline ownership, SSR behavior,
and package shape.

This is not a request to turn every SVG element into a React component or to publish
new low-level APIs. A component or module boundary is useful only when it owns a
cohesive responsibility, narrows subscriptions or change coupling, or already has a
real internal reuse case. Line count is evidence of accumulated responsibility, not
the acceptance criterion by itself.

The user explicitly limited the 2026-08-01 pass to planning. No runtime, test, style,
or package implementation belongs to the planning slice.

## Target State

At completion:

- `packages/gantt/src/react/Gantt.tsx` is the stable public composition root. It owns
  runtime creation, provider composition, top-level prop reconciliation, measurement,
  and diagnostics orchestration only where those responsibilities cannot live in a
  narrower private adapter.
- the visual chart is composed from private lane, task, dependency, accessibility,
  control, preview, and overlay boundaries whose names match product concepts;
- task and dependency items subscribe to their own interaction state, while changes
  to one item or an overlay do not cause every visible item slot to render again;
- pointer, keyboard, focus, wheel, measurement, and overlay lifecycle code is grouped
  by behavior instead of being interleaved with a thousand-line JSX return;
- default tooltip, menu, editor, item-properties, and dependency-properties surfaces
  live in discoverable files without changing their public slot prop types;
- `react/runtime.ts` remains the private runtime entry point, but pure snapshot/input
  derivation and independently stateful interaction controllers no longer accumulate
  in one factory closure;
- no root export, package export, public prop, slot signature, class hook, data part,
  DOM role, keyboard shortcut, command lifecycle, or controlled/uncontrolled ownership
  rule changes;
- the existing scene, occurrence catalog, and selective invalidation paths remain the
  only source of renderer data. React does not recreate layout or scheduling logic;
- future M6 capabilities can add derived data and registered render behavior without
  adding another monolithic conditional block to `Gantt.tsx`.

There is deliberately no hard maximum line count. As a review signal, the public
composition root should become a few hundred lines, ordinary private components and
controllers should generally remain reviewable in one sitting, and any file that
again mixes state orchestration, DOM effects, command mapping, and large render trees
should trigger a boundary review.

## Decisions

### 1. Preserve the public API and package surface exactly

This refactor is internal. Keep these entry points and contracts source-compatible:

- `@gantempo/gantt` root exports;
- `Gantt`, `GanttProps`, `GanttHandle`, and `useGanttSelector`;
- controlled and uncontrolled document, session, and range ownership;
- slots, columns, class-name callbacks, appearance variants, feature flags, overlay
  containers, interaction mappers, and semantic callbacks;
- the single stylesheet export.

Private components must not be exported from `packages/gantt/src/index.tsx`, added as
package subpaths, or promoted to public slots without a second consumer and a separate
contract decision. A moved file is not evidence that consumers need its API.

### 2. Use product and subscription boundaries, not generic atomic-design labels

The useful internal atoms visible in the current chart are:

- one task occurrence, including ordinary, summary, milestone, progress, resize, and
  link-handle presentation;
- one dependency occurrence and its routed segments/continuations;
- one lane row and its project branch/properties controls;
- the timeline grid and background cell layers;
- the accessible treegrid and non-visual dependency summary;
- time header and zoom controls;
- task/dependency interaction previews;
- the owned overlay host and its tooltip, menu, and modal editor surfaces.

Do not create components for every `<line>`, `<rect>`, marker, or text span. Those
elements have no independent lifecycle and extra component boundaries would add
reconciliation and prop plumbing without improving ownership.

### 3. Keep public reuse at the existing semantic seams

The current public reusable/customizable surfaces are already the right level:

- `TaskContent` customizes content without replacing task geometry, hit targets,
  selection, focus, or accessibility;
- `LaneHeader` and lane columns customize row content without owning layout;
- tooltip, context-menu, task-editor, item-properties, and dependency-properties
  slots replace application-facing surfaces while Gantt retains lifecycle and command
  ownership;
- semantic appearance variants, `classNames`, stable data parts, and CSS variables
  customize presentation without exposing internal renderer nodes.

The time header, zoom controls, dependency visuals, task shell, and complete lane row
are good private components now, but not good public APIs yet. Reconsider an additive
slot only when M6 or a second real consumer needs it and can state a stable semantic
contract independent of the current DOM/SVG renderer.

### 4. Keep kernel and renderer ownership

React consumes `ChartScene` and the runtime selector snapshot. It must not calculate
hierarchy, intervals, dependency routing, viewport inclusion, or scheduling policy.
The scene pipeline remains the renderer-independent derivation and cache boundary.

The refactor may build per-scene lookup maps, such as tasks grouped by lane or
dependency summaries by ID, once with `useMemo`. It must not duplicate the occurrence
catalog, add a second range or selection state, or copy scene primitives into React
state.

### 5. Make performance isolation explicit and measurable

Component extraction alone does not improve performance. The implementation must:

- preserve primitive identity supplied by the scene pipeline;
- use `memo` only at meaningful list-item/layer boundaries with stable props;
- keep narrow `useGanttSelector` subscriptions at task and dependency item level;
- prevent overlay state, focus on another item, or an unrelated interaction from
  rerendering every visible `TaskContent` or lane cell;
- derive maps and grouped collections once per scene rather than filtering all tasks
  inside every lane render;
- instantiate private interaction controllers once per Gantt instance;
- avoid per-frame context values or handler object bags whose identity changes on
  every root render;
- retain the current viewport-only paint set and full occurrence catalog semantics.

Render-count tests must assert relative isolation, not implementation-specific
absolute counts that become flaky under React development behavior.

### 6. Keep markup and accessibility stable during structural slices

File moves and component extraction must preserve:

- DOM/SVG nesting and paint order;
- every documented class, CSS variable, `data-gt-part`, state/data attribute, and
  consumer class-name call;
- region, treegrid, row, gridcell, button, menu, tooltip, dialog, live-region, and
  dependency-summary semantics;
- roving focus, `aria-owns`, hierarchy levels/expansion, accessible names,
  descriptions, shortcut metadata, modal isolation, focus trapping, and focus return;
- LTR/RTL geometry, SSR markup, hydration, and portal ownership.

If an implementation slice discovers that a markup change is required, record it as
a deviation and treat it as a separate behavior change rather than hiding it inside
the refactor.

### 7. Split other large files only where ownership is already visible

The immediate adjacent candidates are:

- `react/surfaces.tsx`: already contains independent default components and should be
  split by surface;
- `react/runtime.ts`: contains pure input/snapshot derivation plus pointer, keyboard,
  dependency-link, pan/range, callback, store, and command-bus orchestration. It should
  be decomposed after the React facade is characterized, while retaining one runtime
  facade and one instance-local state machine;
- large React DOM tests: split only when each resulting file follows a product
  behavior boundary and shared fixtures remain explicit.

Do not split `render/scene-pipeline.ts`, `commands/reduce.ts`,
`runtime/command-bus.ts`, or `view/resolve-view.ts` merely because they are large.
They currently describe cohesive pipelines or dispatch boundaries and have focused
pure tests. A later split needs evidence such as independent invalidation ownership,
repeated merge conflicts, or a real second consumer.

## Scope

### In scope

- private React module and folder structure;
- extraction of cohesive visual components and accessible mirrors;
- extraction of DOM measurement, wheel, pointer, keyboard, focus, and overlay
  adapters;
- split default surface implementations;
- private render-model/index helpers derived from an immutable scene;
- component-level subscription and memoization boundaries;
- safe decomposition of the private React runtime into input/snapshot helpers and
  instance-local controllers;
- characterization, render-isolation, DOM, accessibility, SSR, package, and browser
  verification;
- documentation of exact deviations and evidence.

### Out of scope

- public API additions, removals, renames, or package subpath exports;
- new public slots or compound-component APIs;
- a new renderer, canvas promotion, or package split;
- visual redesign, style cleanup, copy changes, or new product behavior;
- scheduling, calendars, constraints, resources, critical path, or other M6 work;
- scene, model, command, persistence, range, selection, or focus semantic changes;
- broad test rewrites or snapshotting the entire DOM as a substitute for behavioral
  assertions;
- arbitrary file-size limits or a generic `utils.ts`/`components.tsx` dumping ground.

## Current State Audit

The 2026-08-01 checkout has these large production TypeScript files:

| File | Lines | Assessment |
| --- | ---: | --- |
| `react/Gantt.tsx` | 4,028 | Immediate refactor target; mixes at least eight responsibilities. |
| `react/runtime.ts` | 2,669 | Next target; one facade is correct, but the factory owns several extractable controllers and pure derivations. |
| `render/scene-pipeline.ts` | 1,422 | Large but cohesive cached pipeline; do not split in this refactor. |
| `commands/reduce.ts` | 1,133 | Large strict command dispatcher/reducer; keep stable here. |
| `runtime/command-bus.ts` | 985 | Cohesive lifecycle/acknowledgement boundary; keep stable here. |
| `react/surfaces.tsx` | 934 | Immediate adjacent target; independent default surfaces already exist. |
| `view/resolve-view.ts` | 730 | Strategy seams exist, but unrelated to this cleanup and already pure/tested. |
| `react/types.ts` | 541 | Cohesive public React contract; keeping it together improves API discoverability. |

`Gantt.tsx` currently contains these approximate responsibility bands:

| Lines | Responsibility |
| --- | --- |
| 74–880 | styles, overlay geometry, summaries, class state, validation, editor values/commands, accessible labels, keyboard translation |
| 881–1,200 | task occurrence rendering and item-level selector subscription |
| 1,201–1,829 | surface state, derived indexes, portal hosts, focus and modal lifecycle |
| 1,830–2,423 | geometry plus pointer, pan, dependency-link, focus, and keyboard DOM adapters |
| 2,424–2,869 | menu models and task/lane/dependency editor dispatch workflows |
| 2,870–3,050 | tooltip, menu, and editor portal rendering |
| 3,051–3,765 | root, controls, accessible mirrors, lanes, grid, dependencies, tasks, and previews |
| 3,766–4,028 | runtime creation, public facade, diagnostics, measurement, wheel navigation, providers |

The existing public facade exports only `Gantt` from this module. Tests import it as a
black box, and the root package exposes customization through semantic types rather
than renderer internals. This makes an internal restructure possible without an API
transition.

The first planning audit showed unrelated user changes in
`packages/gantt/src/styles.css` and `packages/gantt/src/styles.test.ts`. They were not
part of this work. Implementation must preserve any concurrent changes and stage only
explicit refactor paths.

## Proposed Private Module Shape

Names may be adjusted during implementation when the dependency graph proves a
clearer colocated boundary, but any deviation must preserve the ownership described
here.

```text
packages/gantt/src/react/
├── Gantt.tsx                         # public composition root only
├── context.tsx
├── localization-context.tsx
├── types.ts                          # unchanged public contract authority
├── runtime.ts                        # private runtime facade/composition
├── runtime/
│   ├── display-inputs.ts             # prop normalization/equality/diagnostics
│   ├── selector-snapshot.ts          # occurrence/target/public-selector derivation
│   ├── viewport-controller.ts        # range, pan, fit, zoom, viewport proposals
│   ├── keyboard-controller.ts        # keyboard/link state transitions
│   └── pointer-controller.ts         # pointer gesture and auto-pan orchestration
├── surface/
│   ├── GanttSurface.tsx              # chart shell and layer composition
│   ├── surface-model.ts              # per-scene indexes and stable summaries
│   ├── TaskItem.tsx                  # one visible task occurrence
│   ├── TaskLayer.tsx
│   ├── DependencyItem.tsx            # one visible dependency occurrence
│   ├── DependencyLayer.tsx
│   ├── LaneGrid.tsx                  # visible lane rows, headers, cells, controls
│   ├── AccessibleTreeGrid.tsx
│   ├── AccessibleDependencies.tsx
│   ├── TimeHeader.tsx
│   ├── ZoomControls.tsx
│   ├── InteractionPreview.tsx
│   ├── OverlayLayer.tsx
│   ├── overlay-controller.ts
│   ├── editor-commands.ts            # private validation/value/command adapters
│   ├── presentation.ts               # summaries, labels, appearance/class helpers
│   ├── dom-geometry.ts               # overlay/pointer geometry only
│   ├── use-focus-bridge.ts
│   ├── use-pointer-interactions.ts
│   ├── use-keyboard-interactions.ts
│   ├── use-measured-viewport.ts
│   └── use-wheel-navigation.ts
└── surfaces/
    ├── TaskContent.tsx
    ├── LaneHeader.tsx
    ├── Tooltip.tsx
    ├── ContextMenu.tsx
    ├── TaskEditor.tsx
    ├── ItemProperties.tsx
    ├── DependencyProperties.tsx
    ├── shared.tsx                    # only genuinely shared form primitives
    └── index.ts                      # private imports for the composition layer
```

Dependency direction must remain:

```text
public Gantt composition
  -> private surface components and DOM adapters
  -> private React runtime facade
  -> runtime / interaction / render kernels
  -> view / model / command kernels
```

Kernel modules must not import from `react/`. Surface components may consume scene
primitives and public slot types, but may not call layout or scheduling code.

Avoid barrel imports inside `surface/` and `runtime/` when they obscure cycles. The
private `surfaces/index.ts` may exist as the one stable aggregation point because the
default surfaces are already independent leaves.

## Behavior and Performance Contract to Preserve

### Public and data behavior

- identical controlled/uncontrolled reconciliation and proposal acknowledgement;
- identical command source/action metadata, diagnostics, history, and callbacks;
- identical selection, focus, project collapse, range, scale, and viewport behavior;
- identical task/lane/dependency property validation and transactions;
- no change to appearance precedence or unresolved-variant diagnostics.

### Interaction behavior

- task move/resize/progress/create and dependency link gestures;
- mouse, touch, and pen pointer capture/cancellation;
- primary empty-header and middle-button panning conflict rules;
- wheel/trackpad axis behavior, Shift fallback, Alt zoom, and Ctrl/Meta browser zoom;
- keyboard navigation, editing modes, link mode, history, paging, zoom, and fit;
- offscreen focus/reveal via the full occurrence catalog;
- read-only charts still permit navigation and supported property inspection.

### Rendering and accessibility behavior

- viewport-only task/lane/dependency painting and existing layer order;
- task, summary, milestone, progress, clipping, dependency, and RTL geometry;
- accessible region/treegrid/dependency summaries and live announcements;
- roving task/dependency focus, empty-state focus handoff, modal isolation, and portal
  focus restoration;
- stable IDs within an instance and collision-free IDs across instances;
- deterministic SSR and first hydration render.

### Performance evidence

- add a focused React render-isolation fixture with several visible task items, a
  custom `TaskContent` counter, lane columns, dependencies, and overlays;
- prove a target-only selection/focus/preview update does not invoke unrelated task
  content or lane cell renderers;
- prove tooltip/menu/editor state does not rebuild static lane/grid/task content;
- preserve current scene benchmark work profiles and exact output parity;
- record bundle/declaration/tarball results, but do not claim browser frame rate from
  component tests or a local refactor run.

## Slices

### Slice 0: Planning and responsibility baseline

Status: `[x]` Done

Goal: create the durable refactor contract before implementation.

This slice should implement:

- audit production file sizes and the responsibility bands in `Gantt.tsx`;
- classify reusable internal components separately from public customization seams;
- define API, DOM, accessibility, performance, and dependency-direction guardrails;
- create this plan and link it from the roadmap;
- preserve the pre-existing style/test changes.

Expected output:

- this plan;
- roadmap status showing the post-M5 cleanup before M6;
- no runtime, test, style, package, or architecture change.

Verification:

- focused source and contract inspection completed 2026-08-01;
- the plan file and every new roadmap link were resolved with `test -f` and `rg`;
- `git diff --check` passed;
- `mise run ci` passed on 2026-08-01: build and checks succeeded, with 89 test
  files and 480 tests passing;
- final `git status --short` showed only this plan and `docs/ROADMAP.md`; no source,
  test, style, package, or architecture file was changed by the planning slice.

Dependencies: completed M5.

### Slice 1: Lock black-box structure and render-isolation evidence

Status: `[x]` Done

Goal: make accidental behavior and performance regressions observable before moving
code.

Why here: component extraction is safer when DOM, accessibility, interaction, and
render-isolation expectations are executable rather than inferred from the original
file.

This slice should implement:

- add focused characterization tests for stable root/layer/data-part structure,
  accessible treegrid ownership, dependency summaries, overlay ownership, focus
  return, and SSR markup;
- add reusable test fixture/builders for task, lane, dependency, customization, and
  overlay cases without centralizing unrelated assertions;
- add a render-probe test using custom task content and lane cells;
- record the current render fan-out, then encode the target isolation assertions only
  with the component boundary that makes them pass in the same slice;
- keep existing end-to-end behavior tests authoritative rather than replacing them
  with a giant snapshot.

Expected output:

- focused structure and render-isolation tests;
- small, explicit test helpers shared only by React DOM tests;
- a recorded baseline for later slices.

Verification:

- `vp test run packages/gantt/src/react/Gantt*.test.tsx` passed 8 files / 91 tests;
- `vp test run packages/gantt/src/index.consumer.dom.test.tsx
  apps/playground/src/project-ssr.dom.test.tsx` passed 2 files / 3 tests;
- `mise run ci` passed on 2026-08-01: 90 test files / 484 tests, 199 formatted
  files, 188 lint/type files, and the 138-artifact package build;
- `git diff --check` passed.

Dependencies: Slice 0.

### Slice 2: Extract pure presentation/editor adapters and default surfaces

Status: `[x]` Done

Goal: remove independent leaf logic from `Gantt.tsx` and split the existing default
surface collection without changing behavior.

Why here: pure functions and already-independent leaf components are the lowest-risk
move and simplify later component extraction.

This slice should implement:

- move task/lane summary, target, accessible-label, class-name, appearance, and
  geometry helpers to narrow private modules;
- move task/lane/dependency property value, validation, elapsed-duration, and command
  mapping helpers to `editor-commands.ts`;
- split each default surface into its own discoverable file;
- share form helpers only when two or more surfaces already use the same behavior;
- keep all public surface prop types in `react/types.ts` and all public exports
  unchanged.

Expected output:

- private pure modules with focused unit tests where behavior was previously only
  indirectly covered;
- split default surface files;
- no DOM or runtime change.

Verification:

- `vp test run packages/gantt/src/react/Gantt.customization.dom.test.tsx
  packages/gantt/src/react/Gantt.properties.dom.test.tsx
  packages/gantt/src/react/Gantt.localization-rtl.dom.test.tsx
  packages/gantt/src/react/Gantt.dom.test.tsx
  packages/gantt/src/react/surface/*.test.ts` passed 6 files / 62 tests;
- `git diff --check` passed;
- `mise run ci` passed on 2026-08-01: 92 test files / 489 tests, 210 formatted
  files, 199 lint/type files, and the 154-artifact package build.

Dependencies: Slice 1.

### Slice 3: Extract stable lane, task, dependency, and accessibility components

Status: `[x]` Done

Goal: make the visual chart a composition of meaningful private renderer units while
preserving exact markup and paint order.

Why here: leaf helpers and contracts are stable, so JSX can move without mixing in
state-machine changes.

This slice should implement:

- extract `TaskItem`/`TaskLayer` from the existing `GanttTask` implementation;
- extract one `DependencyItem` plus the dependency layer and preview;
- extract lane rows/cells/branch/properties controls into `LaneGrid`;
- extract time header, grid lines, zoom controls, empty state, live region, accessible
  treegrid, and accessible dependency summary at their semantic boundaries;
- build one per-scene surface model containing task/lane/dependency lookup maps,
  grouped task DOM IDs, resolved column widths, and stable summaries;
- remove repeated `find`, `some`, and per-lane task filtering where the same index can
  be derived once per scene;
- preserve DOM/SVG order, keys, IDs, class callbacks, and slot call sites exactly.

Expected output:

- private visual components with narrow typed props;
- a substantially smaller `GanttSurface` render tree;
- no public or visual change.

Verification:

- focused DOM, project, customization, localization/RTL, and keyboard tests;
- structure parity assertions from Slice 1;
- current scene benchmarks to prove work-profile parity;
- `mise run ci`.

Dependencies: Slice 2.

Verification:

- `vp test run packages/gantt/src/react/Gantt*.test.tsx
  packages/gantt/src/react/surface/*.test.ts` passed 11 files / 97 tests;
- the fixed `m4-appendix-scene-v1` benchmark reported 44.5118 cold builds/s,
  86.0766 warm label updates/s, 83.9386 warm appearance/progress updates/s, and
  5756.74 vertical viewport queries/s for 2,000 tasks across 400 lanes;
- the fixed `m5-project-v1` benchmark reported 9.3100 cold builds/s, 8.5435
  collapse updates/s, 8.2482 filter updates/s, 8.5908 dependency updates/s, and
  10.7357 zoom updates/s for 2,000 tasks, 400 summaries, and 1,599 dependencies;
- `git diff --check` passed;
- `mise run ci` passed on 2026-08-01: 93 test files / 490 tests, 224 formatted
  files, 213 lint/type files, and the 180-artifact package build.

### Slice 4: Isolate item subscriptions and render fan-out

Status: `[x]` Done

Goal: ensure the new component boundaries improve steady-state React work rather than
only distribute lines across files.

Why here: the final item boundaries and stable surface model must exist before
memoization and selector placement can be evaluated honestly.

This slice should implement:

- keep target-specific selection/focus/press/drag/resize/progress/pending/rejected
  subscriptions inside `TaskItem` and `DependencyItem`;
- remove whole-selection/focus dependencies from parent layers where only items need
  them;
- apply `memo` to task, dependency, and lane row boundaries only when props are stable
  and the render probes demonstrate avoided work;
- stabilize handler references and derived item props without hiding stale closure
  bugs behind custom equality functions;
- ensure custom slot/class callback changes still propagate immediately;
- record before/after relative render-probe results.

Expected output:

- target-local rendering for ordinary selection, focus, preview, and pending changes;
- no semantic or DOM change;
- explicit evidence for every memoization boundary retained.

Verification:

- render-isolation tests;
- full React DOM suite;
- runtime interaction benchmark and scene benchmarks;
- `mise run ci`.

Dependencies: Slice 3.

Verification:

- `vp test run packages/gantt/src/react/Gantt*.test.tsx
  packages/gantt/src/react/surface/*.test.ts` passed 11 files / 100 tests;
- the fixed `m4-runtime-v2` benchmark reported 312.26 selection/focus updates/s,
  132.33 pointer preview updates/s, 410.41 measured scroll queries/s, and
  82,773.41 indexed mouse hit tests/s for 2,000 tasks across 400 lanes;
- the fixed `m4-appendix-scene-v1` benchmark reported 39.4832 cold builds/s,
  81.1822 warm label updates/s, 87.1351 warm appearance/progress updates/s, and
  5269.71 vertical viewport queries/s;
- the fixed `m5-project-v1` benchmark reported 9.3391 cold builds/s, 9.0449
  collapse updates/s, 8.4822 filter updates/s, 8.6080 dependency updates/s, and
  10.5251 zoom updates/s;
- `git diff --check` passed;
- `mise run ci` passed on 2026-08-01: 93 test files / 493 tests, 224 formatted
  files, 213 lint/type files, and the 180-artifact package build.

### Slice 5: Isolate overlay lifecycle and editor workflows

Status: `[x]` Done

Goal: keep tooltip, context-menu, editor, portal, modal, and command workflow changes
out of the chart renderer and prevent overlay state from rerendering static chart
layers.

Why here: item render boundaries are stable, so overlay isolation can be measured and
the existing task/lane/dependency entry points are known.

This slice should implement:

- add one instance-local private overlay controller for tooltip, menu, and editor
  state;
- render the owned portal host and overlay layer from a dedicated component;
- keep collision adjustment, theme mirroring, outside dismissal, resize/scroll
  dismissal, modal sibling isolation, body-scroll locking, focus trap, focus return,
  and slot-binding diagnostics together;
- keep task/lane/dependency editor submit/delete workflows with the overlay layer and
  the pure command adapters from Slice 2;
- expose only stable private open/close/inspect operations to task, lane, dependency,
  keyboard, and menu handlers;
- prove overlay changes do not rerender static task/lane content.

Expected output:

- one cohesive overlay subsystem;
- smaller surface orchestration;
- unchanged overlay container and slot behavior.

Verification:

- overlay, customization, property, focus, pending/rejection, and multi-instance tests;
- render-isolation tests;
- SSR import test;
- `mise run ci`.

Dependencies: Slice 4.

Verification:

- `vp test run packages/gantt/src/react/Gantt*.test.tsx
  packages/gantt/src/index.test.tsx apps/playground/src/project-ssr.dom.test.tsx`
  passed 10 files / 106 tests, covering overlay customization, task/lane/dependency
  properties, focus return, pending/rejection, multiple instances, package SSR, and
  playground SSR/hydration;
- the overlay render probe opens and closes the tooltip/editor while recording zero
  custom task-content, lane-cell, and dependency-path renders;
- `git diff --check` passed;
- `mise run ci` passed on 2026-08-01: 93 test files / 493 tests, 226 formatted
  files, 215 lint/type files, and the 184-artifact package build.

### Slice 6: Extract DOM interaction and measurement adapters

Status: `[x]` Done

Goal: make `GanttSurface` declarative by moving browser event/lifecycle translation to
narrow hooks that call the existing runtime facade.

Why here: visual and overlay ownership is settled, so hooks can have small explicit
inputs rather than receiving the entire surface state.

This slice should implement:

- extract pointer geometry and candidate lookup helpers;
- extract task gesture, dependency-link, and empty-canvas pan DOM adapters;
- extract keyboard event-to-action translation and focus bridge;
- extract measured viewport/ResizeObserver/scroll lifecycle;
- extract wheel/trackpad/Alt-zoom navigation while retaining the native non-passive
  listener required for conditional `preventDefault`;
- preserve pointer capture, synthetic-adapter fallbacks, passive listener choices,
  cleanup, and stale-callback safety;
- keep runtime command/gesture semantics below React.

Expected output:

- focused DOM hooks with explicit dependency lists;
- `GanttSurface` as chart composition rather than an event/state monolith;
- `Gantt.tsx` as the small public lifecycle/composition root.

Verification:

- wheel, keyboard, pointer, project, focus, and runtime DOM tests;
- listener/observer cleanup and multi-instance tests;
- browser smoke checks for physical mouse/trackpad behavior where automation permits;
- `mise run ci`.

Dependencies: Slice 5.

Verification:

- `vp test run packages/gantt/src/react/Gantt.wheel.dom.test.tsx
  packages/gantt/src/react/Gantt.keyboard.dom.test.tsx
  packages/gantt/src/react/Gantt.dom.test.tsx
  packages/gantt/src/react/Gantt.project.dom.test.tsx
  packages/gantt/src/react/Gantt.structure.dom.test.tsx` passed 5 files / 68 tests;
- `vp test run packages/gantt/src/react/Gantt*.test.tsx` passed the complete React
  DOM selection: 8 files / 92 tests, including listener/observer cleanup and
  multi-instance coverage;
- browser-free automation covers synthetic pointer, wheel, focus, capture fallback,
  and cleanup behavior; no live physical trackpad input is available in the test
  environment, so that remains a Slice 8 browser gate;
- `git diff --check` passed;
- `mise run ci` passed on 2026-08-01: 93 test files / 493 tests, 232 formatted
  files, 221 lint/type files, and the 196-artifact package build.

### Slice 7: Decompose the private React runtime by state-machine ownership

Status: `[x]` Complete

Goal: prevent M6 from adding more responsibilities to the 2,669-line runtime factory
while preserving one runtime instance and facade.

Why here: the React adapter now calls a stable runtime boundary, so private runtime
modules can move without simultaneous JSX and DOM lifecycle changes.

This slice should implement:

- extract display input normalization/equality and selector snapshot/occurrence
  derivation as pure modules first;
- extract viewport/range/pan/fit/zoom, keyboard/link, and pointer gesture controllers
  as instance-local factories with narrow explicit host callbacks;
- instantiate controllers once inside `createGanttReactRuntime` and keep store,
  command bus, callback error isolation, controlled reconciliation, activation, and
  public handle composition in the facade;
- keep interaction state transitions synchronous where they are synchronous today;
- do not replace explicit typed dependencies with a service locator, mutable global,
  or generic event bus;
- retain scene-pipeline cache identity and rebuild/publish ordering.

Expected output:

- a runtime facade whose main flow is readable top to bottom;
- independently testable pure derivation and interaction controllers;
- no public runtime export or behavioral change.

Verification:

- complete `react/runtime.test.ts` and runtime DOM suites;
- controlled acknowledgement, callback failure, history, range proposal, occurrence
  catalog, keyboard, pointer, pan, dependency, and cleanup tests;
- existing runtime interaction and scene benchmarks;
- `mise run ci`.

Dependencies: Slice 6.

### Slice 8: Final API, package, browser, and documentation gate

Status: `[ ]` Not started

Goal: prove the restructure is behavior-preserving and leave a clean M6 handoff.

This slice should implement:

- audit the final module dependency direction and reject cycles/catch-all modules;
- compare root exports and packed declarations to the pre-refactor facade;
- run a fresh packed-tarball React consumer and React/browser-free model consumer;
- build the playground and inspect representative routes at desktop and narrow
  viewports;
- verify accessibility trees, focus, menus/editors, pointer navigation, console, and
  network state;
- record exact render-isolation, CI, build, package, SSR, and browser evidence here
  and in the roadmap;
- document any deliberate deviation before marking the plan complete.

Expected output:

- complete plan and roadmap evidence;
- unchanged public package contract;
- an actionable M6 starting point.

Verification:

- `mise run ci`;
- `mise run build-playground`;
- focused benchmarks with recorded fixture/work-profile metadata;
- fresh packed-tarball consumer proof;
- Chrome DevTools inspection of `/`, `/interactive`, `/project`, and `/navigation` at
  representative desktop, tablet, and phone widths;
- `git diff --check` and explicit dirty-worktree audit.

Dependencies: Slices 1–7.

## Testing Plan

### Per-slice automated gates

- Pure helper moves: focused unit/surface tests plus full CI.
- Visual component moves: all `Gantt*.dom.test.tsx`, structure parity, SSR, and full
  CI.
- Subscription work: render probes, interaction tests, runtime/scene benchmarks, and
  full CI.
- Overlay work: focus, modal, portal, multi-instance, customization, property, and
  pending/rejection tests plus full CI.
- Runtime work: full runtime unit/DOM tests, benchmarks, and full CI.

Every slice should be a focused Conventional Commit after its named full gate passes.
Do not mark a slice done from type checking, one focused test file, or a file move
alone.

### Final live routes

- `/`: default consumer and empty/basic states;
- `/interactive`: task gesture, menu, editor, and customization surfaces;
- `/project`: hierarchy, summaries, milestones, dependencies, properties, zoom, and
  RTL/localization-sensitive structure;
- `/navigation`: large visible set, virtualization, wheel/trackpad/mouse pan, and
  focus retention.

Record page reuse versus new-page creation, viewport dimensions, inspected
accessibility semantics, console state, and any browser capability limits. Do not
claim physical trackpad, forced-colors, performance, or network coverage that the
available tool did not exercise.

## Risks and Mitigations

- **Prop-bag sprawl replaces one monolith with unreadable plumbing.** Keep props typed
  by semantic boundary, derive one stable surface model per scene, and let item
  components use narrow selectors rather than passing the whole runtime snapshot.
- **Memoization hides stale props.** Prefer stable input construction and ordinary
  `memo`; avoid custom equality unless a render probe and mutation test prove it.
- **More components increase React work.** Do not componentize individual SVG
  segments/cells. Measure list-item boundaries and retain only those that isolate
  updates.
- **Overlay extraction changes focus/modal behavior.** Move lifecycle and markup as a
  unit and keep existing black-box focus/portal tests authoritative.
- **Runtime controllers become a service-locator architecture.** Use small typed host
  callback interfaces, one-time construction, and direct calls; no global container
  or generic event bus.
- **Markup drift breaks consumer CSS or accessibility.** Lock stable parts/roles and
  inspect exact DOM/accessibility behavior before and after each visual slice.
- **File moves expand the public package accidentally.** Keep root exports and package
  exports unchanged and verify declarations/tarball consumers.
- **Dirty worktree changes are overwritten or staged.** Preserve the existing style
  and style-test edits, inspect status before every slice, and stage explicit paths.
- **M6 feature work becomes mixed into cleanup.** Finish and verify this plan first;
  record feature requests as M6 inputs rather than adding them opportunistically.

## Open Questions

These are implementation judgments, not reasons to change the public API:

1. Does overlay isolation need a tiny private external-store controller, or can a
   dedicated component/ref boundary provide stable operations without rendering the
   chart subtree? Choose the smallest design that passes render-isolation and focus
   tests.
2. Which scene indexes should be computed by `surface-model.ts` versus exposed by the
   runtime snapshot? Default to React-private per-scene indexes unless a non-React
   consumer is proven.
3. Can task/dependency item memoization use ordinary `memo` with stable props, or does
   the existing class-name/slot identity contract require a narrower parent split?
   Do not add a custom comparator before measuring.
4. After pure helpers move, are pointer/keyboard controllers independent enough to
   extract without a broad host interface? If not, record the coupling and split the
   runtime slice more narrowly rather than inventing an abstraction.
5. Should large React DOM tests be split while their production behavior moves? Only
   split files when the resulting suite names one behavior area and does not hide
   shared setup or duplicate fixtures.

## Working Notes

### 2026-08-01 — Planning audit

- `Gantt.tsx` is 4,028 lines. Its size comes primarily from one 2,565-line
  `GanttSurface`, not from the 263-line public facade.
- The existing `GanttTask` is already a strong internal component candidate: it owns
  one occurrence, uses a target-specific selector, and accepts renderer primitives
  and stable slot/class contracts. The missing piece is a parent boundary that does
  not rerender it for unrelated surface state.
- Dependency rendering repeats target-state derivation inline and is the clearest
  sibling candidate to task items.
- The accessible treegrid currently derives owned task IDs by filtering all visible
  tasks for every lane. A per-scene grouped index improves both readability and work
  without changing the scene or public selector contract.
- Overlay state/effects and editor commands account for a large, independently
  testable part of `GanttSurface`; extracting only portal JSX would leave ownership
  fragmented, so lifecycle and workflows should move together.
- Default surfaces already have independent exported functions in one 934-line file.
  Splitting them is discoverability cleanup, not a new component model.
- `runtime.ts` needs an ownership-based pass before M6, but changing it at the same
  time as JSX extraction would make regressions harder to localize. It is therefore a
  later slice after the React facade stabilizes.
- Existing architecture already requires small selector subscriptions, renderer-
  independent primitives, a narrow public facade, and Community component authority.
  This plan implements that target more faithfully; it does not require a new
  architecture decision record or `docs/ARCHITECTURE.md` change.
- No source, style, test, package, or architecture file was changed during planning.
- Slice 0 verification passed: the plan and roadmap links resolve, `git diff --check`
  is clean, and implementation remains deferred.

### 2026-08-01 — Slice 1 characterization baseline

- Added one focused structure suite plus a small React test fixture for the stable
  chart/layer order, treegrid `aria-owns` links, dependency visual/summary pairing,
  body-owned overlay host, editor focus return, and deterministic SSR structure.
- The render probe measured the pre-extraction behavior rather than inferring it:
  focusing and selecting Task A invokes both Task A and unrelated Task B content,
  and also invokes unrelated lane cells.
- A trial ordinary `memo` boundary around the existing task component did not isolate
  Task B because parent inputs do not yet retain stable identity through the update.
  It was removed instead of adding a custom comparator. Slice 3 must create the
  stable surface model/component inputs; Slice 4 will convert the recorded positive
  fan-out assertions to zero-render isolation assertions.
- No public facade, DOM, accessibility, SSR, runtime, or package behavior changed.
- The first full gate found only formatter drift in the new test; after
  `vp check --fix`, the required `mise run ci` rerun passed completely.

### 2026-08-01 — Slice 2 pure adapters and default surfaces

- Moved geometry, appearance/class, task/lane summary, target, accessible-name, and
  item-state helpers into `surface/presentation.ts`; moved legacy editor and canonical
  task/lane property validation, values, elapsed duration, and command mapping into
  `surface/editor-commands.ts`.
- Added focused pure tests for clipped geometry, lane/class presentation, legacy
  validation, canonical property validation, task/placement transaction mapping, and
  elapsed-duration formatting.
- Split all seven default surfaces into named files under `react/surfaces/` with one
  private aggregation index. Public prop types remain in `react/types.ts`; the root
  package exports and package export map are unchanged.
- `Gantt.tsx` fell from the 4,028-line planning baseline to 3,500 lines without a DOM,
  accessibility, runtime, style, or public API change.

### 2026-08-01 — Slice 3 semantic chart composition

- Added one React-private per-scene surface model for resolved columns, lane widths,
  task lookup, task DOM IDs grouped by lane, lane summaries, and dependency summaries.
  This removes repeated visible-task filtering and dependency searches from the render
  tree without moving React-only indexes into the renderer snapshot.
- Extracted cohesive task and dependency items/layers, lane/grid cells, time and zoom
  controls, accessibility mirrors, and interaction/progress previews. DOM/SVG order,
  keys, IDs, class and slot call sites, accessibility ownership, and public exports
  remain unchanged.
- Task and dependency target-state subscriptions now live at their item boundaries;
  Slice 4 owns the measured parent render isolation and ordinary `memo` decisions.
- `Gantt.tsx` fell from 3,500 to 2,705 lines. The fixed scene benchmarks retained
  their expected fixture shapes and completed before the full gate.

### 2026-08-01 — Slice 4 target-local rendering

- Applied ordinary `memo` at task, dependency, lane-row, lane-timeline, and accessible
  row boundaries after stabilizing the props those boundaries actually consume. No
  custom memo comparator was added.
- The Slice 1 probe moved from positive unrelated fan-out to zero renders: focusing
  and selecting Task A still renders Task A, while Task B, Task C, their unrelated
  lane rows, and their custom cell callbacks remain at zero. Focusing dependency A–B
  renders that dependency while dependency B–C remains at zero.
- Changed task slots and class callbacks still propagate immediately through the
  memoized layers. Target-specific task and dependency interaction state remains
  subscribed inside the corresponding item.
- Stabilized current-value handler lookups, immutable lane summaries, unchanged
  dependency routes, and runtime dependency selector summaries. The runtime now
  retains an unchanged dependency summary array across selection-only rebuilds rather
  than cloning every dependency record and summary.
- The fixed runtime and scene benchmarks completed without changing their fixture
  topology. `Gantt.tsx` is 2,731 lines; the small increase from Slice 3 is the stable
  boundary wiring, not restored rendering logic.

### 2026-08-01 — Slice 5 overlay subsystem

- Added one instance-local private overlay controller for tooltip, menu, and editor
  state plus stable open/position/close operations. Chart-facing tooltip and context
  handlers no longer acquire new identities when an overlay opens or closes.
- Moved body-level host creation, instance theme mirroring, scroll/resize and outside
  dismissal, collision adjustment, menu/editor initial focus, modal sibling isolation,
  body-scroll locking, exact cleanup, focus restoration, slot-binding diagnostics,
  and pending/rejection closure into the controller. Portal creation is owned by a
  dedicated `OverlayLayer`.
- Task/lane/dependency editor validation and command callbacks continue to use the
  pure Slice 2 adapters and controller state transitions, preserving controlled
  pending and rejection behavior. Overlay disappearance still reconciles stale
  task/lane/dependency targets and properties selection changes.
- Added a memoized task-content boundary inside `TaskItem`: removing a tooltip ID from
  the task wrapper no longer invokes unchanged consumer content. The overlay probe now
  records zero static task-content, lane-cell, and dependency-path renders through
  editor open and close.
- `Gantt.tsx` fell from 2,731 to 2,287 lines with no overlay container, slot, DOM,
  focus, SSR, or public API change.

### 2026-08-01 — Slice 6 DOM adapters

- Added focused private adapters for pointer geometry and target lookup, task gesture,
  dependency-link and empty-canvas pan capture, keyboard event translation,
  DOM/logical focus bridging, measured viewport/retained-range lifecycle, and native
  wheel/trackpad/Alt-zoom navigation.
- The pointer hook keeps task click-versus-drag bookkeeping, dependency pointer IDs,
  pan presentation state, pointer capture/release fallbacks, and cancellation cleanup
  instance-local. It calls the existing runtime facade rather than duplicating
  command or gesture semantics in React.
- The measurement hook retains the focused/preview range, observes the body and
  timeline, uses a passive scroll listener, and clears runtime measurement on every
  teardown. The wheel hook retains the native non-passive listener required for
  conditional `preventDefault`, RTL anchor mirroring, and native vertical fallback.
- `Gantt.tsx` fell from 2,287 to 1,680 lines. Its remaining surface code is chart
  composition, overlay workflows, and keyboard/menu orchestration rather than raw
  pointer/observer/wheel lifecycle.

### 2026-08-01 — Slice 7 private runtime ownership

- Extracted display input normalization/equality and selector/occurrence derivation
  into private pure modules. Dependency summary identity retention, occurrence
  catalog construction, controlled/default input ownership, localization diagnostics,
  and view equality remain unchanged.
- Added instance-local range, viewport, pan, pointer gesture, keyboard interaction,
  and dependency-link controllers with explicit store, range publication, display,
  and interaction host callbacks. The facade still owns the store, command bus,
  controlled reconciliation, callback isolation, activation/disposal, snapshot
  publish order, and public handle composition.
- Added focused controller coverage for isolated state, dependency-link lifecycle,
  pan completion/disposal, range reason/anchor publication, RTL motion, and vertical
  navigation. `runtime.ts` fell from 2,702 lines at the Slice 7 checkout to 2,270
  lines without a public export or runtime contract change.
- Focused runtime and DOM verification passed 13 files / 128 tests. The fixed runtime
  benchmark recorded 261.07 selection/focus updates/s, 140.39 pointer preview
  updates/s, 438.75 measured scroll queries/s, and 85,553.75 indexed hit tests/s.
  The fixed scene benchmark recorded 44.351 cold builds/s, 84.7004 label updates/s,
  88.3905 appearance/progress updates/s, and 6,270.55 vertical queries/s; the fixed
  project benchmark recorded 9.4293 cold builds/s, 8.4367 collapse queries/s, 8.4693
  filter queries/s, 9.8547 dependency updates/s, and 10.3056 zooms/s. These are
  observations for the existing fixture metadata, not performance thresholds.
- `git diff --check` passed; `mise run ci` passed on 2026-08-01 with 97 test files /
  501 tests, 242 formatted files, 231 lint/type files, and the 208-artifact package
  build.

## Next Slice

Run Slice 8 as the final API, dependency-direction, package, browser, and documentation
gate. Compare root exports and packed declarations with the locked facade; use fresh
packed React and browser-free consumers; build the playground; inspect `/`,
`/interactive`, `/project`, and `/navigation` at representative widths with Chrome
DevTools; record accessibility, focus, menu/editor, pointer, console, network,
benchmark, CI, SSR, and dirty-worktree evidence before marking the plan complete.
