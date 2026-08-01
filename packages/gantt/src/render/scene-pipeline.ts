import type { EntityReference } from '../commands/types';
import { routeDependency, type DependencyRouteEndpoint } from '../layout/route-dependencies';
import type { ResolvedIntervalPlacement } from '../layout/resolve-placement-intervals';
import {
  resolvePlacementIntervals,
  type ResolvePlacementIntervalsResult,
} from '../layout/resolve-placement-intervals';
import {
  positionStackedLanes,
  resolveStackLayoutMetrics,
  stackLane,
  type LaidOutLane,
  type StackLayout,
} from '../layout/stack-lanes';
import type { Diagnostic } from '../model/diagnostics';
import { buildDocumentIndexes, type DocumentIndexes } from '../model/indexes';
import type { GanttDocument, TimeRange } from '../model/types';
import { validateDocumentReferences, type ValidateDocumentResult } from '../model/validate';
import { generateFixedIntervalTicks } from '../time/fixed-interval-ticks';
import { generateAdaptiveTimeTicks } from '../time/adaptive-ticks';
import { createLinearTimeScale } from '../time/linear-time-scale';
import { resolveView } from '../view/resolve-view';
import { sameViewDefinition } from '../view/definition-equality';
import type {
  GanttViewDefinition,
  ResolvedViewLane,
  ResolvedViewPlacement,
  ResolveViewResult,
  ViewLaneKey,
} from '../view/types';
import { createIntervalIndex, type IntervalIndex } from '../viewport/interval-index';
import { createLanePrefixIndex } from '../viewport/lane-prefix-index';
import { queryViewport } from '../viewport/query-viewport';
import type { ViewportKernel } from '../viewport/create-viewport-kernel';
import type { ViewportResult } from '../viewport/types';
import {
  DEFAULT_CHART_LAYOUT_METRICS,
  type BuildChartSceneOptions,
  type ChartLayoutMetrics,
  type ChartScene,
  type DependencyPathPrimitive,
  type DependencySummaryPrimitive,
  type GridLinePrimitive,
  type LaneRowPrimitive,
  type TaskBarPrimitive,
  type TimeTickPrimitive,
} from './primitives';
import {
  createAppearanceRegistry,
  resolveLaneAppearance,
  resolveTaskAppearance,
  type AppearanceRegistry,
  type EffectiveAppearancePrimitive,
} from './appearance';

export type ChartSceneInvalidation =
  | {
      readonly affected: readonly EntityReference[];
      readonly kind: 'affected';
    }
  | {
      readonly kind: 'external';
    };

export interface ChartScenePipelineWork {
  readonly appearanceRegistryBuilds: number;
  readonly affectedLaneKeys: readonly string[];
  readonly indexBuilds: number;
  readonly intervalBuilds: number;
  readonly lanePositionBuilds: number;
  readonly lanePrimitiveBuilds: number;
  readonly laneStackBuilds: number;
  readonly mode: 'cold' | 'fallback' | 'reused' | 'selective';
  readonly occurrenceCatalogBuilds: number;
  readonly taskPrimitiveBuilds: number;
  readonly tickBuilds: number;
  readonly topologyBuilds: number;
  readonly validationBuilds: number;
  readonly viewportIntervalIndexBuilds: number;
  readonly viewportKernelBuilds: number;
  readonly viewportQueries: number;
}

export interface ChartScenePipelineResult {
  readonly occurrences: readonly ChartSceneOccurrence[];
  readonly scene: ChartScene;
  readonly work: ChartScenePipelineWork;
}

export interface ChartSceneOccurrence {
  readonly assignmentId?: string;
  readonly end: number;
  readonly height: number;
  readonly laneHeight: number;
  readonly laneId?: string;
  readonly laneIndex: number;
  readonly laneViewKey: string;
  readonly laneY: number;
  readonly placementId?: string;
  readonly resourceId?: string;
  readonly segmentId?: string;
  readonly start: number;
  readonly taskId: string;
  readonly viewKey: string;
  readonly y: number;
}

export interface ChartSceneDependencyMap {
  readonly laneKeysByReference: ReadonlyMap<string, readonly string[]>;
  readonly occurrenceKeysByReference: ReadonlyMap<string, readonly string[]>;
}

export interface ChartScenePipeline {
  build(
    options: BuildChartSceneOptions,
    invalidation?: ChartSceneInvalidation,
  ): ChartScenePipelineResult;
  getDependencies(): ChartSceneDependencyMap | undefined;
  reset(): void;
}

interface MutableWork {
  appearanceRegistryBuilds: number;
  affectedLaneKeys: string[];
  indexBuilds: number;
  intervalBuilds: number;
  lanePositionBuilds: number;
  lanePrimitiveBuilds: number;
  laneStackBuilds: number;
  mode: ChartScenePipelineWork['mode'];
  occurrenceCatalogBuilds: number;
  taskPrimitiveBuilds: number;
  tickBuilds: number;
  topologyBuilds: number;
  validationBuilds: number;
  viewportIntervalIndexBuilds: number;
  viewportKernelBuilds: number;
  viewportQueries: number;
}

interface LaneStackCacheEntry {
  readonly lane: LaidOutLane;
  readonly signature: string;
}

interface PipelineCache {
  readonly appearanceRegistry: AppearanceRegistry;
  readonly dependencies?: ChartSceneDependencyMap;
  readonly dependencyPaths: readonly DependencyPathPrimitive[];
  readonly dependencySummaries: readonly DependencySummaryPrimitive[];
  readonly indexes: DocumentIndexes;
  readonly intervals?: ResolvePlacementIntervalsResult;
  readonly kernel?: ViewportKernel;
  readonly lanePrimitiveByKey: ReadonlyMap<string, LaneRowPrimitive>;
  readonly laneStacks: ReadonlyMap<ViewLaneKey, LaneStackCacheEntry>;
  readonly layout?: StackLayout;
  readonly localLanes?: readonly LaidOutLane[];
  readonly metrics: ChartLayoutMetrics;
  readonly legacyTaskVariantsSignature: string;
  readonly occurrences: readonly ChartSceneOccurrence[];
  readonly options: BuildChartSceneOptions;
  readonly scene: ChartScene;
  readonly taskPrimitiveByKey: ReadonlyMap<string, TaskBarPrimitive>;
  readonly tickDiagnostics: readonly Diagnostic[];
  readonly ticks: readonly TimeTickPrimitive[];
  readonly topology: ResolveViewResult;
  readonly validation: ValidateDocumentResult;
  readonly viewport?: ViewportResult;
}

function createWork(mode: MutableWork['mode']): MutableWork {
  return {
    appearanceRegistryBuilds: 0,
    affectedLaneKeys: [],
    indexBuilds: 0,
    intervalBuilds: 0,
    lanePositionBuilds: 0,
    lanePrimitiveBuilds: 0,
    laneStackBuilds: 0,
    mode,
    occurrenceCatalogBuilds: 0,
    taskPrimitiveBuilds: 0,
    tickBuilds: 0,
    topologyBuilds: 0,
    validationBuilds: 0,
    viewportIntervalIndexBuilds: 0,
    viewportKernelBuilds: 0,
    viewportQueries: 0,
  };
}

function freezeWork(work: MutableWork): ChartScenePipelineWork {
  return Object.freeze({
    ...work,
    affectedLaneKeys: Object.freeze([...work.affectedLaneKeys].sort()),
  });
}

function resolveMetrics(overrides?: Partial<ChartLayoutMetrics>): ChartLayoutMetrics {
  const metrics = { ...DEFAULT_CHART_LAYOUT_METRICS, ...overrides };
  for (const name of ['headerHeight', 'rowHeight', 'barHeight', 'laneColumnWidth'] as const) {
    if (!Number.isFinite(metrics[name]) || metrics[name] <= 0) {
      throw new RangeError(`Layout metric "${name}" must be a positive finite number.`);
    }
  }
  for (const name of ['labelPadding', 'lanePaddingTop', 'lanePaddingBottom', 'stackGap'] as const) {
    if (!Number.isFinite(metrics[name]) || metrics[name] < 0) {
      throw new RangeError(`Layout metric "${name}" must be a non-negative finite number.`);
    }
  }
  resolveStackLayoutMetrics({
    defaultMinimumLaneHeight: metrics.rowHeight,
    barHeight: metrics.barHeight,
    paddingTop: metrics.lanePaddingTop,
    paddingBottom: metrics.lanePaddingBottom,
    stackGap: metrics.stackGap,
  });
  return Object.freeze(metrics);
}

function sameMetrics(previous: ChartLayoutMetrics, next: ChartLayoutMetrics): boolean {
  return (Object.keys(previous) as (keyof ChartLayoutMetrics)[]).every(
    (key) => previous[key] === next[key],
  );
}

function sameRange(previous: TimeRange, next: TimeRange): boolean {
  return previous.start === next.start && previous.end === next.end;
}

function tickSignature(options: BuildChartSceneOptions): string {
  return JSON.stringify([
    options.range.start,
    options.range.end,
    options.tickAnchor,
    options.tickInterval,
    options.timeZone,
    options.locale,
    options.timeScaleLevel,
    options.timeScaleWidth,
    options.direction,
  ]);
}

function directionalX(x: number, direction: BuildChartSceneOptions['direction']): number {
  return direction === 'rtl' ? 1 - x : x;
}

function projectQuerySignature(options: BuildChartSceneOptions): string {
  return JSON.stringify(options.projectQuery ?? {});
}

function appearanceRegistrySignature(options: BuildChartSceneOptions): string {
  return JSON.stringify(options.appearanceVariants ?? []);
}

function legacyTaskVariantsSignature(options: BuildChartSceneOptions): string {
  return JSON.stringify(
    Object.entries(options.taskVariants ?? {}).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

function viewportSignature(options: BuildChartSceneOptions, totalHeight: number): string {
  return JSON.stringify([
    options.range.start,
    options.range.end,
    options.viewport?.verticalStart ?? 0,
    options.viewport?.verticalExtent ?? totalHeight,
  ]);
}

function referenceKey(reference: EntityReference): string {
  return `${reference.collection}\u0000${reference.id}`;
}

function addDependency(
  target: Map<string, Set<string>>,
  collection: EntityReference['collection'],
  id: string | undefined,
  value: string,
): void {
  if (id === undefined) {
    return;
  }
  const key = referenceKey({ collection, id });
  const values = target.get(key);
  if (values === undefined) {
    target.set(key, new Set([value]));
  } else {
    values.add(value);
  }
}

function freezeDependencyMap(
  source: Map<string, Set<string>>,
): ReadonlyMap<string, readonly string[]> {
  return new Map([...source].map(([key, values]) => [key, Object.freeze([...values])] as const));
}

function buildDependencies(topology: ResolveViewResult): ChartSceneDependencyMap | undefined {
  if (topology.status === 'rejected') {
    return undefined;
  }
  const lanes = new Map<string, Set<string>>();
  const occurrences = new Map<string, Set<string>>();

  for (const lane of topology.view.lanes) {
    if (lane.source.kind === 'document-lane') {
      addDependency(lanes, 'lanes', lane.source.laneId, lane.key);
      addDependency(lanes, 'resources', lane.source.resourceId, lane.key);
    } else if (lane.source.kind === 'project-task') {
      addDependency(lanes, 'tasks', lane.source.taskId, lane.key);
    } else if (lane.source.kind === 'resource') {
      addDependency(lanes, 'resources', lane.source.resourceId, lane.key);
    }
  }

  for (const placement of topology.view.placements) {
    addDependency(lanes, 'tasks', placement.taskId, placement.laneKey);
    addDependency(occurrences, 'tasks', placement.taskId, placement.key);
    addDependency(lanes, 'assignments', placement.assignmentId, placement.laneKey);
    addDependency(occurrences, 'assignments', placement.assignmentId, placement.key);
    if (placement.source.kind === 'document-placement') {
      addDependency(lanes, 'placements', placement.source.placementId, placement.laneKey);
      addDependency(occurrences, 'placements', placement.source.placementId, placement.key);
      addDependency(lanes, 'lanes', placement.source.laneId, placement.laneKey);
    } else if (placement.source.kind === 'resource-assignment') {
      addDependency(lanes, 'resources', placement.source.resourceId, placement.laneKey);
      addDependency(occurrences, 'resources', placement.source.resourceId, placement.key);
    }
  }

  return Object.freeze({
    laneKeysByReference: freezeDependencyMap(lanes),
    occurrenceKeysByReference: freezeDependencyMap(occurrences),
  });
}

function affectedLaneKeys(
  affected: readonly EntityReference[],
  previous: ChartSceneDependencyMap | undefined,
  next: ChartSceneDependencyMap | undefined,
): readonly string[] {
  const keys = new Set<string>();
  for (const reference of affected) {
    const key = referenceKey(reference);
    for (const laneKey of previous?.laneKeysByReference.get(key) ?? []) {
      keys.add(laneKey);
    }
    for (const laneKey of next?.laneKeysByReference.get(key) ?? []) {
      keys.add(laneKey);
    }
  }
  return Object.freeze([...keys]);
}

function recordById(document: GanttDocument, reference: EntityReference): object | undefined {
  return document[reference.collection].find((record) => record.id === reference.id);
}

function taskIntervalSignature(record: object | undefined): string | undefined {
  if (record === undefined) {
    return undefined;
  }
  const task = record as GanttDocument['tasks'][number];
  const schedule = (value: typeof task.schedule) =>
    value?.mode === 'instant'
      ? ['instant', value.start, value.end]
      : value === undefined
        ? undefined
        : ['all-day', value.startDate, value.endDate];
  return JSON.stringify([
    task.kind,
    schedule(task.schedule),
    task.segments.map((segment) => [segment.id, schedule(segment.schedule)]),
  ]);
}

function taskTopologySignature(
  record: object | undefined,
  view: GanttViewDefinition | undefined,
): string | undefined {
  if (record === undefined) {
    return undefined;
  }
  const task = record as GanttDocument['tasks'][number];
  const viewKind = view?.kind ?? 'document';
  if (view?.kind === 'project' && (view.filter !== undefined || view.sort !== undefined)) {
    return JSON.stringify(task);
  }
  return JSON.stringify([
    viewKind === 'project' ? task.title : undefined,
    viewKind === 'project' ? task.kind : undefined,
    viewKind === 'project' ? task.order : undefined,
    viewKind === 'project' ? task.parentId : undefined,
    task.segments.map((segment) => segment.id),
  ]);
}

function laneTopologySignature(record: object | undefined): string | undefined {
  if (record === undefined) {
    return undefined;
  }
  const lane = record as GanttDocument['lanes'][number];
  return JSON.stringify([
    lane.id,
    lane.title,
    lane.parentId,
    lane.resourceId,
    lane.order,
    lane.height,
    lane.fields,
  ]);
}

function topologyAffected(
  affected: readonly EntityReference[],
  previousDocument: GanttDocument,
  nextDocument: GanttDocument,
  view: GanttViewDefinition | undefined,
): boolean {
  const viewKind = view?.kind ?? 'document';
  return affected.some((reference) => {
    const previous = recordById(previousDocument, reference);
    const next = recordById(nextDocument, reference);
    if (reference.collection === 'dependencies') {
      return false;
    }
    if (reference.collection === 'tasks') {
      return taskTopologySignature(previous, view) !== taskTopologySignature(next, view);
    }
    if (reference.collection === 'placements') {
      return viewKind === 'document';
    }
    if (reference.collection === 'assignments') {
      return viewKind === 'document' || viewKind === 'resource' || viewKind === 'custom';
    }
    if (reference.collection === 'lanes') {
      return (
        viewKind === 'document' && laneTopologySignature(previous) !== laneTopologySignature(next)
      );
    }
    if (reference.collection === 'resources') {
      return viewKind === 'resource' || previous === undefined || next === undefined;
    }
    return true;
  });
}

function intervalsAffected(
  affected: readonly EntityReference[],
  previousDocument: GanttDocument,
  nextDocument: GanttDocument,
): boolean {
  return affected.some((reference) => {
    if (reference.collection !== 'tasks') {
      return false;
    }
    return (
      taskIntervalSignature(recordById(previousDocument, reference)) !==
      taskIntervalSignature(recordById(nextDocument, reference))
    );
  });
}

function stackSignature(
  lane: ResolvedViewLane,
  placements: readonly ResolvedIntervalPlacement[],
  metrics: ChartLayoutMetrics,
): string {
  return JSON.stringify([
    lane,
    placements,
    metrics.rowHeight,
    metrics.barHeight,
    metrics.lanePaddingTop,
    metrics.lanePaddingBottom,
    metrics.stackGap,
  ]);
}

function buildLayout(
  topology: Extract<ResolveViewResult, { readonly status: 'resolved' }>,
  intervals: ResolvePlacementIntervalsResult,
  metrics: ChartLayoutMetrics,
  previous: PipelineCache | undefined,
  forceAll: boolean,
  work: MutableWork,
): {
  readonly laneStacks: ReadonlyMap<ViewLaneKey, LaneStackCacheEntry>;
  readonly layout: StackLayout;
  readonly localLanes: readonly LaidOutLane[];
} {
  const placementsByLane = new Map<ViewLaneKey, ResolvedIntervalPlacement[]>(
    topology.view.lanes.map((lane) => [lane.key, []]),
  );
  for (const placement of intervals.placements) {
    const placements = placementsByLane.get(placement.laneKey);
    if (placements === undefined) {
      throw new RangeError(`Layout placement "${placement.key}" references an unknown lane key.`);
    }
    placements.push(placement);
  }

  const laneStacks = new Map<ViewLaneKey, LaneStackCacheEntry>();
  const localLanes = topology.view.lanes.map((lane) => {
    const placements = placementsByLane.get(lane.key)!;
    const signature = stackSignature(lane, placements, metrics);
    const cached = forceAll ? undefined : previous?.laneStacks.get(lane.key);
    const local =
      cached?.signature === signature
        ? cached.lane
        : stackLane(lane, placements, {
            defaultMinimumLaneHeight: metrics.rowHeight,
            barHeight: metrics.barHeight,
            paddingTop: metrics.lanePaddingTop,
            paddingBottom: metrics.lanePaddingBottom,
            stackGap: metrics.stackGap,
          });
    if (local !== cached?.lane) {
      work.laneStackBuilds += 1;
    }
    laneStacks.set(lane.key, Object.freeze({ lane: local, signature }));
    return local;
  });
  const positioned = positionStackedLanes(
    localLanes,
    previous?.layout === undefined || previous.localLanes === undefined || forceAll
      ? undefined
      : { absolute: previous.layout, local: previous.localLanes },
  );
  work.lanePositionBuilds += positioned.lanes.filter(
    (lane, index) => lane !== previous?.layout?.lanes[index],
  ).length;
  const layout =
    previous?.layout !== undefined &&
    positioned.totalHeight === previous.layout.totalHeight &&
    positioned.lanes.every((lane, index) => lane === previous.layout?.lanes[index])
      ? previous.layout
      : positioned;
  return Object.freeze({
    laneStacks,
    layout,
    localLanes: Object.freeze(localLanes),
  });
}

function clonePlacement(
  placement: LaidOutLane['placements'][number],
): LaidOutLane['placements'][number] {
  return Object.freeze({ ...placement, source: Object.freeze({ ...placement.source }) });
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

function buildViewportKernel(
  layout: StackLayout,
  previous: PipelineCache | undefined,
  forceAll: boolean,
  work: MutableWork,
): ViewportKernel {
  if (!forceAll && layout === previous?.layout && previous.kernel !== undefined) {
    return previous.kernel;
  }
  let expectedY = 0;
  const lanes = layout.lanes.map((lane, index) => {
    if (
      !Number.isFinite(lane.y) ||
      !Number.isFinite(lane.height) ||
      lane.y !== expectedY ||
      lane.height <= 0
    ) {
      throw new RangeError('Viewport layout lanes must have contiguous finite geometry.');
    }
    expectedY += lane.height;
    return !forceAll && lane === previous?.layout?.lanes[index] && previous.kernel
      ? previous.kernel.lanes[index]!
      : cloneLane(lane);
  });
  if (!Number.isFinite(layout.totalHeight) || layout.totalHeight !== expectedY) {
    throw new RangeError('Viewport layout total height must equal its contiguous lane height.');
  }
  const intervalIndexes = lanes.map((lane, index): IntervalIndex => {
    if (!forceAll && layout.lanes[index] === previous?.layout?.lanes[index] && previous?.kernel) {
      return previous.kernel.intervalIndexes[index]!;
    }
    work.viewportIntervalIndexBuilds += 1;
    return createIntervalIndex(lane.placements);
  });
  const timeRange = contentTimeRange(lanes);
  work.viewportKernelBuilds += 1;
  return Object.freeze({
    lanes: Object.freeze(lanes),
    lanePrefixIndex: createLanePrefixIndex(lanes),
    intervalIndexes: Object.freeze(intervalIndexes),
    contentBounds: Object.freeze({
      height: layout.totalHeight,
      ...(timeRange === undefined ? {} : { timeRange }),
    }),
  });
}

function lanePrimitive(
  lane: LaidOutLane,
  indexes: DocumentIndexes,
  appearanceRegistry: AppearanceRegistry,
): LaneRowPrimitive {
  const laneId = lane.source.kind === 'document-lane' ? lane.source.laneId : undefined;
  const resourceId =
    lane.source.kind === 'resource'
      ? lane.source.resourceId
      : lane.source.kind === 'document-lane'
        ? lane.source.resourceId
        : undefined;
  const laneVariant =
    laneId === undefined ? undefined : indexes.lanesById.get(laneId)?.appearance?.variant;
  return Object.freeze({
    appearance: resolveLaneAppearance(appearanceRegistry, laneVariant),
    viewKey: lane.key,
    ...(laneId === undefined ? {} : { laneId }),
    ...(resourceId === undefined ? {} : { resourceId }),
    source: Object.freeze({ ...lane.source }),
    title: lane.title,
    y: lane.y,
    height: lane.height,
    ...(lane.project === undefined ? {} : { project: Object.freeze({ ...lane.project }) }),
  });
}

function placementProvenance(
  placement: ResolvedViewPlacement,
  lane: Pick<LaneRowPrimitive, 'laneId' | 'resourceId'>,
): Pick<TaskBarPrimitive, 'assignmentId' | 'laneId' | 'placementId' | 'resourceId' | 'segmentId'> {
  const placementId =
    placement.source.kind === 'document-placement' ? placement.source.placementId : undefined;
  return {
    ...(placementId === undefined ? {} : { placementId }),
    ...(lane.laneId === undefined ? {} : { laneId: lane.laneId }),
    ...(lane.resourceId === undefined ? {} : { resourceId: lane.resourceId }),
    ...(placement.assignmentId === undefined ? {} : { assignmentId: placement.assignmentId }),
    ...(placement.segmentId === undefined ? {} : { segmentId: placement.segmentId }),
  };
}

/**
 * Projects the completed layout into stable offscreen-addressable occurrence data.
 * The React runtime consumes this catalog for identity and reveal, while scene
 * primitives remain bounded by the viewport query.
 */
function buildOccurrenceCatalog(layout: StackLayout): readonly ChartSceneOccurrence[] {
  return Object.freeze(
    layout.lanes.flatMap((lane, laneIndex) => {
      const laneId = lane.source.kind === 'document-lane' ? lane.source.laneId : undefined;
      const resourceId =
        lane.source.kind === 'resource'
          ? lane.source.resourceId
          : lane.source.kind === 'document-lane'
            ? lane.source.resourceId
            : undefined;
      const laneMetadata = {
        ...(laneId === undefined ? {} : { laneId }),
        ...(resourceId === undefined ? {} : { resourceId }),
      };
      return lane.placements.map((placement) =>
        Object.freeze({
          viewKey: placement.key,
          laneViewKey: placement.laneKey,
          ...placementProvenance(placement, laneMetadata),
          taskId: placement.taskId,
          laneIndex,
          laneY: lane.y,
          laneHeight: lane.height,
          start: placement.start,
          end: placement.end,
          y: placement.y,
          height: placement.height,
        }),
      );
    }),
  );
}

function dependencyStatus(
  dependencyId: string,
  diagnostics: readonly Diagnostic[],
): DependencyPathPrimitive['status'] {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === 'error' && diagnostic.entityIds?.includes(dependencyId) === true,
  )
    ? 'invalid'
    : 'valid';
}

function sameJson<T>(next: readonly T[], previous: readonly T[] | undefined): readonly T[] {
  return previous !== undefined && JSON.stringify(next) === JSON.stringify(previous)
    ? previous
    : next;
}

function buildDependencyPrimitives(
  options: BuildChartSceneOptions,
  indexes: DocumentIndexes,
  layout: StackLayout,
  occurrences: readonly ChartSceneOccurrence[],
  diagnostics: readonly Diagnostic[],
  previous?: Pick<PipelineCache, 'dependencyPaths' | 'dependencySummaries'>,
): {
  readonly paths: readonly DependencyPathPrimitive[];
  readonly summaries: readonly DependencySummaryPrimitive[];
} {
  const projectView = (options.view?.kind ?? 'document') === 'project';
  const occurrenceByTaskId = new Map(
    occurrences.map((occurrence) => [occurrence.taskId, occurrence]),
  );
  const laneByKey = new Map<string, LaidOutLane>(layout.lanes.map((lane) => [lane.key, lane]));
  const scale = createLinearTimeScale(options.range, { start: 0, end: 1 });

  const endpoint = (taskId: string): DependencyRouteEndpoint | undefined => {
    const direct = occurrenceByTaskId.get(taskId);
    if (direct !== undefined) {
      return Object.freeze({
        endX: directionalX(scale.timeToX(direct.end), options.direction),
        hidden: false,
        startX: directionalX(scale.timeToX(direct.start), options.direction),
        taskId,
        viewKey: direct.viewKey,
        y: direct.y + direct.height / 2,
      });
    }
    let parentId = indexes.tasksById.get(taskId)?.parentId;
    const visited = new Set<string>();
    while (parentId !== undefined && !visited.has(parentId)) {
      visited.add(parentId);
      const ancestor = occurrenceByTaskId.get(parentId);
      if (ancestor !== undefined) {
        const project = laneByKey.get(ancestor.laneViewKey)?.project;
        if (project?.expanded === false || project?.filterMatch === 'ancestor') {
          return Object.freeze({
            endX: directionalX(scale.timeToX(ancestor.end), options.direction),
            hidden: true,
            startX: directionalX(scale.timeToX(ancestor.start), options.direction),
            taskId,
            viewKey: ancestor.viewKey,
            y: ancestor.y + ancestor.height / 2,
          });
        }
        return undefined;
      }
      parentId = indexes.tasksById.get(parentId)?.parentId;
    }
    return undefined;
  };

  const pathById = new Map<string, DependencyPathPrimitive>();
  if (projectView && layout.totalHeight > 0) {
    const top = options.viewport?.verticalStart ?? 0;
    const bottom = top + (options.viewport?.verticalExtent ?? layout.totalHeight);
    const dependencies = [...indexes.dependenciesById.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    dependencies.forEach((dependency, rank) => {
      const from = endpoint(dependency.fromTaskId);
      const to = endpoint(dependency.toTaskId);
      if (from === undefined || to === undefined || from.viewKey === to.viewKey) return;
      const route = routeDependency(
        {
          dependencyId: dependency.id,
          direction: options.direction ?? 'ltr',
          from,
          rank,
          to,
          type: dependency.type,
        },
        { bottom, top },
      );
      if (route === undefined) return;
      pathById.set(
        dependency.id,
        Object.freeze({
          ...route,
          points: Object.freeze(route.points.map((item) => Object.freeze({ ...item }))),
          status: dependencyStatus(dependency.id, diagnostics),
        }),
      );
    });
  }

  const paths = sameJson(Object.freeze([...pathById.values()]), previous?.dependencyPaths);
  const summaries = sameJson(
    Object.freeze(
      [...options.document.dependencies]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((dependency) => {
          const path = pathById.get(dependency.id);
          return Object.freeze({
            dependency: Object.freeze({ ...dependency }),
            fromTitle:
              options.document.tasks.find((task) => task.id === dependency.fromTaskId)?.title ??
              `Missing task ${dependency.fromTaskId}`,
            hiddenEndpoint: path?.hiddenEndpoint ?? true,
            status: dependencyStatus(dependency.id, diagnostics),
            toTitle:
              options.document.tasks.find((task) => task.id === dependency.toTaskId)?.title ??
              `Missing task ${dependency.toTaskId}`,
            visualized: path !== undefined,
          }) satisfies DependencySummaryPrimitive;
        }),
    ),
    previous?.dependencySummaries,
  );
  return Object.freeze({ paths, summaries });
}

function progressPrimitive(
  task: GanttDocument['tasks'][number],
  placement: ResolvedIntervalPlacement,
  range: TimeRange,
  scale: ReturnType<typeof createLinearTimeScale>,
  direction: BuildChartSceneOptions['direction'],
): TaskBarPrimitive['progress'] {
  const progress = task.progress;
  if (
    (task.kind !== 'task' && task.kind !== 'summary') ||
    placement.segmentId !== undefined ||
    progress === undefined ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1
  ) {
    return undefined;
  }
  const completedEnd = placement.start + (placement.end - placement.start) * progress;
  const visibleStart = Math.max(placement.start, range.start);
  const visibleCompletedEnd = Math.min(
    Math.max(completedEnd, visibleStart),
    placement.end,
    range.end,
  );
  const startX = scale.timeToX(visibleStart);
  const endX = scale.timeToX(visibleCompletedEnd);
  return Object.freeze({
    value: progress,
    width: Math.max(0, endX - startX),
    x: direction === 'rtl' ? 1 - endX : startX,
  });
}

function unresolvedAppearanceDiagnostic(
  appearance: EffectiveAppearancePrimitive,
): Diagnostic | undefined {
  return appearance.resolution !== 'unresolved' || appearance.variant === undefined
    ? undefined
    : Object.freeze({
        code: 'appearance.variant.unresolved',
        details: Object.freeze({ variant: appearance.variant }),
        message: `Semantic appearance variant "${appearance.variant}" is not registered.`,
        severity: 'warning',
      });
}

function uniqueDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  const seen = new Set<string>();
  return Object.freeze(
    diagnostics.filter((item) => {
      const key = JSON.stringify([
        item.code,
        item.severity,
        item.path,
        item.entityIds,
        item.details,
        item.message,
      ]);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }),
  );
}

function reusablePrimitive<T>(
  next: T,
  previous: T | undefined,
  work: MutableWork,
  counter: 'lanePrimitiveBuilds' | 'taskPrimitiveBuilds',
): T {
  if (previous !== undefined && JSON.stringify(previous) === JSON.stringify(next)) {
    return previous;
  }
  work[counter] += 1;
  return next;
}

function emptyState(hasLanes: boolean) {
  return hasLanes
    ? {}
    : {
        emptyState: Object.freeze({
          title: 'No scheduled work',
          description: 'Add a task to begin planning.',
        }),
      };
}

function rejectedScene(
  options: BuildChartSceneOptions,
  metrics: ChartLayoutMetrics,
  ticks: readonly TimeTickPrimitive[],
  diagnostics: readonly Diagnostic[],
): ChartScene {
  return Object.freeze({
    direction: options.direction ?? 'ltr',
    range: Object.freeze({ ...options.range }),
    bounds: Object.freeze({
      headerHeight: metrics.headerHeight,
      laneColumnWidth: metrics.laneColumnWidth,
      defaultLaneHeight: metrics.rowHeight,
      timelineHeight: 0,
      totalHeight: metrics.headerHeight,
    }),
    ticks,
    gridLines: Object.freeze(ticks.map((tick) => Object.freeze({ time: tick.time, x: tick.x }))),
    lanes: Object.freeze([]),
    taskBars: Object.freeze([]),
    dependencyPaths: Object.freeze([]),
    dependencySummaries: Object.freeze([]),
    ...emptyState(false),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function createChartScenePipeline(): ChartScenePipeline {
  let cache: PipelineCache | undefined;

  const pipeline: ChartScenePipeline = {
    build(options, invalidation) {
      const documentChanged = options.document !== cache?.options.document;
      const mode: MutableWork['mode'] =
        cache === undefined
          ? 'cold'
          : documentChanged && invalidation?.kind !== 'affected'
            ? 'fallback'
            : 'selective';
      const work = createWork(mode);
      const forceAll = mode === 'cold' || mode === 'fallback' || invalidation?.kind === 'external';
      const metrics = resolveMetrics(options.metrics);
      const nextAppearanceRegistrySignature = appearanceRegistrySignature(options);
      const appearanceRegistryChanged =
        cache === undefined ||
        appearanceRegistrySignature(cache.options) !== nextAppearanceRegistrySignature;
      const nextLegacyTaskVariantsSignature = legacyTaskVariantsSignature(options);
      const legacyTaskVariantsChanged =
        cache === undefined ||
        cache.legacyTaskVariantsSignature !== nextLegacyTaskVariantsSignature;
      const metricsChanged = cache === undefined || !sameMetrics(cache.metrics, metrics);
      const viewChanged =
        cache === undefined || !sameViewDefinition(cache.options.view, options.view);
      const presentationZoneChanged =
        cache === undefined || cache.options.timeZone !== options.timeZone;
      const projectQueryChanged =
        cache === undefined ||
        projectQuerySignature(cache.options) !== projectQuerySignature(options);
      const rangeChanged = cache === undefined || !sameRange(cache.options.range, options.range);
      const affected = invalidation?.kind === 'affected' ? invalidation.affected : [];

      if (
        cache !== undefined &&
        !documentChanged &&
        !metricsChanged &&
        !viewChanged &&
        !projectQueryChanged &&
        !rangeChanged &&
        !appearanceRegistryChanged &&
        !legacyTaskVariantsChanged &&
        tickSignature(cache.options) === tickSignature(options) &&
        viewportSignature(cache.options, cache.layout?.totalHeight ?? 0) ===
          viewportSignature(options, cache.layout?.totalHeight ?? 0)
      ) {
        work.mode = 'reused';
        return Object.freeze({
          occurrences: cache.occurrences,
          scene: cache.scene,
          work: freezeWork(work),
        });
      }

      const appearanceRegistry =
        !appearanceRegistryChanged && cache !== undefined
          ? cache.appearanceRegistry
          : createAppearanceRegistry(options.appearanceVariants);
      if (appearanceRegistry !== cache?.appearanceRegistry) {
        work.appearanceRegistryBuilds += 1;
      }

      const validation =
        !documentChanged && !forceAll && cache !== undefined
          ? cache.validation
          : validateDocumentReferences(options.document);
      if (validation !== cache?.validation) {
        work.validationBuilds += 1;
      }
      const indexes =
        validation === cache?.validation && !forceAll
          ? cache.indexes
          : buildDocumentIndexes(validation.document);
      if (indexes !== cache?.indexes) {
        work.indexBuilds += 1;
      }

      const shouldBuildTopology =
        forceAll ||
        viewChanged ||
        projectQueryChanged ||
        cache === undefined ||
        (documentChanged &&
          topologyAffected(affected, cache.options.document, options.document, options.view));
      const topology = shouldBuildTopology
        ? resolveView(
            validation.document,
            options.view,
            options.projectQuery === undefined ? {} : { project: options.projectQuery },
          )
        : cache!.topology;
      if (topology !== cache?.topology) {
        work.topologyBuilds += 1;
      }
      const dependencies =
        topology === cache?.topology ? cache.dependencies : buildDependencies(topology);

      const reuseTicks =
        !forceAll &&
        cache !== undefined &&
        cache.options.formatters === options.formatters &&
        tickSignature(cache.options) === tickSignature(options);
      const tickDiagnostics: Diagnostic[] = reuseTicks ? [...cache!.tickDiagnostics] : [];
      const ticks: readonly TimeTickPrimitive[] = reuseTicks
        ? cache!.ticks
        : Object.freeze(
            (options.timeScaleLevel === undefined
              ? generateFixedIntervalTicks({
                  range: options.range,
                  anchor: options.tickAnchor,
                  interval: options.tickInterval,
                  timeZone: options.timeZone,
                  ...(options.locale === undefined ? {} : { locale: options.locale }),
                })
              : generateAdaptiveTimeTicks(
                  options.range,
                  options.timeScaleLevel,
                  options.locale ?? 'en-US',
                  options.timeZone,
                  options.timeScaleWidth,
                )
            ).map((tick) => {
              const kind = ('kind' in tick ? tick.kind : 'major') as 'major' | 'minor';
              let label = tick.label;
              if (options.formatters?.dateTime !== undefined) {
                try {
                  const formatted = options.formatters.dateTime(tick.time, {
                    direction: options.direction ?? 'ltr',
                    locale: options.locale ?? 'en-US',
                    timeZone: options.timeZone,
                    use: kind === 'minor' ? 'tick-minor' : 'tick-major',
                  });
                  label = formatted.trim().length > 0 ? formatted : tick.label;
                  if (formatted.trim().length === 0) {
                    throw new Error('empty formatter output');
                  }
                } catch {
                  label = tick.label;
                  if (
                    !tickDiagnostics.some((diagnostic) => diagnostic.code === 'format.date-time')
                  ) {
                    tickDiagnostics.push(
                      Object.freeze({
                        code: 'format.date-time',
                        message:
                          'The dateTime formatter returned no usable output; the built-in formatter is used.',
                        path: '/formatters/dateTime',
                        severity: 'warning',
                      }),
                    );
                  }
                }
              }
              return Object.freeze({
                ...('kind' in tick ? { kind } : {}),
                label,
                x: directionalX(
                  createLinearTimeScale(options.range, { start: 0, end: 1 }).timeToX(tick.time),
                  options.direction,
                ),
                time: tick.time,
              }) satisfies TimeTickPrimitive;
            }),
          );
      if (ticks !== cache?.ticks) {
        work.tickBuilds += 1;
      }

      if (topology.status === 'rejected') {
        const occurrences = Object.freeze([]) as readonly ChartSceneOccurrence[];
        const scene = rejectedScene(options, metrics, ticks, [
          ...validation.diagnostics,
          ...topology.diagnostics,
          ...tickDiagnostics,
        ]);
        cache = {
          appearanceRegistry,
          ...(dependencies === undefined ? {} : { dependencies }),
          dependencyPaths: Object.freeze([]),
          dependencySummaries: Object.freeze([]),
          indexes,
          lanePrimitiveByKey: new Map(),
          laneStacks: new Map(),
          metrics,
          legacyTaskVariantsSignature: nextLegacyTaskVariantsSignature,
          occurrences,
          options,
          scene,
          taskPrimitiveByKey: new Map(),
          tickDiagnostics: Object.freeze(tickDiagnostics),
          ticks,
          topology,
          validation,
        };
        return Object.freeze({ occurrences, scene, work: freezeWork(work) });
      }

      const shouldBuildIntervals =
        forceAll ||
        topology !== cache?.topology ||
        cache?.intervals === undefined ||
        presentationZoneChanged ||
        (documentChanged && intervalsAffected(affected, cache.options.document, options.document));
      const intervals = shouldBuildIntervals
        ? resolvePlacementIntervals(validation.document, topology.view.placements, {
            timeZone: options.timeZone,
          })
        : cache!.intervals!;
      if (intervals !== cache?.intervals) {
        work.intervalBuilds += 1;
      }

      const shouldBuildLayout =
        forceAll ||
        metricsChanged ||
        topology !== cache?.topology ||
        intervals !== cache?.intervals ||
        cache?.layout === undefined;
      const layoutStage = shouldBuildLayout
        ? buildLayout(topology, intervals, metrics, cache, forceAll || metricsChanged, work)
        : {
            laneStacks: cache!.laneStacks,
            layout: cache!.layout!,
            localLanes: cache!.localLanes!,
          };
      const occurrences =
        layoutStage.layout === cache?.layout
          ? cache!.occurrences
          : buildOccurrenceCatalog(layoutStage.layout);
      if (occurrences !== cache?.occurrences) {
        work.occurrenceCatalogBuilds += 1;
      }
      const kernel = buildViewportKernel(layoutStage.layout, cache, forceAll, work);
      const viewportKey = viewportSignature(options, layoutStage.layout.totalHeight);
      const viewport =
        layoutStage.layout.totalHeight === 0
          ? undefined
          : !forceAll &&
              kernel === cache?.kernel &&
              cache.viewport !== undefined &&
              viewportSignature(cache.options, layoutStage.layout.totalHeight) === viewportKey
            ? cache.viewport
            : queryViewport(kernel, {
                timeRange: options.range,
                verticalStart: options.viewport?.verticalStart ?? 0,
                verticalExtent: options.viewport?.verticalExtent ?? layoutStage.layout.totalHeight,
              });
      if (viewport !== undefined && viewport !== cache?.viewport) {
        work.viewportQueries += 1;
      }

      const changedLaneKeys = affectedLaneKeys(affected, cache?.dependencies, dependencies);
      work.affectedLaneKeys = [...changedLaneKeys];
      const lanePrimitiveByKey = new Map<string, LaneRowPrimitive>();
      const lanes = Object.freeze(
        (viewport?.lanes ?? []).map((lane) => {
          const primitive = reusablePrimitive(
            lanePrimitive(lane, indexes, appearanceRegistry),
            forceAll ? undefined : cache?.lanePrimitiveByKey.get(lane.key),
            work,
            'lanePrimitiveBuilds',
          );
          lanePrimitiveByKey.set(lane.key, primitive);
          return primitive;
        }),
      );
      const visibleLanes = new Map(lanes.map((lane) => [lane.viewKey, lane]));
      const scale = createLinearTimeScale(options.range, { start: 0, end: 1 });
      const taskPrimitiveByKey = new Map<string, TaskBarPrimitive>();
      const taskBars: TaskBarPrimitive[] = [];
      for (const placement of viewport?.placements ?? []) {
        const lane = visibleLanes.get(placement.laneKey);
        const task = indexes.tasksById.get(placement.taskId);
        if (lane === undefined || task === undefined) {
          continue;
        }
        const visibleStart = Math.max(placement.start, options.range.start);
        const visibleEnd = Math.min(placement.end, options.range.end);
        const startX = scale.timeToX(visibleStart);
        const endX = scale.timeToX(visibleEnd);
        const x = options.direction === 'rtl' ? 1 - endX : startX;
        const laneVariant =
          lane.laneId === undefined
            ? undefined
            : indexes.lanesById.get(lane.laneId)?.appearance?.variant;
        const legacyTaskVariant = options.taskVariants?.[task.id];
        const progress = progressPrimitive(
          task,
          placement,
          options.range,
          scale,
          options.direction,
        );
        const geometry =
          placement.kind === 'milestone'
            ? Object.freeze({
                centerX: directionalX(startX, options.direction),
                kind: 'milestone' as const,
                size: placement.height,
              })
            : placement.kind === 'summary'
              ? Object.freeze({
                  capHeight: Math.max(2, placement.height / 3),
                  kind: 'summary' as const,
                })
              : Object.freeze({ kind: 'bar' as const });
        const primitive: TaskBarPrimitive = Object.freeze({
          appearance: resolveTaskAppearance(appearanceRegistry, {
            ...(laneVariant === undefined ? {} : { laneVariant }),
            ...(legacyTaskVariant === undefined ? {} : { legacyTaskVariant }),
            ...(task.appearance === undefined ? {} : { taskVariant: task.appearance.variant }),
          }),
          viewKey: placement.key,
          laneViewKey: placement.laneKey,
          ...placementProvenance(placement, lane),
          taskId: placement.taskId,
          source: Object.freeze({ ...placement.source }),
          title: task.title,
          start: placement.start,
          end: placement.end,
          x,
          width: endX - startX,
          y: placement.y,
          height: placement.height,
          ...(progress === undefined ? {} : { progress }),
          presentation: Object.freeze({
            geometry,
            intervalSource: placement.intervalSource,
            kind: placement.kind,
            ...(lane.project === undefined ? {} : { project: Object.freeze({ ...lane.project }) }),
            ...(placement.summary === undefined ? {} : { summary: placement.summary }),
          }),
          clippedStart: placement.start < options.range.start,
          clippedEnd: placement.end > options.range.end,
        }) satisfies TaskBarPrimitive;
        const reusable = reusablePrimitive(
          primitive,
          forceAll ? undefined : cache?.taskPrimitiveByKey.get(placement.key),
          work,
          'taskPrimitiveBuilds',
        );
        taskPrimitiveByKey.set(placement.key, reusable);
        taskBars.push(reusable);
      }

      const appearanceDiagnostics: Diagnostic[] = [];
      const unresolvedVariantIds = new Set<string>();
      for (const appearance of [
        ...lanes.map((lane) => lane.appearance),
        ...taskBars.map((task) => task.appearance),
      ]) {
        if (appearance === undefined) {
          continue;
        }
        const diagnostic = unresolvedAppearanceDiagnostic(appearance);
        const variant = appearance.variant;
        if (
          diagnostic !== undefined &&
          variant !== undefined &&
          !unresolvedVariantIds.has(variant)
        ) {
          unresolvedVariantIds.add(variant);
          appearanceDiagnostics.push(diagnostic);
        }
      }

      const diagnostics = uniqueDiagnostics([
        ...validation.diagnostics,
        ...topology.diagnostics,
        ...intervals.diagnostics,
        ...appearanceDiagnostics,
        ...tickDiagnostics,
      ]);
      const dependencyPrimitives = buildDependencyPrimitives(
        options,
        indexes,
        layoutStage.layout,
        occurrences,
        diagnostics,
        cache,
      );
      const gridLines: readonly GridLinePrimitive[] = Object.freeze(
        ticks.map(
          (tick): GridLinePrimitive =>
            Object.freeze({
              ...(tick.kind === undefined ? {} : { kind: tick.kind }),
              time: tick.time,
              x: tick.x,
            }),
        ),
      );
      const scene: ChartScene = Object.freeze({
        direction: options.direction ?? 'ltr',
        range: Object.freeze({ ...options.range }),
        bounds: Object.freeze({
          headerHeight: metrics.headerHeight,
          laneColumnWidth: metrics.laneColumnWidth,
          defaultLaneHeight: metrics.rowHeight,
          timelineHeight: layoutStage.layout.totalHeight,
          totalHeight: metrics.headerHeight + layoutStage.layout.totalHeight,
        }),
        ticks,
        gridLines,
        lanes,
        taskBars: Object.freeze(taskBars),
        dependencyPaths: dependencyPrimitives.paths,
        dependencySummaries: dependencyPrimitives.summaries,
        ...emptyState(layoutStage.layout.lanes.length > 0),
        diagnostics,
      });
      cache = {
        appearanceRegistry,
        ...(dependencies === undefined ? {} : { dependencies }),
        dependencyPaths: dependencyPrimitives.paths,
        dependencySummaries: dependencyPrimitives.summaries,
        indexes,
        intervals,
        kernel,
        lanePrimitiveByKey,
        laneStacks: layoutStage.laneStacks,
        layout: layoutStage.layout,
        localLanes: layoutStage.localLanes,
        metrics,
        legacyTaskVariantsSignature: nextLegacyTaskVariantsSignature,
        occurrences,
        options,
        scene,
        taskPrimitiveByKey,
        tickDiagnostics: Object.freeze(tickDiagnostics),
        ticks,
        topology,
        validation,
        ...(viewport === undefined ? {} : { viewport }),
      };
      return Object.freeze({ occurrences, scene, work: freezeWork(work) });
    },

    getDependencies() {
      return cache?.dependencies;
    },

    reset() {
      cache = undefined;
    },
  };
  return Object.freeze(pipeline);
}
