# Interactive Custom Integration Plan

Status: Complete
Date: 2026-07-31
Milestone: Post-M4 consumer integration proof

## Summary

Add a second controlled playground consumer at `/interactive-custom`, labeled
`Interactive Custom` in the playground navigation. It should clone the useful
timeline, toolbar, command/history, and controlled-document behavior from
`/interactive`, but demonstrate an application-owned details and editing experience:

- activating a task opens a read-only task details panel below the timeline;
- choosing `Edit properties` from the timeline context menu opens that same panel in
  edit mode;
- the panel is rendered and styled by the playground application, outside Gantt's
  overlay tree;
- saves dispatch typed Gantt commands and continue through the existing controlled
  acknowledgement, history, and document-change path;
- the page has no persistence/API debug log.

The current facade supports application-owned read mode through `onTaskActivate`, but
does not expose the built-in `Edit properties` request. That menu action calls the
private overlay opener directly. The implementation request accepts the narrow public
interaction seam below, so work proceeds in ordered, independently verified slices.

## Target State

At completion:

- the existing `/interactive` route remains unchanged;
- `/interactive-custom` appears as a separate `Interactive Custom` navigation item;
- its chart retains the existing controlled document, deterministic add/remove
  controls, Undo/Redo, task manipulation, appearance, progress, navigation, tooltip,
  and command behavior;
- it does not render `ExampleApiLog`, a persistence-boundary section, raw JSON, or
  API-write state;
- a normal task activation selects the occurrence and opens the application-owned
  panel in display mode;
- the built-in context menu still contains one accessible `Edit properties` action,
  but selecting it closes the menu and asks the application to open edit mode instead
  of opening Gantt's modal properties surface;
- display and edit mode resolve the canonical task by `taskId`, so the panel stays
  current after controlled document acknowledgement and closes safely if the task is
  deleted;
- edit mode covers the same bounded ordinary-task fields demonstrated by the standard
  properties surface: title, description, instant start/end, progress, semantic
  appearance, and one unambiguous persisted lane placement;
- Save emits one `task.update` or one task/placement transaction through
  `GanttHandle.dispatch`; Cancel returns to display mode without mutation;
- no package-owned `dialog` or `ItemProperties` overlay appears on this page;
- pointer and keyboard users can reach both the task activation and context-menu edit
  paths, with visible focus and a named panel/mode.

## Decisions

- Add a new route at `/interactive-custom`; do not rename or replace
  `/interactive`. The URL is inferred from “another playground tab” because
  `/interactive` is already occupied.
- Use the nav label and page heading `Interactive Custom`.
- Keep Gantt responsible for timeline rendering, selection/focus, gestures, context
  menu presentation, commands, history, and controlled acknowledgement.
- Keep details-panel visibility, display/edit mode, form state, validation
  presentation, and panel layout in the playground application.
- Reuse `onTaskActivate` for the display-mode request. A drag/resize/progress gesture
  must not accidentally open the panel; the existing activation suppression remains
  authoritative.
- Add the smallest public edit-request seam needed by the built-in task context menu.
  Do not make the properties overlay externally controlled and do not expose private
  editor state.
- Keep the custom proof task-only. Lane property triggers and application-owned lane
  panels are out of scope unless review explicitly broadens the contract.
- Keep mutations on the existing typed command bus. The custom form must not mutate
  document arrays or records directly.
- Do not reuse `GanttSlots.ItemProperties` for the external panel. That slot replaces
  presentation inside Gantt's package-owned overlay lifecycle and therefore does not
  prove site-owned interaction chrome.

## Confirmed Capability Gap

Observed in the current checkout:

- `GanttProps.onTaskActivate` publishes the activated `GanttTaskTarget`, which is
  sufficient for opening a site-owned display panel.
- `features.properties` makes task activation call Gantt's private `openEditor`, so
  it cannot be enabled on this page without also opening the built-in overlay.
- the built-in context menu always routes its `edit` action directly to the same
  private `openEditor`;
- `contextMenuItems` can append command-backed entries but cannot replace built-in
  entries or publish an application callback;
- `GanttSlots.ItemProperties` receives immutable form values and bounded mutation
  callbacks, but still renders inside Gantt's modal overlay and focus lifecycle.

Therefore the requested split—activation opens external read mode while the built-in
`Edit properties` action opens external edit mode—cannot be implemented faithfully
with the current public API.

## Accepted Public Contract

Slice 1 fixes the additive shape as:

```ts
export interface GanttTaskEditRequest {
  readonly source: "context-menu";
  readonly target: GanttTaskTarget;
}

export interface GanttProps {
  readonly onTaskEditRequest?: (request: GanttTaskEditRequest) => void;
}
```

When `onTaskEditRequest` is present:

- the built-in task menu treats edit as available without requiring
  `features.editor` or `features.properties`;
- its label is `Edit properties`;
- selecting it closes the menu without restoring chart focus, then invokes the
  callback exactly once so the application can focus its own surface;
- it does not open `TaskEditor` or `ItemProperties`;
- ordinary task activation remains independent and continues to publish
  `onTaskActivate`;
- a controlled chart without `onDocumentChange` keeps the action disabled and does
  not invoke the callback;
- existing consumers without the callback retain source compatibility and existing
  runtime behavior.

The callback is a request, not a mutation hook. The application still reads its
authoritative controlled document and dispatches typed commands when the user saves.

## Scope

In scope:

- additive public task edit-request type and prop;
- built-in task context-menu routing for that callback;
- package facade, declaration, DOM, keyboard, focus, and compatibility tests;
- `/interactive-custom` route, navigation, page, application-owned details panel,
  custom form reducer/state, and responsive styling;
- controlled task and unambiguous placement edits through existing commands;
- focused playground DOM/accessibility tests;
- roadmap, architecture, decision-record, plan, package, build, and live-browser
  evidence required by the accepted public contract.

Out of scope:

- replacing or removing the default `ItemProperties` surface;
- externally controlling Gantt's internal tooltip/menu/editor state;
- application-owned lane properties;
- a public form schema or generic details-panel framework;
- new document fields or commands;
- persistence logging, API simulation, server revisions, collaboration, or retry UI;
- task kind conversion, milestones, summaries, ambiguous/derived placement movement,
  assignments, resources, dependencies, calendars, or advanced scheduling fields;
- changing `/interactive` behavior or its existing API-debug proof.

## Behavior to Preserve

- Existing `features.properties`, `features.editor`, `ItemProperties`, `TaskEditor`,
  activation, context-menu, focus-return, Escape, overlay, command, history, and
  acknowledgement behavior remains unchanged when the new callback is absent.
- Task selection and `onTaskActivate` fire through the established semantic event
  path.
- Pointer movement suppresses activation after drag, resize, and progress gestures.
- Controlled documents remain authoritative; the external panel follows acknowledged
  records rather than retaining a mutable copy as truth.
- Context-menu edit remains keyboard reachable through the existing Context Menu and
  Shift+F10 paths.
- The custom page uses only package-root exports.

## Implementation Shape

### Package seam

Route the built-in `edit` menu action through a small request helper:

1. resolve the active task target;
2. close the menu using the existing focus policy;
3. when `onTaskEditRequest` exists, publish the frozen request and stop;
4. otherwise call the existing private editor opener.

The callback should not be added to the command bus, because opening application UI
does not change the document and must not produce patches, history, persistence
events, or command lifecycle events.

### Playground state

Create a page-local details state with:

```ts
type CustomDetailsState =
  | { readonly status: "closed" }
  | {
      readonly mode: "display" | "edit";
      readonly taskId: string;
      readonly target: GanttTaskTarget;
    };
```

Resolve the current task and placement from the acknowledged `state.document` on
every render. Keep temporary form values only while `mode === "edit"`. Reinitialize
them when a different task enters edit mode, retain them while an acknowledgement is
pending, and discard them on Cancel or when the canonical task disappears.

### Save path

Build the same bounded commands as the standard properties intersection:

- omit unchanged task fields;
- send one `task.update` for changed task fields;
- add `placement.move` only for a changed, unambiguous persisted placement;
- wrap both in one transaction when both are needed;
- treat an unchanged form as Cancel/return-to-display, not a history entry;
- let existing command diagnostics and `onCommandRejected` drive the panel error and
  status;
- after controlled acknowledgement, return the panel to display mode with the
  canonical saved values.

The page may share pure playground-only value/validation helpers with a focused test,
but must not import private package editor helpers.

### Layout

Render the panel immediately after the chart frame and before the explanatory note.
Desktop may use a two-column definition/form card. Narrow widths stack labels and
controls without horizontal overflow. Display mode uses semantic text, `dl`, and
progress/date formatting; edit mode uses a named `form`, explicit labels, inline
validation, Save, and Cancel.

## Cross-Slice Rules

- Do not implement the page before Slice 2 publishes and verifies the accepted
  package contract.
- Do not use a portal, hidden package dialog, synthetic Escape event, no-op command,
  or DOM query as a workaround for the missing edit-request seam.
- Do not duplicate the persistence/API log on `/interactive-custom`.
- Preserve all unrelated dirty-worktree changes and stage/commit only explicit slice
  files if implementation is later requested.
- Update this plan and `docs/ROADMAP.md` whenever status, scope, evidence, or the
  actionable next slice changes.
- If review broadens the callback from task-only to task/lane, update the architecture
  and accepted item-properties decision before package implementation.

## Slices

### Slice 1: Accept the external edit-request contract

Status: `[x]` Done

Goal: Review and fix the smallest durable public contract that lets the built-in task
menu hand edit intent to an application-owned surface.

Why here: The requested page cannot be implemented faithfully until the package
boundary is accepted.

This slice should implement:

- confirm `/interactive-custom` as the route;
- confirm callback naming, task-only scope, disabled behavior, and focus semantics;
- update
  `docs/decisions/2026-07-31-item-properties-semantic-appearance-progress.md`;
- update the properties/public-API sections in `docs/ARCHITECTURE.md`;
- update this plan and `docs/ROADMAP.md` with the accepted contract;
- add no runtime or playground code.

Expected output: One reviewed documentation-only contract with no unresolved behavior
needed by Slice 2.

Verification:

- `git diff --check`;
- verify all new Markdown links resolve;
- focused terminology search for the chosen type/prop and route;
- `mise run ci` only if the implementation session adopts the repository convention
  of a full gate after every slice.

Dependencies: Satisfied by the implementation request accepting this proposed plan.

### Slice 2: Publish and verify the package request seam

Status: `[x]` Done

Goal: Add the accepted callback without changing default editor behavior.

Why here: The consumer page should be built against a tested package-root contract,
not an application workaround.

This slice should implement:

- add and export the accepted request type and `GanttProps` callback;
- route built-in context-menu edit selection to the callback when present;
- preserve the existing editor fallback when absent;
- cover pointer-opened and keyboard-opened context menus, exact-once delivery, menu
  close/focus behavior, read-only behavior, and two-instance isolation;
- extend consumer/facade and packed-declaration assertions.

Expected output: A package-root edit-request contract usable by any React consumer.

Verification:

- focused React DOM and public-facade tests;
- `vp pack` at repository root and declaration inspection;
- `mise run ci`;
- `git diff --check`.

Dependencies: Slice 1.

### Slice 3: Add the Interactive Custom consumer

Status: `[x]` Done

Goal: Add the new route and prove site-owned read/edit UI over the Gantt timeline.

Why here: The page can now consume the accepted package seam without private access.

This slice should implement:

- add `InteractiveCustomPage.tsx` and focused playground DOM tests;
- add `/interactive-custom` routing and the `Interactive Custom` nav item;
- clone the controlled timeline/toolbar behavior without API-log imports or state;
- connect `onTaskActivate` to display mode;
- connect the accepted edit-request callback to edit mode;
- implement canonical task/placement resolution, form validation, typed Save,
  Cancel, acknowledgement, rejection, deletion, and stale-target behavior;
- add responsive, accessible panel styling and concise page copy.

Expected output: A self-contained custom-integration example with no Gantt-owned
properties dialog.

Verification:

- focused playground DOM/accessibility tests proving display mode, edit mode, Save,
  Cancel, no package dialog, no API log, and keyboard menu reachability;
- `mise run build-playground`;
- `mise run ci`;
- `git diff --check`.

Dependencies: Slice 2.

### Slice 4: Live browser gate and documentation closeout

Status: `[x]` Done

Goal: Verify the actual integration at desktop and narrow widths and record exact
evidence.

Why here: Rendered focus, menu-to-panel handoff, form layout, and responsive overflow
cannot be closed by component state alone.

This slice should implement:

- inspect `/interactive-custom` at 1440 x 900 and 560 x 900 with Chrome DevTools MCP;
- activate a task and confirm a named read-only panel with no dialog;
- open the task menu by pointer and keyboard, choose `Edit properties`, and confirm
  the same panel enters edit mode;
- save task and placement changes, verify chart/document/history updates, Undo/Redo,
  Cancel, and stale/deleted target handling;
- verify no persistence/API-debug surface, no page/chart horizontal overflow,
  accessible names/focus order/live status, clean application console, and successful
  application requests;
- record exact automated and live evidence in this plan and `docs/ROADMAP.md`.

Expected output: A verified consumer proof and completed handoff record.

Verification:

- `mise run ci`;
- `mise run build-playground`;
- `git diff --check`;
- recorded Chrome route, viewport, accessibility, console, and network evidence.

Dependencies: Slice 3 and a reachable Chrome DevTools MCP page.

## Likely Files to Add

- `apps/playground/src/pages/InteractiveCustomPage.tsx`
- `apps/playground/src/pages/InteractiveCustomPage.dom.test.tsx`

## Likely Files to Change

- `packages/gantt/src/react/types.ts`
- `packages/gantt/src/react/Gantt.tsx`
- focused package React DOM/facade tests
- `packages/gantt/src/index.tsx`
- `apps/playground/src/Playground.tsx`
- `apps/playground/src/styles.css`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/decisions/2026-07-31-item-properties-semantic-appearance-progress.md`
- this plan

## Resolved Review Questions

1. The second route is `/interactive-custom`; `/interactive` remains unchanged.
2. The public names are `GanttTaskEditRequest` and `onTaskEditRequest`.
3. The contract is task-only. Lane requests remain out of scope.
4. `Edit properties` is available through the callback only when the chart is
   mutable. The controlled custom page supplies `onDocumentChange`.

## Working Notes

### 2026-07-31

- Inspected the current controlled `/interactive` consumer, `Gantt` public React
  types, task activation, context-menu edit routing, and `ItemProperties` slot tests.
- Confirmed that application-owned display mode is already possible through
  `onTaskActivate`.
- Confirmed that the built-in edit action and `features.properties` activation both
  call private editor state, while appended context-menu items are command-only.
- Chose a public request callback over an externally controlled overlay because the
  callback proves the desired ownership split with less API and no second mutation
  path.
- No implementation or accepted architecture/decision text was changed. The public
  contract remains proposed until user review.

### 2026-07-31 — Slice 1 contract acceptance

- The implementation request accepted this proposed plan and satisfied Slice 1's
  review dependency.
- Fixed `/interactive-custom`, `Interactive Custom`,
  `GanttTaskEditRequest` / `onTaskEditRequest`, and task-only scope.
- Fixed disabled behavior: a controlled chart without `onDocumentChange` keeps the
  built-in edit action disabled and never publishes the request.
- Fixed focus and lifecycle behavior: selection closes the menu without restoring
  chart focus, publishes one frozen request, and never opens a package editor or
  enters commands, history, persistence, or acknowledgement.
- Synchronized the accepted contract with architecture, the item-properties
  decision, and the roadmap. No runtime or playground code changed in Slice 1.
- Verification passed: link-target checks for the synchronized documents, focused
  terminology search, `git diff --check`, and `mise run ci` (67 test files and 348
  tests, plus formatting, lint, types, and package build).

### 2026-07-31 — Slice 2 package request seam

- Added and exported `GanttTaskEditRequest` and
  `GanttProps.onTaskEditRequest` through the package root.
- The callback itself enables the built-in task menu. On mutable charts,
  `Edit properties` closes that menu without restoring task focus and publishes one
  frozen request. It opens no package editor and dispatches no command.
- A controlled chart without `onDocumentChange` keeps the edit item disabled with
  `The chart is read-only.` Existing consumers without the callback retain the
  current `ItemProperties` / `TaskEditor` fallback.
- Focused DOM and facade coverage proves ordinary activation independence,
  Shift+F10 and pointer-opened paths, exact-once delivery, frozen request/target,
  menu closure, no dialog, read-only behavior, fallback, and two-instance isolation.
- Verification passed:
  - `vp test run packages/gantt/src/react/Gantt.customization.dom.test.tsx packages/gantt/src/react/Gantt.keyboard.dom.test.tsx packages/gantt/src/index.react-runtime.test.tsx packages/gantt/src/index.consumer.dom.test.tsx`
    (4 files, 29 tests);
  - `vp pack` at the repository root;
  - packed `packages/gantt/dist/index.d.ts` inspection for both public names;
  - `mise run ci` (67 files, 352 tests, formatting, lint, types, and package build);
  - `git diff --check`.

### 2026-07-31 — Slice 3 Interactive Custom consumer

- Added `/interactive-custom` and the `Interactive Custom` navigation item while
  preserving the existing `/interactive` route and page.
- Cloned the controlled document, toolbar, history, range, creation mapper, direct
  interaction, appearance, tooltip, context-menu contribution, and acknowledgement
  behavior without importing `ExampleApiLog` or example-persistence state.
- Added a site-owned named panel after the chart. `onTaskActivate` opens display mode;
  `onTaskEditRequest` opens the same panel in edit mode and focuses its title field.
- The panel re-resolves task and placement records from the acknowledged controlled
  document. It shows current values after Save, Undo, and Redo and closes when its
  canonical task is deleted.
- Edit mode covers title, description, UTC instant start/end, integer progress,
  semantic appearance, and one persisted placement lane. Inline validation remains
  site-owned.
- Save omits unchanged fields and dispatches one `task.update`, one
  `placement.move`, or one transaction through `GanttHandle.dispatch`. Cancel and an
  unchanged Save return to display mode without a history entry.
- Responsive styles stack the display grid, form grid, panel header, and actions at
  narrow widths without introducing a second overlay or persistence surface.
- Verification passed:
  - `vp test run apps/playground/src/pages/InteractiveCustomPage.dom.test.tsx apps/playground/src/pages/AppendixConsumers.dom.test.tsx`
    (2 files, 7 tests);
  - `mise run build-playground`;
  - `mise run ci` (68 files, 357 tests, formatting, lint, types, and package build);
  - axe checks in display and edit/history flows;
  - `git diff --check`.

### 2026-07-31 — Slice 4 live browser gate and closeout

- Served the production playground and inspected only
  `http://127.0.0.1:4173/interactive-custom` with Chrome DevTools MCP at
  1440 x 900 and 560 x 900.
- At 1440 x 900, pointer activation selected `Work item 1`, opened the named
  `Work item 1 details` region in display mode, and focused the application-owned
  panel. No package dialog appeared.
- Opened the built-in task menu from a pointer `contextmenu` event at the task's live
  chart geometry and from Shift+F10 after focusing the task. Both menus exposed one
  accessible `Edit properties` item; selecting it focused the title field in the
  same panel's named edit form.
- Saved title, description, UTC start/end, progress, semantic appearance, and lane
  changes together. The chart and canonical display panel reflected the renamed
  task, new dates, 65% progress, `At risk` appearance, and move from Discovery to
  Delivery. Undo restored all original task and placement values; Redo reapplied all
  saved values.
- Changing the title and selecting Cancel returned to display mode without
  persisting the draft. Opening `Work item 3` in edit mode and removing that latest
  task closed the panel with the live status
  `The application-owned panel closed because its canonical task was deleted.`
- The first console inspection found Chrome's form-field issue because the custom
  controls lacked `id` or `name`. Added stable field names, rebuilt, reloaded without
  cache, and repeated the edit-form inspection; the final console contained no
  messages.
- The accessibility snapshot exposed named chart, controls, status, task buttons,
  task menu, panel, form, labels, Save, and Cancel. Focus moved to the panel after
  activation, the title input after edit request, and a surviving chart task after
  stale-target deletion.
- At 1440 x 900, document/page width was 1440 px and the 1323 px chart viewport fit
  its 1324.8 px frame. At 560 x 900, the scrollbar-adjusted document/page width was
  545 px; the 515 px chart viewport, 517 px panel, 479 px form, and every form
  control stayed within that width. Neither viewport had page-level horizontal
  overflow.
- Both viewports contained zero `.api-log`, `pre`, or `[role="dialog"]` elements.
  Final network inspection showed the document, JavaScript, CSS, and data-image
  requests all completed with status 200.
- Verification passed:
  - `vp test run apps/playground/src/pages/InteractiveCustomPage.dom.test.tsx`
    (1 file, 5 tests);
  - `mise run build-playground`;
  - final `mise run ci` (68 files, 357 tests, formatting, lint, types, and package
    build);
  - final `mise run build-playground`;
  - `git diff --check`.

## Final Verification

- Slice 1: link-target checks and focused terminology search passed;
  `mise run ci` passed 67 test files / 348 tests plus formatting, lint, type, and
  package-build gates.
- Slice 2: focused React/facade tests passed 4 files / 29 tests, `vp pack` and packed
  declaration inspection passed, and `mise run ci` passed 67 files / 352 tests plus
  formatting, lint, types, and package build.
- Slice 3: focused playground and regression tests passed 2 files / 7 tests with axe
  coverage, `mise run build-playground` passed, and `mise run ci` passed 68 files /
  357 tests plus formatting, lint, types, and package build.
- Slice 4: the production `/interactive-custom` route passed its 1440 x 900 and
  560 x 900 Chrome DevTools MCP interaction, responsive, accessibility, console, and
  network gates. The focused page test, final production build, `git diff --check`,
  and final `mise run ci` passed.

## Next Slice

None. The accepted package seam, controlled consumer, and live desktop/narrow
integration proof are complete. Future work should start from a separately accepted
plan rather than extending this bounded consumer proof.
