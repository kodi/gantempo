import type { LaidOutLane, LaidOutPlacement } from '../layout/stack-lanes';
import type { TimeRange } from '../model/types';

export interface ViewportQuery {
  readonly timeRange: TimeRange;
  readonly verticalStart: number;
  readonly verticalExtent: number;
}

export interface ViewportContentBounds {
  readonly height: number;
  readonly timeRange?: TimeRange;
}

export type VisibleViewportLane = Omit<LaidOutLane, 'placements'> & {
  readonly placements: readonly LaidOutPlacement[];
};

export interface ViewportResult {
  readonly query: ViewportQuery;
  readonly contentBounds: ViewportContentBounds;
  readonly lanes: readonly VisibleViewportLane[];
  readonly placements: readonly LaidOutPlacement[];
}

export interface ViewportQueryWork {
  readonly laneCandidates: number;
  readonly intervalNodesVisited: number;
}

export interface ViewportQueryWithWork {
  readonly result: ViewportResult;
  readonly work: ViewportQueryWork;
}
