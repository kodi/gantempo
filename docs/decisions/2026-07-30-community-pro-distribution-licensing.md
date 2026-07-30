# Decision: Community and Pro Distribution and Licensing

Status: Accepted
Date: 2026-07-30
Owners: Cross-milestone product distribution

## Context

Gantempo needs a Community edition that developers can adopt without procurement and a
paid edition that funds advanced scheduling, resource planning, export, integration,
and support work. The upgrade must preserve the same document, React component, and
application architecture. Customers must also be able to build and run behind
firewalls or in environments where a third-party licensing service is unavailable.

The architectural capability registry already separates advanced behavior from the
Community model and renderer. The unresolved decisions were:

- whether Community and Pro share a source repository;
- whether paid behavior is a feature flag, replacement library, or additive package;
- whether Pro is public on npm or gated behind a private registry;
- how Community/Pro versions remain compatible;
- whether a license requires runtime network access or deployment identifiers;
- what happens to a deployed application when a subscription ends;
- whether launch begins with one Pro product or several separately purchased modules.

This decision is implemented through the
[Community and Pro distribution and licensing plan](../plans/2026-07-30-community-pro-distribution-licensing-plan.md).

## Decision

### Use one public mixed-license monorepo

Community and Pro sources remain in the same public monorepo so shared contracts,
combined tests, synchronized releases, fixes, and review remain atomic. Repository
visibility and package licensing are independent concerns.

The repository root must identify the mixed-license layout. Each publishable package
must carry its own license file and matching package metadata:

- `@gantempo/gantt` and its Community-owned sources use MIT;
- `@gantempo/gantt-pro` and Pro-owned sources use the commercial license;
- shared tooling is classified explicitly rather than inheriting an ambiguous root
  grant.

Commercial EULA, modification, redistribution, OEM, trademark, and source-use terms
must receive qualified legal review before the first public Pro release.

### Publish two public npm packages

The initial public installation surface contains:

- `@gantempo/gantt`, the MIT Community package;
- `@gantempo/gantt-pro`, one commercially licensed Pro product.

Both packages are publicly downloadable from the normal npm registry. Gantempo will
not require a private registry, customer npm login, or download token for the launch
model.

One public Pro package may expose tree-shakeable named capabilities or subpath exports
for scheduling, resources, analytics, audit, and import/export. Those are packaging
and bundle-size boundaries, not separate launch products or licenses. Splitting them
into separately purchased products requires a later decision.

### Keep Pro additive

`@gantempo/gantt` remains the authority for:

- the public React component and hooks;
- the canonical document and codec;
- command and patch contracts;
- renderers, accessibility, virtualization, themes, and extension APIs.

`@gantempo/gantt-pro` imports the supported Community boundary and registers advanced
commands, validators, queries, render layers, UI contributions, exporters, workers,
or adapters as capabilities. Community never imports Pro. Pro does not ship a fork,
replacement, or second copy of the Gantt component or canonical model.

A customer upgrades by adding the Pro dependency, installing a license value, and
registering Pro capabilities. Existing Community component imports, document data,
persistence integration, themes, and state ownership remain valid.

Community must continue to parse, validate, preserve, and serialize general canonical
records needed by the shared model even when an advanced calculation or view requires
Pro. Removing or rejecting Pro cannot silently delete or rewrite those records.

### Release Community and Pro together

Community and Pro:

- use the same semantic version;
- are built and tested from the same tagged source state;
- declare a strict compatible relationship;
- repeat the compatibility check during capability initialization;
- return an actionable diagnostic before registration when versions are incompatible.

CI must test Community by itself and Community plus Pro before either artifact is
published. Packed-artifact tests own package contents, declarations, licenses,
installation, SSR safety, tree shaking, activation, compatibility, and upgrade
behavior. A partial two-package publish is an incomplete release and requires a
documented forward-recovery path.

Publishing should use npm trusted publishing with short-lived OIDC credentials and
package provenance when supported. Long-lived npm write tokens are not the preferred
release authority.

### Validate signed entitlements offline

Pro activation uses a signed entitlement verified locally. Verification material may
ship in the Pro package; signing material never does.

A commercial entitlement contains only claims needed to determine product and update
eligibility:

- entitlement payload version;
- product or edition;
- stable license identifier and any contractually required customer/account
  reference;
- update-entitlement end date;
- signature.

It must not contain or bind to:

- domains;
- servers;
- tenants;
- end-user counts;
- deployment identifiers;
- customer task, resource, schedule, or project data.

Validation performs no production call-home. The commercial license value is public
application configuration and may be present in source or a browser bundle. It is not
an npm token, signing key, password, or other secret.

Evaluation uses a separately signed entitlement with an explicit expiry. Missing,
malformed, expired-evaluation, wrong-product, post-entitlement-version, or
incompatible-package failures produce stable diagnostics. Pro may decline capability
registration or render documented evaluation UI, but it must not damage the
Community runtime or source document.

### Make update entitlement non-destructive

Commercial entitlement applies to package releases, not to the wall-clock lifetime of
a deployed application:

- a Pro version released on or before the update-entitlement date remains licensed;
- that version continues to build and run after the entitlement date;
- versions released after the entitlement date require renewal;
- renewal provides access to newer releases and support;
- expiry does not disable or degrade an already entitled production deployment.

The launch license is therefore perpetual for entitled package versions with a
time-bounded update and support window. Evaluation entitlements may expire completely;
commercial version entitlements do not.

### Keep customer deployment independent

Gantempo deploys package and documentation releases. Customers bundle Community and
Pro into their own browser, worker, SSR, or Node artifacts and deploy those artifacts
through their normal infrastructure.

The launch library does not:

- download executable Pro code at runtime;
- require Gantempo infrastructure during application startup or use;
- proxy customer document data through Gantempo;
- own customer authentication, persistence, billing, or deployment.

Future hosted services use separate service contracts and entitlements rather than
changing this offline library guarantee.

## Feature Boundary

Community is a complete production library, not an evaluation shell. It includes the
public model, codec, commands, basic scheduling and dependencies, CRUD and interaction,
rendering, virtualization, theming, localization, accessibility, SSR, customization,
and local undo/redo.

Pro monetizes advanced domain intelligence and costly workflows:

- working calendars, shifts, exceptions, and working-time arithmetic;
- automatic scheduling, lag/lead, advanced constraints, and forward/backward planning;
- critical path, slack, baselines, variance, and rollups;
- resource capacity, utilization, workload, and leveling;
- advanced split-task, grouping, WBS, and cross-project behavior;
- persistent audit history;
- advanced import/export and supported persistence integrations;
- priority support and later enterprise/OEM offerings.

Basic performance, accessibility, API access, security, model fidelity, and data
portability are never artificial Pro restrictions.

## Market Evidence

Two distribution patterns are established for commercial TypeScript UI libraries:

- [MUI X](https://mui.com/x/introduction/licensing/) and
  [AG Grid](https://www.ag-grid.com/react-data-grid/installation/) publish separate
  Community and commercial packages and use browser-compatible license values. AG
  Grid also demonstrates a
  [public mixed-license monorepo](https://github.com/ag-grid/ag-grid/blob/latest/LICENSE.txt).
- [SVAR React Gantt](https://docs.svar.dev/react/gantt/getting-started/installation/)
  and [DHTMLX Gantt](https://docs.dhtmlx.com/gantt/guides/installation/) use private
  registries for commercial packages.

Both are viable. Gantempo chooses public Pro distribution because it removes registry
credentials from customer CI, Docker, hosted builders, trials, and routine upgrades.
JavaScript delivered to a customer is inspectable regardless, so private distribution
would add operational friction without creating a strong code-secrecy boundary.

[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) is the preferred
release mechanism because it replaces long-lived publish tokens with short-lived OIDC
credentials and can attach provenance to eligible public packages.

## Alternatives Considered

### One package with scattered edition checks

Rejected. It ships paid code and conditional branches through Community hot paths,
makes tree shaking and license boundaries harder to reason about, and conflicts with
the capability architecture.

### A Pro superset that replaces Community imports

Rejected. A replacement component creates duplicate public APIs, increases migration
work, and makes Community/Pro divergence more likely. The additive package produces a
smaller, reversible upgrade.

### A private Pro registry

Rejected for launch. It provides download access control but requires customer
registry configuration and secret management in every developer, CI, Docker, and
hosted-build environment. Reconsideration requires evidence that access control is
worth that customer and operational cost.

### Separate public Community and private Pro repositories

Rejected for launch. It hides Pro source from anonymous repository visitors but makes
atomic contract changes, combined tests, review, releases, and issue diagnosis more
expensive. It does not prevent paying customers from inspecting delivered JavaScript.

### Runtime license service or domain-bound keys

Rejected. A production call-home adds availability, privacy, offline, SSR, and
incident-response risks. Domain, tenant, server, and user binding also conflicts with
the product/codebase licensing commitment.

### Several separately purchased Pro packages

Rejected for launch. One product is easier to explain, buy, version, support, and
release. Internal capability modules and subpath exports preserve technical
modularity; future commercial splitting requires demonstrated customer demand and a
new decision.

## Consequences

- The Community-to-Pro upgrade is small and reversible.
- One repository and one version line simplify compatibility and combined testing.
- Customers can evaluate, install, build, cache, and deploy without private-registry
  credentials or licensing-service availability.
- Commercial source is publicly readable, so Gantempo relies on contract compliance,
  signed activation, evaluation UX, product quality, updates, and support rather than
  code secrecy.
- Mixed licensing requires precise root and package notices plus legal review.
- A two-package release needs explicit partial-publish recovery.
- License verification must treat package release dates and entitlement dates
  deterministically rather than relying on an application deployment date.
- Gantempo must preserve old entitled artifacts or document customer artifact
  retention so perpetual-version rights remain practical.

## Acceptance Criteria

- Community installs, builds, runs, and passes its contract suite without Pro.
- The same application adds Pro without replacing its Community component imports or
  migrating its document.
- Packed Community and Pro artifacts carry the intended separate licenses and the same
  semantic version.
- Pro rejects incompatible Community versions before partially registering
  capabilities.
- A signed commercial entitlement activates exactly the package versions released
  within its update window without a network request.
- An entitled package keeps building and running after the update-entitlement date.
- A newer post-entitlement package requires renewal.
- Missing or rejected Pro activation leaves Community usable and document data intact.
- Browser, worker, Node, and SSR use do not depend on a Gantempo licensing endpoint.
- Public registry metadata and provenance identify the tagged source used for release.
