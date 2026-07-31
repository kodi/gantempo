# Item Properties, Semantic Appearance, and Progress Contract

Status: Accepted
Date: 2026-07-31
Owners: M4 item-properties appendix

## Context

Base M4 provides occurrence-aware selection, one command and acknowledgement
lifecycle, a task-only editor slot, typed visual slots, and a renderer-only
`taskVariants` map. The appendix adds canonical description and semantic appearance,
lane inspection/editing, rendered progress, and direct progress editing without
creating another document format, mutation path, or renderer-owned state model.

This decision extends the accepted
[document codec](2026-07-30-document-codec-contract.md),
[change kernel](2026-07-30-change-kernel-contract.md),
[view/layout/viewport](2026-07-30-view-layout-viewport-kernel-contract.md), and
[interaction runtime](2026-07-30-interaction-runtime-public-api-contract.md)
contracts.

## Decision

### Persist one bounded semantic appearance reference

Schema version 1 gains backward-compatible optional fields:

```ts
export interface GanttAppearanceReference {
  readonly variant: string;
}

export interface TaskRecord {
  readonly description?: string;
  readonly appearance?: GanttAppearanceReference;
}

export interface LaneRecord {
  readonly appearance?: GanttAppearanceReference;
}
```

The codec and command normalizer trim `variant`. A valid canonical value contains
1–64 Unicode code points after trimming and no control characters. Empty, overlong,
or control-containing values reject with stable model or command diagnostics.
Unknown valid IDs remain ordinary canonical data and survive parsing,
serialization, patches, history, and controlled change envelopes.

These optional members do not require a schema migration because the existing
schema-version-1 codec already treats absent optional record fields as canonical.
Documents that do not use them retain their existing canonical output. `description`
is an optional string and is not hidden in application-defined `fields`.

### Resolve appearance with one portable precedence

Effective appearance resolves in this order:

```text
theme and task-kind default
  -> persisted lane appearance
  -> legacy view-only taskVariants fallback
  -> persisted task appearance
  -> derived system state
```

The legacy `taskVariants` prop remains source-compatible and renderer-only. It applies
only when the task has no persisted `appearance`, never mutates a task, and is
deprecated after the appendix ships in favor of canonical records plus
`appearanceVariants`. Persisted task appearance therefore remains the authoritative
task override and follows the task across views. No placement, assignment, segment,
or progress color is persisted.

The instance registry is:

```ts
export type GanttAppearanceToken =
  | "task.fill"
  | "task.progressFill"
  | "task.text"
  | "task.border"
  | "lane.accent"
  | "lane.surface";

export interface GanttAppearanceVariantOption {
  readonly id: string;
  readonly label: string;
  readonly tokens?: Partial<Record<GanttAppearanceToken, string | number>>;
}

export interface GanttProps {
  readonly appearanceVariants?: readonly GanttAppearanceVariantOption[];
}
```

Registry IDs use the same validity rules as persisted IDs and are unique per
instance. The playground supplies its demonstration meanings; core ships no workflow
taxonomy. A configured variant resolves coordinated portable tokens. An unresolved
ID falls back deterministically to the normal task-kind and theme paint, remains
visible as unavailable in properties, and emits at most one
`appearance.variant.unresolved` warning per distinct ID and registry revision for the
owning instance.

Derived selected, focused, dragging, resizing, pending, invalid, disabled, critical,
and forced-colors states may add or adjust paint and non-color affordances. They
never replace persisted semantic data. Lane variants use a restrained lane accent or
surface plus inherited task paint; the default theme does not saturate complete rows.

### Keep progress numeric and command-owned

`TaskRecord.progress` remains the only persistent progress value and is strictly
finite in `0..1`. Editors display integer `0..100` percentages and convert by
`percentage / 100`. Invalid values reject; they are never silently clamped.

Only ordinary `kind: "task"` records expose progress editing in this appendix.
Milestones expose no progress control, and summary progress is read-only until M5
defines whether it is derived or owned. Progress uses the effective semantic
variant's `task.progressFill`; no independent progress color exists.

Keyboard progress editing uses one percentage point for the normal step and ten
percentage points for the accelerated `Shift` step. Arrow Right/Up increase,
Arrow Left/Down decrease, Home proposes 0%, and End proposes 100%. Pointer and
keyboard interaction use immutable preview state and commit exactly one
`task.update`; the properties field uses that same fraction and command path.

Direct progress editing extends the public M4 interaction summary additively:
`GanttInteractionAction` includes `"progress"`, pointer preview uses
`status: "progressing"`, keyboard preview uses `mode: "progress"`, and
`GanttInteractionPreview.progress` publishes the proposed canonical fraction. The
class-name state includes `progressing`, `classNames.progressHandle` owns the visible
marker, and `data-gt-part="progress-handle"` is the stable rendered part. The larger
coarse-pointer hit target remains private DOM structure.

### Extend, rather than replace, the M4 editor boundary

The appendix adds:

```ts
export type GanttItemPropertiesValue =
  | {
      readonly kind: "task";
      readonly taskId: EntityId;
      readonly title: string;
      readonly description?: string;
      readonly start?: EpochMilliseconds;
      readonly end?: EpochMilliseconds;
      readonly progress?: number;
      readonly appearance?: GanttAppearanceReference;
      readonly placementId?: EntityId;
      readonly laneId?: EntityId;
    }
  | {
      readonly kind: "lane";
      readonly laneId: EntityId;
      readonly title: string;
      readonly appearance?: GanttAppearanceReference;
    };

export interface GanttItemPropertiesProps {
  readonly bindings: GanttOverlayBindings;
  readonly initialValue: GanttItemPropertiesValue;
  readonly pending: boolean;
  readonly error?: string;
  readonly errorId: string;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onSubmit: (value: GanttItemPropertiesValue) => void;
}
```

`GanttSlots.ItemProperties` replaces the complete default task/lane presentation.
`GanttFeatures.properties` enables the new surface. The existing
`GanttSlots.TaskEditor`, `GanttTaskEditorProps`, and `GanttFeatures.editor` remain
source-compatible: when an application supplies the legacy task slot and does not
supply `ItemProperties`, eligible task activation keeps the existing title/start/end
contract. Lane properties require the new surface.

The default task surface edits title, description, instant start/end, progress,
appearance, one unambiguous persisted placement lane, and deletion. It shows the
stable ID, task kind, and derived elapsed duration read-only. It does not add
calendar-aware duration policy. The lane surface edits title and appearance and
shows stable lane ID plus linked resource identity read-only.

Selection changes the inspected target, but read-only selection does not open the
surface automatically. Activation, Enter, the context menu, or an Edit action opens
it. Save dispatches one command or one transaction through M4; controlled consumers
must acknowledge the same immutable change envelope. Cancel, Escape, click-away,
pending state, stale targets, rejection, focus return, and instance isolation remain
owned by the verified M4 overlay/runtime lifecycle.

An occurrence can move lanes only when it has one canonical persisted `placementId`
and the destination has one canonical `laneId`; otherwise the control is read-only
with a stable reason. Occurrence-level appearance and kind conversion remain
deferred.

## Public API Impact

The appendix adds canonical appearance types, registry types and props, the
item-properties slot/value types, and the narrow additive progress interaction
members named above. Existing root imports remain the only public boundary. The
packed declaration must not expose private resolver, diagnostic deduplication, form
reducer, scene-cache, or hit-test implementations.

## Consequences

- Description and semantic appearance become portable document data without storing
  CSS or theme configuration.
- One task can inherit different lane appearances across occurrences until it gains
  an explicit task appearance.
- Legacy `taskVariants` behavior remains available without becoming authoritative
  persisted data.
- The properties surface is bounded and replaceable but is not a public form-schema
  framework.
- Progress rendering, fields, gestures, history, and accessibility share one numeric
  and command contract.

## Revisit Triggers

Revisit this decision before adding placement/assignment/segment appearance, raw
colors, public workflow meanings, summary progress ownership, kind conversion,
calendar-aware duration editing, a general form schema, or renderer-specific
document styling.

## Links

- [Architecture](../ARCHITECTURE.md)
- [UI and theming](../UI_THEMING.md)
- [Roadmap](../ROADMAP.md#m4-appendix-item-properties-semantic-appearance-and-progress)
- [Implementation plan](../plans/2026-07-30-m4-item-properties-and-semantic-color-appendix-plan.md)
