# React Query Document Integration

Status: Accepted
Date: 2026-08-02
Supersedes: The network lifecycle portion of
[Simple Integration Defaults](2026-08-02-simple-integration-defaults.md)

## Context

The first package-owned document hook combined two independent responsibilities:
editable chart draft state and remote request state. That made a small example
possible, but it also duplicated caching, cancellation, retry, mutation, and
invalidation behavior already provided by TanStack Query in many React applications.
It further left the public name `useGanttDocument` ambiguous about whether the hook
owned a local draft, a remote resource, or both.

## Decision

### Keep the core hook draft-only

The root package exports `useGanttDocumentDraft`. It receives a canonical source
document and owns the local controlled draft, immediate change acknowledgement,
dirty state, saved-baseline acknowledgement, reset, and detection of a newer source
while local edits are dirty.

The hook does not fetch, retry, cache, mutate, invalidate, or render lifecycle UI.
The pre-release `useGanttDocument` network controller and its lifecycle status types
are removed rather than deprecated.

### Provide an optional TanStack Query entry

`@gantempo/gantt/react-query` exports `useGanttDocumentQuery`. Consumers that import
this entry install `@tanstack/react-query`; the package root has no TanStack runtime
dependency.

The adapter parses unknown query results into the canonical model, connects query
data to `useGanttDocumentDraft`, saves the current draft through a mutation, updates
the matching query cache after success, and exposes native query and mutation
results. It consumes the query-provided `AbortSignal` through the application query
function and preserves application or QueryClient retry, stale-time, refetch, and
invalidation configuration.

While the draft is dirty, a changed query result is reported as a remote update and
does not replace local edits. Reset explicitly adopts the latest query document.
Edits made during a pending mutation remain dirty when that mutation finishes.

### Keep server policy application-owned

GanTempo does not define query keys, endpoints, authentication, retries, stale time,
optimistic backend behavior, revisions, conflicts, rollback, or retry-safe operation
IDs. The optional adapter coordinates server state with an editable document; it does
not turn the chart model into a storage protocol.

## Consequences

- Core consumers do not pay for or configure TanStack Query.
- React Query consumers get standard cancellation, caching, retry, mutation, and
  invalidation surfaces without rebuilding chart draft coordination.
- The public names communicate ownership: `Draft` is local editable state and
  `Query` is the optional server-state integration.
- The simple example gains a production-shaped request lifecycle while remaining a
  small chart integration.
- The optional export requires separate facade, peer-missing, SSR, type, package, and
  fresh-consumer verification.

## Links

- [Architecture](../ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md)
- [Implementation plan](../plans/2026-08-02-react-query-document-integration-plan.md)
- [Prior integration decision](2026-08-02-simple-integration-defaults.md)
