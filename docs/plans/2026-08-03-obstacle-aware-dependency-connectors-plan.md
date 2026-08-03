# Obstacle-Aware Dependency Connectors Plan

Status: Active
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

Status: `[-]` In progress

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

## Next Slice

Complete Slice 1 in `packages/gantt/src/layout/route-dependencies.ts`, project the
task bounds from `packages/gantt/src/render/scene-pipeline.ts`, update
`packages/gantt/src/react/renderer/DependencyItem.tsx`, then run the focused gate
before the full repository and live-browser checks.
