# React Query Document Integration Plan

Status: Complete
Milestone: Post-M5 integration boundary correction before M6
Architecture mapping: Controlled document ownership, React draft state, optional server-state adapter
Last updated: 2026-08-03

## Summary

Replace the broad `useGanttDocument` network-state controller with two explicit
React boundaries. Core GanTempo should own only an editable canonical document draft
and immediate controlled acknowledgement. An optional TanStack Query subpath should
own the standard query/mutation wiring for loading, caching, retries, cancellation,
and invalidation without making TanStack Query a dependency of the core entrypoint.

The first API-loaded example should use the optional adapter and retain its three-step
shape, exact source, full code panels, five ordinary tasks, built-in appearances, and
working edit/Save result.

## Decisions

- Rename and narrow the core hook to `useGanttDocumentDraft`. It accepts a canonical
  source document and owns the local draft, immediate `GanttDocumentChange`
  acknowledgement, dirty state, saved-baseline acknowledgement, reset, and detection
  of a newer remote document while dirty.
- Remove `useGanttDocument`, its custom loading/retry/Save state machine, and its old
  public types before release. This repository is pre-release, so no deprecated alias
  or dual lifecycle is required.
- Add `@gantempo/gantt/react-query` as an optional package export with
  `useGanttDocumentQuery`. The export depends on an optional peer installation of
  `@tanstack/react-query`; the root `@gantempo/gantt` entry remains free of TanStack
  runtime imports.
- The adapter parses unknown query data into a canonical `GanttDocument`, passes the
  query `AbortSignal` through to application code, preserves TanStack retry/cache/error
  behavior, saves through a mutation, updates the matching query cache on success,
  and never overwrites a dirty draft during a background refetch.
- Expose native query and mutation results alongside the draft binding rather than
  inventing a second vocabulary for pending, error, retry, and invalidation state.
- Keep the simple guide at the application level: its entry file renders the example
  itself, its API module exposes only ordinary load/save functions, and cancellation
  remains an adapter capability rather than required introductory knowledge.
- Keep authentication, endpoints, query keys, revision/conflict policy, optimistic
  server updates, and product UI application-owned.

## Scope

### In scope

- core draft-hook implementation, types, exports, and lifecycle tests;
- optional React Query subpath, peer metadata, build configuration, and adapter tests;
- playground QueryClient setup, fake API functions, guide source, live result, and
  focused tests;
- architecture, decision, roadmap, package, fresh-consumer, and browser proof.

### Out of scope

- shipping a separate package before a subpath proves insufficient;
- autosave, offline mutation persistence, optimistic backend writes, conflicts,
  revisions, retry-safe operation IDs, or multi-document caches;
- replacing TanStack defaults with hidden GanTempo retry, stale-time, or invalidation
  policy;
- changing `<Gantt>` controlled/uncontrolled ownership or command semantics.

## Behavior To Preserve

- Chart changes are acknowledged into local controlled state immediately; network
  completion never gates interaction commitment.
- Edits made during an in-flight Save remain dirty after that Save succeeds.
- Background server data may be reported while dirty but cannot silently replace the
  local draft.
- Invalid API data fails before reaching `<Gantt>` with a useful canonical parser
  error.
- Core imports and SSR do not require `@tanstack/react-query`.
- The first example remains directly navigable, accessible, responsive, and free of
  internal code-panel scrolling.

## Implementation Shape

```text
@gantempo/gantt
  useGanttDocumentDraft({ document })
    -> canonical local draft
    -> immediate ganttProps acknowledgement
    -> dirty / remote-update / reset / markSaved

@gantempo/gantt/react-query (optional peer)
  useQuery(queryKey, queryFn + canonical parse)
    -> useGanttDocumentDraft(query.data)
  useMutation(save current draft)
    -> setQueryData(saved draft)
    -> markSaved(saved draft)
```

## Slices

### Slice 1: Freeze the split integration contract

Status: `[x]` Done

- add this active plan and the durable React Query integration decision;
- update architecture and roadmap ownership;
- record the pre-release replacement of `useGanttDocument` rather than retaining a
  compatibility alias.

Verification:

- `git diff --check`
- focused plan/decision/architecture/roadmap link inspection

Dependencies: none.

Passed 2026-08-02: `git diff --check` passed. Focused link inspection confirmed the
active plan and roadmap entry, the accepted decision and partial supersession link,
and the updated architecture boundary for both public hook names and the optional
entrypoint.

### Slice 2: Replace the core network hook with a draft hook

Status: `[x]` Done

- implement `useGanttDocumentDraft` and its public types;
- cover initialization, immediate acknowledgement, clean source adoption, dirty
  remote-update protection, reset, Save acknowledgement, and edit-during-Save safety;
- export the draft hook while retaining the old controller only as a temporary
  compile bridge; Slice 4 removes that bridge with the example migration.

Verification:

- focused core hook and public-facade tests
- `vp check`

Dependencies: Slice 1.

Passed 2026-08-02: focused draft-hook and root-facade coverage passed 2 files / 18
tests. `vp check` passed formatting for 253 files and lint/type checking for 240 files
with no warnings or errors. The old controller remains only as the documented
compile bridge until Slice 4.

### Slice 3: Add the optional TanStack Query adapter

Status: `[x]` Done

- add the `@gantempo/gantt/react-query` entry and optional peer metadata;
- wire canonical query parsing, mutation Save, cache update, retry/error exposure,
  cancellation, and dirty-refetch protection;
- prove the root entry remains usable without the optional peer.

Verification:

- focused adapter tests
- package build and export inspection
- core-only and adapter fresh consumers

Dependencies: Slice 2 and an installed compatible TanStack Query version.

Passed 2026-08-02: the adapter, draft, and root-facade selection passed 3 files / 23
tests. `vp check` passed 255 formatted files and 242 lint/type files. `vp pack`
emitted separate `index` and `react-query` entries across a 218-file package; direct
inspection confirmed the root bundle has no TanStack import and the optional entry
externalizes it. A fresh core-only consumer installed six packages with no TanStack
package present and imported `useGanttDocumentDraft`; a separate consumer installed
TanStack Query and imported `useGanttDocumentQuery`.

### Slice 4: Migrate the simple example

Status: `[x]` Done

- add the QueryClient provider at the playground application boundary;
- replace the custom lifecycle adapter with small load/save functions and
  `useGanttDocumentQuery`;
- keep three full-source steps and the same small live project;
- update focused route, error/retry, edit/Save, and accessibility coverage.

Verification:

- focused playground tests
- `mise run build-playground`
- `git diff --check`

Dependencies: Slice 3.

Passed 2026-08-02: the draft hook, optional adapter, root facade, fake API, and
playground route passed 5 files / 28 tests, including provider/query source,
load retry, edit/dirty/Save, failed-Save retryability, query cache update, dirty
refetch protection, cancellation, and axe coverage. `vp check` passed 240
lint/type files with no warnings or errors. The production playground build passed
2,023 transformed modules after replacing prefix aliases with exact root,
`react-query`, and stylesheet aliases. `git diff --check` passed. The old controller,
tests, types, and root exports are removed.

### Slice 5: Complete distribution and browser proof

Status: `[x]` Done

- run the full repository gate and fresh packed consumers;
- verify the exact route at desktop and narrow viewports;
- verify load/retry, background-refetch protection, edit/dirty/Save, query cache
  update, zoom, one-day movement, warning contrast, network, overflow, and console;
- synchronize final plan and roadmap evidence.

Verification:

- `mise run ci`
- `mise run build-playground`
- `vp pack` plus fresh root and React Query consumers
- `git diff --check`
- Chrome DevTools at 1440x1000 and 560x900

Dependencies: Slices 1-4.

Passed 2026-08-02: `mise run ci` passed formatting for 253 files,
lint/type checking for 240 files, 101 test files / 518 tests, and the 214-file
two-entry package build. `mise run build-playground` passed 2,023 transformed
modules. The final npm tarball is 385.8 kB / 215 files. A fresh core-only consumer
proved strict TypeScript and SSR without `@tanstack/react-query` installed; a second
fresh consumer installed TanStack Query and proved the optional entry with strict
TypeScript and SSR. Chrome verified `/examples/simple-project` at 1440x1000 and
560x900: loading and the JSON request, complete accessibility structure, four open
source panels with no internal overflow, zero page overflow, working zoom,
edit/dirty/Save, one-day keyboard movement, `#f0d7a5` warning fill with `#18352f`
text, and no console warnings or errors. Focused automated coverage proves load
refetch/error, failed-Save retryability, cache update, cancellation, and dirty-refetch
protection. Lighthouse remained at 96 accessibility solely because five existing
inactive playground navigation links measure 4.27:1 contrast; that unrelated known
shell issue was not expanded into this integration change. `git diff --check` passed.

### Slice 6: Remove playground and cancellation leakage from the simple guide

Status: `[x]` Done

- replace the raw playground entry source with a standalone copyable example entry;
- reduce the visible API module to one GET function and one Save function;
- make the TanStack Query provider and `queryFn` / `mutationFn` integration explicit
  in the step titles and copy;
- preserve adapter-level cancellation support and tests without teaching
  `AbortSignal` in the simple page;
- re-run focused, production-build, and live responsive route verification.

Verification:

- focused simple API and route tests
- `vp check`
- `mise run build-playground`
- `git diff --check`
- Chrome DevTools at desktop and narrow viewports

Dependencies: Slice 5 and the user review finding recorded below.

Passed 2026-08-03: focused API and route coverage passed 2 files / 5 tests.
`vp check` passed formatting for 254 files and lint/type checking for 241 files.
`mise run build-playground` passed 2,023 transformed modules, `mise run ci` passed
101 test files / 518 tests and the 214-file package build, and `git diff --check`
passed. Chrome verified `/examples/simple-project` at 1440x1000 and 560x900: the
visible source contains the standalone `QueryClientProvider`, `queryFn`,
`mutationFn`, GET, and PUT; it contains no playground import or cancellation
primitive; all four code panels have equal client/scroll dimensions; both viewports
have zero page overflow; and a live edit moved from Unsaved to Saved through a GET
304 and PUT 204 with no console warnings or errors.

## Testing Plan

- Draft hook: source initialization, immediate edit acknowledgement, clean adoption,
  dirty remote update, reset, matching/non-matching Save acknowledgement, and stable
  callbacks.
- React Query adapter: parsing, retry/error state, consumed cancellation signal,
  mutation success/failure, cache update, edits during Save, refetch while dirty, and
  native query/mutation result exposure.
- Example: three full source panels, provider/query integration, five tasks, two
  dependencies, load retry, edit/dirty/Save, and axe.
- Final: repository CI, playground build, root and optional-entry consumers, two live
  viewports, network, console, overflow, accessibility tree, and interaction checks.

## Open Questions

None blocking. A separate `@gantempo/react-query` package remains an option only if
the subpath cannot preserve a clean optional-peer and distribution boundary.

## Working Notes

### 2026-08-02 — User-directed boundary correction

- The first simplified hook successfully removed boilerplate, but it duplicated the
  query library responsibilities that many React applications already standardize.
- `useGanttDocument` is React-shaped but hides two different kinds of state: remote
  server state and the chart's local editable draft. The replacement names those
  boundaries directly.
- TanStack Query defaults remain visible and configurable. GanTempo adds only the
  coordination needed to prevent background data from clobbering a dirty chart.
- The old hook remains temporarily during Slices 2-3 so every slice keeps the
  workspace compiling. Slice 4 removed that bridge after migrating the example, so
  the public facade now exposes only the explicit draft and optional query APIs.
- The first production build exposed prefix matching in the playground's existing
  root package alias. Exact aliases for the root, React Query subpath, and stylesheet
  now keep source-mode development aligned with the package export map.

### 2026-08-03 — Simple guide leaked infrastructure

- Showing the playground's real `main.tsx` made the copyable guide import an
  unexplained `<Playground />` shell that no consumer needs.
- Passing TanStack's cancellation signal through a hand-written delay helper exposed
  a low-level capability before the user could see the basic load/show/save flow.
- The correction keeps cancellation inside the optional adapter contract and its
  focused tests, while the first page shows a standalone QueryClient entry, one
  ordinary load function, one ordinary Save function, and the chart component.
- A tiny development/preview PUT handler keeps the copyable fetch-based Save real in
  the working playground without adding any handler code to the introductory page.

## Next Slice

None for this plan. The next roadmap work is M6 planning; the first integration page
now deliberately teaches only set up, load/show, edit, and Save.
