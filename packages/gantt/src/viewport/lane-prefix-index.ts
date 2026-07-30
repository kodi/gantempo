import type { LaidOutLane } from '../layout/stack-lanes';

export interface LanePrefixIndex {
  readonly laneEnds: readonly number[];
}

export function createLanePrefixIndex(lanes: readonly LaidOutLane[]): LanePrefixIndex {
  return Object.freeze({
    laneEnds: Object.freeze(lanes.map((lane) => lane.y + lane.height)),
  });
}

/**
 * Finds the first lane whose half-open outer range can intersect verticalStart.
 */
export function findFirstVisibleLane(index: LanePrefixIndex, verticalStart: number): number {
  let low = 0;
  let high = index.laneEnds.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (index.laneEnds[middle]! <= verticalStart) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}
