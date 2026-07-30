import type { Diagnostic } from '../model/diagnostics';
import { buildDocumentIndexes } from '../model/indexes';
import { validateDocumentReferences } from '../model/validate';
import { resolvePlacementIntervals } from '../layout/resolve-placement-intervals';
import { resolveStackLayoutMetrics, stackLanes } from '../layout/stack-lanes';
import { generateFixedIntervalTicks } from '../time/fixed-interval-ticks';
import { createLinearTimeScale } from '../time/linear-time-scale';
import { resolveView } from '../view/resolve-view';
import type { ResolvedViewLane, ResolvedViewPlacement } from '../view/types';
import { createViewportKernel } from '../viewport/create-viewport-kernel';
import { queryViewport } from '../viewport/query-viewport';
import {
  DEFAULT_CHART_LAYOUT_METRICS,
  type BuildChartSceneOptions,
  type ChartLayoutMetrics,
  type ChartScene,
  type LaneRowPrimitive,
  type TaskBarPrimitive,
} from './primitives';

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

function lanePrimitive(lane: ResolvedViewLane & { readonly y: number; readonly height: number }) {
  const laneId = lane.source.kind === 'document-lane' ? lane.source.laneId : undefined;
  const resourceId =
    lane.source.kind === 'resource'
      ? lane.source.resourceId
      : lane.source.kind === 'document-lane'
        ? lane.source.resourceId
        : undefined;
  return Object.freeze({
    viewKey: lane.key,
    ...(laneId === undefined ? {} : { laneId }),
    ...(resourceId === undefined ? {} : { resourceId }),
    source: Object.freeze({ ...lane.source }),
    title: lane.title,
    y: lane.y,
    height: lane.height,
  }) satisfies LaneRowPrimitive;
}

function placementProvenance(
  placement: ResolvedViewPlacement,
  lane: LaneRowPrimitive,
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

/**
 * Composes the pure M3 kernels and translates only queried layout into semantic
 * primitives; relationship lookup, stacking, and visibility remain outside React.
 */
export function buildChartScene(options: BuildChartSceneOptions): ChartScene {
  const { document, range } = options;
  const metrics = resolveMetrics(options.metrics);
  const scale = createLinearTimeScale(range, { start: 0, end: 1 });
  const validation = validateDocumentReferences(document);
  const validatedDocument = validation.document;
  const diagnostics: Diagnostic[] = [...validation.diagnostics];
  const topology = resolveView(validatedDocument, options.view);

  const ticks = generateFixedIntervalTicks({
    range,
    anchor: options.tickAnchor,
    interval: options.tickInterval,
    timeZone: options.timeZone,
    ...(options.locale === undefined ? {} : { locale: options.locale }),
  }).map((tick) => Object.freeze({ ...tick, x: scale.timeToX(tick.time) }));

  if (topology.status === 'rejected') {
    diagnostics.push(...topology.diagnostics);
    return Object.freeze({
      range: Object.freeze({ ...range }),
      bounds: Object.freeze({
        headerHeight: metrics.headerHeight,
        laneColumnWidth: metrics.laneColumnWidth,
        timelineHeight: 0,
        totalHeight: metrics.headerHeight,
      }),
      ticks: Object.freeze(ticks),
      gridLines: Object.freeze(ticks.map((tick) => Object.freeze({ time: tick.time, x: tick.x }))),
      lanes: Object.freeze([]),
      taskBars: Object.freeze([]),
      ...emptyState(false),
      diagnostics: Object.freeze(diagnostics),
    });
  }

  diagnostics.push(...topology.diagnostics);
  const intervals = resolvePlacementIntervals(validatedDocument, topology.view.placements);
  diagnostics.push(...intervals.diagnostics);
  const layout = stackLanes(topology.view.lanes, intervals.placements, {
    defaultMinimumLaneHeight: metrics.rowHeight,
    barHeight: metrics.barHeight,
    paddingTop: metrics.lanePaddingTop,
    paddingBottom: metrics.lanePaddingBottom,
    stackGap: metrics.stackGap,
  });
  const kernel = createViewportKernel(layout);
  const viewport =
    layout.totalHeight === 0
      ? undefined
      : queryViewport(kernel, {
          timeRange: range,
          verticalStart: options.viewport?.verticalStart ?? 0,
          verticalExtent: options.viewport?.verticalExtent ?? layout.totalHeight,
        });
  const lanes = (viewport?.lanes ?? []).map(lanePrimitive);
  const lanePrimitives = new Map(lanes.map((lane) => [lane.viewKey, lane]));
  const indexes = buildDocumentIndexes(validatedDocument);
  const taskBars: TaskBarPrimitive[] = [];

  for (const placement of viewport?.placements ?? []) {
    const lane = lanePrimitives.get(placement.laneKey);
    const task = indexes.tasksById.get(placement.taskId);
    if (!lane || !task) {
      continue;
    }
    const visibleStart = Math.max(placement.start, range.start);
    const visibleEnd = Math.min(placement.end, range.end);
    const x = scale.timeToX(visibleStart);
    const xEnd = scale.timeToX(visibleEnd);
    taskBars.push(
      Object.freeze({
        viewKey: placement.key,
        laneViewKey: placement.laneKey,
        ...placementProvenance(placement, lane),
        taskId: placement.taskId,
        source: Object.freeze({ ...placement.source }),
        title: task.title,
        start: placement.start,
        end: placement.end,
        x,
        width: xEnd - x,
        y: placement.y,
        height: placement.height,
        clippedStart: placement.start < range.start,
        clippedEnd: placement.end > range.end,
      }),
    );
  }

  return Object.freeze({
    range: Object.freeze({ ...range }),
    bounds: Object.freeze({
      headerHeight: metrics.headerHeight,
      laneColumnWidth: metrics.laneColumnWidth,
      timelineHeight: layout.totalHeight,
      totalHeight: metrics.headerHeight + layout.totalHeight,
    }),
    ticks: Object.freeze(ticks),
    gridLines: Object.freeze(ticks.map((tick) => Object.freeze({ time: tick.time, x: tick.x }))),
    lanes: Object.freeze(lanes),
    taskBars: Object.freeze(taskBars),
    ...emptyState(layout.lanes.length > 0),
    diagnostics: Object.freeze(diagnostics),
  });
}
