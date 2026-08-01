import { describe, expect, it } from 'vite-plus/test';

import type { GanttReactRuntimeSnapshot } from '../runtime';
import { buildGanttSurfaceModel } from './surface-model';

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
});
