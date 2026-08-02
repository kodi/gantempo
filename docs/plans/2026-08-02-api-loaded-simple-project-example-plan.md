# API-Loaded Simple Project Example Plan

Status: Complete
Milestone: Post-M5 example and integration hardening before M6
Architecture mapping: Public React consumer, document trust boundary, controlled ownership
Last updated: 2026-08-02

## Summary

Add a standalone playground page that teaches the smallest believable production
integration rather than the smallest possible `Gantt` invocation. The page must load
an API-shaped static JSON document through `fetch`, validate it at the public codec
boundary, acknowledge chart changes into controlled React state, expose an explicit
Save workflow, show every integration file as copyable code, and finish with the same
working example described by those steps.

## Decisions

- Route the example at `/examples/simple-project` and expose it in the top-level
  playground navigation as `API Example`.
- Use a bundled static JSON asset as the deterministic simulated `GET` response. The
  loader must still use `fetch` and `parseGanttDocument`; the React page must never
  import the parsed fixture as its runtime document.
- Simulate Save in an application adapter with visible latency and a clear in-memory
  label. Do not imply that the static asset accepts writes.
- Keep document ownership controlled. `onDocumentChange` installs `change.document`
  immediately and marks the draft dirty; explicit Save serializes the current
  document after local acknowledgement.
- Keep range ownership runtime-local through `defaultRange`; controlled range and
  incremental persistence belong to the later medium example.
- Display the exact fixture, adapter, component, and example CSS used by the live
  result. Fetch the fixture from its public endpoint and use Vite raw-source imports
  for the application source files so documentation cannot silently diverge.
- Use the existing public project view, adaptive scale, default tooltip/context menu/
  properties surfaces, semantic appearance variants, dependencies, hierarchy,
  milestones, and progress. Do not add or imply automatic scheduling.

## Scope

### In scope

- a deterministic API-shaped JSON fixture;
- a small fetch/parse/serialize application adapter;
- loading, load-error, controlled draft, dirty, saving, saved, and save-error UI;
- an ordered integration guide with complete source code;
- a final live chart using the documented code;
- route, accessibility, behavior, build, responsive, console, and network coverage;
- synchronized plan and roadmap evidence.

### Out of scope

- a real backend, service worker, mock server dependency, or writeable Vite endpoint;
- autosave, retries, incremental `entityChanges`, revision conflict policy, or
  collaboration;
- package API or model changes;
- automatic scheduling, working calendars, critical path, or resource leveling;
- redesigning unrelated playground pages or navigation architecture.

## Behavior To Preserve

- Existing routes and their deterministic fixtures remain unchanged.
- The package retains controlled/runtime-owned document and range contracts.
- Direct mouse, wheel, trackpad, touch, and keyboard navigation remains available.
- The app-level example uses the package stylesheet and public root facade only.
- Playground tests remain included in the normal repository gate.

## Implementation Shape

```text
static JSON asset
  -> fetch in application adapter
  -> parseGanttDocument trust boundary
  -> controlled React document
  -> Gantt onDocumentChange acknowledgement
  -> explicit Save
  -> serializeGanttDocument
  -> clearly labeled in-memory mock response
```

The documentation page fetches the working fixture from its exact public endpoint,
imports the adapter, component, and CSS as raw text for its code panels, and imports
the component normally for the final live example.

## Slices

### Slice 1: Freeze the example contract and roadmap position

Status: `[x]` Done

- record the target integration, simulation boundary, scope, slices, and final gate;
- add the post-M5 example to the roadmap and make it the current focus;
- verify plan/roadmap status, links, and working-tree scope.

Verification:

- `git diff --check`
- focused plan/roadmap link and status inspection

Passed 2026-08-02: both checks completed with the active roadmap entry, dependency
order, current focus, plan link, route, and simulation boundary aligned.

Dependencies: none.

### Slice 2: Add the API boundary and controlled working example

Status: `[x]` Done

- add the static JSON fixture with project hierarchy, progress, milestones, semantic
  appearance, and manual dependencies;
- add a fetch/parse loader and an explicitly simulated serialize/save adapter;
- add the controlled chart with loading, retry, dirty, saving, saved, and error states;
- add focused adapter and DOM behavior tests.

Verification:

- focused Vite+ tests for the adapter and page
- `vp check`

Passed 2026-08-02: the two focused files passed 6 tests covering fetch/parse,
HTTP/schema failures, serialization, route/guide accessibility, controlled
acknowledgement, Save success/failure, and retry. `vp check` passed formatting for 249
files and lint/type checking for 236 files with no warnings or errors.

Dependencies: Slice 1.

### Slice 3: Add the standalone guide, routing, and responsive presentation

Status: `[x]` Done

- add the ordered install/data/adapter/component/style steps with exact raw source;
- add the final live example and an explicit static-GET/in-memory-Save explanation;
- link the route from the top-level playground navigation;
- add responsive, overflow, focus, and code-block styles without changing package CSS;
- extend route and accessibility coverage.

Verification:

- focused page and route tests including axe
- `mise run build-playground`
- `git diff --check`

Passed 2026-08-02: focused route/DOM/axe coverage is included in the 6-test run;
`mise run build-playground` transformed 1,974 modules and emitted the production
assets; `git diff --check` passed.

Dependencies: Slice 2.

### Slice 4: Complete repository and live-browser evidence

Status: `[x]` Done

- run the complete repository gate and production playground build;
- inspect `/examples/simple-project` in Chrome DevTools at desktop and narrow
  viewports;
- verify the static JSON request, loading-to-ready behavior, edit/dirty/save flow,
  keyboard/focus behavior, accessibility tree, page overflow, and clean console;
- record exact evidence here and in the roadmap before marking the work complete.

Verification:

- `mise run ci`
- `mise run build-playground`
- `git diff --check`
- Chrome DevTools at `1440x1000` and `560x900`
- Lighthouse accessibility audit where available

Dependencies: Slices 1-3.

Passed 2026-08-02: `mise run ci` passed 99 files / 507 tests, formatting for
249 files, lint/type checking for 236 files, and the 208-file package build.
`mise run build-playground` transformed 1,974 modules and emitted the production
assets; its existing greater-than-500-kB chunk advisory remains non-fatal.
`git diff --check` passed.

Chrome DevTools verified `/examples/simple-project` at 1440x1000 and 560x900. The
fixture completed real `GET` requests with 200/304 responses; aborted requests were
the expected cleanup from React Strict Mode before the successful request. The chart
reported zero diagnostics, the application command acknowledged a controlled edit,
Save serialized 2,425 bytes, Enter opened the labelled task-properties dialog, and
the accessibility tree exposed the guide, dependencies, hierarchy, and keyboard
instructions. Both viewports had no page-level horizontal overflow and the console
had no warnings, errors, or issues. A live contrast and compact-brand naming defect
were fixed; the repeat mobile Lighthouse navigation audit scored 100 accessibility
and 100 best practices. The remaining Lighthouse failures concern the playground's
site-wide `robots.txt` and `llms.txt`, outside this example's scope.

## Testing Plan

- Adapter tests: successful fetch/parse, invalid payload rejection, HTTP failure, and
  serialized mock save.
- Page tests: loading, retryable failure, loaded chart semantics, controlled edit,
  dirty state, save success/failure, exact code panels, route state, and axe.
- Build and type checks: normal `mise run ci` plus production playground build.
- Browser: exact route, both viewports, request evidence, visible chart behavior,
  keyboard/focus, no horizontal page overflow, accessibility tree, console, and
  Lighthouse.

## Open Questions

None blocking. A later medium example should decide the incremental persistence,
revision, retry, and conflict contract rather than expanding this explicit-Save page.

## Working Notes

### 2026-08-02 — Initial contract

- The existing `/project` route proves the complete feature matrix, but its ownership,
  localization, direction, filtering, and diagnostics controls make it a poor first
  integration tutorial.
- The existing runtime-owned page is intentionally advanced and does not represent
  the simplest credible API-loaded application.
- A static fetched asset provides deterministic network evidence in development and
  production builds. Because it cannot accept writes, Save must remain visibly
  simulated instead of using a misleading `PUT` request.
- Slice 1 verification passed with `git diff --check`, explicit plan existence, and a
  focused roadmap/plan link, status, route, and current-focus inspection.

### 2026-08-02 — Working consumer and guide

- Added the public `/api/examples/simple-project.json` fixture with nine project tasks,
  hierarchy, summaries, two milestones, progress, semantic appearance, and five
  manual dependencies.
- Added the fetch/parse adapter, explicit serialize/save mock, abortable load/retry,
  controlled acknowledgement, dirty/save/error state, and stable application toolbar
  command through `GanttHandle.dispatch`.
- Added a five-step standalone guide whose fixture comes from the exact endpoint and
  whose adapter, component, and CSS panels are raw imports of the live source.
- The properties portal remains available for direct editing. Focused lifecycle tests
  use the deterministic `Advance API step` toolbar command so they prove controlled
  acknowledgement and Save without depending on portal focus behavior in jsdom.
- Focused verification passed 6 tests; `vp check`, the production playground build,
  and `git diff --check` passed. The jsdom axe run emits the repository's known canvas
  `getContext` notice but reports zero accessibility violations.

### 2026-08-02 — Repository and browser completion

- The final repository gate passed 99 files / 507 tests, formatting for 249 files,
  lint/type checking for 236 files, and the 208-file package build. The final
  playground build transformed 1,974 modules; `git diff --check` passed.
- Chrome DevTools reused the selected playground page and verified the exact route at
  1440x1000 and 560x900. Both sizes retained zero page overflow and zero chart
  diagnostics with a clean console.
- Network evidence showed the fixture's real successful `GET`; React Strict Mode's
  initial effect cleanup produced the expected aborted request before the 200/304
  responses.
- The application toolbar edit changed `Connect save workflow` from 45% to 55%,
  exposed the dirty state, and Save reported 2,425 serialized bytes. Enter on the
  focused task opened the correctly labelled properties dialog.
- Live inspection exposed and fixed a low-contrast note, the compact brand's missing
  accessible name, and a pale milestone label. The repeat mobile Lighthouse audit
  scored 100 accessibility and 100 best practices.

## Next Slice

The simple example is complete. Before implementing a medium example, define its
incremental persistence, revision, retry, and conflict contract in a new active plan;
otherwise resume M6 detailed planning.
