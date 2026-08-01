import { describe, expect, it } from 'vite-plus/test';

import type { GanttReactRuntimeSnapshot } from '../runtime';
import {
  buildDependencySummaryMap,
  buildGanttSurfaceModel,
  stabilizeDependencyPaths,
} from './surface-model';

describe('Gantt surface model', () => {
  it('builds scene indexes and grouped task ownership once', () => {
    const scene = {
      bounds: { laneColumnWidth: 160 },
      lanes: [
        {
          height: 58,
          laneId: 'lane-a',
          source: { kind: 'document-lane', laneId: 'lane-a' },
          title: 'Lane A',
          viewKey: 'lane-a-view',
          y: 0,
        },
        {
          height: 58,
          laneId: 'lane-b',
          source: { kind: 'document-lane', laneId: 'lane-b' },
          title: 'Lane B',
          viewKey: 'lane-b-view',
          y: 58,
        },
      ],
      taskBars: [
        { laneViewKey: 'lane-a-view', viewKey: 'task-a-view' },
        { laneViewKey: 'lane-a-view', viewKey: 'task-b-view' },
      ],
    } as unknown as GanttReactRuntimeSnapshot['scene'];
    const dependency = {
      dependency: {
        fromTaskId: 'task-a',
        id: 'dependency-a-b',
        toTaskId: 'task-b',
        type: 'finish-to-start' as const,
      },
      fromTitle: 'Task A',
      hiddenEndpoint: false,
      status: 'valid' as const,
      target: { dependencyId: 'dependency-a-b', kind: 'dependency' as const },
      toTitle: 'Task B',
    };

    const model = buildGanttSurfaceModel({
      accessibilityId: 'chart',
      columns: undefined,
      dependencySummaries: [dependency],
      propertiesEnabled: true,
      scene,
    });

    expect(model.columnTemplate).toBe('160px 44px');
    expect(model.laneColumnWidth).toBe(204);
    expect(model.taskByViewKey.get('task-b-view')).toBe(scene.taskBars[1]);
    expect(model.taskDomIdsByLane.get('lane-a-view')).toEqual(['chart-task-0', 'chart-task-1']);
    expect(model.taskDomIdsByLane.has('lane-b-view')).toBe(false);
    expect(model.dependencySummaryById.get('dependency-a-b')).toBe(dependency);
  });

  it('retains semantically unchanged dependency inputs and replaces changed geometry', () => {
    const previousPath = {
      clippedEnd: false,
      clippedStart: false,
      dependencyId: 'dependency-a-b',
      fromTaskId: 'task-a',
      fromViewKey: 'task-a-view',
      hiddenEndpoint: false,
      points: [
        { x: 0.2, y: 20 },
        { x: 0.4, y: 20 },
      ],
      status: 'valid',
      toTaskId: 'task-b',
      toViewKey: 'task-b-view',
      type: 'finish-to-start',
    } as const;
    const equivalentPath = {
      ...previousPath,
      points: previousPath.points.map((point) => ({ ...point })),
    };
    const changedPath = {
      ...equivalentPath,
      points: [equivalentPath.points[0]!, { x: 0.5, y: 20 }],
    };

    const previous = [previousPath] as const;
    expect(stabilizeDependencyPaths(previous, [equivalentPath])).toBe(previous);
    expect(stabilizeDependencyPaths(previous, [equivalentPath])[0]).toBe(previousPath);
    expect(stabilizeDependencyPaths(previous, [changedPath])[0]).toBe(changedPath);
  });

  it('retains a dependency summary when the runtime selector keeps its record identity', () => {
    const dependency = {
      dependency: {
        fromTaskId: 'task-a',
        id: 'dependency-a-b',
        toTaskId: 'task-b',
        type: 'finish-to-start' as const,
      },
      fromTitle: 'Task A',
      hiddenEndpoint: false,
      status: 'valid' as const,
      target: { dependencyId: 'dependency-a-b', kind: 'dependency' as const },
      toTitle: 'Task B',
    };
    const previous = buildDependencySummaryMap([dependency]);
    const next = buildDependencySummaryMap([{ ...dependency }], previous);

    expect(next.get('dependency-a-b')).toBe(dependency);
  });
});
