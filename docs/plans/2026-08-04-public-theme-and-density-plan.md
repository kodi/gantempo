# Public Theme And Density Plan

Status: Complete and verified
Date: 2026-08-04
Milestone: Post-M5 public theming correction before playground Tailwind migration Slice 3
Architecture mapping: UI and theming contract; per-instance view configuration

## Summary

Replace the playground-only convention of selecting light, dark, high-contrast, and
compact presentation through consumer classes with a first-class `Gantt` contract.
The package will expose built-in theme names, typed custom theme definitions, density
presets, stable root attributes, and portal propagation while retaining `className`
and `classNames` as additive consumer styling APIs.

This is a package contract correction discovered while preparing the active
playground Tailwind migration. The architecture already requires built-in themes,
typed semantic tokens, instance isolation, density independent from color, and
portalled surface parity. This plan makes that existing target concrete before the
playground removes its legacy chart-frame theme selectors.

## Target Contract

```ts
export type GanttBuiltInTheme = 'dark' | 'high-contrast' | 'light';
export type GanttDensity = 'compact' | 'comfortable' | 'touch';

export interface GanttThemeDefinition {
  readonly id: string;
  readonly mode?: GanttBuiltInTheme;
  readonly tokens: Readonly<Partial<Record<GanttThemeToken, string | number>>>;
}

export interface GanttProps {
  readonly theme?: GanttBuiltInTheme | GanttThemeDefinition;
  readonly density?: GanttDensity;
  readonly themeRevision?: number | string;
}
```

- `theme` defaults to `light` and `density` defaults to `comfortable`.
- Built-in themes use packaged static CSS selected by public `data-gt-theme` and
  `data-gt-theme-mode` attributes.
- A custom definition selects its built-in fallback through `mode`; its supplied
  semantic tokens override that base on the owning root.
- `themeRevision` lets a host explicitly resynchronize external portal tokens when
  host-managed CSS variables change without changing the theme object or class.
- `className` remains a CSS/design-system/CSP integration seam, and `classNames`
  remains the typed part/state seam. Neither is the built-in theme selector.
- Density changes the renderer's layout metrics as well as CSS presentation; it is
  not a paint-only alias.

## Scope

### In scope

- public built-in theme, theme-token, custom-definition, density, and revision types;
- exported immutable built-in definitions plus a typed custom-theme helper;
- light, dark, and high-contrast package token sets;
- compact, comfortable, and touch renderer metrics;
- stable theme/mode/density root attributes and custom token application;
- external overlay-host attribute and resolved-token synchronization;
- runtime switching, multiple-instance isolation, SSR-safe output, and focused tests;
- matrix and main playground consumers/recipes using `theme` and `density` props;
- authoritative theming documentation, decision, roadmap, and active Tailwind-plan
  synchronization.

### Out of scope

- canvas or visual-export renderer implementation;
- a theme builder UI or persistence inside `GanttDocument`;
- system-theme preference selection beyond the documented future CSS-media path;
- splitting the existing aggregate stylesheet into new package subpath artifacts;
- completing the broader playground Tailwind migration or deleting its legacy CSS;
- arbitrary per-item colors, which remain owned by `appearanceVariants`.

## Decisions

- Keep one semantic token vocabulary independent of CSS property spelling. A private
  mapping applies browser custom properties, while the public token IDs remain usable
  by future canvas/export resolvers.
- Package built-ins are selected by attributes and static CSS. Custom theme objects
  use root custom-property values; consumers requiring stylesheet-only CSP behavior
  can keep using `className` plus documented `--gt-*` variables.
- A custom theme's `mode` is both its fallback palette and native color-scheme/high-
  contrast semantic mode. Missing mode means `light`.
- Theme IDs must be non-empty. Token values must be non-empty strings or finite
  numbers. Invalid definitions fail at the component boundary instead of producing a
  partially silent theme.
- Built-in values have one exported TypeScript definition and matching CSS assertions
  so DOM styling and portable consumers cannot drift unnoticed.
- Density metrics enter the existing scene-pipeline `metrics` input. Root CSS
  variables reflect the resolved scene metrics, so SVG geometry, lane layout,
  scrolling, hit testing, and CSS agree.
- `themeRevision` is an explicit cache/synchronization signal, not a global theme
  store. Multiple differently themed instances remain independent.

## Ordered Slices

### Slice 1: Fix and document the public contract

Status: `[x]` Done

- add the focused decision record and link it from architecture, roadmap, and this
  plan;
- replace the illustrative theme interface in `docs/UI_THEMING.md` with the accepted
  initial contract and precedence;
- record this package-contract deviation in the active Tailwind migration plan;
- keep the roadmap's execution order explicit before runtime implementation starts.

Verification:

- `git diff --check`
- linked-file and stale-contract searches

### Slice 2: Implement renderer-independent definitions and density metrics

Status: `[x]` Done

- add `packages/gantt/src/theme.ts` with public types, token IDs, immutable built-ins,
  custom-definition normalization, browser token mapping, and density metrics;
- add `theme`, `density`, and `themeRevision` to `GanttBaseProps` and root exports;
- feed resolved density metrics through `react/runtime/display-inputs.ts` into the
  existing scene pipeline;
- verify metric changes rebuild layout without changing document/session ownership.

Verification:

- focused theme and scene/runtime tests;
- strict public type/facade checks.

### Slice 3: Apply themes to roots, CSS, and portals

Status: `[x]` Done

- resolve the theme once per React render and apply stable theme/mode/density data
  attributes plus custom token properties to the Gantt root;
- add static dark/high-contrast and density rules to the package stylesheet while
  preserving the default light appearance;
- propagate theme/mode/density attributes and resynchronize all resolved `--gt-*`
  values on external overlay hosts when theme, density, class, or revision changes;
- preserve root-local portal inheritance and forced-colors behavior.

Verification:

- focused DOM, overlay, stylesheet, switching, two-instance, and SSR tests;
- existing customization and overlay regression suites.

### Slice 4: Migrate the playground proof

Status: `[x]` Done

- pass scenario `theme` and `density` directly to `Gantt`;
- keep temporary wrapper tokens only for playground-owned toolbar chrome until the
  already-planned Tailwind chart-frame slice removes them;
- update matrix recipes so dark/high-contrast/compact choices teach the public props;
- add one typed custom-theme recipe without changing scenario data or interaction
  ownership;
- update focused main/matrix tests to assert the public package attributes.

Verification:

- focused main and matrix DOM tests;
- production playground build.

### Slice 5: Complete verification and handoff

Status: `[x]` Done

- run formatting, lint, type checking, full tests, package build, playground build,
  and diff checks;
- inspect `/`, `/matrix`, and an overlay-bearing route at desktop and narrow widths
  when an approved Chrome surface is available;
- record routes, viewports, theme switching, portal state, accessibility findings,
  console/network state, and any live issues fixed;
- update this plan, roadmap, and Tailwind plan with exact evidence and the next
  actionable migration slice.

Verification:

- `vp check`
- `vp test run`
- `vp pack`
- `vp build apps/playground`
- `git diff --check`
- Chrome DevTools live gate when available

## Files Expected To Change

- `packages/gantt/src/theme.ts`
- `packages/gantt/src/theme.test.ts`
- `packages/gantt/src/index.tsx`
- `packages/gantt/src/react/types.ts`
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/react/runtime/display-inputs.ts`
- `packages/gantt/src/react/runtime.ts`
- `packages/gantt/src/react/renderer/overlays/controller.ts`
- `packages/gantt/src/styles.css`
- `packages/gantt/src/styles.test.ts`
- focused React DOM/SSR tests under `packages/gantt/src/react/`
- `apps/playground/src/ScenarioGantt.tsx`
- `apps/playground/src/matrix-recipes.ts`
- `apps/playground/src/pages/MainPage.dom.test.tsx`
- `apps/playground/src/pages/MatrixPage.dom.test.tsx`
- `README.md`
- `docs/UI_THEMING.md`
- `docs/ARCHITECTURE.md`
- `docs/decisions/2026-08-04-public-theme-and-density-contract.md`
- `docs/plans/2026-08-03-playground-tailwind-migration-plan.md`
- `docs/ROADMAP.md`

## Working Notes

The durable contract is recorded in the
[public theme and density decision](../decisions/2026-08-04-public-theme-and-density-contract.md).

### 2026-08-04 — Contract gap and plan start

- The live matrix currently selects theme on the playground `chart-frame` wrapper,
  and its revealed recipes teach complete theme token sets behind arbitrary consumer
  class names.
- `GanttBaseProps` exposes `className` and typed `classNames` but no theme, density, or
  revision contract. The package stylesheet contains only the neutral light token set.
- External overlay hosts already enumerate and copy every computed `--gt-*` property,
  but resynchronization depends only on `className` and hosts do not carry public
  theme/mode/density attributes.
- The scene pipeline already accepts validated layout metric overrides, but the React
  runtime does not currently supply them. Playground `--gt-row-height` overrides can
  therefore disagree with scene, SVG, scrolling, and hit-test geometry.
- Architecture and `UI_THEMING.md` already select built-in light/dark/high-contrast,
  typed theme definitions, separate density, per-instance ownership, and portal
  parity. This work concretizes that target and does not alter `GanttDocument`.
- Slice 1 added the focused accepted decision, replaced the illustrative theming API
  with the concrete initial tokens and precedence, linked architecture and roadmap,
  and recorded the prerequisite in the active Tailwind plan. `git diff --check` and
  cross-document link searches passed; no runtime behavior was claimed.

### 2026-08-04 — Theme, density, portal, and playground implementation

- Added the exported closed built-in theme/density/token unions, immutable light,
  dark, and high-contrast definitions, `defineGanttTheme`, custom-definition runtime
  validation, and semantic-token-to-browser-property resolution.
- Compact, comfortable, and touch now feed complete validated metrics into the scene
  pipeline. The root publishes the resulting header/default-row values, eliminating
  the old CSS-only geometry mismatch.
- Gantt roots now publish theme, mode, and density attributes. Static package CSS owns
  all three palettes and density presentation; custom object values override their
  selected mode without runtime stylesheet creation.
- Document-level overlay hosts publish the same attributes and resynchronize every
  computed `--gt-*` token when theme, density, class, or revision changes.
- `ScenarioGantt` passes theme/density to the package. Matrix recipes now teach the
  three built-ins and compact prop directly, while the resource scenario renders and
  reveals a typed `resource-planning` custom theme.
- Focused theme/unit, DOM/SSR/portal, stylesheet, root-facade, main-page, and matrix
  verification passed 6 files / 20 tests. The compact DOM proof changed real lane
  geometry from 58px to 38px; the custom theme proof switched external portal tokens
  and attributes at runtime. `vp check --no-fmt` passed lint/types for 247 files after
  repository formatting, and `git diff --check` passed.

### 2026-08-04 — Final verification and handoff

- The first package build exposed one declaration-only issue: TypeScript isolated
  declarations required an explicit type on the private semantic-token property map.
  The map now has a closed `GanttThemeCssProperty` type; no runtime behavior or public
  root export changed in that correction.
- Final `vp check` passed formatting for all 260 files and lint/type checking for all
  247 checked files with no warnings or errors.
- Final `vp test run` passed 104 test files / 532 tests. The recurring jsdom canvas
  capability notices remain informational and do not represent test failures.
- Final `vp pack` emitted 217 files / 1.82 MB, including the root declaration facade,
  the theme declaration chunk, and the 36.63 kB packaged stylesheet. The root facade
  exposes only the intended theme helper, built-ins, and public types.
- `vp build apps/playground` transformed 2,110 modules and emitted the production app;
  the existing large-chunk advisory remains non-blocking.
- `git diff --check` passed after the final documentation synchronization.
- Chrome DevTools/list-pages and the built-in Browser were not exposed in this
  session, and `http://localhost:5173/matrix` had no running local server. No live
  viewport, computed-style, accessibility-tree, console, or network claim is made.
  Automated DOM/SSR, axe-backed existing suites, stylesheet, portal, and production-
  build evidence therefore own this bounded completion.

## Next Slice

Resume the active playground Tailwind migration at Slice 2. Its later shared chart-
frame Slice 3 should remove wrapper-owned theme/density selection and consume this
completed package contract while preserving playground-owned toolbar presentation.
