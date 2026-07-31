import type { ViewportKernel } from './create-viewport-kernel';
import type { ViewportQuery, ViewportResult, VisibleViewportLane } from './types';

/**
 * Deliberately scans complete layout for parity tests and benchmarks; runtime code
 * must use queryViewport instead.
 */
export function queryViewportBruteForce(
  kernel: ViewportKernel,
  query: ViewportQuery,
): ViewportResult {
  const verticalEnd = query.verticalStart + query.verticalExtent;
  if (
    !Number.isFinite(query.timeRange.start) ||
    !Number.isFinite(query.timeRange.end) ||
    query.timeRange.end <= query.timeRange.start ||
    !Number.isFinite(query.verticalStart) ||
    query.verticalStart < 0 ||
    !Number.isFinite(query.verticalExtent) ||
    query.verticalExtent <= 0 ||
    !Number.isFinite(verticalEnd)
  ) {
    throw new RangeError('Invalid brute-force viewport query.');
  }

  const lanes: VisibleViewportLane[] = [];
  const placements = [];
  for (const lane of kernel.lanes) {
    if (lane.y + lane.height <= query.verticalStart || lane.y >= verticalEnd) {
      continue;
    }
    const visible = lane.placements.filter((placement) =>
      placement.start === placement.end
        ? placement.start >= query.timeRange.start && placement.start < query.timeRange.end
        : placement.start < query.timeRange.end && placement.end > query.timeRange.start,
    );
    placements.push(...visible);
    lanes.push(
      Object.freeze({
        ...lane,
        source: Object.freeze({ ...lane.source }),
        placements: Object.freeze(visible),
      }),
    );
  }
  return Object.freeze({
    query: Object.freeze({
      timeRange: Object.freeze({ ...query.timeRange }),
      verticalStart: query.verticalStart,
      verticalExtent: query.verticalExtent,
    }),
    contentBounds: kernel.contentBounds,
    lanes: Object.freeze(lanes),
    placements: Object.freeze(placements),
  });
}
