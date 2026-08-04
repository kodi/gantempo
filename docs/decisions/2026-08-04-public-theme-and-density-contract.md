# Public Theme And Density Contract

Status: Accepted
Date: 2026-08-04

## Context

The package renderer already consumes scoped `--gt-*` semantic properties, but its
public React API exposes only generic root and part class hooks. Consequently, the
playground selects light, dark, high-contrast, and compact presentation outside the
component and teaches those built-in choices as arbitrary consumer classes. CSS row
height overrides also do not enter the scene pipeline, so visual metrics can disagree
with SVG geometry, navigation, scrolling, and hit testing.

The architecture already requires per-instance built-in themes, typed portable theme
data, independent density, renderer parity, and themed portals. The missing decision
is the concrete initial public contract and precedence.

## Decision

`Gantt` accepts `theme`, `density`, and `themeRevision` view props. `theme` is either
`'light'`, `'dark'`, `'high-contrast'`, or a `GanttThemeDefinition`; `density` is
`'compact'`, `'comfortable'`, or `'touch'`. Defaults are light and comfortable. No
theme value is persisted in `GanttDocument`, and there is no global setter.

A custom definition has a stable non-empty `id`, an optional built-in `mode` fallback
that defaults to light, and a partial semantic token record. The initial public token
IDs are:

- `font.family`;
- `color.surface`, `color.surfaceMuted`, `color.border`, and `color.grid`;
- `color.text`, `color.textMuted`, `color.accent`, `color.onAccent`, `color.focus`, and
  `color.empty`;
- `task.fill`, `task.text`, `task.border`, and `task.progressFill`;
- `variant.neutral`, `variant.success`, `variant.warning`, and `variant.mutedText`;
- `overlay.zIndex`.

Token IDs are independent of browser CSS property names. Values are non-empty strings
or finite numbers. Invalid definitions fail at the component boundary. Additive token
IDs may be introduced later without changing the selection model.

Built-in themes are immutable exported definitions, but string selection uses static
packaged CSS under `data-gt-theme-mode`; it does not inject a runtime stylesheet.
Custom object tokens are applied as root custom properties above their built-in mode
fallback. Ordinary consumer CSS applied through `className` can override packaged
built-ins; explicit custom-object tokens take precedence at the root; per-item
portable appearance and interaction/system states retain their existing descendant
and state precedence.

The root publishes `data-gt-theme`, `data-gt-theme-mode`, and `data-gt-density`.
External overlay hosts publish the same attributes and copy all resolved `--gt-*`
values. They resynchronize when theme, density, root class, or `themeRevision`
changes. `themeRevision` is an explicit host signal for CSS-variable changes that do
not otherwise change React props.

Density resolves renderer layout metrics before scene construction. The root then
publishes the exact resolved header and default-row metrics back to CSS. A density
switch therefore rebuilds affected layout/viewport structures, while a paint-only
theme switch does not rebuild document, schedule, or scene geometry.

`className` remains the CSS/design-system and strict-CSP seam. `classNames` remains
the typed DOM/SVG part/state seam. Neither is the built-in theme selector. Applications
that disallow inline custom properties author a CSS class using documented `--gt-*`
variables and select the appropriate built-in mode with `theme`.

## Consequences

- built-in light, dark, high-contrast, compact, comfortable, and touch choices are
  discoverable and type checked;
- custom theme data can later feed canvas and export without parsing arbitrary DOM
  selectors;
- different instances and their portals remain isolated;
- density can no longer be a CSS-only geometry illusion;
- custom object themes use inline custom properties, while stylesheet-only consumers
  retain the class-based token path;
- system preference selection, theme subpath splitting, canvas/export resolution, and
  a theme builder remain later work.

## Links

- [Architecture](../ARCHITECTURE.md#104-theming-and-design-systems)
- [UI and theming strategy](../UI_THEMING.md)
- [Implementation plan](../plans/2026-08-04-public-theme-and-density-plan.md)
- [Roadmap](../ROADMAP.md)
