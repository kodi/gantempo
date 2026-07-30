# Default Surface Modernization Plan

Status: Complete and verified
Date: 2026-07-30
Milestone: Post-M4 interaction refinement

## Summary

Modernize the built-in task editor and context menu so the verified M4 interaction
surfaces feel like one contemporary product UI. Preserve the existing public slot,
command, overlay, focus, and accessibility contracts while improving hierarchy,
spacing, iconography, controls, action emphasis, and narrow-viewport behavior.

## Decisions

- Use `lucide-react` inside the package's built-in React surfaces. The package owns
  the icons used by its defaults; consumers do not need to install or configure an
  icon system.
- Keep `GanttContextMenuItem`, `GanttTaskEditorProps`, surface slots, and overlay
  bindings source-compatible. Icons are derived from known built-in actions and use
  a neutral fallback for consumer commands.
- Present editor dates as native `datetime-local` controls while preserving the
  existing epoch-millisecond editor value and command boundary.
- Use icon plus text for actions. Decorative icons remain hidden from assistive
  technology; visible labels and existing accessible names remain authoritative.
- Treat Delete as a visually destructive menu action and Save as the editor's primary
  action without changing command semantics.

## Scope

In scope:

- default context-menu and task-editor markup;
- default overlay visual tokens and responsive styles;
- the package dependency and lockfile;
- focused DOM/accessibility tests and `/interactive` browser verification;
- synchronized plan and roadmap evidence.

Out of scope:

- changing the public slot props or context-menu item schema;
- a general icon customization API;
- task property fields beyond title, start, and end;
- changing command, runtime, portal, or persistence behavior.

## Behavior To Preserve

- keyboard menu navigation, Escape handling, focus trapping, focus return, pending
  behavior, click-away close, and modal background isolation;
- disabled reasons and screen-reader labels;
- consumer class hooks and complete replacement slots;
- light, dark, and high-contrast theme inheritance;
- ISO-compatible instant editing at the existing epoch-millisecond boundary.

## Slices

### Slice 1: Plan and baseline

Status: `[x]` Done

- inspect the default surfaces, theme hooks, focused tests, and `/interactive`
  consumer;
- select the internal Lucide and native datetime-local approach;
- create this active plan and link it from the roadmap.

Verification:

- focused source and documentation inspection;
- `git diff --check`.

Dependencies: none.

### Slice 2: Surface implementation and focused tests

Status: `[x]` Done

- add the icon dependency and modernized default markup;
- add low-specificity visual, state, and responsive styles;
- update focused DOM tests for date conversion and structural/action semantics;
- preserve all existing accessible names and bindings.

Verification:

- focused customization DOM tests;
- repository formatting, lint, and type checking;
- package and playground builds.

Dependencies: Slice 1.

### Slice 3: Live visual and accessibility gate

Status: `[x]` Done

- inspect `/interactive` at desktop and narrow viewports with Chrome DevTools;
- verify modal/menu geometry, keyboard focus, accessibility tree, console, and
  network state;
- record exact evidence here and in the roadmap.

Verification:

- full repository CI;
- Chrome DevTools browser gate;
- `git diff --check`.

Dependencies: Slice 2.

## Testing Plan

- Prove built-in actions retain their exact accessible names and disabled reasons.
- Prove editor local datetime values convert back to the same epoch-millisecond
  command boundary and validation remains visible and associated with the dialog.
- Re-run focus containment, focus return, pending interception, overlay ownership,
  and collision tests.
- Inspect light-theme desktop and narrow menu/editor layouts, then exercise the
  playground's dark and high-contrast tokens if the route exposes them.

## Working Notes

### 2026-07-30 baseline

- The editor used raw ISO strings, uniformly outlined controls, an unaccented Save
  button, and a text glyph close control.
- The context menu rendered every item as text-only with no icon, destructive
  treatment, grouping cue, or task context.
- Existing bindings already provide the correct modal/menu roles, accessible names,
  keyboard behavior, focus restoration, collision handling, and document-level
  overlay ownership. This pass can remain inside the default surface implementation
  and stylesheet.

### 2026-07-30 dependency-store deviation

- The initial filtered `pnpm add` did not mutate the repository because sandboxed
  pnpm selected `.pnpm-store/v11`, while the existing `node_modules` links use
  `/Users/kodisha/Library/pnpm/store/v11`.
- Installation must explicitly reuse the existing store; rebuilding all workspace
  links against a second store is unnecessary and outside this UI slice.
- Reusing the store succeeded, but the shell pnpm was 11.9.0 while `packageManager`
  pins 11.18.0. The older client rewrote unrelated peer snapshots in the lockfile;
  normalize it with the repository-pinned client before accepting the dependency
  diff.
- Restoring the lockfile baseline and regenerating with pnpm 11.18.0 reduced the
  accepted lockfile diff to the 12 Lucide-specific lines. `pnpm peers check` still
  reports pre-existing `@napi-rs/wasm-runtime` expectations for alpha
  `@emnapi/core`/`@emnapi/runtime`; Lucide's React peer is satisfied and introduced
  no new peer warning.
- The pinned client then declined to run the format script because the current
  modules were linked by pnpm 11.9.0 and a non-interactive purge was not authorized.
  Avoid a broad reinstall: use the existing linked pnpm runtime for scripts and keep
  pnpm 11.18.0 as the final lockfile authority.
- Direct `vp fmt` passed all 132 files, but direct type checking found an unrelated
  Vite config type collision between `@vitejs/plugin-react` and the Vite Plus config
  type. The earlier 11.9.0 add changed module links before the lockfile was restored,
  so verify with the repository-managed task first and repair links from the accepted
  lockfile if the collision persists.

### 2026-07-30 focused-test finding

- The first focused DOM run showed that the new visible `Required` hint became part
  of the Title input's computed label (`Title Required`). Restore the stable `Title`
  accessible name explicitly while keeping the visual hint; no command behavior was
  involved.

### 2026-07-30 Slice 2 completion

- Added `lucide-react@1.27.0` as a package dependency with a 12-line isolated lockfile
  diff and satisfied React peer.
- The default menu now has task context, icon-backed actions, consumer commands
  between edit and destructive delete, compact hover/focus states, and explicit
  destructive treatment.
- The default editor now has a structured icon header, stable accessible field names,
  native local date-time controls with epoch round-trip conversion, a two-column
  desktop/one-column narrow schedule, styled validation, clear primary/secondary
  actions, pending feedback, and reduced-motion/forced-color handling.
- Focused customization coverage passed all 8 tests. `mise run ci` passed 132-file
  formatting, 121-file lint/type checking, 51 test files and all 248 tests, plus the
  four-artifact package build.
- The package artifact is 307.90 kB JavaScript (60.88 kB gzip), 20.38 kB CSS
  (3.53 kB gzip), and 40.07 kB declarations (6.83 kB gzip).
- The production playground build transformed 1,908 modules and emitted 408.63 kB
  JavaScript before the final live fixes.

### 2026-07-30 browser-gate environment note

- The first local dev-server start failed before serving with sandbox `EPERM` while
  binding `::1:5173`. Restart the same repository task with local-listener permission;
  this is not an application runtime or build failure.
- Chrome's selected playground tab retained a prior 150-pixel viewport emulation even
  after a window resize request. The menu still stayed within the fixed overlay and
  exposed all four labelled actions, but reset emulation explicitly before recording
  the intended desktop and narrow evidence.
- Desktop Chrome showed that a universal 1-millisecond input step made ordinary
  minute-aligned tasks display unnecessary seconds and milliseconds. Use minute
  precision for minute-aligned values and retain millisecond controls only for tasks
  that actually carry sub-minute precision.
- Chrome's issue panel reported that the editor form controls had no `id` or `name`
  even though their wrapping labels were accessible. Add stable `title`, `start`, and
  `end` names to satisfy browser form/autofill diagnostics without changing the
  React submit path.

### 2026-07-30 Slice 3 completion

- Chrome DevTools verified `/interactive` at explicit 1,440 × 900 and 560 × 900 light
  viewports.
- At desktop, the four-action menu measured 248 × 239.59 pixels at
  x=642.04..890.04 and y=592..831.59. Every item fit without overflow, Create held
  keyboard focus, Delete carried destructive state, all four Lucide SVGs rendered,
  and the fixed overlay covered the available 1,425 × 900 viewport area.
- The desktop editor measured 540 × 353.70 pixels at x=450..990 and
  y=273.15..626.84. Its backdrop covered the full 1,440 × 900 viewport, the schedule
  resolved to two 238-pixel columns, Title held initial focus, all inputs fit, and the
  body was scroll-locked.
- At 560 × 900, the editor became a bottom sheet at x=10..550 and y=480.41..890 with
  one 502-pixel schedule column and no page overflow. The menu collision-adjusted to
  x=289..537 and y=652.41..892, leaving the configured eight-pixel right/bottom safe
  area with no item overflow.
- The accessibility tree exposed only the labelled modal dialog while open, with
  Title, Start, End, Close, Cancel, and Save controls. Escape removed the dialog,
  restored `Work item 2` focus, unlocked body scrolling, and cleared all inert state.
- After adding stable form names, Chrome no longer reported the form-field issue.
  Remaining CSP, Shared Storage, MaxListeners, and ObjectMultiplex messages came from
  Chrome extensions/DevTools and match prior environment noise; no
  application-owned error or warning appeared.
- All 69 post-reload local/data/extension requests completed with status 200,
  including the Lucide dependency module.
- The final `mise run ci` passed 132-file formatting, 121-file lint/type checking, 51
  test files and all 248 tests, plus the package build. Final package output is
  307.90 kB JavaScript (60.88 kB gzip), 20.38 kB CSS (3.53 kB gzip), and 40.07 kB
  declarations (6.83 kB gzip).
- The final production playground build transformed 1,908 modules and emitted
  408.69 kB JavaScript (116.84 kB gzip) and 26.23 kB CSS (5.49 kB gzip).

## Next Slice

Resume Appendix Slice A1 of the item-properties, semantic-color, and progress plan.
