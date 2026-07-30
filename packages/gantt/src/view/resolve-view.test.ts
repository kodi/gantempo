import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { resolveView } from './resolve-view';
import type { GanttViewDefinition } from './types';

function createDocument(): GanttDocument {
  return {
    schemaVersion: 1,
    tasks: [
      {
        id: 'shared',
        title: 'Design',
        kind: 'task',
        segments: [
          {
            id: 'segment-a',
            schedule: { mode: 'instant', start: 1, end: 2 },
          },
        ],
      },
      { id: 'task-b', title: 'Build', kind: 'task', segments: [] },
    ],
    resources: [
      { id: 'shared', title: 'Ada' },
      { id: 'resource-b', title: 'Grace' },
    ],
    lanes: [
      { id: 'shared', title: 'Planned', height: 72 },
      { id: 'lane-b', title: 'Later' },
    ],
    assignments: [
      { id: 'shared', taskId: 'shared', resourceId: 'shared' },
      { id: 'assignment-b', taskId: 'shared', resourceId: 'resource-b' },
    ],
    placements: [
      {
        id: 'shared',
        taskId: 'shared',
        laneId: 'shared',
        segmentId: 'segment-a',
        assignmentId: 'shared',
      },
    ],
    dependencies: [],
  };
}

describe('resolveView', () => {
  it('preserves document lane and placement order with canonical provenance', () => {
    const result = resolveView(createDocument(), { kind: 'document' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes.map((lane) => lane.title)).toEqual(['Planned', 'Later']);
    expect(result.view.lanes[0]).toMatchObject({
      minimumHeight: 72,
      source: { kind: 'document-lane', laneId: 'shared' },
    });
    expect(result.view.placements).toHaveLength(1);
    expect(result.view.placements[0]).toMatchObject({
      taskId: 'shared',
      segmentId: 'segment-a',
      assignmentId: 'shared',
      source: {
        kind: 'document-placement',
        placementId: 'shared',
        laneId: 'shared',
      },
    });
    expect(result.view.lanes[0]?.key).not.toBe(result.view.placements[0]?.key);
  });

  it('derives one flat project lane and placement per task', () => {
    const result = resolveView(createDocument(), { kind: 'project' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes.map((lane) => lane.source)).toEqual([
      { kind: 'project-task', taskId: 'shared' },
      { kind: 'project-task', taskId: 'task-b' },
    ]);
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual([
      'shared',
      'task-b',
    ]);
  });

  it('derives resource lanes and repeated task placements from assignment order', () => {
    const result = resolveView(createDocument(), { kind: 'resource' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes.map((lane) => lane.title)).toEqual(['Ada', 'Grace']);
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual([
      'shared',
      'shared',
    ]);
    expect(result.view.placements.map((placement) => placement.assignmentId)).toEqual([
      'shared',
      'assignment-b',
    ]);
    expect(new Set(result.view.placements.map((placement) => placement.laneKey)).size).toBe(2);
  });

  it('normalizes custom data without retaining caller-owned descriptors', () => {
    const definition: GanttViewDefinition = {
      kind: 'custom',
      id: 'status',
      lanes: [{ key: 'doing', title: 'Doing', minimumHeight: 80 }],
      placements: [
        {
          key: 'design',
          laneKey: 'doing',
          taskId: 'shared',
          segmentId: 'segment-a',
        },
      ],
    };

    const result = resolveView(createDocument(), definition);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes[0]).toMatchObject({
      title: 'Doing',
      minimumHeight: 80,
      source: { kind: 'custom', viewId: 'status', customLaneKey: 'doing' },
    });
    expect(result.view.placements[0]).toMatchObject({
      taskId: 'shared',
      segmentId: 'segment-a',
    });
    expect(Object.isFrozen(result.view)).toBe(true);
    expect(Object.isFrozen(result.view.lanes[0]?.source)).toBe(true);
    expect(result.view.lanes[0]).not.toBe(definition.lanes[0]);
  });

  it('rejects duplicate keys and missing custom lane topology', () => {
    const result = resolveView(createDocument(), {
      kind: 'custom',
      id: 'invalid',
      lanes: [
        { key: 'same', title: 'One' },
        { key: 'same', title: 'Two' },
      ],
      placements: [
        { key: 'same', laneKey: 'missing', taskId: 'shared' },
        { key: 'same', laneKey: 'same', taskId: 'shared' },
      ],
    });

    expect(result.status).toBe('rejected');
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'view.duplicate-lane-key',
      'view.missing-lane',
      'view.duplicate-placement-key',
    ]);
  });

  it('omits only placements with invalid canonical references', () => {
    const result = resolveView(createDocument(), {
      kind: 'custom',
      id: 'references',
      lanes: [{ key: 'lane', title: 'Lane' }],
      placements: [
        { key: 'missing', laneKey: 'lane', taskId: 'missing' },
        { key: 'segment', laneKey: 'lane', taskId: 'shared', segmentId: 'missing' },
        { key: 'valid', laneKey: 'lane', taskId: 'shared' },
      ],
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual(['shared']);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'view.missing-task',
      'view.missing-segment',
    ]);
  });

  it('rejects duplicate built-in source IDs without confusing cross-family reuse', () => {
    const document = createDocument();
    const duplicateLaneDocument = {
      ...document,
      lanes: [...document.lanes, { id: 'shared', title: 'Duplicate lane' }],
    };

    expect(resolveView(duplicateLaneDocument, { kind: 'document' }).status).toBe('rejected');
    expect(resolveView(document, { kind: 'document' }).status).toBe('resolved');
  });
});
