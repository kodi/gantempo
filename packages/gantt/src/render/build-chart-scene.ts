import { indexLanes, indexPlacements, indexTasks } from '../model/indexes';
import type { Diagnostic } from '../model/diagnostics';
import type { GanttDocument } from '../model/types';
import { generateFixedIntervalTicks } from '../time/fixed-interval-ticks';
import { createLinearTimeScale } from '../time/linear-time-scale';
import {
  DEFAULT_CHART_LAYOUT_METRICS,
  type BuildChartSceneOptions,
  type ChartLayoutMetrics,
  type ChartScene,
  type TaskBarPrimitive,
} from './primitives';

function resolveMetrics(overrides?: Partial<ChartLayoutMetrics>): ChartLayoutMetrics {
  const metrics = { ...DEFAULT_CHART_LAYOUT_METRICS, ...overrides };
  for (const [name, value] of Object.entries(metrics)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`Layout metric "${name}" must be a positive finite number.`);
    }
  }
  if (metrics.barHeight > metrics.rowHeight) {
    throw new RangeError('Layout bar height cannot exceed row height.');
  }
  return Object.freeze(metrics);
}

function duplicateDiagnostics(document: GanttDocument): {
  readonly tasks: ReturnType<typeof indexTasks>;
  readonly lanes: ReturnType<typeof indexLanes>;
  readonly placements: ReturnType<typeof indexPlacements>;
  readonly diagnostics: Diagnostic[];
} {
  const tasks = indexTasks(document.tasks);
  const lanes = indexLanes(document.lanes);
  const placements = indexPlacements(document.placements);

  return {
    tasks,
    lanes,
    placements,
    diagnostics: [...tasks.diagnostics, ...lanes.diagnostics, ...placements.diagnostics],
  };
}

export function buildChartScene(options: BuildChartSceneOptions): ChartScene {
  const { document, range } = options;
  const metrics = resolveMetrics(options.metrics);
  const scale = createLinearTimeScale(range, { start: 0, end: 1 });
  const indexes = duplicateDiagnostics(document);
  const diagnostics = indexes.diagnostics;

  const lanes = indexes.lanes.ordered.map((lane, index) =>
    Object.freeze({
      laneId: lane.id,
      title: lane.title,
      y: index * metrics.rowHeight,
      height: metrics.rowHeight,
    }),
  );
  const laneRows = new Map(lanes.map((lane) => [lane.laneId, lane]));
  const taskBars: TaskBarPrimitive[] = [];

  for (const placement of indexes.placements.ordered) {
    const lane = laneRows.get(placement.laneId);
    if (!lane) {
      diagnostics.push({
        code: 'reference.placement-lane',
        severity: 'error',
        entityIds: [placement.id, placement.laneId],
        message: `Placement "${placement.id}" references missing lane "${placement.laneId}".`,
      });
      continue;
    }

    const task = indexes.tasks.byId.get(placement.taskId);
    if (!task) {
      diagnostics.push({
        code: 'reference.placement-task',
        severity: 'error',
        entityIds: [placement.id, placement.taskId],
        message: `Placement "${placement.id}" references missing task "${placement.taskId}".`,
      });
      continue;
    }

    const schedule = task.schedule;
    if (!schedule) {
      diagnostics.push({
        code: 'render.missing-task-schedule',
        severity: 'warning',
        entityIds: [task.id, placement.id],
        message: `Task "${task.id}" has no renderable schedule.`,
      });
      continue;
    }
    if (schedule.mode !== 'instant') {
      diagnostics.push({
        code: 'render.missing-task-schedule',
        severity: 'warning',
        entityIds: [task.id, placement.id],
        message: `Task "${task.id}" has no renderable instant schedule.`,
      });
      continue;
    }
    if (!Number.isFinite(schedule.start) || !Number.isFinite(schedule.end)) {
      diagnostics.push({
        code: 'render.non-finite-task-time',
        severity: 'error',
        entityIds: [task.id, placement.id],
        message: `Task "${task.id}" has a non-finite schedule boundary.`,
      });
      continue;
    }
    if (schedule.end <= schedule.start) {
      diagnostics.push({
        code: 'render.invalid-task-interval',
        severity: 'error',
        entityIds: [task.id, placement.id],
        message: `Task "${task.id}" must end after it starts.`,
      });
      continue;
    }
    if (schedule.end <= range.start || schedule.start >= range.end) {
      continue;
    }

    const visibleStart = Math.max(schedule.start, range.start);
    const visibleEnd = Math.min(schedule.end, range.end);
    const x = scale.timeToX(visibleStart);
    const xEnd = scale.timeToX(visibleEnd);

    taskBars.push(
      Object.freeze({
        placementId: placement.id,
        taskId: task.id,
        laneId: lane.laneId,
        title: task.title,
        start: schedule.start,
        end: schedule.end,
        x,
        width: xEnd - x,
        y: lane.y + (lane.height - metrics.barHeight) / 2,
        height: metrics.barHeight,
        clippedStart: schedule.start < range.start,
        clippedEnd: schedule.end > range.end,
      }),
    );
  }

  const ticks = generateFixedIntervalTicks({
    range,
    anchor: options.tickAnchor,
    interval: options.tickInterval,
    timeZone: options.timeZone,
    ...(options.locale === undefined ? {} : { locale: options.locale }),
  }).map((tick) => Object.freeze({ ...tick, x: scale.timeToX(tick.time) }));
  const timelineHeight = lanes.length * metrics.rowHeight;

  return Object.freeze({
    range: Object.freeze({ ...range }),
    bounds: Object.freeze({
      headerHeight: metrics.headerHeight,
      laneColumnWidth: metrics.laneColumnWidth,
      timelineHeight,
      totalHeight: metrics.headerHeight + timelineHeight,
    }),
    ticks: Object.freeze(ticks),
    gridLines: Object.freeze(ticks.map((tick) => Object.freeze({ time: tick.time, x: tick.x }))),
    lanes: Object.freeze(lanes),
    taskBars: Object.freeze(taskBars),
    ...(lanes.length === 0
      ? {
          emptyState: Object.freeze({
            title: 'No scheduled work',
            description: 'Add a task to begin planning.',
          }),
        }
      : {}),
    diagnostics: Object.freeze(diagnostics),
  });
}
