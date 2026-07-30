import type { LaidOutLane, LaidOutPlacement, StackLayout } from '../layout/stack-lanes';
import type { TimeRange } from '../model/types';
import { createIntervalIndex, type IntervalIndex } from './interval-index';
import { createLanePrefixIndex, type LanePrefixIndex } from './lane-prefix-index';
import type { ViewportContentBounds } from './types';

export interface ViewportKernel {
  readonly lanes: readonly LaidOutLane[];
  readonly lanePrefixIndex: LanePrefixIndex;
  readonly intervalIndexes: readonly IntervalIndex[];
  readonly contentBounds: ViewportContentBounds;
}

function clonePlacement(placement: LaidOutPlacement): LaidOutPlacement {
  return Object.freeze({
    ...placement,
    source: Object.freeze({ ...placement.source }),
  });
}

function cloneLane(lane: LaidOutLane): LaidOutLane {
  return Object.freeze({
    ...lane,
    source: Object.freeze({ ...lane.source }),
    placements: Object.freeze(lane.placements.map(clonePlacement)),
  });
}

function contentTimeRange(lanes: readonly LaidOutLane[]): TimeRange | undefined {
  let start = Infinity;
  let end = -Infinity;
  for (const lane of lanes) {
    for (const placement of lane.placements) {
      start = Math.min(start, placement.start);
      end = Math.max(end, placement.end);
    }
  }
  return start === Infinity ? undefined : Object.freeze({ start, end });
}

/**
 * Defensively freezes completed layout and builds reusable vertical and interval
 * indexes exactly once for subsequent viewport queries.
 */
export function createViewportKernel(layout: StackLayout): ViewportKernel {
  let expectedY = 0;
  for (const lane of layout.lanes) {
    if (
      !Number.isFinite(lane.y) ||
      !Number.isFinite(lane.height) ||
      lane.y !== expectedY ||
      lane.height <= 0
    ) {
      throw new RangeError('Viewport layout lanes must have contiguous finite geometry.');
    }
    expectedY += lane.height;
  }
  if (!Number.isFinite(layout.totalHeight) || layout.totalHeight !== expectedY) {
    throw new RangeError('Viewport layout total height must equal its contiguous lane height.');
  }

  const lanes = Object.freeze(layout.lanes.map(cloneLane));
  const timeRange = contentTimeRange(lanes);
  return Object.freeze({
    lanes,
    lanePrefixIndex: createLanePrefixIndex(lanes),
    intervalIndexes: Object.freeze(lanes.map((lane) => createIntervalIndex(lane.placements))),
    contentBounds: Object.freeze({
      height: layout.totalHeight,
      ...(timeRange === undefined ? {} : { timeRange }),
    }),
  });
}
