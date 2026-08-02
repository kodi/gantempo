# Simple Integration Defaults Plan

Status: Complete
Milestone: Post-M5 integration correction before M6
Architecture mapping: Public React integration hook, controlled ownership, semantic appearance
Last updated: 2026-08-02

## Summary

Correct the first API-loaded example so it reads like a genuinely simple GanTempo
integration. The package should own repeated load/validation, controlled
acknowledgement, dirty/save/error state, and common semantic appearance defaults. The
application should supply a small API adapter and render a normal chart with only a
few ordinary tasks and two optional features.

This is a follow-up to the completed
[API-loaded simple project example plan](2026-08-02-api-loaded-simple-project-example-plan.md).
That implementation remains useful as evidence, but its integration and fixture are
medium-level and should not remain the first simple example.

## Decisions

- Add a public `useGanttDocument` React hook. The hook loads unknown data, validates
  it with the canonical parser, immediately acknowledges chart changes into
  controlled state, tracks dirty/load/save/error state, and exposes explicit `save`
  and `reload` actions.
- Keep actual transport application-owned. Callers supply `load(signal)` and optional
  `save(document)` functions; GanTempo does not invent endpoints, autosave,
  concurrency, retries, revisions, or conflict policy.
- Make `accent`, `neutral`, `success`, and `warning` built-in semantic appearance
  variants. Instance `appearanceVariants` add new IDs and merge same-ID labels/tokens
  over the defaults.
- Reduce the fixture to five ordinary scheduled tasks, progress, two dependencies,
  and one built-in warning appearance. Remove hierarchy, summaries, milestones, and
  custom appearance setup from the simple example.
- Reduce the guide to install, a small fake API adapter, and one small React component.
  Source panels must still show the exact files used by the live result.
- Keep explicit Save. The hook owns its state machine, while the page owns the button
  and wording so product UI and localization do not leak into the chart package.

## Scope

### In scope

- public hook types, implementation, exports, and lifecycle tests;
- automatic built-in appearance registration with per-instance overrides;
- a smaller fixture, adapter, React example, guide, styles, and focused tests;
- public facade, architecture, decision, roadmap, build, package, and browser proof.

### Out of scope

- automatic persistence, debounce, queuing, rollback, operation IDs, or conflicts;
- server rendering of asynchronously loaded data;
- changing the existing controlled/uncontrolled `<Gantt>` ownership union;
- adding new chart event kinds, scheduling semantics, or Pro behavior;
- redesigning medium and complex examples before their contracts are planned.

## Behavior To Preserve

- `<Gantt>` retains its existing controlled and uncontrolled props and command
  lifecycle.
- Controlled changes are acknowledged immediately; persistence never blocks local
  commitment.
- Unknown appearance IDs remain diagnosable and round-trip unchanged.
- Existing custom variants continue to render, including IDs outside the built-ins.
- Existing playground routes and direct navigation behavior remain intact.

## Implementation Shape

```text
application load(signal) -> useGanttDocument -> parseGanttDocument
                                           -> controlled ganttProps
Gantt change -> immediate hook acknowledgement -> dirty
explicit Save -> application save(document) -> saved or retryable save-error

built-in appearance variants -> registry -> same-ID application override -> renderer
```

## Slices

### Slice 1: Freeze the corrected public contract

Status: `[x]` Done

- record the hook and appearance-default decisions;
- update architecture and roadmap ownership;
- preserve the completed example plan as prior evidence and record the correction.

Verification:

- `git diff --check`
- focused plan/roadmap/architecture link inspection

Dependencies: none.

Passed 2026-08-02: `git diff --check` passed, and focused inspection confirmed the
plan, architecture, decision, and roadmap links plus the active milestone status.

### Slice 2: Add package-owned integration and appearance defaults

Status: `[x]` Done

- implement and export `useGanttDocument` with stable callbacks and race-safe state;
- add built-in variants and merge custom overrides;
- add focused hook, registry, SSR/public-facade, and type coverage.

Verification:

- focused package tests
- `vp check`

Dependencies: Slice 1.

Passed 2026-08-02: focused package and facade coverage passed 3 files / 20 tests;
the combined package/example selection passed 5 files / 25 tests. `vp check` passed
formatting for 251 files and lint/type checking for 238 files with no warnings or
errors.

### Slice 3: Reset the simple example

Status: `[x]` Done

- replace the fixture with five ordinary tasks and two dependencies;
- reduce the fake API and React component to the new public hook;
- reduce the guide to three exact-source steps and remove medium-level claims;
- update route/behavior/axe coverage.

Verification:

- focused adapter and page tests
- `mise run build-playground`
- `git diff --check`

Dependencies: Slice 2.

Passed 2026-08-02: the combined focused selection passed 5 files / 25 tests,
including the three-step route, axe, properties edit, Save, load retry, and save-error
behavior. `mise run build-playground` transformed 1,974 modules and emitted 50.31-kB
CSS and 581.26-kB JavaScript assets; the existing greater-than-500-kB advisory remains
non-fatal. `git diff --check` passed before the final evidence update.

### Slice 4: Complete package and live-browser proof

Status: `[x]` Done

- run the full repository and packed-consumer gates required by the public facade;
- inspect the exact route at desktop and narrow viewports;
- verify load, ordinary task edit, dirty/save, default warning appearance, network,
  accessibility, overflow, and console behavior;
- synchronize final plan and roadmap evidence.

Verification:

- `mise run ci`
- `mise run build-playground`
- `vp pack` plus fresh tarball consumer
- `git diff --check`
- Chrome DevTools at 1440x1000 and 560x900
- Lighthouse accessibility where available

Dependencies: Slices 1-3.

Passed 2026-08-02: the final focused selection passed 6 files / 55 tests. `mise run
ci` passed formatting and lint/type checks plus 100 test files / 513 tests and the
211-file package build. `mise run build-playground` transformed 1,974 modules and
emitted 50.47-kB CSS and 581.44-kB JavaScript assets; the existing greater-than-500-kB
advisory remains non-fatal. A fresh 384.5-kB / 212-file tarball consumer installed
the package, passed strict TypeScript compilation, imported the new public facade,
and rendered the built-in warning appearance through SSR.

Chrome DevTools verified `/examples/simple-project` at 1440x1000 and 560x900. The
static fixture request completed with `304`, the chart exposed five tasks and two
dependencies in its accessibility tree, task properties changed Build from 45% to
50%, Save reached `Saved`, and the final console had no warning or error messages.
Zoom changed the visible scale and all three controls remained 30x30 at both
viewports. The warning task resolved to `#f0d7a5` with `#18352f` text (9.42:1), and
the narrow page had no document overflow. The adaptive default move snap was also
verified live by moving Build exactly one day from Aug 10-20 to Aug 11-21.

Mobile Lighthouse scored 96 accessibility and 100 best practices. Its only
accessibility deduction was five pre-existing global playground navigation links at
4.27:1; the corrected warning task was not a failing node. `git diff --check` passed
after the completion evidence update.

## Testing Plan

- Hook: successful parse, invalid payload, load error/reload, immediate controlled
  acknowledgement, Save success/failure, edit-during-save, unmount abort, and no-save
  mode.
- Appearance: defaults without props, same-ID token merge, custom additions, invalid
  option filtering, unresolved fallback, and SSR rendering.
- Example: three steps, exact source, five ordinary tasks, two dependencies, one
  hook, loading/retry, edit/dirty/save, and axe.
- Final: repository CI, playground build, fresh package consumer, two live viewports,
  network, console, overflow, accessibility tree, and Lighthouse.

## Open Questions

None blocking. Automatic persistence and server conflict policy remain medium-example
concerns.

## Working Notes

### 2026-08-02 — User-directed correction

- The completed first version proved the full controlled API path but required a
  large component state machine, custom variants, five guide steps, and a fixture
  spanning summaries, milestones, hierarchy, dependencies, and progress.
- The simple example must optimize for first-success comprehension: one package hook,
  one small adapter, one small React component, ordinary tasks, and no required
  appearance setup.

### 2026-08-02 — Package defaults and simple reset

- Added the public `useGanttDocument` controller with abortable unknown-data loading,
  canonical validation, stable adapter refs, immediate controlled acknowledgement,
  dirty/save/error/reload state, double-Save protection, and edit-during-Save safety.
- Added automatic `accent`, `neutral`, `success`, and `warning` variants. Instance
  options now add IDs or merge labels/tokens over a matching default.
- Reset the fixture from nine mixed-kind hierarchical tasks and five dependencies to
  five ordinary tasks and two dependencies. The `warning` task proves defaults
  without an `appearanceVariants` prop.
- Reduced the guide from five steps to three and removed the contract diagram, custom
  toolbar command, custom variant table, raw fixture panel, and CSS step. The working
  component now has one hook and delegates all lifecycle machinery to the package.
- Added a root test alias for `@gantempo/gantt` so workspace tests consume current
  source exports instead of racing the parallel package build against stale `dist`.

### 2026-08-02 — Live corrections from the simple example

- A descendant `button` selector in the example was overriding the chart's private
  zoom controls. Scoping page button styles to the example toolbar and loading/error
  state restored the built-in 30x30 controls and zoom behavior.
- Built-in neutral, success, and warning variants referenced playground variables
  without fallbacks. Self-contained token fallbacks now keep `warning` readable in
  any consumer; the live task measured 9.42:1 text contrast.
- Adaptive charts incorrectly reused the day zoom level's 14-day nominal viewport
  span as their default editing snap. The runtime now uses a one-day editing step;
  pointer and keyboard interactions share that package-owned default, while
  `interactionSnap` remains available for application overrides.

## Next Slice

Plan the medium integration example or M6 without reintroducing transport, lifecycle,
or appearance boilerplate into the simple entry point.
