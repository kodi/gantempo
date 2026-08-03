# Entire Playground Tailwind Migration Plan

Status: In progress
Milestone: Post-M5 playground and example DX
Architecture mapping: Application-owned presentation; framework-neutral package boundary
Last updated: 2026-08-03

## Summary

Migrate every surface under `apps/playground` to Tailwind CSS v4 utilities and remove
all playground-authored CSS class selectors. The finished playground must not retain
a legacy BEM layer, route-specific stylesheet, CSS Module, `@apply` abstraction, or
custom class name that depends on an app-authored selector. Presentation should be
visible at the React or HTML element that owns it.

This is an application-only migration. `@gantempo/gantt` continues to ship its own
framework-neutral structural and theme CSS. The playground may consume the package's
public semantic tokens, `data-gt-*` attributes, typed `classNames`, and slots, but it
must not migrate package renderer CSS or make Tailwind a package dependency.

The migration is already underway. Tailwind and the Vite integration are installed,
and the simple API example is complete and verified. This plan preserves that work,
incorporates the in-progress matrix recipe addition, and makes the zero-custom-class
target explicit for every remaining route and shared component.

## Target State And Definition Of Done

The migration is complete only when all of the following are true:

- all eight routes (`/`, `/matrix`, `/interactive`, `/interactive-custom`,
  `/uncontrolled`, `/navigation`, `/project`, and `/examples/simple-project`) use
  Tailwind utilities for all playground-owned presentation;
- `apps/playground/src/styles.css` contains only the Tailwind layer/import directives
  and `@theme` token configuration; it contains no authored selector rules;
- the standalone example CSS entry remains Tailwind directives only;
- no stylesheet under `apps/playground` contains an app-authored class selector,
  element selector, attribute selector, media rule with authored declarations, or
  `@apply` block;
- no JSX `className` contains a legacy playground/BEM hook such as `chart-frame`,
  `page-intro`, `api-log__*`, or `interactive-*`; every value is a Tailwind utility
  string or an explicit static map of Tailwind utility strings;
- dynamic theme, density, tone, open/closed, current-page, invalid, disabled, and
  responsive styling uses static Tailwind variants/maps so Tailwind can discover
  every generated utility;
- tests use roles, accessible names, `data-gt-*`, or purpose-specific `data-testid`
  hooks rather than deleted presentation class names;
- no playground rule targets private package classes such as `.gt-gantt__*`; chart
  customization uses documented semantic tokens, stable `data-gt-*` parts, or typed
  `classNames` hooks;
- a repository test prevents new playground selector CSS, `@apply`, CSS Modules, and
  the removed legacy class prefixes from being introduced;
- package manifests and packed output confirm that Tailwind remains confined to the
  private playground application.

`@theme` declarations and the imported `@gantempo/gantt/styles.css` package stylesheet
are intentionally allowed. They configure Tailwind and consume the package contract;
they are not playground-authored CSS classes.

## Decisions

- Use Tailwind CSS 4.3.3 through the official `@tailwindcss/vite` plugin already
  installed in `apps/playground`.
- Keep Tailwind Preflight disabled. Move the current root, body, box-sizing, font,
  link, and button defaults to utilities on `index.html`, the root shell, and the
  owning controls. Ensure Tailwind scans `index.html` explicitly if its utilities are
  not discovered by the existing source configuration.
- Keep the palette and typography in Tailwind `@theme` tokens. Theme configuration is
  the only authored declaration block allowed in the final app stylesheet.
- Convert presentation directly to utilities. Do not preserve BEM names through
  `@apply`, CSS Modules, a CSS-in-JS layer, runtime stylesheet injection, or aliases
  that merely rename the legacy classes.
- Prefer local literal utility strings. Where runtime state needs a class choice, use
  a typed map whose values contain complete static Tailwind utility strings; do not
  construct class names through interpolation.
- Express Gantt instance tokens through Tailwind arbitrary-property utilities and
  explicit light/dark/high-contrast and density maps. Use Tailwind arbitrary variants
  only against public `data-gt-*` hooks or classes supplied through typed `classNames`.
- Preserve semantic `data-*` attributes when they describe state or are stable test
  and browser-verification hooks. Do not retain presentation-only `data-theme` or
  custom names solely as substitutes for deleted CSS selectors.
- Keep matrix recipes data-agnostic: assume `document` and `range` already exist and
  teach only view selection, appearance mapping, and semantic styling.
- Use an independent accessible code toggle per matrix card so comparison remains
  compact by default and keyboard users can reveal the recipes they want.
- Do not introduce shadcn or a shared UI package. Extract a local React primitive only
  when repeated structure and accessibility behavior justify it; its styling still
  lives in Tailwind utilities at the component boundary.
- Do not add Tailwind, its Vite plugin, or playground theme code to
  `@gantempo/gantt`.

## Scope

### In scope

- Tailwind/Vite source discovery and the no-Preflight global styling strategy;
- `index.html`, application shell, navigation, page layouts, headings, badges,
  controls, cards, forms, logs, panels, toolbars, chart frames, and responsive states;
- the simple API example and its standalone source;
- per-scenario matrix presentation recipes and accessible reveal controls;
- light, dark, high-contrast, and density demonstrations through Tailwind-authored
  semantic token values;
- all playground runtime components, their DOM tests, SSR/hydration checks, and
  browser verification;
- deletion of all superseded playground selector CSS and an automated regression
  guard.

### Out of scope

- rewriting `packages/gantt/src/styles.css` or renderer markup as utilities;
- changing the public chart styling contract unless implementation proves an
  existing public hook is insufficient;
- adding a Tailwind peer/runtime dependency or Tailwind-specific public API to the
  package;
- adopting shadcn, creating `packages/ui`, redesigning routes, or changing playground
  product behavior;
- changing scenario documents, scheduling behavior, persistence flows, or package
  interaction ownership.

If removing a private `.gt-gantt__*` target reveals a missing public styling hook,
stop that slice and record the contract gap as a deviation. Any package API change is
substantial and requires an updated plan/roadmap and, when durable architecture is
affected, the relevant decision/architecture updates before implementation.

## Current State

Observed on 2026-08-03; counts are a migration baseline and may decrease while other
in-flight playground work lands:

- `apps/playground/src/styles.css` is 1,532 lines and has 246 lines beginning an
  app-authored class selector, including repeated selectors inside responsive rules;
- 117 non-simple-example literal `className` attributes remain across ten runtime
  components; most of those components still carry legacy playground/BEM names;
- Tailwind 4.3.3 and `@tailwindcss/vite` are scoped to the playground, registered in
  `apps/playground/vite.config.ts`, and imported without Preflight;
- `SimpleProjectExamplePage.tsx`, `examples/SimpleProjectExample.tsx`, and the
  standalone example CSS entry already use direct utilities;
- `ScenarioGantt.tsx` assembles dynamic `chart-frame--*` classes, while the legacy
  stylesheet owns the Gantt instance tokens, theme/density variants, toolbar, and
  chart sizing;
- the legacy stylesheet targets private `.gt-gantt__lane-header`,
  `.gt-gantt__task-label`, and `.gt-gantt__time-header` classes; these must not survive
  as arbitrary Tailwind selectors;
- `MainPage.dom.test.tsx`, `AppendixConsumers.dom.test.tsx`,
  `InteractiveCustomPage.dom.test.tsx`, and `ExampleApiLog.dom.test.tsx` still query or
  assert legacy presentation classes;
- a user-directed matrix recipe addition is in progress in `MatrixPage.tsx`,
  `scenarios/index.ts`, `matrix-recipes.ts`, and `MatrixPage.dom.test.tsx`. Its content
  and verification should be preserved when the matrix presentation is migrated.

## Behavior To Preserve

- all existing routes, link destinations, `aria-current` behavior, accessible names,
  headings, landmarks, keyboard order, focus-visible treatment, and stable semantic
  hooks;
- desktop and narrow layouts without page-level horizontal overflow, including the
  horizontally scrollable route navigation where needed;
- the simple example's full-height source panels, GET/edit/PUT flow, warning
  contrast, zoom, and one-day interaction snap;
- controlled, application-owned, and runtime-owned editing flows; undo/redo; menus;
  dialogs; custom details validation; cancellation; and API-log retention/disclosure;
- main, matrix, navigation, and project chart dimensions, isolated light/dark/high-
  contrast themes, comfortable/compact density, and appearance variants;
- project query-string modes, RTL/localization, filtering, hierarchy, dependencies,
  SSR/hydration, and read-only behavior;
- full occurrence knowledge, controlled navigation, focus/selection behavior, and all
  existing package interaction semantics;
- package builds, SSR consumers, and core-only consumers that do not install or run
  Tailwind.

## Implementation Shape

1. Finish the already-started matrix recipe work without broadening it into the CSS
   migration.
2. Migrate shared outer chrome first so every route receives the same Tailwind-owned
   document, shell, navigation, page, intro, metadata, and note behavior.
3. Replace the chart-frame styling boundary in `ScenarioGantt` with typed static
   Tailwind maps for size, density, and theme before migrating consumers that depend
   on it.
4. Convert route families in reviewable slices, updating focused tests away from
   presentation selectors in the same slice.
5. Delete the selector stylesheet only after all consumers have moved, then add a
   structural regression test that enforces the final zero-custom-selector boundary.
6. Run the full repository, package-boundary, responsive, accessibility, console, and
   network proof before marking the plan and roadmap complete.

Temporary coexistence is permitted only while an ordered slice is in progress. Each
slice must remove the selectors it supersedes; no slice may add new app-authored CSS.

## Cross-Slice Rules

- Preserve the public package facade and package stylesheet import.
- Do not modify scenario data, document/change ownership, controlled range behavior,
  or scheduling semantics as part of visual migration.
- Do not target undocumented package DOM classes. Prefer `data-gt-part`; use typed
  `classNames` when a Tailwind utility must be attached directly to a package part.
- Keep complete utility strings statically discoverable by Tailwind. Variant maps may
  select complete strings but may not synthesize fragments such as
  `` `bg-${tone}` ``.
- Preserve accessible names and semantic hooks before removing a class used by a
  test. Add `data-testid` only when role/name or public `data-gt-*` queries cannot
  identify the element reliably.
- Preserve the current no-Preflight boundary and explicitly migrate every global
  default that the legacy stylesheet supplied.
- Run `git diff --check` in every slice and a focused DOM/build gate before advancing.
- Use Conventional Commit subjects for implementation slices.
- Synchronize this active plan and `docs/ROADMAP.md` whenever implementation status,
  evidence, a substantial deviation, or the actionable next slice changes.

## Slices

### Slice 1: Establish Tailwind and migrate the simple example

Status: `[x]` Done

Goal: Establish the app-only Tailwind toolchain and prove direct utilities on a
real, copyable example.

Why here: This validates Vite integration, no-Preflight utilities, example source,
and package independence before touching shared playground chrome.

This slice implemented:

- Tailwind 4.3.3 and its Vite plugin in the playground only;
- CSS-first theme tokens without Preflight;
- direct utilities for the simple guide, result, loading state, toolbar, chart frame,
  and standalone entry;
- removal of `simple-project-example.css` and its BEM classes.

Expected output: A complete `/examples/simple-project` Tailwind route and standalone
example whose package integration still works without a Tailwind package dependency.

Verification: Completed evidence is recorded in Working Notes. Focused DOM tests,
`mise run build-playground`, `mise run ci`, `git diff --check`, and Chrome at
1440x1000 and the available narrow 500x844 viewport passed.

Dependencies: Accepted Tailwind adoption decision and the React Query example.

### Slice 1.1: Add matrix presentation recipes

Status: `[-]` In progress

Goal: Let each matrix scenario independently reveal the focused React/CSS recipe for
its rendered presentation.

Why here: The user requested this while Slice 1 was complete. It can land before the
shared CSS migration because the new controls already use direct utilities.

This slice should implement:

- one focused, data-agnostic React/CSS recipe for every matrix scenario;
- independent Show code/Hide code controls with associated code regions;
- recipes aligned with project, custom, resource, segment, theme, density, and empty-
  state choices;
- focused DOM coverage for default-hidden and independent reveal behavior.

Expected output: Matrix recipes and controls that introduce no new custom selector
CSS and remain ready for the full matrix-card migration in Slice 3.

Verification:

- `pnpm test -- apps/playground/src/pages/MatrixPage.dom.test.tsx --reporter=verbose`
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome on `/matrix` at desktop and narrow widths

Dependencies: Slice 1.

### Slice 2: Migrate document defaults, shared shell, and main page

Status: `[ ]` Not started

Goal: Make the application shell and `/` route fully Tailwind-owned.

Why here: Every later route inherits document and shell behavior. Migrating this
first prevents each route slice from duplicating global reset, layout, header, and
navigation work.

This slice should implement:

- move root/body sizing, margin, font, color, background, box-sizing, and control
  defaults to discoverable utilities in `index.html`, `Playground.tsx`, and owning
  elements while keeping Preflight disabled;
- convert the sticky header, brand, responsive route navigation, current-page state,
  shared page container, intro, eyebrow, metadata badges, note, and theme selector;
- convert `MainPage.tsx` while preserving its accessible theme control;
- remove every superseded shell/main/global rule from `styles.css`;
- migrate `MainPage.dom.test.tsx` away from `.chart-frame` to a semantic chart query.

Expected output: All routes render inside Tailwind shell chrome; `/` contains no
legacy class names; document-level behavior no longer relies on authored selector
rules.

Verification:

- `pnpm test -- apps/playground/src/pages/MainPage.dom.test.tsx --reporter=verbose`
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome on `/` and `/examples/simple-project` at 1440x1000 and 560x900 (or the
  available narrow minimum), checking navigation overflow, current-page state,
  focus, theme changes, and console state

Dependencies: Slice 1.1 complete or cleanly committed so shared Matrix changes are
not mixed into this slice.

### Slice 3: Replace the shared chart-frame, theme, and matrix CSS boundary

Status: `[ ]` Not started

Goal: Express shared Gantt wrappers, semantic tokens, size/density choices, matrix
cards, and matrix recipes entirely through static Tailwind utilities.

Why here: `ScenarioGantt` is the highest-leverage styling boundary for main, matrix,
and navigation consumers. Proving the public package-hook strategy here removes the
risk before route-specific migrations continue.

This slice should implement:

- replace `chart-frame`, `chart-frame--${size}`, and dynamic density classes with
  typed maps of complete utility strings;
- move light/dark/high-contrast semantic `--gt-*` token sets and row/header metrics
  into explicit Tailwind arbitrary-property utility maps;
- migrate toolbar, actions, chart sizing, card grid, card header, recipe toggle, and
  code region presentation;
- replace `.gt-gantt__lane-header` and `.gt-gantt__task-label` targets with stable
  `data-gt-part` variants or typed `classNames` utilities;
- preserve `data-theme` only if it remains meaningful to tests/accessibility rather
  than as a selector dependency;
- remove all shared chart-frame and matrix selectors from `styles.css` and update
  affected DOM tests to use semantic hooks.

Expected output: `ScenarioGantt.tsx` and `/matrix` contain no legacy custom class
names, and Tailwind can statically emit every theme, density, and state utility.

Verification:

- `pnpm test -- apps/playground/src/pages/MainPage.dom.test.tsx apps/playground/src/pages/MatrixPage.dom.test.tsx --reporter=verbose`
- `vp check`
- `mise run build-playground`
- inspect the production CSS for the explicit light/dark/high-contrast and density
  utilities
- `git diff --check`
- Chrome on `/` and `/matrix` at 1440x1000 and 560x900, covering each theme,
  matrix density, recipe disclosure, accessibility tree, overflow, and console

Dependencies: Slice 2 and completed Slice 1.1.

### Slice 4: Migrate navigation and project consumers

Status: `[ ]` Not started

Goal: Convert the navigation stress route and M5 project consumer without changing
their controlled view, query-string, localization, hierarchy, or interaction logic.

Why here: Both are bounded chart consumers that reuse the shell and chart strategy
but have distinct responsive summaries/toolbars and strong existing DOM coverage.

This slice should implement:

- convert `NavigationPage.tsx` summary cards and responsive layout;
- move the narrow time-header treatment from the private
  `.gt-gantt__time-header` selector to a public `data-gt-part` or typed `classNames`
  Tailwind variant;
- convert `ProjectPage.tsx` configuration grid, ownership links, controls, toolbar,
  chart wrapper/token metrics, status region, and narrow/RTL layouts;
- preserve URL option handling, Arabic RTL behavior, SSR/hydration, read-only state,
  filtering, dependencies, and accessible names;
- remove the navigation/project rules and class-based test queries they supersede.

Expected output: `/navigation` and `/project` are Tailwind-only playground surfaces,
including SSR/hydration output, with no private package-class targeting.

Verification:

- `pnpm test -- apps/playground/src/pages/NavigationPage.dom.test.tsx apps/playground/src/pages/ProjectPage.dom.test.tsx apps/playground/src/project-ssr.dom.test.tsx --reporter=verbose`
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome on `/navigation` and representative `/project` light/RTL/read-only query
  modes at 1440x1000 and 560x900; verify paging/panning, overflow, focus,
  accessibility, console, and requests

Dependencies: Slice 3.

### Slice 5: Migrate controlled/runtime-owned interaction chrome and API log

Status: `[ ]` Not started

Goal: Convert the shared interaction controls, chart toolbar content, slot content,
and API event log used by the controlled and runtime-owned examples.

Why here: These routes share the densest stateful chrome. Migrating the common shapes
together avoids temporary duplicate patterns and gives the custom-details route a
stable Tailwind baseline for Slice 6.

This slice should implement:

- convert `InteractivePage.tsx` and `UncontrolledPage.tsx` page chrome, command rows,
  disabled/hover/focus states, separators, status outputs, chart counts, and notes;
- convert lane-header, task-content, column-cell, tooltip, menu, and editor slot
  classes to Tailwind utility values passed through the package APIs;
- convert `ExampleApiLog.tsx`, including empty state, tones, disclosure hover/open
  state, chevron rotation, retained-list scrolling, metadata, and raw JSON panel;
- replace presentation-class queries in `AppendixConsumers.dom.test.tsx` and
  `ExampleApiLog.dom.test.tsx` with semantic/data hooks;
- remove all corresponding interactive and API-log selectors from `styles.css`.

Expected output: `/interactive` and `/uncontrolled` contain no legacy custom class
names, and the reusable API log has no selector dependency.

Verification:

- `pnpm test -- apps/playground/src/pages/AppendixConsumers.dom.test.tsx apps/playground/src/ExampleApiLog.dom.test.tsx --reporter=verbose`
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome on `/interactive` and `/uncontrolled` at desktop and narrow widths,
  exercising add/remove, undo/redo, edit, progress, log disclosure, keyboard focus,
  overflow, console, and requests

Dependencies: Slice 3.

### Slice 6: Migrate the application-owned custom interaction panel

Status: `[ ]` Not started

Goal: Convert `/interactive-custom`, including its details display and edit form, to
Tailwind without changing the application-owned edit-request contract.

Why here: This is the largest remaining single route and reuses the interactive
baseline from Slice 5. Keeping it separate makes its accessibility and validation
behavior reviewable.

This slice should implement:

- convert the custom details container, header, status badge, description, definition
  list, form grid, fields, invalid/error states, disabled fieldset, and action row;
- use explicit responsive utilities for the three-column/two-column/one-column
  transitions and narrow stacked actions;
- replace `uncontrolled-task--pending` and any other typed package class hook with
  direct Tailwind utility values;
- preserve details-region focus, edit/cancel/save behavior, validation messages,
  deletion closure, keyboard entry points, and the absence of an API/debug surface;
- remove all custom-details and remaining interactive selectors and migrate
  `InteractiveCustomPage.dom.test.tsx` off `.api-log` or other presentation queries.

Expected output: `/interactive-custom` is Tailwind-only and preserves the complete
application-owned interaction contract.

Verification:

- `pnpm test -- apps/playground/src/pages/InteractiveCustomPage.dom.test.tsx --reporter=verbose`
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome on `/interactive-custom` at 1440x1000 and 560x900, covering menu and
  keyboard entry, edit validation, Save, Cancel, Undo/Redo, deletion closure,
  focus return, accessibility, overflow, console, and requests

Dependencies: Slice 5.

### Slice 7: Delete legacy CSS and enforce the zero-custom-selector boundary

Status: `[ ]` Not started

Goal: Remove the final compatibility layer and make the user's no-custom-CSS-class
requirement mechanically enforceable.

Why here: Deletion is safe only after every route owns its Tailwind presentation.
The permanent guard belongs with cleanup so later work cannot silently recreate the
legacy styling system.

This slice should implement:

- audit every `.tsx`, `.ts`, `.html`, and `.css` file under `apps/playground` for
  legacy class names, custom selectors, private `.gt-gantt__*` targeting, `@apply`,
  CSS Modules, CSS-in-JS, and dynamically interpolated utility fragments;
- reduce `src/styles.css` to Tailwind imports/layers plus `@theme` only and confirm
  `src/examples/styles.css` is directives only;
- remove dead `data-theme`, helper maps, imports, and test hooks that existed only for
  deleted selectors, while retaining semantic/test contracts;
- add a focused source-boundary test that fails on authored selector rules, `@apply`,
  CSS Module files, known legacy prefixes, or private package-class targets;
- prove every route is still represented in DOM and browser coverage.

Expected output: Zero playground-authored selector rules, zero legacy custom class
names, and a stable automated regression gate.

Verification:

- focused new Tailwind-boundary test
- `rg -n "@apply|\\.module\\.css|\\.gt-gantt__" apps/playground` returns no matches
  outside intentional negative assertions in the boundary test
- `rg -n "playground-(shell|header|nav)|page(__|--)|chart-frame|scenario-(matrix|card)|interactive-|custom-details|api-log|project-(controls|status)" apps/playground/src --glob '!**/*.test.*'` returns no matches
- `vp check`
- `mise run build-playground`
- `git diff --check`

Dependencies: Slices 2-6.

### Slice 8: Complete repository, package-boundary, and browser proof

Status: `[ ]` Not started

Goal: Verify the completed migration across the repository, distribution boundary,
all routes, responsive layouts, accessibility, and runtime diagnostics.

Why here: Only the final Tailwind graph and deleted selector layer can prove that the
entire playground migrated without regressing package consumers.

This slice should implement:

- run the full automated gates and package build from a clean implementation state;
- confirm `@gantempo/gantt` manifests and packed artifacts contain no Tailwind
  dependency or playground source;
- inspect all eight routes in live Chrome at desktop and narrow widths, plus the
  intermediate 900px breakpoint where layout changes materially;
- exercise each route's meaningful interaction rather than checking screenshots
  alone;
- record exact test counts, build output, selector/CSS reduction, routes, viewports,
  accessibility findings, console/network state, and live issues fixed in this plan;
- update this plan and `docs/ROADMAP.md` with final status and completion evidence.

Expected output: A verified, documented Tailwind-only playground with the package
boundary unchanged.

Verification:

- `mise run ci`
- `mise run build-playground`
- `vp pack`
- fresh tarball consumer checks for stylesheet import, React/TypeScript use, SSR, and
  absence of a Tailwind runtime/package requirement
- `git diff --check`
- Chrome route matrix at 1440x1000, 900x900, and 560x900 (or the available narrow
  minimum), recording accessibility tree, horizontal overflow, focus, console, and
  network results

Dependencies: Slice 7.

## Testing Plan

### Per-slice confidence

- Run the closest existing DOM suites for behavior and accessibility contracts.
- Build the production playground in every slice so Tailwind source discovery and
  arbitrary variants are checked outside development mode.
- Inspect every migrated route at desktop and narrow widths before removing its
  legacy selectors.
- Search the changed route for old class names and run `git diff --check` before the
  slice is marked done.

### Final confidence

- The source-boundary test is the mechanical acceptance gate for zero custom
  playground selector CSS.
- `mise run ci` is the repository formatting, lint/type, test, and package gate.
- `mise run build-playground` proves production Tailwind generation and app bundling.
- Packed/fresh-consumer checks prove that the application-only dependency did not
  leak into `@gantempo/gantt`.
- Live Chrome verification covers every route, the meaningful breakpoint set,
  accessibility, focus/keyboard behavior, interaction parity, overflow, console, and
  network state.

## Files Expected To Change

Foundation and shared boundary:

- `apps/playground/index.html`
- `apps/playground/src/styles.css`
- `apps/playground/src/Playground.tsx`
- `apps/playground/src/ScenarioGantt.tsx`
- `apps/playground/src/appearance.ts`
- `apps/playground/src/pages/MainPage.tsx`
- `apps/playground/src/pages/MainPage.dom.test.tsx`

Route families:

- `apps/playground/src/pages/MatrixPage.tsx`
- `apps/playground/src/matrix-recipes.ts`
- `apps/playground/src/scenarios/index.ts`
- `apps/playground/src/pages/MatrixPage.dom.test.tsx`
- `apps/playground/src/pages/NavigationPage.tsx`
- `apps/playground/src/pages/NavigationPage.dom.test.tsx`
- `apps/playground/src/pages/ProjectPage.tsx`
- `apps/playground/src/pages/ProjectPage.dom.test.tsx`
- `apps/playground/src/project-ssr.dom.test.tsx`
- `apps/playground/src/pages/InteractivePage.tsx`
- `apps/playground/src/pages/UncontrolledPage.tsx`
- `apps/playground/src/pages/InteractiveCustomPage.tsx`
- `apps/playground/src/pages/InteractiveCustomPage.dom.test.tsx`
- `apps/playground/src/ExampleApiLog.tsx`
- `apps/playground/src/ExampleApiLog.dom.test.tsx`
- `apps/playground/src/pages/AppendixConsumers.dom.test.tsx`

Boundary proof:

- a new focused Tailwind/source-boundary test under `apps/playground/src/`;
- `docs/plans/2026-08-03-playground-tailwind-migration-plan.md`;
- `docs/ROADMAP.md` as slice status/evidence changes.

`apps/playground/src/pages/SimpleProjectExamplePage.tsx`,
`apps/playground/src/examples/SimpleProjectExample.tsx`, and
`apps/playground/src/examples/styles.css` should need only audit-driven corrections;
their Tailwind migration is already complete.

## Open Questions And Deviation Triggers

- No product decision is open: the required end state is Tailwind across the entire
  playground with no playground-authored CSS classes.
- Verify during Slice 3 that all current private `.gt-gantt__*` selectors can be
  replaced through existing public `data-gt-*` or typed `classNames` hooks. A missing
  hook is a package-contract deviation, not permission to retain a private selector.
- Verify during Slice 2 that the no-Preflight document utilities cover the legacy
  global defaults in production output. If they do not, fix content discovery or
  attach utilities to the owning HTML/React elements; do not restore selector CSS.

## Working Notes

### 2026-08-03 — Adoption decision

- The initial playground carried roughly 1,584 lines of app CSS, 203 class selectors,
  and 76 distinct literal JSX class names.
- The simple loading state exposed the cost directly through
  `simple-project-example simple-project-example__state`: implementation detail was
  visible where a few local utilities communicate the design more clearly.
- Tailwind's Vite integration and CSS-first configuration make an incremental app-
  only migration possible without changing package distribution.

### 2026-08-03 — Slice 1 completion evidence

- Added Tailwind 4.3.3 and `@tailwindcss/vite` only to `apps/playground`, registered
  the Vite plugin, and imported theme plus utility layers without Preflight.
- Replaced the simple guide, source panels, integration steps, result card, loading
  state, toolbar, and chart frame with direct utilities. Deleted
  `simple-project-example.css`; a live DOM search found no remaining simple/example
  BEM presentation classes on the route.
- The standalone source includes the Tailwind Vite plugin, no-Preflight CSS entry,
  QueryClient entry, GET/PUT adapter, and full working component. All six source
  panels are expanded, use `white-space: pre-wrap`, and have equal client/scroll
  dimensions instead of internal scroll areas.
- `pnpm test -- apps/playground/src/pages/SimpleProjectExamplePage.dom.test.tsx
  --reporter=verbose` passed the repository suite: 101 files and 518 tests.
- `mise run build-playground` passed with 2,024 modules transformed; the existing
  large-chunk advisory remains non-blocking. Final `mise run ci` passed formatting,
  lint/types, all 101 test files and 518 tests, and the 214-file package build;
  `git diff --check` passed.
- Chrome inspected `/examples/simple-project` at 1440x1000 and at its 500x844 narrow
  window minimum. Both had no page-level horizontal overflow or console errors; the
  chart measured 430px and 470px tall respectively, the fake GET returned 200, the
  accessible tree exposed all three integration steps, and every code panel remained
  fully visible without horizontal scrolling.

### 2026-08-03 — Entire-playground planning audit

- The user tightened the migration acceptance criterion: the entire playground must
  use Tailwind and no playground-authored custom CSS classes may remain.
- The current 1,532-line stylesheet still has 246 class-selector starts and owns
  shared chrome, interactive pages, API logs, matrix cards, chart themes, project UI,
  and responsive behavior. The remaining work is therefore split by shared boundary
  and route family rather than left as one broad cleanup slice.
- Tests still use `.chart-frame`, `.interactive-task--selected`, `.api-log`, and
  `.api-log-entry__operation`; those assertions must migrate with their owning
  components so deleted presentation classes do not become hidden test contracts.
- Private `.gt-gantt__*` targets in app CSS are explicitly excluded from the Tailwind
  rewrite. Public `data-gt-*` and typed `classNames` hooks are the allowed bridge.
- No implementation or verification for Slices 2-8 was performed by this planning
  audit.

## Next Slice

Complete and verify Slice 1.1 without mixing in broad styling changes. Then start
Slice 2 by inspecting `apps/playground/index.html`, `src/Playground.tsx`,
`src/pages/MainPage.tsx`, and the global/shell/main sections of `src/styles.css`.
Move the no-Preflight document defaults and shared chrome to static utilities, update
`MainPage.dom.test.tsx` to use semantic chart hooks, run its focused test plus the
production playground build, and inspect `/` and `/examples/simple-project` at desktop
and narrow widths before marking Slice 2 done.
