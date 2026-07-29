# Gantempo Competitor Landscape

Status: Internal working document
Research snapshot: 2026-07-29

## 1. Purpose

This document records the current competitive landscape for Gantempo: a React and
TypeScript library that should support both traditional project Gantt charts and
lane-based scheduling/resource timelines.

It focuses on:

- pricing and licensing;
- important product features;
- product and developer-experience gaps;
- opportunities for Gantempo to compete;
- a recommended Free/Pro boundary and pricing position.

Prices and license terms can change. Confirm them again before making a public pricing
claim or purchasing a competitor license.

## 2. Executive assessment

The market splits into three groups:

1. **Free libraries** that are pleasant for basic timelines or Gantt rendering but do
   not provide a complete scheduling engine.
2. **Free-core plus paid-Pro products**, especially SVAR and DHTMLX, which now provide
   credible MIT starting points and charge for advanced scheduling, resources, export,
   and support.
3. **Mature commercial suites**, such as Bryntum, Webix, Syncfusion, and GSTC, which
   offer substantial capability but introduce higher prices, broader bundles,
   framework wrappers, domain restrictions, or quote-based SaaS licensing.

The strongest opening for Gantempo is not "another task tree with bars." It is:

> A native React planning engine where tasks, lanes, resources, assignments, and
> visual placements are separate concepts, with an approachable MIT core and a
> transparent, SaaS-friendly Pro license.

The proposed architecture already supports this direction. The most defensible
differentiators are:

- traditional Gantt and multi-entry resource lanes over the same data model;
- a genuinely declarative React API, not an imperative JavaScript widget wrapped in
  React;
- typed commands, patches, transactions, validation, and undo/redo;
- worker/server-capable scheduling and layout engines;
- explicit time-zone and daylight-saving behavior;
- accessibility and keyboard editing as core features;
- transparent per-product licensing with no per-domain production keys.

## 3. Pricing snapshot

| Product | Free entry point | Commercial pricing | Licensing observations |
| --- | --- | --- | --- |
| **SVAR React Gantt** | MIT; unlimited developers, projects, and SaaS | Developer $749; Application $1,899; Team $3,399; Enterprise $6,799 | Perpetual; one year of support and updates; no deployment fees. Developer tier excludes SaaS. Renewal is 70% of current price within two months of expiry, otherwise 80%. |
| **GSTC** | Free/trial key under restrictive vendor terms | Regular $1,499; Enterprise $2,999; Corporate $4,999 | Perpetual. Limits are 1, 5, and 10 production domains/projects. Enterprise and Corporate cover SaaS; higher tiers add iframe rights. Purchased licenses use offline, domain-bound keys. |
| **DHTMLX Gantt 10** | MIT Community edition | Individual $799; Commercial $1,599; Enterprise $2,999; Ultimate $5,999 | Perpetual distribution rights with one year of updates/support. PRO features and add-ons vary by tier. Some SaaS use requires the appropriate tier or an additional arrangement. |
| **Bryntum Gantt** | Time-limited trial; a special single EUL can be requested by eligible small companies | $940/developer for a small-team EUL; $900/developer at the displayed 10-developer tier | Perpetual EUL for internal/non-commercial applications; one year of support and updates renews automatically at the original license price unless cancelled. SaaS/commercial distribution requires a quote-based OEM subscription. |
| **Webix Gantt** | 30-day trial | Custom from $798; Company $2,499; DevTeam $3,999 | The entry offer starts with one widget, one project, and two developers. Higher tiers cover the broader Webix widget suite. Confirm SaaS/distribution terms for the intended product. |
| **Syncfusion React Gantt** | Community License for eligible users | Custom quote | Community eligibility currently requires under $1M annual gross revenue, no more than 5 developers, no more than 10 employees, and no more than $3M in outside capital historically. Paid pricing is not public. |
| **react-calendar-timeline** | MIT | None | Free React timeline; no paid scheduling engine. |
| **Konva Timeline** | Free/open source | None | React/TypeScript canvas timeline; no commercial scheduling layer. |
| **Frappe Gantt** | MIT | None | Free JavaScript Gantt; not a native React component. |
| **gantt-task-react** | MIT | None | Free React/TypeScript Gantt with a comparatively small feature surface. |

### Pricing takeaways

- SVAR is the clearest direct benchmark for a native React Free/Pro strategy.
- DHTMLX is now a stronger threat at the free tier because v10 moved its Community
  edition to MIT.
- GSTC's $1,499 starting price and domain binding leave room for a lower-friction
  alternative.
- Bryntum's internal-use pricing is straightforward, but SaaS requires an OEM quote.
- Syncfusion can be free for a small eligible company, but it is not universally free
  and its paid price is opaque.
- A transparent Gantempo Pro price around $399/year per product would be materially
  easier to approve than the perpetual licenses above while still feeling like a
  serious developer product.

## 4. Direct competitors

## 4.1 SVAR React Gantt

### Positioning

SVAR is the closest product-model competitor: a native React Gantt with an MIT
open-source edition and a paid Pro upgrade.

### Important features

Free/core capabilities include:

- summary tasks, milestones, dependencies, and hierarchical subtasks;
- drag/resize, task reordering, adding and editing tasks;
- inline editing and standalone forms;
- sorting, filtering, tooltips, zoom, markers, and read-only mode;
- customizable scales, grid cells, task bars, themes, and localization;
- API hooks to listen to, intercept, and execute data operations;
- REST data provider and dynamic subtask loading;
- Excel/CSV import.

Pro adds:

- unscheduled tasks;
- working-day calendars and individual task/resource calendars;
- forward auto-scheduling for Finish-to-Start dependencies;
- critical path and slack visualization;
- baselines and rollups;
- grouping, split tasks, and WBS codes;
- resource assignment and resource-load chart;
- undo/redo;
- PDF, PNG, Excel, and MS Project import/export.

### Where SVAR appears weaker

These are product assessments, not claims that a feature can never be implemented:

- Its advertised auto-scheduling scope is currently forward scheduling with
  Finish-to-Start dependencies. A broader engine can differentiate on all four
  dependency types, lag/lead, constraints, backward planning, and deterministic
  conflict explanations.
- It is primarily presented as a project Gantt. Resource views exist, but arbitrary
  multi-entry lanes and task-to-resource placement are not the central data model.
- Important usability features such as undo/redo are paid. Gantempo can make a basic
  local command history free and charge for persistent/auditable history.
- The renewal price is high relative to the original perpetual price.

### How Gantempo should compete

- Match the quality of the React integration and free core.
- Make multi-entry lanes and task/assignment separation visible in the first release.
- Offer all editing through one typed command API usable from both UI gestures and
  application code.
- Make basic undo/redo, accessibility, SSR, and virtualization part of Community.
- In Pro, go beyond FS-only scheduling and return explainable scheduling diagnostics.

## 4.2 GSTC — Gantt Schedule Timeline Calendar

### Positioning

GSTC is the strongest lane-native commercial benchmark. It is a generic TypeScript
timeline that can act as a Gantt chart, resource planner, reservation system, booking
calendar, or media editor.

### Important features

- multiple items in one row;
- large-dataset virtual scrolling, with claims of handling hundreds of thousands of
  items;
- tree-like collapsible groups;
- movable and resizable items with configurable business rules;
- snap-to-time behavior;
- zoom down to seconds;
- selectable cells and items;
- resizable, sortable, and searchable list columns;
- templates, slots, actions, plugins, and component overrides;
- framework integrations for React, Next.js, Vue, Angular, and Svelte;
- mobile and DST support;
- offline license keys for paid use.

### Where GSTC appears weaker

- It supports React but is not designed as a React-first declarative state model.
- The extensibility surface is powerful but broad: configuration, mutable state paths,
  templates, slots, actions, components, and plugins increase the learning surface.
- The product is strongest as a flexible timeline renderer. Project-scheduling
  algorithms such as critical path, baselines, resource leveling, and constraints are
  not its central public value proposition.
- The Regular license excludes SaaS, and all paid tiers are limited by permanent
  production domains/projects.
- Purchase and domain-key issuance are relatively manual.
- License terms restrict source modification beyond documented configuration.

### How Gantempo should compete

- Preserve the multi-entry lane flexibility while exposing ordinary React props,
  hooks, refs, render functions, and controlled state.
- Use stable public records and typed commands instead of requiring consumers to know
  internal state paths or DOM component names.
- Publish repeatable performance benchmarks rather than a single maximum-item claim.
- Avoid permanent domain binding; authorize a product/codebase and allow unlimited
  deployments.
- Combine GSTC-style lane flexibility with a real optional scheduling engine.

## 4.3 DHTMLX Gantt

### Positioning

DHTMLX is the most dangerous mature Free/Pro benchmark after its June 2026 release of
Gantt v10. The Community edition is now MIT, and the paid edition has a deep scheduling
feature set.

### Important features

Community capabilities include:

- task hierarchy, summaries, milestones, and all four dependency types;
- inline editing, filtering, drag-and-drop, custom scales, themes, and zoom;
- configurable layouts and backward planning;
- smart rendering advertised for more than 30,000 tasks/dependencies;
- keyboard navigation, WAI-ARIA support, RTL, and responsive/full-screen modes;
- XML data exchange.

PRO capabilities include:

- resource management and resource histograms;
- auto-scheduling and constraint control;
- critical path;
- task grouping, dynamic loading, and WBS codes;
- task/project/resource calendars;
- custom timeline elements;
- React component and advanced framework support;
- PDF/PNG, Excel, iCal, MS Project, and other import/export options;
- optional Node.js scheduling/export modules, depending on license.

### Where DHTMLX appears weaker

- DHTMLX states that its React Gantt is an official React wrapper around a standalone
  JavaScript library rather than a React-native implementation.
- The API inherits a large imperative widget surface and instance lifecycle.
- A conventional Gantt task tree remains the primary abstraction; resource scheduling
  is an advanced view rather than the foundation of the model.
- Licensing has multiple tiers and add-ons, and SaaS rights require careful checking.
- Some modern React consumers may prefer immutable records, controlled state,
  server/worker execution, and typed patch streams over widget-managed state.

### How Gantempo should compete

- Do not attempt to beat DHTMLX feature-for-feature in v1.
- Win on React ergonomics, model clarity, modular size, and lane/Gantt unification.
- Provide a headless engine usable without mounting the visual component.
- Make time-zone behavior and serializable state explicit.
- Offer a migration-friendly JSON codec and small adapter examples for Redux, Zustand,
  TanStack Query, and server persistence.

## 4.4 Bryntum Gantt

### Positioning

Bryntum is a premium enterprise component with a mature scheduling engine, extensive
UI, source-code access, and integration with Bryntum Scheduler Pro and Task Board.

### Important features

- drag, resize, and task creation using mouse or touch;
- programmatic validation of editing;
- 25+ included columns and custom columns;
- real-time updates, undo/redo, grouping, advanced filtering, and UI state;
- all dependency types with lead/lag;
- split tasks, rollups, inactive tasks/dependencies, and version history;
- MS Project and Primavera import through MPXJ;
- PDF, PNG, and Excel export;
- huge-dataset support and flexible zoom;
- resources, assignments, calendars, and workload/cost functionality;
- customizable HTML/CSS rendering and themes;
- React, Angular, Vue, Salesforce, and SharePoint integrations.

### Where Bryntum appears weaker

- React integration is a wrapper over Bryntum's framework-independent widget and data
  model, not a React-owned rendering/state architecture.
- Per-developer pricing becomes expensive quickly.
- The internal-use EUL does not cover paid SaaS or commercial redistribution; those
  require a quote-based OEM subscription.
- The support/update subscription auto-renews at the original license price unless
  cancelled.
- The breadth of its object model and suite can be more than a focused React product
  needs.

### How Gantempo should compete

- Treat Bryntum as the long-term capability benchmark, especially for scheduling
  correctness, resources, calendars, and version history.
- Differentiate with a smaller installation, transparent licensing, and modern React
  control.
- Build a deterministic scheduling test corpus early; UI polish alone will not compete
  with Bryntum for serious planning use cases.

## 4.5 Webix Gantt

### Positioning

Webix offers a ready-to-use Gantt application/widget within a larger enterprise UI
suite.

### Important features

- tasks, projects, milestones, dependencies, and split tasks;
- inline editing, linking, moving, resizing, and information panels;
- auto-scheduling, working calendars, and critical path;
- baselines;
- resource assignment, resource view, load diagram, and workload visualization;
- zoom and custom time scales;
- lazy loading and large-project support;
- REST/custom backend integration;
- React, Angular, and Vue integration;
- mobile/compact mode.

### Where Webix appears weaker

- It is an application-style widget and broad UI suite, not a focused native React
  engine.
- The entry point and higher tiers bundle or lead into other Webix widgets.
- Consumers wanting headless scheduling, immutable state, or a highly bespoke React UI
  may have to work around the widget's internal structure.

### How Gantempo should compete

- Offer composable pieces instead of requiring the full grid-plus-chart application.
- Make the core useful with a customer's own design system and editors.
- Provide example application shells for users who do want a ready-made experience.

## 4.6 Syncfusion React Gantt

### Positioning

Syncfusion is an enterprise component suite rather than a single-purpose Gantt vendor.
Its React Gantt is feature rich, and its Community License is attractive to eligible
small companies.

### Important features

- task hierarchy and dependencies;
- taskbar, cell, and dialog editing;
- toolbar and context-menu task creation/deletion;
- multitier timelines and custom units;
- resources, calendars, baselines, critical path, and scheduling features;
- row and timeline virtualization;
- accessibility, themes, and localization;
- broad integration with Syncfusion's other components and document tooling.

### Where Syncfusion appears weaker

- Community access is eligibility-based, not an unconditional open-source license.
- Paid prices are quote-based.
- The buyer receives a very broad suite, which is valuable for some companies but adds
  product, documentation, and licensing surface for teams that only need a Gantt.
- Gantempo can be easier to inspect, fork, theme, and integrate into a React-specific
  architecture.

### How Gantempo should compete

- Keep the Community edition genuinely MIT and self-serve.
- Keep paid pricing public.
- Stay focused on planning and scheduling instead of becoming a general component
  suite.

## 5. Free/open-source feature benchmarks

## 5.1 react-calendar-timeline

Strengths:

- real React component and MIT license;
- groups/lanes with multiple items per group;
- moving, resizing, cross-group moves, stacking, and snapping;
- controlled visible time and controlled selection;
- rich callbacks for item and canvas interaction;
- custom item renderers and headers;
- React 18/19 and TypeScript work in the current beta;
- a clear lane-oriented API.

Gaps Gantempo should cover:

- not a project-scheduling engine;
- no first-class task hierarchy, dependency graph, critical path, calendars, or
  resource capacity model;
- parent applications own most create/edit/persistence behavior;
- no single model that can switch between task-tree and assignment-lane views.

This is a strong benchmark for Community edition interaction ergonomics.

## 5.2 Konva Timeline

Strengths:

- React and TypeScript;
- canvas rendering;
- zero-to-many tasks per resource;
- tasks can move across resources;
- generic enough for Gantt, scheduler, and planner use.

Gaps Gantempo should cover:

- smaller ecosystem and feature set;
- canvas accessibility requires additional semantic UI;
- no mature project-scheduling, analytics, import/export, or Pro ecosystem.

This is a useful performance and lane-interaction benchmark.

## 5.3 Frappe Gantt

Strengths:

- MIT, compact, attractive, and easy to start;
- task dependencies and interactive date/progress changes;
- customizable views from hours to years;
- configurable holidays/ignored periods;
- simple data format and API;
- current npm package remains actively published.

Gaps Gantempo should cover:

- standalone JavaScript rather than native React;
- traditional task-per-row Gantt rather than arbitrary multi-entry lanes;
- no advanced scheduling/resource engine;
- limited large-enterprise workflow and state-management surface.

This is the benchmark for a delightful five-minute setup.

## 5.4 gantt-task-react

Strengths:

- React, TypeScript, and MIT;
- basic tasks, projects, milestones, dependencies, progress, and interaction;
- simple component API.

Gaps Gantempo should cover:

- limited scheduling, resource, calendar, lane, export, and enterprise features;
- less suitable as the foundation for a complete Free/Pro product.

This is a benchmark for minimum viable React Gantt API simplicity, not for the target
feature ceiling.

## 6. Cross-market gaps Gantempo can own

## 6.1 One model for two kinds of planning

Most Gantt products start with one task per row. Most scheduler products start with
resources and events. Gantempo should make these separate dimensions:

- `Task`: the work and its hierarchy/dependencies;
- `Lane`: the visual grouping or resource row;
- `Resource`: a person, machine, room, or capacity pool;
- `Assignment`: a task/resource relationship, units, effort, and calendar;
- `Placement` or `Segment`: where an assignment is displayed in a lane.

The same document can then drive:

- project task-tree Gantt;
- team/resource workload view;
- equipment or room booking view;
- roadmap;
- split-task view;
- portfolio timeline.

This is the most valuable architectural difference from the market.

## 6.2 Native React without surrendering performance

Provide:

- controlled and uncontrolled modes;
- plain immutable inputs;
- granular subscriptions/selectors to avoid full re-renders;
- an imperative ref only for viewport and focus operations;
- custom React renderers for rows, cells, bars, handles, links, menus, and editors;
- horizontal and vertical virtualization;
- worker-compatible layout/scheduling;
- an optional canvas renderer for extreme density, paired with a semantic DOM layer.

## 6.3 One typed command surface

All changes, whether caused by drag-and-drop or an external button, should use the same
commands:

- create/update/delete task;
- move/resize/split task;
- create/delete dependency;
- move placement between lanes;
- assign/unassign resource;
- set progress, calendar, or constraint;
- batch/transaction.

Commands should be:

- interceptable and cancellable;
- validated before commit;
- reducible to serializable patches;
- suitable for local undo/redo;
- easy to send to a backend or collaboration system;
- explainable when rejected.

This is easier to integrate than a mix of mutable widget methods and UI callbacks.

## 6.4 Scheduling explanations, not only schedule results

Pro scheduling should return diagnostics such as:

- which dependency or constraint moved a task;
- why a task cannot move to the requested date;
- which calendar days were skipped;
- which resources are over capacity;
- which cycle or invalid constraint blocked a calculation;
- what changed between the old and new schedule.

This improves trust and makes complex scheduling debuggable.

## 6.5 Time correctness

Treat time zones, local calendars, daylight-saving transitions, and duration semantics
as explicit model concerns. Publish tests for:

- DST gaps and repeated hours;
- all-day versus instant-based tasks;
- resource calendars in different zones;
- elapsed duration versus working duration;
- cross-zone display and editing;
- minute/hour/day/week/month scale boundaries.

GSTC mentions DST, but this remains an area where a documented correctness model can
stand out.

## 6.6 Accessibility as product quality

Community should include:

- keyboard navigation through grid, lanes, tasks, and dependency handles;
- keyboard move/resize commands with announcements;
- accessible names, roles, and state;
- high-contrast theme;
- reduced-motion support;
- focus restoration after virtualization;
- a non-visual task summary/table.

Do not make accessibility a Pro entitlement.

## 6.7 Transparent licensing

Avoid:

- permanent domain binding;
- production call-home;
- counting end users;
- separate SaaS permission on the normal Pro tier;
- forcing a sales call for ordinary teams;
- pricing every developer who merely sees compiled application code.

Prefer:

- licensing per product/codebase;
- a small included developer allowance;
- unlimited domains, servers, end users, and SaaS deployments;
- offline validation;
- a clear redistribution/OEM exception only for products that expose Gantempo as a
  competing standalone developer component.

## 7. Recommended Free/Pro split

## 7.1 Community — MIT

Community must be good enough for real production applications:

- React and TypeScript components;
- arbitrary lanes and multiple entries per lane;
- task hierarchy, summaries, milestones, and all four dependency visuals;
- create, edit, delete, drag, resize, reorder, and cross-lane movement;
- controlled/uncontrolled state;
- JSON-compatible codec and migrations;
- typed command API, validation hooks, and patch events;
- local undo/redo;
- custom rows, cells, bars, links, tooltips, menus, and editors;
- zoom, pan, markers, selection, snapping, filtering, and sorting;
- horizontal/vertical virtualization;
- responsive/compact/read-only modes;
- themes, localization, RTL, accessibility, and keyboard navigation;
- SSR/Next.js-safe package behavior;
- basic dependency validation and cycle detection;
- community support.

This free tier should beat `react-calendar-timeline`, Konva Timeline, Frappe Gantt, and
`gantt-task-react` as an integration foundation. It should also be credible beside the
SVAR and DHTMLX Community editions.

## 7.2 Pro

Charge for business logic and costly workflow features, not basic rendering quality:

- working-time engine and project/task/resource calendars;
- auto-scheduling for all dependency types, lead/lag, constraints, and forward/backward
  planning;
- critical path, total/free float, and explainable schedule diagnostics;
- baselines, variance, rollups, WBS, and earned-value/cost extensions;
- resource assignment, capacity, utilization, workload, and leveling;
- advanced split-task and time-phased assignment behavior;
- persistent/auditable history and advanced transactions;
- PDF, PNG, SVG, Excel, CSV, iCal, MS Project, and Primavera import/export as feasible;
- worker/server scheduling packages;
- official REST/GraphQL persistence adapters;
- priority support and longer support windows.

Possible later enterprise/OEM features:

- real-time collaboration adapters and conflict resolution;
- audit/compliance packs;
- white-label/OEM redistribution rights;
- source escrow or source access for Pro packages;
- custom support SLA and consulting.

## 8. Recommended pricing

### Primary model

License Pro per product/codebase, not per domain:

- **Community:** $0, MIT, unlimited developers/projects/SaaS.
- **Pro:** $399/year per product, including up to 3 active developers.
- **Additional developer:** $99/year.
- **Additional product:** $249/year.
- **Launch offer:** $299 for the first year.

The normal Pro license should include:

- commercial and SaaS use;
- unlimited production domains, servers, tenants, and end users;
- all Pro npm packages;
- updates during the subscription;
- priority email support with a stated response target;
- no runtime call-home requirement.

### Optional perpetual model

If buyers strongly request perpetual licensing:

- **Pro Perpetual:** $899 per product, up to 3 developers.
- Includes one year of updates and support.
- **Maintenance:** $229/year for continued updates and support.
- The last received version continues working if maintenance expires.

### OEM/redistribution

Use custom pricing only when the customer:

- resells Gantempo as a standalone developer component;
- exposes it through a low-code/no-code builder where end users create competing Gantt
  components;
- needs source redistribution or special sublicensing.

Suggested starting range: $2,500-$5,000/year, adjusted for redistribution scope and
support obligations.

### Why this position works

- It is far below the $749-$1,499 entry prices of the closest paid competitors.
- It is transparent where Bryntum and Syncfusion SaaS pricing requires a quote.
- It avoids GSTC's domain limits.
- It gives small React product teams enough included developers to adopt without
  license administration.
- Annual pricing funds ongoing compatibility, accessibility, performance, and
  scheduling work.

Do not underprice below roughly $299/year once Pro is credible. Scheduling, export, and
enterprise browser compatibility create a real long-term maintenance burden.

## 9. Competitive delivery priorities

## Phase 1 — Community credibility

Ship:

1. native React/TypeScript component and stable data model;
2. arbitrary lanes with multiple entries;
3. task-tree mode over the same document;
4. drag, resize, create, delete, cross-lane move, selection, and keyboard editing;
5. dependency rendering and validation;
6. custom renderers and themes;
7. controlled/uncontrolled APIs and patch events;
8. virtualization with published benchmark fixtures;
9. accessibility and SSR examples;
10. excellent five-minute starter and JSON example.

Success criterion: a developer choosing among the free libraries sees Gantempo as the
best foundation even before Pro exists.

## Phase 2 — First sellable Pro

Ship:

1. working calendars;
2. deterministic auto-scheduling;
3. critical path and float;
4. baselines and variance;
5. resource assignment and workload;
6. PDF/PNG/Excel export;
7. priority support and stable commercial packages.

Success criterion: the Pro edition solves the same core buying job as SVAR Pro while
remaining simpler to license and more flexible for resource lanes.

## Phase 3 — Enterprise differentiation

Ship:

1. constraints, lead/lag, backward scheduling, and resource leveling;
2. explainable scheduling diagnostics;
3. worker and server execution;
4. MS Project/Primavera interoperability where commercially justified;
5. persistent audit history and collaboration adapter contracts;
6. published large-data and scheduling-correctness suites.

Success criterion: Gantempo is evaluated against DHTMLX and Bryntum on capability, not
only against free React components.

## 10. Product risks

- **Trying to match every enterprise feature too early.** Win a narrow React and lane
  use case first.
- **A weak free edition.** DHTMLX and SVAR now make a credible MIT core table stakes.
- **Conflating rows with tasks.** This would erase the main differentiation.
- **Building scheduling rules into React components.** Keep engines pure and portable.
- **Canvas-only rendering.** It can improve density but must not sacrifice semantics,
  text selection, customization, or accessibility.
- **Opaque licensing.** A self-serve developer product should not require a sales call
  for normal SaaS use.
- **Unsubstantiated performance claims.** Publish data generators, hardware/browser
  details, interaction latency, and visible-item counts.
- **Export scope explosion.** Treat complex formats as isolated packages/services and
  prioritize based on paying demand.

## 11. Source links

Official/current sources used for pricing and product facts:

- [SVAR pricing and Free/Pro feature comparison](https://svar.dev/react/gantt/pricing/)
- [SVAR React Gantt product page](https://svar.dev/react/gantt/)
- [GSTC pricing](https://gantt-schedule-timeline-calendar.neuronet.io/pricing)
- [GSTC features](https://gantt-schedule-timeline-calendar.neuronet.io/)
- [GSTC configuration and API surface](https://gantt-schedule-timeline-calendar.neuronet.io/documentation/configuration)
- [GSTC Corporate license terms](https://gantt-schedule-timeline-calendar.neuronet.io/NEURONET%20Corporate%20License%20Terms%20v3.4.pdf)
- [GSTC Enterprise license terms](https://gantt-schedule-timeline-calendar.neuronet.io/NEURONET%20Enterprise%20License%20Terms%20v3.1.pdf)
- [GSTC Regular/Individual license terms](https://gantt-schedule-timeline-calendar.neuronet.io/NEURONET%20Individual%20License%20Terms%20v3.1.pdf)
- [DHTMLX Gantt product and pricing](https://dhtmlx.com/docs/products/dhtmlxGantt/)
- [DHTMLX Gantt MIT Community edition](https://dhtmlx.com/docs/products/dhtmlxGantt/open-source/)
- [DHTMLX React Gantt](https://dhtmlx.com/docs/products/dhtmlxGantt-for-React/)
- [DHTMLX v10 release notes](https://docs.dhtmlx.com/gantt/whats-new/)
- [Bryntum Gantt pricing](https://bryntum.com/store/gantt/)
- [Bryntum Gantt features](https://bryntum.com/products/gantt/features/)
- [Webix Gantt features and pricing](https://webix.com/gantt/)
- [Syncfusion React Gantt](https://www.syncfusion.com/gantt-sdk/react-gantt-chart)
- [Syncfusion Community License eligibility](https://www.syncfusion.com/products/communitylicense)
- [Syncfusion commercial pricing](https://www.syncfusion.com/sales/pricing)
- [react-calendar-timeline](https://github.com/namespace-ee/react-calendar-timeline)
- [Konva Timeline](https://github.com/melfore/konva-timeline)
- [Frappe Gantt](https://github.com/frappe/gantt)
- [gantt-task-react](https://github.com/MaTeMaTuK/gantt-task-react)

## 12. Research cautions

- Feature lists describe what vendors publicly document, not every internal capability
  or limitation.
- "Appears weaker" sections are product-strategy opinions based on public materials.
- Pricing excludes taxes and may exclude optional modules, support, services, or
  negotiated SaaS/OEM rights.
- License summaries are not legal advice. Read the current license agreement before
  relying on a term.
