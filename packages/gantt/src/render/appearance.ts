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
  for (const option of options ?? []) {
    if (
      !isCanonicalAppearanceVariant(option.id) ||
      typeof option.label !== 'string' ||
      byId.has(option.id)
    ) {
      continue;
    }
    byId.set(
      option.id,
      Object.freeze({
        id: option.id,
        label: option.label,
        ...(option.tokens === undefined ? {} : { tokens: normalizedTokens(option.tokens) }),
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
