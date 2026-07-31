# UI and Theming Strategy

Status: Architecture baseline
Last updated: 2026-07-31

## 1. Decision

Gantempo will be **Tailwind-native without Tailwind lock-in**.

Tailwind applications receive a first-class token bridge, stable styling attributes,
typed class hooks, and React slots that accept utility classes naturally. Gantempo
does not require Tailwind, generate its UI from Tailwind utilities, or expose Tailwind
configuration as its core theme model.

The core theme contract is a renderer-independent set of semantic tokens, parts,
states, variants, and density metrics. CSS custom properties represent that contract
in the browser. The same semantic values are resolved for SVG, canvas, portals, and
visual export.

The system architecture and package boundaries remain authoritative in
[Architecture](ARCHITECTURE.md). This document is authoritative for public UI and
theming contracts.

## 2. Product promise

A consumer should be able to:

- make Gantempo look native inside an existing design system;
- apply a complete brand theme without targeting undocumented DOM structure;
- use Tailwind utilities in slots and typed class hooks;
- run Gantempo without installing Tailwind;
- display differently themed Gantt instances on the same page;
- switch light, dark, contrast, or density modes at runtime;
- preserve the same semantic appearance in DOM/SVG, canvas, and exports;
- upgrade without routine theme breakage caused by internal markup changes.

Theme customization must not require `!important`, global skin state, raw HTML, or
runtime stylesheet injection.

## 3. Non-goals

- Making every internal element or class name a public API.
- Recreating a general-purpose design-token framework.
- Requiring a build-time CSS tool.
- Guaranteeing that arbitrary DOM CSS can be reproduced by canvas or server export.
- Encoding product-specific status, priority, or workflow values in the core theme.
- Persisting theme configuration inside `GanttDocument`.

Themes are view configuration. Applications may persist a user's theme preference
separately from scheduling data.

## 4. Theming layers

The visual system has four layers:

```text
host design system / CSS / Tailwind / typed theme
  -> Gantempo semantic tokens
  -> parts, states, variants, and density
  -> DOM/SVG, canvas, portals, and export
```

### 4.1 Structural styles

Structural styles are required for:

- layout and containment;
- virtualization;
- hit targets and interaction geometry;
- focus proxies and visually hidden content;
- SVG positioning;
- editor and overlay placement.

They must contain the smallest possible set of visual opinions.

### 4.2 Semantic theme

The semantic theme controls paint and typography:

- surfaces, text, borders, and grid lines;
- task, summary, milestone, baseline, and dependency appearance;
- selection, focus, dragging, invalid, and disabled states;
- working and non-working time;
- warnings, errors, and capacity states;
- shadows, radii, and motion.

### 4.3 Density

Density controls layout metrics independently from color:

- row and task height;
- header and cell padding;
- resize-handle and dependency-handle size;
- minimum pointer and touch targets;
- editor and menu spacing.

The initial presets are `compact`, `comfortable`, and `touch`. A color theme may select
a default density, but applications can override it separately.

### 4.4 Consumer overrides

Consumer CSS, `classNames`, portable appearance rules, and React slots apply after the
packaged theme. Gantempo styles use cascade layers and low-specificity selectors so
ordinary consumer rules can win without `!important`.

## 5. Stylesheet and package contract

The exact package scope remains open. The intended subpath shape is:

```ts
import "@scope/gantt/styles/structure.css";
import "@scope/gantt/themes/default.css";
```

Optional imports may include:

```ts
import "@scope/gantt/themes/dark.css";
import "@scope/gantt/themes/high-contrast.css";
import "@scope/gantt/themes/tailwind.css";
```

Rules:

- `structure.css` is versioned with the renderer and is required.
- Visual theme files never duplicate structural rules.
- Each theme is scoped beneath a Gantempo root selector.
- Theme imports have no font, icon-font, reset, or global element side effects.
- The default theme remains usable without any CSS framework.
- The Tailwind bridge is optional CSS, not a Tailwind runtime dependency.
- Strict Content Security Policy usage can rely entirely on static stylesheets and
  classes.

An `unstyled` entry point means “structure without a packaged visual theme,” not “no
CSS.”

## 6. Semantic token contract

CSS custom properties use the `--gt-` prefix and are scoped to an instance:

```css
.brand-planner {
  --gt-font-family: var(--app-font-sans);
  --gt-color-surface: var(--app-surface);
  --gt-color-surface-muted: var(--app-surface-muted);
  --gt-color-text: var(--app-text);
  --gt-color-border: var(--app-border);
  --gt-color-accent: var(--app-accent);
  --gt-color-focus-ring: var(--app-focus-ring);
  --gt-task-fill: var(--app-accent);
  --gt-task-text: var(--app-on-accent);
  --gt-task-radius: var(--app-radius-sm);
  --gt-dependency-stroke: var(--app-border-strong);
  --gt-row-height: 36px;
  --gt-z-overlay: 1200;
}
```

Token families include:

- `font-*` and `text-*`;
- `color-surface-*`, `color-text-*`, `color-border-*`, and `color-accent-*`;
- `grid-*`, `row-*`, `scale-*`, and `lane-*`;
- `task-*`, `summary-*`, `milestone-*`, and `progress-*`;
- `dependency-*`, `baseline-*`, and `calendar-*`;
- `selection-*`, `focus-*`, `drag-*`, and `validation-*`;
- `capacity-*`, `critical-*`, and `variance-*`;
- `radius-*`, `shadow-*`, and `motion-*`.

`--gt-z-overlay` is the integration token for the instance-owned portal wrapper. It
defaults to `1000`; applications should map it to their established overlay scale
instead of escalating individual menu or dialog z-index values.

Tokens are classified as:

- **paint tokens**, which can update without layout;
- **metric tokens**, which invalidate the affected layout indexes;
- **motion tokens**, which are disabled or reduced under reduced-motion preferences.

This classification is published in a machine-readable theme manifest.

Themes may also be authored as plain typed data:

```ts
export interface GanttThemeDefinition {
  id: string;
  mode?: "light" | "dark" | "high-contrast";
  tokens: Partial<Record<GanttThemeToken, string | number>>;
}
```

The typed form is useful for autocomplete, canvas, deterministic export, tests, and
theme tooling. CSS remains the most direct browser integration surface.

## 7. Stable styling hooks

Internal class names and DOM nesting are private. Rendered public surfaces expose
stable attributes:

```html
<div
  data-gt-part="task"
  data-gt-kind="summary"
  data-gt-variant="risk"
  data-gt-state="selected focused"
  data-gt-density="compact"
></div>
```

The public attributes are:

- `data-gt-part` for component identity;
- `data-gt-kind` for domain presentation such as task, summary, or milestone;
- `data-gt-variant` for application-defined semantic variants;
- `data-gt-state` for space-separated interaction or validation states;
- `data-gt-density` for the effective density;
- `data-gt-orientation` where layout direction matters.

Part, kind, and state values are documented and versioned. Entity IDs and arbitrary
application fields are not emitted as styling attributes by default.

The M4 appendix publishes `task-track`, `task-progress`, and `progress-handle` for
ordinary task progress. `progress-handle` is the visible direct-edit marker and may
be styled through `classNames.progressHandle`; the larger transparent
coarse-pointer target is private structure. The task's `data-progressing="true"`
attribute and the typed `progressing` class-name state distinguish preview from
committed paint without relying on color.

## 8. React customization APIs

The React layer provides three levels of customization.

### 8.1 Root theme and density

```tsx
<Gantt
  className="brand-planner"
  theme={themeDefinition}
  themeRevision={colorMode}
  density="compact"
/>
```

`themeRevision` tells non-CSS renderers to refresh resolved tokens when host-managed
CSS variables change. DOM and SVG normally respond to CSS changes without a React
render.

### 8.2 Typed class hooks

```tsx
<Gantt
  classNames={{
    lane: "border-b border-slate-200 dark:border-slate-800",
    task: ({ selected, dragging }) =>
      selected
        ? "ring-2 ring-indigo-500"
        : dragging
          ? "opacity-70"
          : "hover:brightness-95",
  }}
/>
```

Class hook keys and callback contexts are public typed contracts. Consumers should use
complete class-name literals so build-time utility scanners can discover them.

Class hooks customize DOM/SVG and portalled UI. They do not define canvas or
server-export appearance.

### 8.3 Typed slots

```tsx
<Gantt
  slots={{
    TaskContent: BrandedTaskContent,
    Tooltip: BrandedTooltip,
    TaskEditor: BrandedTaskEditor,
  }}
/>
```

Slots cover:

- task, summary, milestone, and baseline content;
- dependency markers and handles;
- lane and time headers;
- grid cells and columns;
- buttons, icons, menus, and tooltips;
- editors, dialogs, and validation messages;
- empty, loading, and error states.

Slot props include required behavior, state, accessibility props, and event bindings.
Consumers should not need to reconstruct hit testing or keyboard behavior to replace
visual content.

## 9. Portable appearance rules

CSS and React slots are intentionally renderer-specific. Data-driven appearance that
must survive renderer changes uses a portable appearance resolver:

```ts
export interface GanttAppearance {
  task?(context: TaskAppearanceContext): PortableAppearance;
  dependency?(context: DependencyAppearanceContext): PortableAppearance;
  lane?(context: LaneAppearanceContext): PortableAppearance;
}

export interface PortableAppearance {
  variant?: string;
  tokens?: Partial<Record<PortableVisualToken, string | number>>;
}
```

Prefer semantic variants such as `risk`, `blocked`, or `external` over direct colors.
The theme maps variants to visual tokens. Direct token overrides remain available for
data visualization.

Customization support is explicit:

| Customization | DOM/SVG | Portals | Canvas | Visual export |
| --- | --- | --- | --- | --- |
| Semantic theme tokens | Yes | Yes | Yes | Yes |
| Portable appearance variants | Yes | Yes | Yes | Yes |
| `classNames` | Yes | Yes | No | No |
| React slots | Yes | Yes | No | No |
| Descendant CSS selectors | Yes | Yes | No | No |
| Renderer-specific layer | Yes | N/A | Yes | Exporter-specific |

This boundary prevents a false promise that arbitrary browser CSS can be reproduced by
a pixel renderer or a server process.

### 9.1 Canonical item variants

Tasks and lanes may persist one optional `GanttAppearanceReference` containing a
bounded semantic variant ID. Documents never persist colors, token maps, CSS classes,
theme objects, or renderer configuration. The instance-level
`appearanceVariants` registry supplies accessible labels and coordinated portable
tokens for:

- task fill;
- task progress fill;
- task text;
- task border;
- lane accent;
- lane surface.

Resolution applies theme/task-kind defaults, lane appearance, the legacy view-only
`taskVariants` fallback, persisted task appearance, then derived interaction and
system state. Persisted task appearance wins over the compatibility fallback. Unknown
valid IDs remain canonical and serialize unchanged; they use deterministic
kind/theme paint and one deduplicated warning per ID and registry revision.

The default lane treatment is a restrained accent or subtle surface, not a saturated
row fill. The same effective variant supplies task and progress paint, while focus,
selection, pending, invalid, critical, disabled, and forced-colors states retain
non-color indicators. Core defines no priority, status, or workflow meaning; examples
supply their own palette.

The exact data validity, precedence, registry, compatibility, progress, and properties
surface contracts are fixed by the
[item-properties, semantic-appearance, and progress decision](decisions/2026-07-31-item-properties-semantic-appearance-progress.md).

## 10. Tailwind integration

Tailwind support has three parts.

### 10.1 Token bridge

The optional bridge maps Gantempo semantic tokens to Tailwind theme variables:

```css
.gt-tailwind {
  --gt-font-family: var(--font-sans);
  --gt-color-surface: var(--color-white);
  --gt-color-surface-muted: var(--color-slate-50);
  --gt-color-text: var(--color-slate-900);
  --gt-color-border: var(--color-slate-200);
  --gt-color-accent: var(--color-indigo-600);
  --gt-color-focus-ring: var(--color-indigo-500);
  --gt-task-radius: var(--radius-md);
}
```

Applications can replace this mapping with their own semantic variables. The adapter
does not assume how the host selects dark mode.

### 10.2 Utilities in public React surfaces

Typed `classNames` and slots accept ordinary utility strings. Stable `data-gt-*`
attributes allow arbitrary and custom variants without depending on internal class
names.

The documentation will use complete static utility strings and include guidance for
classes authored outside the application's normal source scan.

### 10.3 Version independence

The core theme API depends on CSS custom properties, not a particular Tailwind major.
Version-specific setup belongs in adapter documentation and fixtures. An application
can remove Tailwind while keeping the same semantic Gantempo token contract.

The adapter should remain CSS-first. A JavaScript plugin or preset is added only if it
solves a demonstrated integration problem that static tokens and documented recipes
cannot solve.

## 11. Built-in themes and modes

The initial visual package includes:

- neutral light;
- neutral dark;
- high contrast;
- system light/dark selection using CSS media queries;
- compact, comfortable, and touch density presets.

Light/dark selection must not require reading browser globals during module evaluation
or cause server hydration differences. Themes set an appropriate `color-scheme` for
native controls.

Theme and density can be selected per instance. There is no global `setTheme` API.

## 12. Canvas and export parity

DOM and SVG consume CSS variables directly. Canvas and visual exporters consume a
cached `ResolvedGanttTheme`.

In the browser:

1. Resolve semantic custom properties once at the owning root.
2. Validate and normalize colors, lengths, typography, and motion values.
3. Cache the result by theme revision.
4. Repaint canvas primitives without recalculating layout for paint-only changes.
5. Invalidate layout only when metric tokens change.

The renderer must not call `getComputedStyle` for every task or frame.

Client-side export may use the resolved browser theme. Server export receives a
complete `GanttThemeDefinition` or a packaged named theme because it cannot resolve
host CSS variables. Unresolved variables produce diagnostics rather than silent
fallback colors.

## 13. Portals, SSR, and Content Security Policy

- Menus, tooltips, editors, and dialogs inherit the owning instance theme.
- The default portal target is the owning document body. Each instance appends and
  cleans up only its own fixed wrapper so ancestor overflow, containment, and stacking
  contexts do not clip interactive surfaces.
- `overlayContainer="root"` deliberately retains the chart-local boundary. A DOM
  element, document fragment, or SSR-safe callback selects an application overlay
  root or shadow root.
- External wrappers receive the owning root's resolved `--gt-*` values, typography,
  `data-gantempo`, `data-gt-part="overlay-host"`, boundary, and owner attributes.
- Menus and tooltips use viewport coordinates in external wrappers and are measured
  into an eight-pixel safe area. Root mode uses chart-local coordinates.
- A document-body editor covers and isolates the document viewport. Custom targets
  retain focus trapping and focus return without guessing which application
  ancestors may be made inert.
- A portal cannot cross an iframe document boundary; a parent-page surface requires
  explicit host integration.
- CSS media queries provide system theme selection without hydration-dependent
  JavaScript.
- Computed-style resolution begins only after mounting.
- Static CSS themes require no runtime `<style>` injection.
- Inline style convenience APIs are optional; every supported theme can be expressed
  through a class and stylesheet for strict Content Security Policy environments.

## 14. Accessibility requirements

Built-in themes must preserve:

- visible keyboard focus;
- sufficient text, control, grid, and dependency contrast;
- distinguishable selected, focused, invalid, and disabled states;
- forced-colors behavior;
- reduced-motion behavior;
- usable touch and resize targets at each density;
- state communication that does not depend on color alone.

Development diagnostics should detect missing required tokens, invalid values, and
obvious contrast or transparent-focus failures. Custom themes remain the consumer's
responsibility, but the library provides a theme test fixture covering all important
states.

## 15. Performance rules

- Paint-token changes do not rebuild document, schedule, or layout state.
- Metric-token changes invalidate only affected measurements and viewport indexes.
- Theme switching does not re-render every React task solely to change color.
- Resolved canvas themes are cached by instance and revision.
- Slot and class callbacks run only for affected visible primitives.
- No theme path performs work proportional to the full document during scrolling.

## 16. Versioning

The following are public and follow semantic versioning:

- semantic token names and meanings;
- public part, kind, variant, state, density, and orientation values;
- typed `classNames`, slot props, and appearance contexts;
- stylesheet subpath exports;
- the machine-readable theme manifest.

Internal class names and DOM nesting are not public.

New tokens may be added in minor releases with defaults. Renaming or removing a token
requires a deprecation period and migration entry. Development builds warn when a
deprecated token or part is used where detection is possible.

## 17. Verification

Automated fixtures cover:

- built-in light, dark, and high-contrast themes;
- compact, comfortable, and touch density;
- host CSS-variable overrides;
- the Tailwind token bridge and utility-based slots;
- two differently themed instances on one page;
- menus, tooltips, editors, and dialogs in portals;
- every task, dependency, validation, drag, focus, and capacity state;
- DOM/SVG and canvas semantic parity;
- client and server visual export;
- SSR and hydration;
- forced colors and reduced motion;
- strict Content Security Policy without runtime style injection.

## 18. Acceptance criteria

The first stable theming contract is complete when:

- a brand theme can be implemented using documented tokens only;
- a Tailwind application can adopt the token bridge without a Gantempo-specific build
  step;
- a non-Tailwind application receives the same customization surface;
- Tailwind is not a runtime, peer, or transitive dependency;
- consumers can use utilities in typed class hooks and React slots;
- no supported customization requires undocumented selectors or `!important`;
- two theme instances and their portals remain isolated;
- semantic task variants look equivalent in DOM/SVG, canvas, and export;
- paint-only theme switching avoids layout recalculation;
- custom themes can be tested against a published state and accessibility fixture.

## 19. Deferred decisions

- Final token names and the initial manifest contents.
- Whether the Tailwind bridge is a core subpath or a small adapter package.
- Whether a visual theme builder ships before or after the first stable release.
- The support window for version-specific Tailwind setup fixtures.
