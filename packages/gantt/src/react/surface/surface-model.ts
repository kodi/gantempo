import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttDependencySummary, GanttLaneColumn, GanttLaneSummary } from '../types';
import { laneSummary } from './presentation';

const LANE_PROPERTIES_COLUMN_WIDTH = 44;

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
  const laneSummaries = new Map(scene.lanes.map((lane) => [lane.viewKey, laneSummary(lane)]));
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
    dependencySummaryById: new Map(
      dependencySummaries.map((summary) => [summary.target.dependencyId, summary]),
    ),
    laneColumnWidth,
    laneSummaries,
    resolvedColumns,
    taskByViewKey,
    taskDomIds,
    taskDomIdsByLane,
  });
}
