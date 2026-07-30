import type { TimeRange } from '../model/types';

export type NavigationDeltaUnit = 'line' | 'page' | 'pixel';

export interface NavigationDeltaMetrics {
  readonly lineSize: number;
  readonly pageSize: number;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function normalizeTimeRange(range: TimeRange): TimeRange | undefined {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
    return undefined;
  }
  return Object.freeze({ start: range.start, end: range.end });
}

export function normalizeNavigationDelta(
  delta: number,
  unit: NavigationDeltaUnit,
  metrics: NavigationDeltaMetrics,
): number {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }
  if (!positiveFinite(metrics.lineSize) || !positiveFinite(metrics.pageSize)) {
    return 0;
  }
  const multiplier = unit === 'line' ? metrics.lineSize : unit === 'page' ? metrics.pageSize : 1;
  const normalized = delta * multiplier;
  return Number.isFinite(normalized) ? normalized : 0;
}

export function shiftTimeRange(range: TimeRange, delta: number): TimeRange | undefined {
  const normalized = normalizeTimeRange(range);
  if (normalized === undefined || !Number.isFinite(delta)) {
    return undefined;
  }
  const duration = normalized.end - normalized.start;
  const start = normalized.start + delta;
  const end = start + duration;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined;
  }
  return Object.freeze({ start, end });
}

export function shiftTimeRangeByPixels(
  range: TimeRange,
  pixelDelta: number,
  viewportWidth: number,
): TimeRange | undefined {
  const normalized = normalizeTimeRange(range);
  if (
    normalized === undefined ||
    !Number.isFinite(pixelDelta) ||
    pixelDelta === 0 ||
    !positiveFinite(viewportWidth)
  ) {
    return undefined;
  }
  const duration = normalized.end - normalized.start;
  const timeDelta = (pixelDelta * duration) / viewportWidth;
  return shiftTimeRange(normalized, timeDelta);
}

export function shiftVerticalViewport(
  verticalStart: number,
  delta: number,
  contentHeight: number,
  viewportHeight: number,
): number | undefined {
  if (
    !Number.isFinite(verticalStart) ||
    verticalStart < 0 ||
    !Number.isFinite(delta) ||
    !Number.isFinite(contentHeight) ||
    contentHeight < 0 ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight < 0
  ) {
    return undefined;
  }
  const maxStart = Math.max(0, contentHeight - viewportHeight);
  const next = Math.max(0, Math.min(maxStart, verticalStart + delta));
  return Number.isFinite(next) ? next : undefined;
}

export function pageVerticalViewport(
  verticalStart: number,
  direction: -1 | 1,
  contentHeight: number,
  viewportHeight: number,
  overlap: number,
): number | undefined {
  if (
    (direction !== -1 && direction !== 1) ||
    !Number.isFinite(overlap) ||
    overlap < 0 ||
    overlap >= viewportHeight
  ) {
    return undefined;
  }
  return shiftVerticalViewport(
    verticalStart,
    direction * (viewportHeight - overlap),
    contentHeight,
    viewportHeight,
  );
}

export function pageTimeRange(
  range: TimeRange,
  direction: -1 | 1,
  overlapRatio = 0.1,
): TimeRange | undefined {
  const normalized = normalizeTimeRange(range);
  if (
    normalized === undefined ||
    (direction !== -1 && direction !== 1) ||
    !Number.isFinite(overlapRatio) ||
    overlapRatio < 0 ||
    overlapRatio >= 1
  ) {
    return undefined;
  }
  const duration = normalized.end - normalized.start;
  return shiftTimeRange(normalized, direction * duration * (1 - overlapRatio));
}
