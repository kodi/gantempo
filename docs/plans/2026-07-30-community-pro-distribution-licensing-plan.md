# Community and Pro Distribution and Licensing Plan

Status: Active
Date: 2026-07-30
Owners: Cross-milestone product distribution

## Summary

Gantempo will use an open-core distribution model with one production-quality
Community package and one additive Pro package. Both packages are released from one
mixed-license monorepo, published publicly to npm at the same version, and composed
through the existing capability boundary. Pro activation is signed and offline. A
commercial entitlement permits perpetual use of package versions released during the
entitlement window; renewal purchases newer releases and support rather than keeping
an existing deployment alive.

This plan turns the accepted product direction into a resumable implementation path.
The durable contract is recorded in the
[Community and Pro distribution and licensing decision](../decisions/2026-07-30-community-pro-distribution-licensing.md).
This planning pass changes documentation only. It does not create a Pro package,
license validator, billing service, or release workflow.

## Decisions

- Keep one public, mixed-license monorepo.
- Publish `@gantempo/gantt` as the MIT Community package.
- Publish `@gantempo/gantt-pro` as the commercially licensed Pro package.
- Keep one Pro product and one Pro npm package at launch. Internal capabilities may
  remain separate modules or subpath exports without becoming separate products.
- Keep `@gantempo/gantt` as the React component and public model authority. Pro is an
  additive capability package, not a fork or replacement component.
- Publish Community and Pro from the same release with the same semantic version.
- Give Pro a strict Community compatibility declaration and repeat the check during
  capability initialization with an actionable diagnostic.
- Distribute both packages through the public npm registry. Do not require customers
  to authenticate to a private registry for the launch model.
- Validate signed commercial and evaluation entitlements offline. The commercial
  license value is public application configuration and is expected to appear in a
  browser bundle.
- Never require a production call-home or bind an entitlement to a domain, server,
  tenant, end user, or customer project data.
- Allow perpetual use of every Pro package version released on or before the
  commercial update-entitlement date. Expiry ends access to newer releases and
  support; it does not disable an already entitled package version.
- Keep Community usable when Pro is absent or rejected. Missing or invalid Pro
  activation must not mutate, delete, or stop Community from round-tripping document
  data.
- Publish through CI with npm trusted publishing and provenance when the registry and
  repository configuration support it.

## Scope

### In scope

- Source-repository visibility and per-package license boundaries.
- Community and Pro npm package relationships.
- The additive customer upgrade path.
- Version synchronization and compatibility failure behavior.
- Signed offline commercial and evaluation activation.
- Update-entitlement and subscription-expiry semantics.
- Customer-build and customer-deployment boundaries.
- Release verification, public npm publishing, and package provenance.
- Documentation and tests that prove the complete upgrade and expiry path.

### Out of scope

- Choosing a payment processor, merchant of record, customer portal, tax provider, or
  CRM.
- Final prices, developer-count rules, sales-assisted enterprise terms, or support
  service levels.
- Drafting the commercial EULA, trademark policy, or redistribution/OEM agreement;
  those require qualified legal review before publication.
- Selecting the signing algorithm, key custody system, license payload encoding, or
  operational rotation procedure before the activation implementation slice.
- Hosted exports, collaboration, or other future service-backed products.
- Implementing any package, entitlement, billing, or release behavior in this
  documentation slice.

## Current State

Observed on 2026-07-30:

- `packages/gantt/package.json` names `@gantempo/gantt`, keeps it private at version
  `0.0.0`, and exposes one React library facade plus its stylesheet.
- `pnpm-workspace.yaml` already reserves `pro/*` as a workspace location.
- No `pro/` package, license validator, entitlement issuer, public release workflow,
  mixed-license root notice, or per-package license files exist.
- The architecture already requires Community and Pro to share a model and install
  advanced behavior through capabilities.
- The competitor research already recommends MIT Community, offline validation,
  product/codebase licensing, unlimited deployments, and no production call-home.
- M2 change-kernel planning is concurrent work. This cross-milestone plan does not
  alter M2 status, scope, files, or next action.

## Behavior to Preserve

- Community owns the canonical document, codecs, commands, rendering, public React
  component, accessibility, virtualization, and extension boundary.
- Community never imports Pro.
- General records needed for compatibility can be parsed, validated, preserved, and
  serialized by Community even when their advanced interpretation requires Pro.
- Removing Pro from an application does not erase Pro-relevant records or make the
  Community package unusable.
- Pro behavior remains capability-driven rather than guarded by scattered
  edition-conditionals in model, command, layout, or renderer hot paths.
- Package imports remain SSR-safe and do not perform activation network requests at
  module scope or runtime.
- Customer applications own their data, persistence, authentication, billing, and
  deployment infrastructure.

## Implementation Shape

### Source and license boundary

The repository remains one public monorepo. The root must state that the repository
contains packages under different licenses. Each publishable package must carry its
own license file and matching package metadata:

```text
packages/gantt/       MIT
pro/gantt-pro/        Commercial
pro/* internals       Commercial unless explicitly designated otherwise
```

The Community license must not be written at a scope that accidentally grants MIT
rights to Pro sources. Commercial EULA, redistribution, OEM, and source-modification
terms require legal review before the first Pro release.

### Package and capability boundary

`@gantempo/gantt-pro` uses `@gantempo/gantt` as its Community runtime and public
contract. It must not bundle a second Gantt component or duplicate the canonical
model. One launch package may expose tree-shakeable named capabilities or stable
subpaths for scheduling, resources, analytics, audit, and import/export.

Installing Pro should require one new dependency plus activation and capability
registration. Existing Community component imports, document data, persistence
adapters, themes, and controlled/uncontrolled ownership remain valid.

### Version and release boundary

- Community and Pro use one semantic release version.
- Pro declares a strict supported Community range and reports an initialization error
  when the resolved versions are incompatible.
- CI tests Community alone and Community plus Pro before publishing either package.
- Package-content, declaration, license, install, activation, tree-shaking, SSR, and
  entitlement-version checks run against packed artifacts.
- A release publishes both artifacts from the same tagged source state. A partial
  publish must be detected and recovered without claiming the release complete.
- Public npm publishing should use short-lived OIDC credentials and provenance rather
  than a long-lived write token.

### Entitlement and activation boundary

A signed entitlement is verified locally with verification material embedded in the
Pro package. The signing authority remains outside published packages.

The durable commercial claims are:

- product or edition;
- update-entitlement end date;
- stable license identifier and any contractually required customer/account
  reference;
- payload or format version;
- signature.

The payload must not contain domains, servers, tenants, end-user counts, deployment
identifiers, or customer project data. A commercial key is intentionally public
configuration, not an npm credential or general-purpose secret.

Commercial entitlement is based on the Pro package release date:

- a package version released on or before the entitlement date remains activated;
- a package version released after the entitlement date requires renewal;
- an entitled version continues to run after the entitlement date;
- renewal changes update/support eligibility, not the validity of prior deployments.

Evaluation access uses a separately signed, explicitly expiring evaluation
entitlement. Missing, malformed, edition-mismatched, or ineligible entitlements
produce typed diagnostics. License failure may prevent Pro capability registration or
show documented evaluation UI, but it must leave the Community runtime and source
document intact.

### Deployment boundary

Gantempo publishes packages; customers deploy applications. Pro code is bundled into
the customer's browser, worker, or Node artifact by the customer's normal build. The
launch product does not dynamically deliver executable Pro code and does not require a
Gantempo licensing service during application startup or operation.

Future hosted services must define separate service entitlements and data-transfer
contracts rather than weakening the offline library contract.

## Cross-Slice Rules

- Do not begin a slice until its owning milestone and dependencies are active.
- Do not introduce a second React component, model, command path, or document codec
  for Pro.
- Do not use private-registry availability as runtime license enforcement.
- Do not make a commercial entitlement a secret that browser consumers are expected
  to hide.
- Do not let license failure corrupt, downgrade, migrate, or discard customer data.
- Do not publish either package until the combined packed-artifact gate passes.
- Do not claim an entitled-version or expiry behavior without a test using fixed
  release and entitlement dates.
- Any future move to private package distribution, separate source repositories,
  runtime call-home, domain binding, or multiple Pro products requires a new decision
  record and synchronized architecture and roadmap changes.

## Ordered Slices

### Slice 1: Formalize the durable contract

Status: `[x]` Done and verified

**Goal**

Record the accepted repository, package, activation, release, deployment, and expiry
contracts without changing runtime behavior.

**Why here**

Later Pro and release work need one stable commercial boundary before package
manifests, license code, or CI encode accidental policy.

**This slice should implement**

- Add this detailed plan.
- Add the focused distribution and licensing decision record.
- Update architecture package, capability, licensing, release, acceptance, and open
  decision sections.
- Link the decision and plan from the roadmap without changing M2 execution status.

**Expected output**

- `docs/plans/2026-07-30-community-pro-distribution-licensing-plan.md`
- `docs/decisions/2026-07-30-community-pro-distribution-licensing.md`
- synchronized `docs/ARCHITECTURE.md`
- synchronized `docs/ROADMAP.md`

**Verification**

- `git diff --check`
- explicit linked-file existence checks
- focused searches proving public packages, same-version release, offline validation,
  no call-home/domain binding, and prior-version continuity agree across all four
  documents
- repository documentation formatting check

**Dependencies**

- Accepted product direction from the 2026-07-30 exploration.

**Completed in this slice**

- Added the accepted decision and this cross-milestone implementation plan.
- Updated architecture package names, mixed-license source layout, additive capability
  boundary, public npm distribution, synchronized release, signed offline activation,
  non-destructive update entitlement, deployment ownership, acceptance criteria, and
  open decisions.
- Linked M6 and M7 to this plan and added the durable cross-milestone rules without
  changing M2 status or next action.

**Verification evidence**

- `vp check` passed formatting for all 44 files and found no lint warnings, lint
  errors, or type errors across 33 files.
- `git diff --check` passed.
- `test -f` passed for architecture, roadmap, this plan, and the decision record.
- Focused `rg -l` checks found the public mixed-license repository, same-version
  release, no-call-home activation, and prior-version continuity contracts across all
  four documents.

### Slice 2: Establish source and package license boundaries

Status: `[ ]` Not started

**Goal**

Make the repository and packed artifacts unambiguous about Community and Pro rights
before the first Pro source is added.

**This slice should implement**

- Obtain qualified review of the commercial EULA and redistribution/OEM terms.
- Add the mixed-license root notice and package-specific licenses.
- Add package metadata and automated checks that prevent license-file or metadata
  drift.
- Confirm the repository is ready for the intended public visibility.

**Verification**

- Legal approval is recorded outside the repository as appropriate.
- Packed Community and Pro fixtures contain only their intended license files and
  metadata.
- A repository check fails on missing or mismatched package licenses.

**Dependencies**

- Slice 1.
- Approval to begin M6/M7 distribution implementation.

### Slice 3: Implement compatibility and offline activation

Status: `[ ]` Not started

**Goal**

Create the small package-neutral contracts and Pro-owned validator needed to register
paid capabilities safely.

**This slice should implement**

- Define the machine-readable capability and package compatibility manifests.
- Add strict declared and runtime Community/Pro version checks.
- Add signed commercial and evaluation entitlement parsing and offline verification.
- Add typed diagnostics and non-destructive failure behavior.
- Add fixed-date tests for entitled, post-entitlement, evaluation-expired, malformed,
  wrong-edition, and incompatible-version cases.

**Verification**

- Focused deterministic activation and compatibility tests in browser-like, Node, SSR,
  and worker-safe environments.
- Tests prove validation performs no network requests and contains no signing secret.
- Tests prove license failure preserves the Community document and runtime.

**Dependencies**

- Slice 2.
- Stable capability initialization boundary from the owning architecture milestone.

### Slice 4: Package the first additive Pro product

Status: `[ ]` Not started

**Goal**

Ship advanced capabilities through one commercial package without replacing or
duplicating Community.

**This slice should implement**

- Add `@gantempo/gantt-pro` with a strict Community compatibility declaration.
- Expose one launch product with tree-shakeable capability entry points.
- Keep the existing `@gantempo/gantt` component and document API unchanged.
- Add Community-only, evaluation, licensed-upgrade, Pro-removal, and incompatible
  version fixtures.

**Verification**

- Packed-install tests prove one Community runtime and no duplicated component/model.
- The same Community application upgrades by adding Pro activation and capability
  registration.
- Removing Pro preserves document round trips and produces explicit missing-capability
  diagnostics where appropriate.

**Dependencies**

- Slice 3.
- Verified M5 Community product boundary and active M6 implementation plan.

### Slice 5: Publish synchronized public npm artifacts

Status: `[ ]` Not started

**Goal**

Create a reproducible release that publishes Community and Pro from one source state.

**This slice should implement**

- Add combined prepublish and packed-artifact gates.
- Configure public scoped-package visibility.
- Configure npm trusted publishing, protected release approval, and provenance.
- Publish the same semantic version for Community and Pro.
- Detect and document recovery from a partial two-package release.

**Verification**

- A release candidate installs from packed artifacts without repository-only files.
- The public registry reports matching package versions, licenses, dependency
  contracts, and provenance.
- A clean consumer fixture installs, builds, activates, and runs without a private
  registry or runtime licensing network request.

**Dependencies**

- Slice 4.
- Active M7 release plan and npm organization/repository configuration.

### Slice 6: Prove entitlement continuity and customer deployment

Status: `[ ]` Not started

**Goal**

Prove that the commercial lifecycle remains predictable after update entitlement ends.

**This slice should implement**

- Add an entitled older-version deployment fixture.
- Prove a post-entitlement package is rejected until renewal.
- Prove the entitled older package continues to build and run offline.
- Document customer CI, browser, worker, Node, SSR, renewal, rollback, and artifact
  retention behavior.

**Verification**

- Fixed-date black-box tests cover both sides of the entitlement boundary.
- A deployed entitled artifact starts with the licensing endpoint unavailable because
  no such runtime dependency exists.
- Final M7 documentation and release acceptance criteria link the evidence.

**Dependencies**

- Slice 5.

## Final Verification

- Community and Pro packed artifacts have the same version and the intended licenses.
- Community works alone and remains the only React component/model authority.
- Adding Pro requires no Community import replacement or document migration.
- Offline activation accepts exactly the package releases covered by the signed
  entitlement.
- Previously entitled versions continue to build and run after entitlement expiry.
- Missing or invalid activation cannot mutate or discard source documents.
- Browser, worker, Node, and SSR paths perform no activation call-home.
- Public npm metadata and provenance match the tagged source release.
- The full repository gate for the owning implementation milestone passes.

## Working Notes

### 2026-07-30 — Documentation contract

- The current repository already reserves `pro/*`, so this decision refines the
  intended distribution rather than forcing an immediate workspace split.
- Public mixed-license monorepos and private commercial registries are both established
  market patterns. Gantempo chooses the public-package model to minimize install,
  trial, CI, Docker, hosted-builder, and customer-deployment friction.
- A browser-delivered commercial package cannot make its license value secret. The
  entitlement is a signed compliance token; registry credentials and signing keys are
  separate secrets that never enter customer bundles.
- Slice 1 passed `vp check`, `git diff --check`, explicit linked-file existence checks,
  and focused four-document contract searches.
- No runtime, package, billing, registry, or browser behavior is implemented or
  verified by this slice.

## Next Slice

Do not begin runtime work from this plan while M2 is active. When the roadmap reaches
the first approved Pro packaging work, start Slice 2 by reviewing the intended public
repository boundary and obtaining qualified commercial-license terms, then add
package-specific license metadata and packed-artifact checks before any Pro source is
published.
