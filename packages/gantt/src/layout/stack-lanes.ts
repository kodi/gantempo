import type { ResolvedViewLane, ViewLaneKey, ViewPlacementKey } from '../view/types';
import type { ResolvedIntervalPlacement } from './resolve-placement-intervals';

export interface StackLayoutMetrics {
  readonly defaultMinimumLaneHeight: number;
  readonly barHeight: number;
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly stackGap: number;
}

export const DEFAULT_STACK_LAYOUT_METRICS: StackLayoutMetrics = Object.freeze({
  defaultMinimumLaneHeight: 58,
  barHeight: 24,
  paddingTop: 17,
  paddingBottom: 17,
  stackGap: 6,
});

export interface LaidOutPlacement extends ResolvedIntervalPlacement {
  readonly track: number;
  readonly y: number;
  readonly height: number;
}

export interface LaidOutLane extends ResolvedViewLane {
  readonly y: number;
  readonly height: number;
  readonly stackCount: number;
  readonly placements: readonly LaidOutPlacement[];
}

export interface StackLayout {
  readonly lanes: readonly LaidOutLane[];
  readonly totalHeight: number;
}

/**
 * Validates the layout configuration once so hot layout loops can use metrics
 * without defensive branches or partial fallback behavior.
 */
export function resolveStackLayoutMetrics(
  overrides?: Partial<StackLayoutMetrics>,
): StackLayoutMetrics {
  const metrics = { ...DEFAULT_STACK_LAYOUT_METRICS, ...overrides };
  const positive = ['defaultMinimumLaneHeight', 'barHeight'] as const;
  const nonNegative = ['paddingTop', 'paddingBottom', 'stackGap'] as const;

  for (const name of positive) {
    if (!Number.isFinite(metrics[name]) || metrics[name] <= 0) {
      throw new RangeError(`Layout metric "${name}" must be a positive finite number.`);
    }
  }
  for (const name of nonNegative) {
    if (!Number.isFinite(metrics[name]) || metrics[name] < 0) {
      throw new RangeError(`Layout metric "${name}" must be a non-negative finite number.`);
    }
  }
  return Object.freeze(metrics);
}

function compareForStack(left: ResolvedIntervalPlacement, right: ResolvedIntervalPlacement) {
  return (
    left.start - right.start ||
    left.end - right.end ||
    left.sourceOrder - right.sourceOrder ||
    left.key.localeCompare(right.key)
  );
}

function assignTracks(
  placements: readonly ResolvedIntervalPlacement[],
): ReadonlyMap<ViewPlacementKey, number> {
  const trackEnds: number[] = [];
  const tracks = new Map<ViewPlacementKey, number>();

  for (const placement of [...placements].sort(compareForStack)) {
    let track = trackEnds.findIndex((end) => end <= placement.start);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(placement.end);
    } else {
      trackEnds[track] = placement.end;
    }
    if (tracks.has(placement.key)) {
      throw new RangeError(`Layout placement key "${placement.key}" must be unique.`);
    }
    tracks.set(placement.key, track);
  }
  return tracks;
}

/**
 * Assigns the lowest available deterministic track and emits absolute, contiguous
 * lane and bar geometry without changing resolved-view output order.
 */
export function stackLanes(
  lanes: readonly ResolvedViewLane[],
  placements: readonly ResolvedIntervalPlacement[],
  metricOverrides?: Partial<StackLayoutMetrics>,
): StackLayout {
  const metrics = resolveStackLayoutMetrics(metricOverrides);
  const placementsByLane = new Map<ViewLaneKey, ResolvedIntervalPlacement[]>();
  const laneKeys = new Set<ViewLaneKey>();

  for (const lane of lanes) {
    if (laneKeys.has(lane.key)) {
      throw new RangeError(`Layout lane key "${lane.key}" must be unique.`);
    }
    laneKeys.add(lane.key);
    placementsByLane.set(lane.key, []);
  }
  for (const placement of placements) {
    const group = placementsByLane.get(placement.laneKey);
    if (!group) {
      throw new RangeError(`Layout placement "${placement.key}" references an unknown lane key.`);
    }
    group.push(placement);
  }

  let laneY = 0;
  const laidOutLanes: LaidOutLane[] = [];
  for (const lane of lanes) {
    const minimumHeight = lane.minimumHeight ?? metrics.defaultMinimumLaneHeight;
    if (!Number.isFinite(minimumHeight) || minimumHeight <= 0) {
      throw new RangeError(`Lane "${lane.key}" minimum height must be positive and finite.`);
    }
    const lanePlacements = placementsByLane.get(lane.key)!;
    const tracks = assignTracks(lanePlacements);
    const stackCount = tracks.size === 0 ? 0 : Math.max(...tracks.values()) + 1;
    const contentHeight =
      metrics.paddingTop +
      metrics.paddingBottom +
      stackCount * metrics.barHeight +
      Math.max(0, stackCount - 1) * metrics.stackGap;
    const height = Math.max(minimumHeight, contentHeight);
    const laidOutPlacements = lanePlacements.map((placement) => {
      const track = tracks.get(placement.key)!;
      return Object.freeze({
        ...placement,
        source: Object.freeze({ ...placement.source }),
        track,
        y: laneY + metrics.paddingTop + track * (metrics.barHeight + metrics.stackGap),
        height: metrics.barHeight,
      });
    });
    laidOutLanes.push(
      Object.freeze({
        ...lane,
        source: Object.freeze({ ...lane.source }),
        y: laneY,
        height,
        stackCount,
        placements: Object.freeze(laidOutPlacements),
      }),
    );
    laneY += height;
  }

  return Object.freeze({
    lanes: Object.freeze(laidOutLanes),
    totalHeight: laneY,
  });
}
