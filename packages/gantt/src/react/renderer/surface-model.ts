import type { DependencyPathPrimitive } from '../../render/primitives';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttDependencySummary, GanttLaneColumn, GanttLaneSummary } from '../types';
import { laneSummary } from './presentation';

const LANE_PROPERTIES_COLUMN_WIDTH = 44;
const laneSummaryCache = new WeakMap<object, GanttLaneSummary>();

function stableLaneSummary(
  lane: GanttReactRuntimeSnapshot['scene']['lanes'][number],
): GanttLaneSummary {
  const cached = laneSummaryCache.get(lane);
  if (cached !== undefined) return cached;
  const summary = laneSummary(lane);
  laneSummaryCache.set(lane, summary);
  return summary;
}

function stableDependencySummary(
  summary: GanttDependencySummary,
  cached: GanttDependencySummary | undefined,
): GanttDependencySummary {
  if (
    cached !== undefined &&
    cached.dependency === summary.dependency &&
    cached.fromTitle === summary.fromTitle &&
    cached.hiddenEndpoint === summary.hiddenEndpoint &&
    cached.status === summary.status &&
    cached.target.dependencyId === summary.target.dependencyId &&
    cached.toTitle === summary.toTitle
  ) {
    return cached;
  }
  return summary;
}

export function buildDependencySummaryMap(
  dependencies: readonly GanttDependencySummary[],
  previous?: ReadonlyMap<string, GanttDependencySummary>,
): ReadonlyMap<string, GanttDependencySummary> {
  return new Map(
    dependencies.map((summary) => {
      const stable = stableDependencySummary(summary, previous?.get(summary.target.dependencyId));
      return [stable.target.dependencyId, stable] as const;
    }),
  );
}

function dependencyPathEqual(
  previous: DependencyPathPrimitive,
  next: DependencyPathPrimitive,
): boolean {
  return (
    previous.clippedEnd === next.clippedEnd &&
    previous.clippedStart === next.clippedStart &&
    previous.dependencyId === next.dependencyId &&
    previous.fromTaskId === next.fromTaskId &&
    previous.fromViewKey === next.fromViewKey &&
    previous.hiddenEndpoint === next.hiddenEndpoint &&
    previous.status === next.status &&
    previous.toTaskId === next.toTaskId &&
    previous.toViewKey === next.toViewKey &&
    previous.type === next.type &&
    previous.points.length === next.points.length &&
    previous.points.every(
      (point, index) => point.x === next.points[index]?.x && point.y === next.points[index]?.y,
    )
  );
}

export function stabilizeDependencyPaths(
  previous: readonly DependencyPathPrimitive[],
  next: readonly DependencyPathPrimitive[],
): readonly DependencyPathPrimitive[] {
  const previousById = new Map(previous.map((path) => [path.dependencyId, path]));
  const stable = next.map((path) => {
    const candidate = previousById.get(path.dependencyId);
    return candidate !== undefined && dependencyPathEqual(candidate, path) ? candidate : path;
  });
  return stable.length === previous.length &&
    stable.every((path, index) => path === previous[index])
    ? previous
    : Object.freeze(stable);
}

export interface GanttSurfaceModel {
  readonly columnTemplate: string;
  readonly dependencySummaryById: ReadonlyMap<string, GanttDependencySummary>;
  readonly laneColumnWidth: number;
  readonly laneSummaries: ReadonlyMap<string, GanttLaneSummary>;
  readonly resolvedColumns: readonly GanttLaneColumn[];
  readonly taskByViewKey: ReadonlyMap<
    string,
    GanttReactRuntimeSnapshot['scene']['taskBars'][number]
  >;
  readonly taskDomIds: ReadonlyMap<string, string>;
  readonly taskDomIdsByLane: ReadonlyMap<string, readonly string[]>;
}

export function buildGanttSurfaceModel(input: {
  readonly accessibilityId: string;
  readonly columns: readonly GanttLaneColumn[] | undefined;
  readonly dependencySummaries: readonly GanttDependencySummary[];
  readonly propertiesEnabled: boolean;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): GanttSurfaceModel {
  const { accessibilityId, columns, dependencySummaries, propertiesEnabled, scene } = input;
  const resolvedColumns =
    columns !== undefined && columns.length > 0
      ? columns
      : Object.freeze([
          Object.freeze({
            header: 'Work item',
            id: 'title',
            width: scene.bounds.laneColumnWidth,
          }),
        ]);
  const columnWidths = resolvedColumns.map((column) =>
    Number.isFinite(column.width) && (column.width ?? 0) > 0
      ? Math.max(72, column.width!)
      : resolvedColumns.length === 1
        ? scene.bounds.laneColumnWidth
        : 120,
  );
  const laneColumnWidth =
    columnWidths.reduce((total, width) => total + width, 0) +
    (propertiesEnabled ? LANE_PROPERTIES_COLUMN_WIDTH : 0);
  const columnTemplate = [
    ...columnWidths,
    ...(propertiesEnabled ? [LANE_PROPERTIES_COLUMN_WIDTH] : []),
  ]
    .map((width) => `${width}px`)
    .join(' ');
  const taskByViewKey = new Map(scene.taskBars.map((task) => [task.viewKey, task]));
  const laneSummaries = new Map(scene.lanes.map((lane) => [lane.viewKey, stableLaneSummary(lane)]));
  const taskDomIds = new Map(
    scene.taskBars.map((task, index) => [task.viewKey, `${accessibilityId}-task-${index}`]),
  );
  const taskDomIdsByLane = new Map<string, string[]>();
  for (const task of scene.taskBars) {
    const ids = taskDomIdsByLane.get(task.laneViewKey) ?? [];
    ids.push(taskDomIds.get(task.viewKey)!);
    taskDomIdsByLane.set(task.laneViewKey, ids);
  }
  return Object.freeze({
    columnTemplate,
    dependencySummaryById: buildDependencySummaryMap(dependencySummaries),
    laneColumnWidth,
    laneSummaries,
    resolvedColumns,
    taskByViewKey,
    taskDomIds,
    taskDomIdsByLane,
  });
}
