import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';

const document: GanttDocument = {
  assignments: [],
  dependencies: [
    { fromTaskId: 'task', id: 'task-milestone', toTaskId: 'milestone', type: 'finish-to-start' },
  ],
  lanes: [],
  placements: [],
  resources: [],
  schemaVersion: 1,
  tasks: [
    {
      id: 'task',
      kind: 'task',
      progress: 0.25,
      schedule: { end: 40, mode: 'instant', start: 10 },
      segments: [],
      title: 'Task',
    },
    {
      id: 'milestone',
      kind: 'milestone',
      schedule: { end: 80, mode: 'instant', start: 80 },
      segments: [],
      title: 'Milestone',
    },
  ],
};

function scene(direction: 'ltr' | 'rtl') {
  return buildChartScene({
    direction,
    document,
    range: { end: 100, start: 0 },
    tickAnchor: 0,
    tickInterval: 10,
    timeZone: 'UTC',
    view: { kind: 'project' },
  });
}

describe('scene direction', () => {
  it('mirrors time primitives and dependency geometry while preserving semantic order', () => {
    const ltr = scene('ltr');
    const rtl = scene('rtl');

    expect(rtl.direction).toBe('rtl');
    expect(rtl.ticks.map((tick) => tick.time)).toEqual(ltr.ticks.map((tick) => tick.time));
    for (const [index, tick] of ltr.ticks.entries()) {
      expect(rtl.ticks[index]!.x).toBeCloseTo(1 - tick.x);
    }
    for (const task of ltr.taskBars) {
      const mirrored = rtl.taskBars.find((candidate) => candidate.taskId === task.taskId)!;
      expect(mirrored.x).toBeCloseTo(1 - task.x - task.width);
      if (task.progress !== undefined) {
        expect(mirrored.progress?.x).toBeCloseTo(1 - task.progress.x - task.progress.width);
      }
      if (task.presentation?.geometry.kind === 'milestone') {
        expect(mirrored.presentation?.geometry).toMatchObject({ kind: 'milestone' });
        if (mirrored.presentation?.geometry.kind === 'milestone') {
          expect(mirrored.presentation.geometry.centerX).toBeCloseTo(
            1 - task.presentation.geometry.centerX,
          );
        }
      }
    }
    expect(rtl.dependencyPaths).toHaveLength(1);
    for (const [index, point] of ltr.dependencyPaths[0]!.points.entries()) {
      expect(rtl.dependencyPaths[0]!.points[index]).toMatchObject({ y: point.y });
      expect(rtl.dependencyPaths[0]!.points[index]!.x).toBeCloseTo(1 - point.x);
    }
  });

  it('falls back from a failed tick formatter with one stable diagnostic', () => {
    const result = buildChartScene({
      document,
      formatters: { dateTime: () => '' },
      range: { end: 100, start: 0 },
      tickAnchor: 0,
      tickInterval: 10,
      timeZone: 'UTC',
      view: { kind: 'project' },
    });

    expect(result.ticks[0]!.label.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'format.date-time'),
    ).toHaveLength(1);
  });
});
