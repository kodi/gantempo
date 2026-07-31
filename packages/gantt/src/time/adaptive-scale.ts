import type { EpochMilliseconds, TimeRange } from '../model/types';

export type GanttTimeScaleLevel = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type GanttTimeScaleDefinition =
  | {
      readonly tickAnchor: EpochMilliseconds;
      readonly tickInterval: number;
      readonly kind: 'fixed';
    }
  | {
      readonly kind: 'adaptive';
      readonly maxLevel?: GanttTimeScaleLevel;
      readonly minLevel?: GanttTimeScaleLevel;
    };

export interface GanttZoomOptions {
  readonly anchorRatio?: number;
  readonly anchorTime?: EpochMilliseconds;
}

export interface GanttFitToProjectOptions {
  readonly padding?: number;
}

export const TIME_SCALE_LEVELS: readonly GanttTimeScaleLevel[] = Object.freeze([
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const);

const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;
const LEVEL_SPANS: Readonly<Record<GanttTimeScaleLevel, number>> = Object.freeze({
  minute: 2 * HOUR,
  hour: 2 * DAY,
  day: 14 * DAY,
  week: 12 * 7 * DAY,
  month: 548 * DAY,
  quarter: 4 * 365 * DAY,
  year: 12 * 365 * DAY,
});
const MAX_EPOCH = 8.64e15;

export function timeScaleLevelIndex(level: GanttTimeScaleLevel): number {
  return TIME_SCALE_LEVELS.indexOf(level);
}

export function timeScaleLevelSpan(level: GanttTimeScaleLevel): number {
  return LEVEL_SPANS[level];
}

export function normalizeAdaptiveBounds(
  definition: Extract<GanttTimeScaleDefinition, { readonly kind: 'adaptive' }>,
): { readonly maxIndex: number; readonly minIndex: number } {
  const minIndex = definition.minLevel === undefined ? 0 : timeScaleLevelIndex(definition.minLevel);
  const maxIndex =
    definition.maxLevel === undefined
      ? TIME_SCALE_LEVELS.length - 1
      : timeScaleLevelIndex(definition.maxLevel);
  if (minIndex < 0 || maxIndex < 0) throw new RangeError('Adaptive scale levels are invalid.');
  return minIndex <= maxIndex
    ? Object.freeze({ maxIndex, minIndex })
    : Object.freeze({ maxIndex: minIndex, minIndex });
}

export function resolveAdaptiveScaleLevel(
  range: TimeRange,
  width: number,
  definition: Extract<GanttTimeScaleDefinition, { readonly kind: 'adaptive' }> = {
    kind: 'adaptive',
  },
): GanttTimeScaleLevel {
  if (!Number.isFinite(width) || width <= 0) throw new RangeError('Scale width must be positive.');
  const duration = range.end - range.start;
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Scale range is invalid.');
  const { minIndex, maxIndex } = normalizeAdaptiveBounds(definition);
  const nominalSpan = duration * (960 / width);
  let bestIndex = minIndex;
  let bestDistance = Infinity;
  for (let index = minIndex; index <= maxIndex; index += 1) {
    const distance = Math.abs(Math.log(nominalSpan / LEVEL_SPANS[TIME_SCALE_LEVELS[index]!]));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return TIME_SCALE_LEVELS[bestIndex]!;
}

function boundedRange(start: number, duration: number): TimeRange | undefined {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 2 * MAX_EPOCH
  ) {
    return undefined;
  }
  const boundedStart = Math.max(-MAX_EPOCH, Math.min(MAX_EPOCH - duration, start));
  const end = boundedStart + duration;
  return Number.isFinite(end) && end > boundedStart
    ? Object.freeze({ end, start: boundedStart })
    : undefined;
}

export function zoomRangeToLevel(
  range: TimeRange,
  level: GanttTimeScaleLevel,
  options: GanttZoomOptions = {},
): TimeRange | undefined {
  const ratio = options.anchorRatio ?? 0.5;
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) return undefined;
  const anchorTime = options.anchorTime ?? range.start + (range.end - range.start) * ratio;
  if (!Number.isFinite(anchorTime)) return undefined;
  const duration = LEVEL_SPANS[level];
  return boundedRange(anchorTime - duration * ratio, duration);
}

export function adjacentTimeScaleLevel(
  current: GanttTimeScaleLevel,
  direction: 'in' | 'out',
  definition: Extract<GanttTimeScaleDefinition, { readonly kind: 'adaptive' }> = {
    kind: 'adaptive',
  },
): GanttTimeScaleLevel {
  const { minIndex, maxIndex } = normalizeAdaptiveBounds(definition);
  const delta = direction === 'in' ? -1 : 1;
  const index = Math.max(minIndex, Math.min(maxIndex, timeScaleLevelIndex(current) + delta));
  return TIME_SCALE_LEVELS[index]!;
}

export function clampTimeScaleLevel(
  level: GanttTimeScaleLevel,
  definition: Extract<GanttTimeScaleDefinition, { readonly kind: 'adaptive' }>,
): GanttTimeScaleLevel {
  const { minIndex, maxIndex } = normalizeAdaptiveBounds(definition);
  const index = Math.max(minIndex, Math.min(maxIndex, timeScaleLevelIndex(level)));
  return TIME_SCALE_LEVELS[index]!;
}

export function fitTimeRange(
  bounds: TimeRange | undefined,
  viewportWidth: number,
  options: GanttFitToProjectOptions = {},
): TimeRange | undefined {
  if (bounds === undefined || !Number.isFinite(viewportWidth) || viewportWidth <= 0)
    return undefined;
  const padding = options.padding ?? 24;
  if (!Number.isFinite(padding) || padding < 0 || padding * 2 >= viewportWidth) return undefined;
  const contentDuration = bounds.end - bounds.start;
  if (!Number.isFinite(contentDuration) || contentDuration < 0) return undefined;
  const visibleRatio = 1 - (2 * padding) / viewportWidth;
  const duration = contentDuration === 0 ? LEVEL_SPANS.minute : contentDuration / visibleRatio;
  return boundedRange(bounds.start - duration * (padding / viewportWidth), duration);
}
