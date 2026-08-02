import { isCanonicalAppearanceVariant } from '../model/appearance';

export type GanttAppearanceToken =
  | 'lane.accent'
  | 'lane.surface'
  | 'task.border'
  | 'task.fill'
  | 'task.progressFill'
  | 'task.text';

export interface GanttAppearanceVariantOption {
  readonly id: string;
  readonly label: string;
  readonly tokens?: Partial<Record<GanttAppearanceToken, number | string>>;
}

export interface EffectiveAppearancePrimitive {
  readonly resolution: 'default' | 'legacy' | 'resolved' | 'unresolved';
  readonly source: 'default' | 'lane' | 'legacy-task' | 'task';
  readonly tokens: Readonly<Partial<Record<GanttAppearanceToken, number | string>>>;
  readonly variant?: string;
}

export interface AppearanceRegistry {
  readonly byId: ReadonlyMap<string, GanttAppearanceVariantOption>;
  readonly signature: string;
}

const EMPTY_TOKENS = Object.freeze({});

export const GANTT_DEFAULT_APPEARANCE_VARIANTS: readonly GanttAppearanceVariantOption[] =
  Object.freeze([
    Object.freeze({
      id: 'accent',
      label: 'Primary work',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-color-task)',
        'lane.surface': 'color-mix(in srgb, var(--gt-color-task) 7%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-color-task) 76%, black)',
        'task.fill': 'var(--gt-color-task)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-color-task) 72%, black)',
        'task.text': 'var(--gt-color-task-text)',
      }),
    }),
    Object.freeze({
      id: 'neutral',
      label: 'Supporting work',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-task-neutral, #dde3e4)',
        'lane.surface': 'color-mix(in srgb, var(--gt-task-neutral, #dde3e4) 22%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-task-neutral, #dde3e4) 72%, black)',
        'task.fill': 'var(--gt-task-neutral, #dde3e4)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-task-neutral, #dde3e4) 68%, black)',
        'task.text': 'var(--gt-task-muted-text, #18352f)',
      }),
    }),
    Object.freeze({
      id: 'success',
      label: 'Ready',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-task-success, #bfe6c4)',
        'lane.surface': 'color-mix(in srgb, var(--gt-task-success, #bfe6c4) 15%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-task-success, #bfe6c4) 72%, black)',
        'task.fill': 'var(--gt-task-success, #bfe6c4)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-task-success, #bfe6c4) 78%, black)',
        'task.text': 'var(--gt-task-muted-text, #18352f)',
      }),
    }),
    Object.freeze({
      id: 'warning',
      label: 'At risk',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-task-warning, #f0d7a5)',
        'lane.surface': 'color-mix(in srgb, var(--gt-task-warning, #f0d7a5) 15%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-task-warning, #f0d7a5) 72%, black)',
        'task.fill': 'var(--gt-task-warning, #f0d7a5)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-task-warning, #f0d7a5) 70%, black)',
        'task.text': 'var(--gt-task-muted-text, #18352f)',
      }),
    }),
  ]);

function normalizedTokens(
  tokens: GanttAppearanceVariantOption['tokens'],
): Readonly<Partial<Record<GanttAppearanceToken, number | string>>> {
  if (tokens === undefined) {
    return EMPTY_TOKENS;
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(tokens)
        .filter(
          (entry): entry is [GanttAppearanceToken, number | string] =>
            typeof entry[1] === 'string' ||
            (typeof entry[1] === 'number' && Number.isFinite(entry[1])),
        )
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ),
  );
}

export function createAppearanceRegistry(
  options: readonly GanttAppearanceVariantOption[] | undefined,
): AppearanceRegistry {
  const byId = new Map<string, GanttAppearanceVariantOption>();
  for (const option of [...GANTT_DEFAULT_APPEARANCE_VARIANTS, ...(options ?? [])]) {
    if (!isCanonicalAppearanceVariant(option.id) || typeof option.label !== 'string') {
      continue;
    }
    const existing = byId.get(option.id);
    const tokens = Object.freeze({
      ...existing?.tokens,
      ...normalizedTokens(option.tokens),
    });
    byId.set(
      option.id,
      Object.freeze({
        id: option.id,
        label: option.label,
        ...(Object.keys(tokens).length === 0 ? {} : { tokens }),
      }),
    );
  }
  return Object.freeze({
    byId,
    signature: JSON.stringify(
      [...byId.values()].map((option) => [option.id, option.label, option.tokens ?? null]),
    ),
  });
}

function resolvedAppearance(
  registry: AppearanceRegistry,
  source: EffectiveAppearancePrimitive['source'],
  variant: string | undefined,
): EffectiveAppearancePrimitive {
  if (variant === undefined) {
    return Object.freeze({
      resolution: 'default',
      source: 'default',
      tokens: EMPTY_TOKENS,
    });
  }
  const option = registry.byId.get(variant);
  if (option !== undefined) {
    return Object.freeze({
      resolution: 'resolved',
      source,
      tokens: option.tokens ?? EMPTY_TOKENS,
      variant,
    });
  }
  return Object.freeze({
    resolution: source === 'legacy-task' ? 'legacy' : 'unresolved',
    source,
    tokens: EMPTY_TOKENS,
    variant,
  });
}

export function resolveLaneAppearance(
  registry: AppearanceRegistry,
  laneVariant: string | undefined,
): EffectiveAppearancePrimitive {
  return resolvedAppearance(registry, laneVariant === undefined ? 'default' : 'lane', laneVariant);
}

export function resolveTaskAppearance(
  registry: AppearanceRegistry,
  input: {
    readonly laneVariant?: string;
    readonly legacyTaskVariant?: string;
    readonly taskVariant?: string;
  },
): EffectiveAppearancePrimitive {
  if (input.taskVariant !== undefined) {
    return resolvedAppearance(registry, 'task', input.taskVariant);
  }
  if (
    input.legacyTaskVariant !== undefined &&
    isCanonicalAppearanceVariant(input.legacyTaskVariant)
  ) {
    return resolvedAppearance(registry, 'legacy-task', input.legacyTaskVariant);
  }
  return resolvedAppearance(
    registry,
    input.laneVariant === undefined ? 'default' : 'lane',
    input.laneVariant,
  );
}
