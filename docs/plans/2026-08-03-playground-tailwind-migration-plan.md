# Playground Tailwind Migration Plan

Status: In progress
Milestone: Post-M5 playground and example DX
Architecture mapping: Application-owned presentation; framework-neutral package boundary
Last updated: 2026-08-03

## Summary

Replace the playground's large hand-written BEM stylesheet with Tailwind CSS v4 so
examples look like contemporary React integrations and their source is directly
copyable. Tailwind belongs only to `apps/playground`; `@gantempo/gantt` continues to
ship framework-neutral structural CSS, semantic tokens, stable parts, and slots.

## Decisions

- Use Tailwind CSS 4.3.3 through the official `@tailwindcss/vite` plugin.
- Omit Tailwind Preflight during migration so its global resets cannot change chart
  SVG/DOM behavior or unrelated legacy routes.
- Define the playground palette and typography as Tailwind theme tokens rather than
  repeating arbitrary color values in JSX.
- Convert JSX to utilities directly. Do not preserve BEM names through `@apply`.
- Keep only CSS that represents chart semantic-token demos or behavior Tailwind
  cannot express cleanly; it must not become a second general layout system.
- Do not add Tailwind, shadcn, or app UI dependencies to `@gantempo/gantt`.

## Scope

### In scope

- Tailwind/Vite setup and monorepo source detection;
- simple API example and its standalone source;
- shared playground shell, page primitives, and all existing routes;
- deletion of superseded app-level CSS and responsive/browser regression proof.

### Out of scope

- rewriting package renderer styles as utilities;
- changing public chart styling contracts or adding a package Tailwind peer;
- adopting shadcn or creating a shared UI package during this migration.

## Behavior To Preserve

- every route, accessible name, stable test hook, theme, chart interaction, and
  responsive breakpoint;
- the simple example's full-height source panels, GET/edit/PUT flow, warning contrast,
  zoom, and one-day interaction snap;
- isolated light, dark, and high-contrast chart presentations;
- package builds and core-only consumers without Tailwind.

## Slices

### Slice 1: Establish Tailwind and migrate the simple example

Status: `[x]` Complete

- install Tailwind 4.3.3 and its Vite plugin in the playground only;
- add CSS-first theme tokens without Preflight;
- convert the simple guide, result, loading state, and standalone entry to utilities;
- delete `simple-project-example.css` and remove its BEM classes.

Verification:

- focused simple-example tests
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome at 1440x1000 and 560x900

Dependencies: accepted decision and current React Query example.

### Slice 2: Migrate shared playground chrome

Status: `[ ]` Not started

- convert header, navigation, page container, intro, badges, and common controls;
- preserve accessible current-page, focus, responsive navigation, and theme controls;
- remove corresponding rules from the legacy stylesheet.

Verification: shell and main-page tests, production build, desktop/narrow Chrome.

Dependencies: Slice 1.

### Slice 3: Migrate cards, logs, and interactive routes

Status: `[ ]` Not started

- convert scenario cards, API log, forms, panels, toolbars, and interactive pages;
- keep chart theme overrides as explicit semantic-token demonstrations;
- preserve stable accessible names and form hooks.

Verification: focused route tests and browser interaction matrix.

Dependencies: Slice 2.

### Slice 4: Migrate project/navigation routes and remove legacy CSS

Status: `[ ]` Not started

- convert remaining project, navigation, uncontrolled, and matrix surfaces;
- delete superseded selectors and consolidate any irreducible chart-demo CSS;
- prove no legacy BEM presentation classes remain in playground JSX.

Verification: all playground tests, build, CSS/class search, responsive browser matrix.

Dependencies: Slice 3.

### Slice 5: Complete repository and distribution proof

Status: `[ ]` Not started

- run full CI and packed consumers;
- record final CSS reduction and browser accessibility/console/network evidence;
- synchronize this plan and roadmap completion evidence.

Verification: `mise run ci`, `mise run build-playground`, `vp pack`, fresh consumers,
`git diff --check`, and Chrome route matrix.

Dependencies: Slices 1-4.

## Working Notes

### 2026-08-03 — Adoption decision

- The playground currently carries roughly 1,584 lines of app CSS, 203 class
  selectors, and 76 distinct literal JSX class names.
- The simple loading state exposed the cost directly through
  `simple-project-example simple-project-example__state`: implementation detail was
  visible where a few local utilities communicate the design more clearly.
- Tailwind's current Vite integration and CSS-first configuration make an incremental
  app-only migration possible without changing package distribution.

### 2026-08-03 — Slice 1 completion evidence

- Added Tailwind 4.3.3 and `@tailwindcss/vite` only to `apps/playground`, registered
  the Vite plugin, and imported theme plus utility layers without Preflight.
- Replaced the simple guide, source panels, integration steps, result card, loading
  state, toolbar, and chart frame with direct utilities. Deleted
  `simple-project-example.css`; a live DOM search found no remaining simple/example
  BEM presentation classes on the route.
- The standalone source now includes the Tailwind Vite plugin, no-Preflight CSS entry,
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

## Next Slice

Begin Slice 2 in `Playground.tsx`: migrate the shared shell, header, navigation, page
container, intros, badges, and common controls before touching route-specific panels.
