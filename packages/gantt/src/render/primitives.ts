import type { Diagnostic } from '../model/diagnostics';
import type {
  DependencyRecord,
  DependencyType,
  EntityId,
  EpochMilliseconds,
  GanttDocument,
  TaskKind,
  TimeRange,
} from '../model/types';
import type { ResolvedSummaryPresentation } from '../presentation/resolve-task-presentations';
import type {
  GanttViewDefinition,
  ResolvedProjectTaskMetadata,
  ViewLaneSource,
  ViewPlacementSource,
} from '../view/types';
import type { ResolveProjectViewQuery } from '../view/types';
import type { GanttTimeScaleLevel } from '../time/adaptive-scale';
import type { EffectiveAppearancePrimitive, GanttAppearanceVariantOption } from './appearance';

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
  readonly defaultLaneHeight: number;
  readonly timelineHeight: number;
  readonly totalHeight: number;
}

export interface TimeTickPrimitive {
  readonly kind?: 'major' | 'minor';
  readonly time: EpochMilliseconds;
  readonly x: number;
  readonly label: string;
}

export interface GridLinePrimitive {
  readonly kind?: 'major' | 'minor';
  readonly time: EpochMilliseconds;
  readonly x: number;
}

export interface LaneRowPrimitive {
  readonly appearance?: EffectiveAppearancePrimitive;
  readonly viewKey: string;
  readonly laneId?: EntityId;
  readonly resourceId?: EntityId;
  readonly source: ViewLaneSource;
  readonly title: string;
  readonly y: number;
  readonly height: number;
  readonly project?: ResolvedProjectTaskMetadata;
}

export interface TaskProgressPrimitive {
  readonly value: number;
  readonly width: number;
  readonly x: number;
}

export type TaskPresentationGeometryPrimitive =
  | { readonly kind: 'bar' }
  | { readonly capHeight: number; readonly kind: 'summary' }
  | { readonly centerX: number; readonly kind: 'milestone'; readonly size: number };

export interface TaskPresentationPrimitive {
  readonly geometry: TaskPresentationGeometryPrimitive;
  readonly intervalSource: 'canonical' | 'descendants';
  readonly kind: TaskKind;
  readonly project?: ResolvedProjectTaskMetadata;
  readonly summary?: ResolvedSummaryPresentation;
}

export interface TaskBarPrimitive {
  readonly appearance?: EffectiveAppearancePrimitive;
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
  readonly progress?: TaskProgressPrimitive;
  readonly presentation: TaskPresentationPrimitive;
  readonly clippedStart: boolean;
  readonly clippedEnd: boolean;
}

export interface DependencyRoutePointPrimitive {
  readonly x: number;
  readonly y: number;
}

export interface DependencyPathPrimitive {
  readonly dependencyId: EntityId;
  readonly fromTaskId: EntityId;
  readonly fromViewKey: string;
  readonly hiddenEndpoint: boolean;
  readonly points: readonly DependencyRoutePointPrimitive[];
  readonly status: 'invalid' | 'valid';
  readonly toTaskId: EntityId;
  readonly toViewKey: string;
  readonly type: DependencyType;
  readonly clippedStart: boolean;
  readonly clippedEnd: boolean;
}

export interface DependencySummaryPrimitive {
  readonly dependency: DependencyRecord;
  readonly fromTitle: string;
  readonly hiddenEndpoint: boolean;
  readonly status: 'invalid' | 'valid';
  readonly toTitle: string;
  readonly visualized: boolean;
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
  readonly dependencyPaths: readonly DependencyPathPrimitive[];
  readonly dependencySummaries: readonly DependencySummaryPrimitive[];
  readonly emptyState?: EmptyStatePrimitive;
  readonly diagnostics: readonly Diagnostic[];
}

export interface BuildChartSceneOptions {
  readonly appearanceVariants?: readonly GanttAppearanceVariantOption[];
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
  readonly projectQuery?: ResolveProjectViewQuery;
  readonly taskVariants?: Readonly<Record<EntityId, string>>;
  readonly timeScaleLevel?: GanttTimeScaleLevel;
  readonly timeScaleWidth?: number;
}
