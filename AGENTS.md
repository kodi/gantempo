# Repository Instructions

## Commit messages

- This repository uses **Conventional Commits**.
- Always format every commit subject as a Conventional Commit:
  `<type>[optional scope][optional !]: <description>`.

## Documentation governance

### Architecture

- `docs/ARCHITECTURE.md` owns the durable target state: system boundaries,
  architectural principles, canonical contracts, long-lived product commitments, and
  release acceptance criteria.
- Update architecture when implementation evidence changes the intended target,
  invalidates a principle or contract, or resolves an architecture-level open
  decision. Do not use architecture as a progress log or task checklist.

### Roadmap

- `docs/ROADMAP.md` owns execution order: current baseline, milestone status,
  dependencies, milestone outcomes, exit conditions, current focus, and links to
  detailed plans and completion evidence.
- Keep the roadmap high level. File-level tasks, command output, detailed findings,
  and handoff notes belong in the active plan.

### Detailed plans and decisions

- Every repository change must belong to an active
  `docs/plans/YYYY-MM-DD-<topic>-plan.md` before implementation begins.
- Detailed plans own scope, exclusions, decisions, ordered slices, exact files or
  systems involved, per-slice verification, working notes, deviations, and the
  actionable next slice.
- This does not require a new plan file for every commit. Related changes may remain
  in one active plan, but every change must be recorded in that plan.
- Cross-plan decisions with durable architectural consequences belong in
  `docs/decisions/` and must be linked from the architecture, roadmap, and active plan
  where relevant.

### Mandatory synchronization

- Every repository change and every discovered deviation must update both the
  active detailed plan and `docs/ROADMAP.md` in the same change set.
- Record a deviation in the active plan as soon as it is discovered. Update the
  roadmap even when the deviation does not change milestone order or scope; a compact
  roadmap change-log entry is sufficient in that case.
- If a deviation changes the intended system boundary, public contract, architectural
  principle, or release acceptance criteria, update `docs/ARCHITECTURE.md` and add or
  update a decision record in the same change set.
- Before marking a slice or milestone done, record the exact verification evidence in
  the active plan and update the roadmap status and completion evidence. Never mark
  unverified work complete.

## Browser verification

- Prefer the installed Chrome DevTools MCP for local playground inspection, responsive
  screenshots, DOM and computed-style checks, accessibility-tree inspection, console
  review, and network verification.
- Before reporting that browser verification is unavailable because the built-in
  Browser has no connected surface, check Chrome DevTools MCP with `list_pages` and
  use it when the target local page is reachable there.
- Select or navigate only the page in scope. Do not inspect unrelated Chrome tabs,
  profiles, history, storage, or private page contents.
- Use the built-in Browser instead when the user explicitly requests it, Chrome
  DevTools MCP is unavailable, or Chrome DevTools lacks a capability the task needs.
- For plan-driven visual gates, record the inspected routes, viewport sizes,
  accessibility findings, console state, and any live issues fixed in the plan.
