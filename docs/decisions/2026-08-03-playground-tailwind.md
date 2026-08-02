# Playground Tailwind Adoption

Status: Accepted
Date: 2026-08-03

## Context

The playground and examples accumulated a large global BEM stylesheet. This makes
small example components depend on opaque app-specific class names, increases the
chance of selector leakage into the chart, and makes copied React examples feel unlike
the applications most users are building.

## Decision

`apps/playground` standardizes on Tailwind CSS v4 for application chrome and example
presentation. Migration is incremental and uses the official Vite integration.
Preflight stays disabled while legacy routes coexist with utilities.

`@gantempo/gantt` remains design-system-neutral. Its required renderer CSS, semantic
custom properties, stable `data-gt-*` parts, typed class hooks, and slots do not depend
on Tailwind. Consumers continue to use the package without installing Tailwind.

The migration writes utilities directly in JSX and does not recreate the BEM system
through `@apply`. Repeated application structures may become local React components
only after repetition is demonstrated; no shared UI package or shadcn dependency is
introduced by this decision.

## Consequences

- examples become more familiar and copyable for Tailwind-based React applications;
- app presentation becomes locally inspectable instead of relying on distant global
  selectors;
- the migration needs route-by-route visual/accessibility verification because
  utilities can preserve behavior only when responsive and state variants are mapped;
- package styling remains portable to non-Tailwind consumers.
