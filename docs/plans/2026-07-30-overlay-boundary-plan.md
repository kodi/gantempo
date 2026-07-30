# Overlay Boundary Plan

Status: Complete and verified
Date: 2026-07-30
Milestone: Post-M4 interaction hardening

## Summary

Move built-in tooltips, context menus, and the task editor out of accidental chart
clipping and stacking contexts. The default React behavior will use one
instance-owned viewport overlay host under the chart document body. Consumers can
instead supply an explicit container, including a shadow root, or select the existing
chart-local boundary.

This plan exists because live `/interactive` evidence showed that the portal was only
logical: its host remained inside `.gt-gantt`, so the playground card's
`overflow: hidden` clipped 74 pixels from the context menu and constrained the modal
backdrop to the 1,308 × 272 pixel chart root.

## Decisions

- Accept the
  [overlay boundary contract](../decisions/2026-07-30-overlay-boundary-contract.md).
- Add a public `overlayContainer` prop. Omission means the owning document body;
  `"root"` preserves chart-local behavior; a DOM element, document fragment, or
  SSR-safe callback selects an application-owned overlay boundary.
- Every non-root target receives one instance-owned wrapper. It is cleaned up on
  target change and unmount and carries resolved Gantt theme variables and root
  attributes without moving the chart DOM.
- Viewport overlays use a fixed full-viewport host and configurable
  `--gt-z-overlay`. Context menus and tooltips use viewport coordinates and are
  measured back inside their available boundary.
- A page-modal editor uses the viewport backdrop, scroll locking, focus containment,
  Escape/click-away close, and focus return. The default document-body path makes
  other body content inert while the editor is open and restores prior state on
  close.
- An iframe remains a hard browser boundary. The package covers only its owning
  document; a parent-page modal requires explicit host integration.

## Scope

In scope:

- public overlay target types and `GanttProps`;
- instance-owned host lifecycle, theme propagation, and positioning;
- context-menu/tooltip collision handling;
- full-viewport editor behavior and modal background isolation;
- focused DOM/type/SSR tests and `/interactive` browser verification;
- architecture, theming, README, roadmap, decision, and plan synchronization.

Out of scope:

- cross-origin iframe escape or parent-window messaging;
- replacing the editor slot with a complete dialog framework;
- a general application overlay manager;
- changing command, document, session, or persistence ownership.

## Behavior To Preserve

- Each Gantt instance owns only its own tooltip, menu, editor, focus return, and live
  interaction state.
- Custom surface slots receive the same required bindings.
- SSR imports and pre-interaction markup do not access browser globals.
- Root-scoped semantic themes remain isolated across multiple instances.
- The explicit root mode retains the existing self-contained chart behavior.

## Files To Change

- `packages/gantt/src/react/types.ts`
- `packages/gantt/src/react/Gantt.tsx`
- `packages/gantt/src/styles.css`
- focused React DOM, SSR, and public-facade tests
- `apps/playground/src/pages/InteractivePage.tsx` if an explicit integration example
  improves discoverability
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_THEMING.md`
- `docs/ROADMAP.md`
- this plan and the overlay decision record

## Slices

### Slice 1: Contract and synchronized plan

Status: `[x]` Done

- record the overlay target, default, lifecycle, positioning, theming, accessibility,
  and embed boundaries;
- link the decision from architecture, roadmap, and this active plan;
- record the live clipping deviation and exact baseline geometry.

Verification:

- `git diff --check`
- focused cross-document link and contract read

Dependencies: none.

### Slice 2: Runtime, styles, and focused tests

Status: `[x]` Done

- implement the public target type and host lifecycle;
- propagate resolved theme variables to external hosts;
- switch menu/tooltip coordinates and collision handling by overlay boundary;
- make the document-level editor viewport-modal and restore background state;
- update focused DOM, type, SSR, and ownership tests.

Verification:

- focused Gantt customization/SSR/public-facade test files
- repository type checking and formatting

Dependencies: Slice 1.

### Slice 3: Consumer docs and live browser gate

Status: `[x]` Done

- document default, root, custom element, shadow-root, and iframe behavior;
- verify `/interactive` at desktop and narrow viewports;
- inspect menu/editor geometry, focus behavior, accessibility tree, console, and
  network state;
- record exact final evidence in this plan and the roadmap.

Verification:

- full repository CI
- production playground build
- Chrome DevTools geometry/accessibility/console/network inspection
- `git diff --check`

Dependencies: Slice 2.

## Testing Plan

- Prove default overlays live outside the chart region and two instances remain
  isolated.
- Prove `overlayContainer="root"` retains the local host.
- Prove a supplied element/callback receives and cleans up one wrapper.
- Prove viewport coordinates are not chart-offset coordinates and menu collision
  adjustment stays inside the viewport.
- Prove editor focus, Escape, click-away, pending behavior, focus return, scroll lock,
  and background restoration.
- Prove SSR and public declaration behavior remain deterministic and browser-safe.

## Working Notes

### 2026-07-30 baseline deviation

- Chrome DevTools inspected `http://localhost:5173/interactive` at 1,440 × 900.
- `.chart-frame--interactive` had `overflow: hidden` and ended at viewport y=720.
- The context menu occupied x=687..877 and y=642..794, leaving 74 pixels clipped.
- The root, internal overlay host, and editor backdrop all occupied x=58.6..1,366.4
  and y=447..719; the modal therefore covered only the chart's 1,308 × 272 pixels.
- Raising the internal z-index cannot cross the ancestor overflow clip.

### 2026-07-30 Slice 1 completion

- Accepted and cross-linked the overlay decision, architecture target, active plan,
  and roadmap focus/change logs.
- `git diff --check`, linked-file existence checks, and the focused cross-document
  overlay-contract search passed.
- No runtime behavior changed in Slice 1.

### 2026-07-30 Slice 2 completion

- Added and exported `GanttOverlayContainer`; omission or `"document"` resolves the
  owning root's body after mount, `"root"` retains chart-local behavior, and a DOM
  element, document fragment, or callback selects a custom target.
- Added one cleaned-up external wrapper per instance with viewport positioning,
  owner/boundary attributes, resolved `--gt-*` token and typography propagation, and
  configurable `--gt-z-overlay`.
- Converted menu and tooltip coordinates to the selected boundary, measured each
  surface once into an eight-pixel safe area, and closed transient surfaces when
  scroll or resize invalidates their coordinates.
- Made document-body editors lock scrolling, compensate for the removed scrollbar,
  make existing and dynamically added body siblings inert/ARIA-hidden, restore prior
  state exactly, keep focus trapped, and return focus on close.
- The dynamic-child observer is a live-gate hardening deviation within the accepted
  modal-isolation scope: an extension inserted a body child after the modal opened,
  demonstrating the same condition application portals can create.
- Focused customization, SSR, and public-facade coverage passed 3 files and 19 tests.
  It covers default document portals, explicit root mode, custom-target cleanup,
  two-instance isolation, viewport collision correction, modal scroll/background
  restoration, and a body child added after open.
- `pnpm check` passed formatting and zero lint/type warnings across 132 formatted and
  121 checked files.

### 2026-07-30 Slice 3 completion

- Documented default, root, custom element/callback, shadow-root, z-index-token, SSR,
  and iframe behavior in `README.md` and `docs/UI_THEMING.md`.
- `mise run ci` passed package build, formatting/lint/types, 51 test files, and all
  248 tests.
- `pnpm build:playground` transformed 141 modules and emitted a 402.87 kB JavaScript
  bundle (114.87 kB gzip) plus the stylesheet and HTML.
- Packed output contains the intentional `GanttOverlayContainer` export and
  `overlayContainer` prop; package output is 303.71 kB JavaScript, 11.50 kB CSS, and
  40.07 kB declarations before compression.
- Chrome DevTools verified `http://localhost:5173/interactive` at 1,440 × 900 and
  560 × 900:
  - the document overlay host was fixed at the viewport with z-index 1000 and retained
    the owning `#fbfcfa` surface and `#26352f` text tokens;
  - the original menu still extended 74 pixels below the clipped chart frame but was
    fully visible because it belonged to the body host;
  - an intentionally extreme pointer coordinate adjusted the 190 × 152 menu to
    x=1,227..1,417 and y=740..892, exactly inside the fixed host's desktop
    eight-pixel safe area without covering its scrollbar gutter;
  - at 560 pixels, the menu occupied x=362..552 and remained inside the same safe area
    with zero page-level horizontal overflow;
  - the editor backdrop measured the complete 1,440 × 900 and 560 × 900 viewports,
    with the 430-pixel dialog centered and no page overflow;
  - the accessibility snapshot exposed only one labelled modal dialog while open;
    body scrolling/inert/ARIA state and task focus restored on close;
  - a body child inserted after open became inert and ARIA-hidden, then restored;
  - all 67 observed local/extension requests returned 200, 304, or successful
    extension responses. No application console error or warning appeared;
    MaxListeners and ObjectMultiplex extension/DevTools warnings were environment
    noise already recorded by prior gates.
- `git diff --check` and packed declaration inspection passed.

## Next Slice

Resume Appendix Slice A1 of the item-properties, semantic-color, and progress plan.
