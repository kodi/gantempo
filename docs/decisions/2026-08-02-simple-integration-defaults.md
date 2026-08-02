# Simple Integration Defaults

Status: Accepted
Date: 2026-08-02

## Context

The first API-loaded playground example exposed a poor beginner contract. A consumer
had to reproduce loading, validation, controlled acknowledgement, dirty tracking,
save lifecycle, race handling, and semantic appearance configuration before the
chart itself became visible. Those responsibilities are valid in advanced
applications, but requiring their boilerplate in the first example makes the basic
product feel harder to integrate than it is.

## Decision

### Provide a package-owned React document controller

Export `useGanttDocument(options)` from the public package facade. Its loader accepts
an `AbortSignal` and returns unknown API data. The hook validates that value with
`parseGanttDocument`, exposes a controlled `ganttProps` binding when ready, and owns
the default loading, load-error, ready, saving, saved, and save-error lifecycle.

The binding acknowledges `GanttDocumentChange.document` immediately. Explicit
`save()` passes the current canonical document to the application-supplied saver.
Edits made during an in-flight Save remain dirty. `reload()` starts a new abortable
load. The hook does not require consumers to memoize adapter functions.

The hook does not render product UI or perform transport itself. It exposes state and
actions so applications can replace loading, error, status, and Save presentation.
It also does not add autosave, retries, rollback, revision reconciliation, or conflict
policy.

### Ship overridable semantic appearance defaults

Core registers four portable IDs by default: `accent`, `neutral`, `success`, and
`warning`. Their tokens use the package theme variables and are available to
persisted task/lane appearance and default properties surfaces without per-instance
configuration.

`appearanceVariants` becomes an additive override list. New IDs are appended. A
valid option whose ID matches a built-in replaces its label and merges its supplied
tokens over the built-in tokens. Unknown persisted IDs retain the existing
diagnosed, deterministic fallback.

### Keep persistence and product semantics bounded

The hook owns a reusable React state machine, not backend storage. Applications still
own endpoints, authentication, request bodies, revisions, retry-safe IDs, and error
presentation. Built-in variants are presentation vocabulary, not workflow state or
business rules; documents persist only the semantic ID.

## Consequences

- The smallest credible API integration uses one hook rather than duplicating a
  controlled persistence state machine.
- Consumers get useful semantic appearance choices without declaring token maps.
- Existing custom IDs remain source-compatible; same-ID options intentionally become
  overrides instead of being discarded after a built-in registration.
- The public facade gains durable hook and default-variant exports that require SSR,
  type, package, and fresh-consumer verification.
- Advanced persistence stays explicit and belongs in later examples or adapters.

## Links

- [Architecture](../ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md)
- [Implementation plan](../plans/2026-08-02-simple-integration-defaults-plan.md)
- [Prior example plan](../plans/2026-08-02-api-loaded-simple-project-example-plan.md)
