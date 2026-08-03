# Obstacle-Aware Dependency Connectors Plan

Status: Complete
Date: 2026-08-03
Owner: Post-M5 dependency-rendering correction

## Summary

Make dependency connectors remain continuous and legible when a target task begins
earlier than its source endpoint. Preserve the document schedules exactly as supplied:
this is a routing and rendering correction, not automatic scheduling.

## Decisions

- Keep the standard orthogonal dependency style and semantic start/finish ports.
- Use the direct midpoint corridor only when opposing endpoint stubs have horizontal
  clearance.
- When those stubs cross, route through the empty gutter between the two task
  rectangles with separate source and target vertical legs.
- Render each connector as one SVG path plus one matching transparent hit path so
  elbows are visually continuous and retain the existing interaction target.
- Keep routing React-free and private. Do not change the public document, dependency,
  command, or scheduling contracts.

## Scope

In scope:

- private dependency endpoint geometry;
- deterministic direct and inter-row routing for all four dependency types and RTL;
- continuous SVG path rendering, marker placement, and hit targeting;
- focused geometry/DOM regression coverage and live proof on the simple project page.

Out of scope:

- moving task dates or interpreting dependency constraints as scheduling rules;
- persisted route geometry, user-authored waypoints, or a public routing API;
- general graph-edge crossing minimization or automatic critical-path behavior;
- changing the example data.

## Behavior To Preserve

- Dependency identity, diagnostics, selection, keyboard activation, editing, clipping,
  hidden-endpoint continuation markers, localization, RTL mirroring, and SSR remain
  unchanged.
- Connectors stay behind task bars and never become a second source of schedule truth.
- Virtual scrolling clips a stable full route rather than recomputing its identity.

## Slice 1: Obstacle-aware route and continuous renderer

Status: `[x]` Done

Goal: Earlier-target and horizontally overlapping dependencies travel through the
inter-row gutter without disappearing behind either task bar.

This slice should implement:

- add task top/bottom bounds to private dependency route endpoints;
- retain the direct route when opposing stubs have space;
- add a deterministic inter-row detour when opposing stubs cross;
- render route points through one visible SVG path and one transparent hit path;
- add focused kernel, scene, and DOM assertions for the earlier-target adjacent-row
  case, all dependency types, clipping, and RTL;
- inspect `/examples/simple-project` at desktop and narrow widths for continuity,
  arrow direction, accessibility, and console state.

Expected output:

- a React-free obstacle-aware routing kernel;
- continuous dependency path DOM with unchanged semantic hooks;
- exact automated and browser evidence recorded below.

Dependencies: Completed M5 dependency routing and the private renderer boundary.

Verification:

- `vp test packages/gantt/src/layout/route-dependencies.test.ts packages/gantt/src/render/scene-dependencies.test.ts packages/gantt/src/react/Gantt.project.dom.test.tsx`
- `mise run ci`
- `mise run build-playground`
- live `/examples/simple-project` inspection at desktop and 560x900
- `git diff --check`

## Working Notes

- 2026-08-03: Live inspection showed both simple-project finish-to-start links are
  continuous in scene geometry but partially hidden behind task bars. The current
  opposing-port midpoint falls inside the overlapping horizontal task extents, so
  adjacent rows expose detached-looking source, vertical, and arrow segments.
- 2026-08-03: The example dates are intentional input and must remain unchanged.
- 2026-08-03: The private endpoint now carries task top/bottom bounds. Opposing ports
  with crossed stubs route through the midpoint of the real inter-row gutter; direct
  and same-side routes retain their existing corridor behavior. Horizontal clearance
  is resolved in pixels from the measured timeline width so narrow layouts retain a
  usable source stub and final arrow segment.
- 2026-08-03: The React renderer now emits one orthogonal `M/H/V` SVG path and one
  matching transparent hit path per dependency. Semantic labels, marker placement,
  stable data hooks, selection, editing, clipping, and continuation markers remain
  unchanged.
- 2026-08-03: Focused verification passed 58 tests across
  `route-dependencies.test.ts`, `scene-dependencies.test.ts`,
  `Gantt.project.dom.test.tsx`, and `runtime.test.ts`. `mise run ci` passed 101 test
  files / 521 tests, formatting for 254 files, lint/types for 241 files, and the
  214-file package build. `mise run build-playground` passed with 2,024 transformed
  modules; the existing large-chunk advisory remains non-blocking. `git diff --check`
  passed.
- 2026-08-03: Live `/examples/simple-project` inspection at 1440x1000 and 560x900
  verified both earlier-target connectors as continuous six-point routes with one
  visible path, one hit path, correctly directed arrowheads, no page-level narrow
  overflow, and no console warnings or errors. After the pixel-clearance and `H/V`
  command refinement, the browser refused the final localhost reload under its URL
  policy; that exact reload was not retried or worked around. Final numerical route,
  responsive-width, DOM-path, accessibility, full-CI, and production-build checks
  passed on the completed code.
- 2026-08-03: After the development server restarted, final-code browser verification
  resolved the prior reload limit. At 1440x1000 and 560x900, both dependencies render
  one continuous `M/H/V` path plus one hit path, preserve their accessible labels and
  arrow markers, and retain 12 px / 16 px horizontal clearance at both widths. Page
  width matched viewport width (1425/1425 desktop and 545/545 narrow), the console had
  no warnings or errors, and the temporary viewport override was reset.

## Next Slice

No connector follow-up is required. Resume the independent playground Tailwind
migration, or create the M6 detailed plan when that work is ready to begin.
