# Decision: Overlay Boundary Contract

Status: Accepted
Date: 2026-07-30
Owners: Post-M4 interaction hardening

## Context

M4 introduced React-portalled tooltips, context menus, and a modal task editor, but
the portal target was always a div inside `.gt-gantt`. That arrangement preserved
theme inheritance and instance isolation while failing the primary reason overlays
need a portal: an ancestor with `overflow`, containment, or a competing stacking
context still clips or confines them.

The controlled playground exposes the failure with an ordinary rounded card using
`overflow: hidden`. A context menu is cut off and the editor's `aria-modal` backdrop
covers only the chart instead of the owning document viewport.

## Decision

### Expose one overlay-container contract

The React component adds:

```ts
type GanttOverlayContainer =
  | "document"
  | "root"
  | Element
  | DocumentFragment
  | (() => Element | DocumentFragment | null);

interface GanttProps {
  readonly overlayContainer?: GanttOverlayContainer;
}
```

Omission is equivalent to `"document"`. After mount, the component resolves the body
from the Gantt root's `ownerDocument`; it never assumes the ambient global document
during import or server rendering.

`"root"` retains the existing chart-local host for applications that intentionally
want a self-contained surface. An element, document fragment, or callback lets an
application integrate Gantempo with its overlay root or shadow DOM. A callback is the
recommended form when the target is unavailable during server rendering.

### Own a wrapper, not the consumer's container

For every non-root target, one Gantt instance appends its own overlay wrapper and
removes only that wrapper on target change or unmount. The package never changes the
target's layout, z-index, classes, or lifecycle.

The wrapper carries documented Gantt overlay attributes and a fixed viewport layer.
It receives the owning root's resolved `--gt-*` custom properties and typography so
multiple differently themed instances can share one document-level target.
`--gt-z-overlay` is configurable by the host application.

### Position surfaces in their containing coordinate space

Document and custom-container overlays use viewport coordinates derived from pointer
or task client rectangles. Root overlays continue to subtract the chart root origin.
After rendering, menu and tooltip bounds are measured and shifted within an
eight-pixel safe area. Open transient surfaces close when their coordinate space
changes through viewport scrolling or resizing.

The modal backdrop fills its overlay wrapper. A document-level wrapper therefore
covers the viewport while root mode remains chart-local.

### Make page-modal semantics match behavior

While a document-body editor is open:

- focus stays inside the dialog and returns to the invoking task on close;
- Escape and backdrop activation close it when no command is pending;
- document scrolling is locked and restored;
- other body children become inert and hidden from the accessibility tree, with
  their previous state restored exactly on close.

Custom targets and root mode retain focus trapping and return, but the package does
not mutate arbitrary ancestors to guess an application's modal boundary.

### Respect browser embedding boundaries

A body portal covers the viewport of the Gantt root's owning document. It cannot
escape an iframe. Cross-document parent overlays require an explicit application
integration and, for cross-origin frames, message passing controlled by the host.

## Consequences

- Rounded cards and scrolling chart containers no longer clip default menus,
  tooltips, or editors.
- Default modal behavior now matches `aria-modal` within the owning document.
- Existing consumers that relied on chart-confined surfaces can select
  `overlayContainer="root"`.
- Consumers remain responsible for choosing a compatible application overlay root
  when their z-index system or shadow DOM requires one.
- The package must maintain host cleanup, theme propagation, collision tests,
  multi-instance isolation, and SSR safety as public behavior.

## Links

- [Architecture](../ARCHITECTURE.md)
- [UI and theming](../UI_THEMING.md)
- [Roadmap](../ROADMAP.md)
- [Implementation plan](../plans/2026-07-30-overlay-boundary-plan.md)
