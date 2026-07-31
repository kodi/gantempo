import { describe, expect, it } from 'vite-plus/test';

import { parseGanttDocument } from './codec';
import { buildDocumentIndexes } from './indexes';
import { serializeGanttDocument } from './serialize';

describe('document kernel round trip', () => {
  it('preserves every M1 domain, identity, relationship, date mode, and stable byte', () => {
    const firstParse = parseGanttDocument({
      schemaVersion: 1,
      revision: 7,
      tasks: [
        {
          appearance: { variant: 'customer:blocked' },
          description: 'Portable description.',
          id: 100,
          title: 'Build 🚀',
          kind: 'task',
          order: -4,
          progress: 0.75,
          schedule: {
            mode: 'instant',
            start: -60_000,
            end: '1970-01-01T00:01:00Z',
          },
          segments: [
            {
              id: 101,
              schedule: { mode: 'instant', start: -60_000, end: 0 },
              fields: { order: 1 },
            },
          ],
          fields: { priority: 'high', nested: { z: 2, a: 1 } },
        },
        {
          id: 'task-all-day',
          title: 'Release',
          kind: 'milestone',
          schedule: {
            mode: 'all-day',
            startDate: '2026-07-30',
            endDate: '2026-07-30',
          },
          segments: [],
        },
      ],
      resources: [
        { id: 200, title: 'Parent pool' },
        { id: 'resource-a', title: 'Алекс', parentId: 200, capacity: 1.5 },
      ],
      lanes: [
        { id: 300, title: 'Portfolio' },
        {
          appearance: { variant: 'customer:team-blue' },
          id: 'lane-a',
          title: 'Delivery',
          parentId: 300,
          resourceId: 'resource-a',
          order: 2,
          height: 64,
        },
      ],
      assignments: [
        {
          id: 400,
          taskId: 100,
          resourceId: 'resource-a',
          allocation: 1,
          effort: { value: 8, unit: 'hour', mode: 'working' },
          role: 'owner',
        },
      ],
      placements: [
        {
          id: 500,
          taskId: 100,
          laneId: 'lane-a',
          assignmentId: 400,
          segmentId: 101,
          order: 3,
        },
        {
          id: 'placement-release',
          taskId: 'task-all-day',
          laneId: 300,
        },
      ],
      dependencies: [
        {
          id: 600,
          fromTaskId: 100,
          toTaskId: 'task-all-day',
          type: 'finish-to-start',
          lag: { value: -1, unit: 'day', mode: 'elapsed' },
        },
      ],
      metadata: {
        unicode: 'Zażółć gęślą jaźń / 日本語',
        nested: { '2': 'two', '10': 'ten', values: [null, false, -1] },
      },
    });

    expect(firstParse.diagnostics).toEqual([]);
    expect(firstParse.document).toBeDefined();
    const firstDocument = firstParse.document!;
    const firstIndexes = buildDocumentIndexes(firstDocument);
    const firstJson = serializeGanttDocument(firstDocument);
    const secondParse = parseGanttDocument(JSON.parse(firstJson));

    expect(secondParse.diagnostics).toEqual([]);
    expect(secondParse.document).toEqual(firstDocument);
    const secondDocument = secondParse.document!;
    const secondIndexes = buildDocumentIndexes(secondDocument);
    const secondJson = serializeGanttDocument(secondDocument);

    expect(secondJson).toBe(firstJson);
    expect(firstDocument.tasks.map((record) => record.id)).toEqual(['100', 'task-all-day']);
    expect(firstDocument.resources.map((record) => record.id)).toEqual(['200', 'resource-a']);
    expect(firstDocument.lanes.map((record) => record.id)).toEqual(['300', 'lane-a']);
    expect(firstDocument.assignments.map((record) => record.id)).toEqual(['400']);
    expect(firstDocument.placements.map((record) => record.id)).toEqual([
      '500',
      'placement-release',
    ]);
    expect(firstDocument.dependencies.map((record) => record.id)).toEqual(['600']);
    expect(firstDocument.tasks[0]?.schedule).toEqual({
      end: 60_000,
      mode: 'instant',
      start: -60_000,
    });
    expect(firstDocument.tasks[0]?.description).toBe('Portable description.');
    expect(firstDocument.tasks[0]?.order).toBe(-4);
    expect(firstDocument.tasks[0]?.appearance).toEqual({ variant: 'customer:blocked' });
    expect(firstDocument.lanes[1]?.appearance).toEqual({ variant: 'customer:team-blue' });
    expect(firstDocument.tasks[1]?.schedule).toEqual({
      endDate: '2026-07-30',
      mode: 'all-day',
      startDate: '2026-07-30',
    });
    expect([...firstIndexes.tasksById.keys()]).toEqual([...secondIndexes.tasksById.keys()]);
    expect(firstIndexes.assignmentsByTaskId.get('100')?.map((record) => record.id)).toEqual(
      secondIndexes.assignmentsByTaskId.get('100')?.map((record) => record.id),
    );
    expect(firstIndexes.placementsByLaneId.get('lane-a')?.map((record) => record.id)).toEqual(
      secondIndexes.placementsByLaneId.get('lane-a')?.map((record) => record.id),
    );
    expect(firstIndexes.dependenciesBySourceTaskId.get('100')?.map((record) => record.id)).toEqual(
      secondIndexes.dependenciesBySourceTaskId.get('100')?.map((record) => record.id),
    );
  });
});
