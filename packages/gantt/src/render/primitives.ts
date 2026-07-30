import type { Diagnostic } from '../model/diagnostics';
import type { EntityId, EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import type { GanttViewDefinition, ViewLaneSource, ViewPlacementSource } from '../view/types';

export interface ChartLayoutMetrics {
  readonly headerHeight: number;
  readonly rowHeight: number;
  readonly barHeight: number;
  readonly laneColumnWidth: number;
  readonly labelPadding: number;
  readonly lanePaddingTop: number;
  readonly lanePaddingBottom: number;
  readonly stackGap: number;
}

export const DEFAULT_CHART_LAYOUT_METRICS: ChartLayoutMetrics = Object.freeze({
  headerHeight: 40,
  rowHeight: 58,
  barHeight: 24,
  laneColumnWidth: 160,
  labelPadding: 8,
  lanePaddingTop: 17,
  lanePaddingBottom: 17,
  stackGap: 6,
});

export interface ChartBoundsPrimitive {
  readonly headerHeight: number;
  readonly laneColumnWidth: number;
  readonly timelineHeight: number;
  readonly totalHeight: number;
}

export interface TimeTickPrimitive {
  readonly time: EpochMilliseconds;
  readonly x: number;
  readonly label: string;
}

export interface GridLinePrimitive {
  readonly time: EpochMilliseconds;
  readonly x: number;
}

export interface LaneRowPrimitive {
  readonly viewKey: string;
  readonly laneId?: EntityId;
  readonly resourceId?: EntityId;
  readonly source: ViewLaneSource;
  readonly title: string;
  readonly y: number;
  readonly height: number;
}

export interface TaskBarPrimitive {
  readonly viewKey: string;
  readonly laneViewKey: string;
  readonly placementId?: EntityId;
  readonly taskId: EntityId;
  readonly laneId?: EntityId;
  readonly resourceId?: EntityId;
  readonly assignmentId?: EntityId;
  readonly segmentId?: EntityId;
  readonly source: ViewPlacementSource;
  readonly title: string;
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
  readonly x: number;
  readonly width: number;
  readonly y: number;
  readonly height: number;
  readonly clippedStart: boolean;
  readonly clippedEnd: boolean;
}

export interface EmptyStatePrimitive {
  readonly title: string;
  readonly description: string;
}

export interface ChartScene {
  readonly range: TimeRange;
  readonly bounds: ChartBoundsPrimitive;
  readonly ticks: readonly TimeTickPrimitive[];
  readonly gridLines: readonly GridLinePrimitive[];
  readonly lanes: readonly LaneRowPrimitive[];
  readonly taskBars: readonly TaskBarPrimitive[];
  readonly emptyState?: EmptyStatePrimitive;
  readonly diagnostics: readonly Diagnostic[];
}

export interface BuildChartSceneOptions {
  readonly document: GanttDocument;
  readonly view?: GanttViewDefinition;
  readonly range: TimeRange;
  readonly viewport?: {
    readonly verticalStart: number;
    readonly verticalExtent: number;
  };
  readonly tickAnchor: EpochMilliseconds;
  readonly tickInterval: number;
  readonly timeZone: string;
  readonly locale?: string;
  readonly metrics?: Partial<ChartLayoutMetrics>;
}
