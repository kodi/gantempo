# Roadmap and Documentation Governance Plan

## Summary

Create the repository's living execution roadmap and define durable ownership and
synchronization rules for architecture, roadmap, detailed plans, decisions,
deviations, and verification evidence.

This plan bootstraps the governance rule it introduces. Future new features and
substantial repository changes must belong to their own active plan or an existing
active plan with matching scope; minor, obvious, and code-inferable work is exempt.

## Decisions

- `docs/ARCHITECTURE.md` owns the durable target architecture and is not a progress
  tracker.
- `docs/ROADMAP.md` owns milestone order, current focus, status, dependencies, exit
  conditions, and links to plans and evidence.
- Detailed plans under `docs/plans/` own implementation scope, slices, findings,
  deviations, verification, and handoff state.
- Cross-plan decisions with durable consequences live under `docs/decisions/`.
- New features and substantial changes or deviations update their active plan and the
  roadmap in the same change set.
- Minor fixes, cosmetic polish, obvious improvements, code-inferable details, and
  straightforward continuation of already documented work do not require standalone
  plan or roadmap updates.

## Scope

### In scope

- Create the initial roadmap from the current architecture and verified read-only
  chart baseline.
- Record the document-ownership and mandatory synchronization rules in `AGENTS.md`.
- Identify the document kernel as the next milestone without drafting its detailed
  implementation plan.

### Out of scope

- Changing `docs/ARCHITECTURE.md`.
- Planning or implementing the document kernel.
- Changing application or package behavior.

## Implementation Slices

### Slice 1: Create the living roadmap

Status: `[x]` Done

- Record M0 as the verified read-only chart baseline.
- Map architecture Slices 1–6 into dependency-ordered execution milestones.
- Define M1 as the current focus with a measurable exit condition.
- Add cross-milestone rules, a decision queue, and a compact change log.

### Slice 2: Add repository documentation governance

Status: `[x]` Done

- Define what belongs in architecture, roadmap, detailed plans, and decision records.
- Require every repository change and deviation to update its active plan and roadmap.
- Require architecture and decision-record updates when a deviation changes the
  intended target boundary or contract.
- Require exact verification evidence before marking work done.

### Slice 3: Name and require the commit-message convention

Status: `[x]` Done

- Record Conventional Commits as the repository's commit-message convention in
  `AGENTS.md`.
- Require all repository commits to follow the convention.
- Verify the policy wording and documentation synchronization without changing
  application behavior.

### Slice 4: Make documentation governance proportional

Status: `[x]` Done

- Limit mandatory plan and roadmap synchronization to new features, substantial
  changes, and substantial deviations.
- Define representative substantial changes without trying to enumerate every case.
- Exempt minor fixes, cosmetic or interaction polish, obvious improvements,
  code-inferable implementation details, and straightforward continuation of
  documented work.
- Preserve synchronization when work materially changes status, scope, evidence,
  decisions, deviations, or the actionable next step.

## Verification

- `git diff --check`
- Confirm `docs/ROADMAP.md`, this plan, and all locally linked repository documents
  exist.
- Read the final roadmap and `AGENTS.md` together and confirm their ownership and
  synchronization rules agree.

Verification passed on 2026-07-30:

- `git diff --check`
- explicit existence checks for `docs/ARCHITECTURE.md`, the completed M0 plan, and
  this governance plan
- a focused cross-document search confirming that `AGENTS.md`, `docs/ROADMAP.md`, and
  this plan agree on architecture, roadmap, plan, decision-record, and mandatory
  synchronization ownership

Slice 3 verification passed on 2026-07-30:

- `git diff --check`
- `rg -n 'Conventional Commits|every commit|Slice 3|commit-message convention'
  AGENTS.md docs/ROADMAP.md
  docs/plans/2026-07-30-roadmap-documentation-governance-plan.md`
- `git log -n 30 --format=%s` confirmed that recent history uses Conventional Commits
  subjects, including scoped subjects.

Slice 4 verification passed on 2026-07-31:

- `git diff --check`
- a focused search confirmed the former every-change rule is replaced consistently
  in `AGENTS.md`, `docs/ROADMAP.md`, and this plan
- a cross-document read confirmed that all three documents require synchronization
  for new features and substantial work while exempting minor, obvious,
  code-inferable, and already documented continuation work

## Working Notes

### 2026-07-30 — Governance bootstrap

- The repository previously had architecture, theming, and one completed
  implementation plan, but no living roadmap.
- M0 is already proven by the completed simplest-chart-primitives plan.
- The roadmap intentionally does not create speculative detailed plans for milestones
  after M1.

### 2026-07-30 — Commit-message convention follow-up

- Recent repository history uses Conventional Commits subjects such as `feat:`,
  `docs:`, and scoped `chore(repo):`.
- Slice 3 records the convention by name and makes it mandatory for future commits.

### 2026-07-31 — Proportional-governance refinement

- Requiring documentation churn for trivial changes made plans and the roadmap less
  useful as records of meaningful execution and decisions.
- Slice 4 narrows the rule to work of substance while explicitly trusting code and
  tests to explain minor and obvious implementation details.
- This governance-policy change is itself substantial, so it is synchronized here
  and in the roadmap.

## Progress

- [x] Slice 1: Create the living roadmap
- [x] Slice 2: Add repository documentation governance
- [x] Verification
- [x] Slice 3: Name and require the commit-message convention
- [x] Slice 4: Make documentation governance proportional

## Next Slice

No further documentation-governance slice is active. Apply the proportional rule to
future work and revisit it only if observed agent behavior exposes a material
ambiguity.
