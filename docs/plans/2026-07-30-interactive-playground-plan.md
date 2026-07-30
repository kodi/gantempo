# Interactive Playground Plan

Status: Complete
Last updated: 2026-07-30

## Summary

Add an `/interactive` playground route with the same full-size chart surface as the
main page and an external toolbar that can add and remove scheduled items dynamically.
The page should prove that an application can compose the completed M2 command/history
kernel with the completed M3 read-only React renderer without defining M4 interaction
runtime contracts prematurely.

## Decisions

- Treat this as a playground-only controlled-consumer proof, not the start of M4.
- Keep four stable document lanes in the initial canvas and begin with no task bars.
- Route every add, remove, clear, undo, and redo action through the public command or
  history APIs; do not mutate document arrays directly.
- Add controls for one item, a five-item transaction, removing the latest item,
  clearing all items as one transaction, undo, and redo.
- Keep pointer editing, chart-owned selection/focus, keyboard commands, scrolling,
  zooming, hit testing, imperative handles, and uncontrolled state out of scope.

## Scope

In scope:

- `/interactive` navigation and page routing;
- a responsive full-size empty chart canvas;
- deterministic generated tasks and placements across the existing lanes;
- command status, task count, and bounded undo/redo state;
- focused static checks, production build, and browser interaction/accessibility
  verification.

Out of scope:

- any change to the public `Gantt` props or command contracts;
- direct manipulation inside the chart;
- persistence, server revisions, or collaboration;
- M4 architecture or decision records.

## Current State

M1–M3 are complete. The package publicly exposes an immutable `document` prop,
commands, transactions, cascade task deletion, and bounded local history. The
renderer recomputes its semantic scene when the document identity changes, but it
remains intentionally read-only and owns no interaction/session state.

## Slices

### Slice 1: Controlled interactive playground

Status: `[x]` Done

Goal: Add the route, page, controls, controlled history state, and responsive styling.

Dependencies: Completed M2 change kernel and M3 React renderer.

Verification:

- `vp check` passed all 82 formatted files and 71 lint/type-checked files.
- `vp test run` passed 29 test files and 125 tests.
- `vp build apps/playground` transformed 46 modules and emitted the production
  playground bundle.

Completed in this slice:

- Added `/interactive` routing and current-page navigation state.
- Added a four-lane, initially empty full-size chart surface.
- Added deterministic add-one and add-five task/placement transactions, cascade
  removal, transactional clear, and bounded undo/redo through public root imports.
- Added task and lane counts, command feedback in a polite live region, correct
  disabled states, focus-visible treatment, task tones, and responsive controls.

### Slice 2: Browser evidence and documentation closeout

Status: `[x]` Done

Goal: Verify the live route across desktop and mobile sizes, exercise every control,
record accessibility/console findings, and synchronize completion evidence.

Dependencies: Slice 1.

Verification:

- Chrome DevTools inspected `/interactive` with viewport emulation at 1440 × 900 and
  560 × 900.
- The initial desktop state showed four empty lanes, zero tasks, zero diagnostics,
  disabled remove/clear/undo/redo controls, and no horizontal overflow.
- Add one produced one accessible bar. Add five committed one transaction and produced
  six total bars. Remove latest reduced the chart to five. Undo restored six, redo
  returned to five, clear removed all five as one step, and undo restored all five.
- At both viewports, chart and controls stayed within the page. The 560-pixel layout
  wrapped controls into two columns, retained the navigation and counts, aligned the
  296-pixel lane list and timeline, and reported zero chart diagnostics.
- The accessibility tree exposed the current navigation link, named controls,
  disabled states, polite atomic status, chart region, lane text, scheduled-task
  group, and date-bearing accessible names for every task bar.
- All 47 application and extension network requests succeeded. Console output had no
  application-authored error; remaining warnings/issues and WebMCP messages came from
  the browser/extension environment, alongside the expected Vite development logs.
- Final `mise run ci` passed all check, test, and four-artifact package build tasks.

## Files to Add

- `apps/playground/src/pages/InteractivePage.tsx`

## Files to Change

- `apps/playground/src/Playground.tsx`
- `apps/playground/src/styles.css`
- `docs/ROADMAP.md`
- this plan

## Working Notes

- The proof deliberately leaves the initial lanes present so the full grid remains a
  useful empty canvas before task bars are added.
- No architecture-level decision is required unless implementation evidence forces a
  public runtime, renderer, or command-contract change.
- Implementation stayed entirely within the playground and consumed the existing
  package facade; no package API, renderer contract, architecture boundary, or M4
  milestone status changed.

## Final Verification

- `vp check` passed 82 formatted files and 71 lint/type-checked files.
- `vp test run` passed 29 test files and 125 tests.
- `vp build apps/playground` transformed 46 modules.
- Chrome DevTools passed the interaction, layout, accessibility-tree, console, and
  network checks above.
- Final `mise run ci` passed 82 formatted files, 71 lint/type-checked files, 29 test
  files, 125 tests, and the four package artifacts.

## Next Slice

Create the required M4 interaction-runtime/public-API plan before adding chart-owned
pointer, touch, keyboard, selection, focus, scrolling, zooming, or imperative state.
