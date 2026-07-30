import type { LaidOutPlacement } from '../layout/stack-lanes';
import { queryIntervalIndex } from './interval-index';
import { findFirstVisibleLane } from './lane-prefix-index';
import type { ViewportKernel } from './create-viewport-kernel';
import type {
  ViewportQuery,
  ViewportQueryWithWork,
  ViewportResult,
  VisibleViewportLane,
} from './types';

function validateQuery(query: ViewportQuery): number {
  const { start, end } = query.timeRange;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new RangeError('Viewport time range must have finite increasing boundaries.');
  }
  if (!Number.isFinite(query.verticalStart) || query.verticalStart < 0) {
    throw new RangeError('Viewport vertical start must be non-negative and finite.');
  }
  if (!Number.isFinite(query.verticalExtent) || query.verticalExtent <= 0) {
    throw new RangeError('Viewport vertical extent must be positive and finite.');
  }
  const verticalEnd = query.verticalStart + query.verticalExtent;
  if (!Number.isFinite(verticalEnd)) {
    throw new RangeError('Viewport vertical range must remain finite.');
  }
  return verticalEnd;
}

function freezeResult(
  kernel: ViewportKernel,
  query: ViewportQuery,
  lanes: readonly VisibleViewportLane[],
  placements: readonly LaidOutPlacement[],
): ViewportResult {
  return Object.freeze({
    query: Object.freeze({
      timeRange: Object.freeze({ ...query.timeRange }),
      verticalStart: query.verticalStart,
      verticalExtent: query.verticalExtent,
    }),
    contentBounds: kernel.contentBounds,
    lanes: Object.freeze([...lanes]),
    placements: Object.freeze([...placements]),
  });
}

/**
 * Queries one immutable kernel and returns ephemeral work observations for tests and
 * benchmarks without retaining prior result arrays in production state.
 */
export function queryViewportWithWork(
  kernel: ViewportKernel,
  query: ViewportQuery,
): ViewportQueryWithWork {
  const verticalEnd = validateQuery(query);
  const visibleLanes: VisibleViewportLane[] = [];
  const visiblePlacements: LaidOutPlacement[] = [];
  let laneCandidates = 0;
  let intervalNodesVisited = 0;

  const firstLane = findFirstVisibleLane(kernel.lanePrefixIndex, query.verticalStart);
  for (let laneIndex = firstLane; laneIndex < kernel.lanes.length; laneIndex += 1) {
    const lane = kernel.lanes[laneIndex]!;
    if (lane.y >= verticalEnd) {
      break;
    }
    laneCandidates += 1;
    const intervalResult = queryIntervalIndex(kernel.intervalIndexes[laneIndex]!, query.timeRange);
    intervalNodesVisited += intervalResult.nodesVisited;
    visiblePlacements.push(...intervalResult.placements);
    visibleLanes.push(
      Object.freeze({
        ...lane,
        source: Object.freeze({ ...lane.source }),
        placements: intervalResult.placements,
      }),
    );
  }

  return Object.freeze({
    result: freezeResult(kernel, query, visibleLanes, visiblePlacements),
    work: Object.freeze({ laneCandidates, intervalNodesVisited }),
  });
}

export function queryViewport(kernel: ViewportKernel, query: ViewportQuery): ViewportResult {
  return queryViewportWithWork(kernel, query).result;
}
