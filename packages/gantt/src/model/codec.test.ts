import { describe, expect, it } from 'vite-plus/test';

import { parseGanttDocument } from './codec';

function fullWireDocument() {
  return {
    schemaVersion: 1,
    revision: 'rev-a',
    tasks: [
      {
        id: 1,
        title: 'Implementation',
        kind: 'task',
        progress: 0.5,
        schedule: {
          mode: 'instant',
          start: '2026-07-30T10:00:00+02:00',
          end: '2026-07-30T12:00:00+02:00',
        },
        segments: [
          {
            id: 10,
            schedule: {
              mode: 'all-day',
              startDate: '2026-07-30',
              endDate: '2026-07-31',
            },
          },
        ],
        fields: { z: 1, nested: { b: true, a: ['x', null] } },
      },
      { id: 'task-2', title: 'Review' },
    ],
    resources: [{ id: 2, title: 'Alex', capacity: 1 }],
    lanes: [{ id: 3, title: 'Delivery', resourceId: 2 }],
    assignments: [
      {
        id: 4,
        taskId: 1,
        resourceId: 2,
        allocation: 0.75,
        effort: { value: 4, unit: 'hour', mode: 'working' },
      },
    ],
    placements: [{ id: 5, taskId: 1, laneId: 3, assignmentId: 4, segmentId: 10 }],
    dependencies: [
      {
        id: 6,
        fromTaskId: 1,
        toTaskId: 'task-2',
        type: 'finish-to-start',
        lag: { value: -30, unit: 'minute' },
      },
    ],
    metadata: { z: 'last', a: { y: 2, x: 1 } },
  };
}

describe('parseGanttDocument', () => {
  it('normalizes a complete six-collection document without retaining wire references', () => {
    const input = fullWireDocument();
    const result = parseGanttDocument(input);

    expect(result.diagnostics).toEqual([]);
    expect(result.sourceSchemaVersion).toBe(1);
    expect(result.document).toMatchObject({
      assignments: [
        {
          effort: { mode: 'working', unit: 'hour', value: 4 },
          id: '4',
          resourceId: '2',
          taskId: '1',
        },
      ],
      dependencies: [
        {
          fromTaskId: '1',
          id: '6',
          lag: { unit: 'minute', value: -30 },
          toTaskId: 'task-2',
        },
      ],
      lanes: [{ id: '3', resourceId: '2' }],
      placements: [
        {
          assignmentId: '4',
          id: '5',
          laneId: '3',
          segmentId: '10',
          taskId: '1',
        },
      ],
      resources: [{ id: '2' }],
      revision: 'rev-a',
      schemaVersion: 1,
      tasks: [
        {
          id: '1',
          kind: 'task',
          schedule: {
            end: Date.parse('2026-07-30T12:00:00+02:00'),
            mode: 'instant',
            start: Date.parse('2026-07-30T10:00:00+02:00'),
          },
          segments: [
            {
              id: '10',
              schedule: {
                endDate: '2026-07-31',
                mode: 'all-day',
                startDate: '2026-07-30',
              },
            },
          ],
        },
        { id: 'task-2', kind: 'task', segments: [] },
      ],
    });
    expect(result.document?.tasks).not.toBe(input.tasks);
    expect(result.document?.tasks[0]?.fields).not.toBe(input.tasks[0]?.fields);
    expect(Object.keys(result.document?.tasks[0]?.fields ?? {})).toEqual(['nested', 'z']);
    expect(Object.keys(result.document?.metadata ?? {})).toEqual(['a', 'z']);
    expect(Object.isFrozen(result.document?.tasks[0]?.segments)).toBe(true);
  });

  it('defaults every missing collection and canonical task default', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      tasks: [{ id: 'task-a', title: 'Task A' }],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.document).toEqual({
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [{ id: 'task-a', kind: 'task', segments: [], title: 'Task A' }],
    });
  });

  it('normalizes canonical descriptions and task/lane semantic appearance', () => {
    const result = parseGanttDocument({
      lanes: [
        {
          appearance: { variant: '  customer:team-blue  ' },
          id: 'lane-a',
          title: 'Lane A',
        },
      ],
      schemaVersion: 1,
      tasks: [
        {
          appearance: { variant: '  customer:blocked  ' },
          description: 'Waiting for the external review.',
          id: 'task-a',
          title: 'Task A',
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.tasks[0]).toMatchObject({
      appearance: { variant: 'customer:blocked' },
      description: 'Waiting for the external review.',
    });
    expect(result.document?.lanes[0]).toMatchObject({
      appearance: { variant: 'customer:team-blue' },
    });
    expect(Object.isFrozen(result.document?.tasks[0]?.appearance)).toBe(true);
    expect(Object.isFrozen(result.document?.lanes[0]?.appearance)).toBe(true);
  });

  it('rejects malformed semantic appearance without losing unrelated records', () => {
    const result = parseGanttDocument({
      lanes: [
        { appearance: { variant: 'bad\u0000variant' }, id: 'bad-lane', title: 'Bad' },
        { id: 'good-lane', title: 'Good' },
      ],
      schemaVersion: 1,
      tasks: [
        { appearance: { variant: ' '.repeat(4) }, id: 'bad-task', title: 'Bad' },
        { id: 'good-task', title: 'Good' },
      ],
    });

    expect(result.document?.tasks.map((task) => task.id)).toEqual(['good-task']);
    expect(result.document?.lanes.map((lane) => lane.id)).toEqual(['good-lane']);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'value.invalid-string',
          path: '/tasks/0/appearance/variant',
        }),
        expect.objectContaining({
          code: 'value.invalid-string',
          path: '/lanes/0/appearance/variant',
        }),
      ]),
    );
  });

  it.each([
    { code: 'document.invalid-root', input: null },
    { code: 'schema.missing-version', input: {} },
    { code: 'schema.unsupported-version', input: { schemaVersion: 2 } },
    { code: 'document.invalid-collection', input: { schemaVersion: 1, tasks: {} } },
    { code: 'document.invalid-collection', input: { schemaVersion: 1, tasks: undefined } },
  ])('treats $code as document-fatal', ({ code, input }) => {
    const result = parseGanttDocument(input);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
  });

  it('warns about unknown structural properties while preserving extension keys', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      typoAtRoot: true,
      tasks: [
        {
          id: 'task-a',
          title: 'Task A',
          typoAtTask: true,
          fields: { appSpecific: true },
        },
      ],
    });

    expect(result.document?.tasks[0]?.fields).toEqual({ appSpecific: true });
    expect(result.diagnostics).toMatchObject([
      {
        code: 'value.unknown-property',
        path: '/typoAtRoot',
        severity: 'warning',
      },
      {
        code: 'value.unknown-property',
        entityIds: ['task-a'],
        path: '/tasks/0/typoAtTask',
        severity: 'warning',
      },
    ]);
  });

  it('preserves unrelated records after malformed records and segments', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      tasks: [
        {
          id: 'task-a',
          title: 'Task A',
          segments: [
            { id: 'bad', schedule: { mode: 'all-day', startDate: '2026-02-30' } },
            {
              id: 'good',
              schedule: {
                mode: 'all-day',
                startDate: '2026-02-28',
                endDate: '2026-03-01',
              },
            },
          ],
        },
        { id: 'bad-task', title: 42 },
        { id: 'task-b', title: 'Task B' },
      ],
    });

    expect(result.document?.tasks.map((task) => task.id)).toEqual(['task-a', 'task-b']);
    expect(result.document?.tasks[0]?.segments.map((segment) => segment.id)).toEqual(['good']);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'record.invalid-segment',
          path: '/tasks/0/segments/0',
        }),
        expect.objectContaining({ code: 'record.invalid-task', path: '/tasks/1' }),
      ]),
    );
  });

  it('keeps the first record and segment after normalized ID collisions', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      tasks: [
        {
          id: 1,
          title: 'First',
          segments: [
            {
              id: 2,
              schedule: { mode: 'instant', start: 0, end: 1 },
            },
            {
              id: '2',
              schedule: { mode: 'instant', start: 1, end: 2 },
            },
          ],
        },
        { id: '1', title: 'Duplicate' },
      ],
    });

    expect(result.document?.tasks).toHaveLength(1);
    expect(result.document?.tasks[0]?.title).toBe('First');
    expect(result.document?.tasks[0]?.segments).toHaveLength(1);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'record.duplicate-segment',
          path: '/tasks/0/segments/1/id',
        }),
        expect.objectContaining({
          code: 'record.duplicate-task',
          path: '/tasks/1/id',
        }),
      ]),
    );
  });

  it.each([
    {
      code: 'value.invalid-instant',
      schedule: {
        mode: 'instant',
        start: '2026-07-30T10:00:00',
        end: '2026-07-30T11:00:00Z',
      },
    },
    {
      code: 'value.invalid-instant',
      schedule: { mode: 'instant', start: Number.NaN, end: 1 },
    },
    {
      code: 'value.invalid-all-day-date',
      schedule: { mode: 'all-day', startDate: '2026-02-29', endDate: '2026-03-01' },
    },
    {
      code: 'value.invalid-enum',
      schedule: { mode: 'floating', start: 0, end: 1 },
    },
  ])('rejects host-dependent or malformed schedule values with $code', ({ code, schedule }) => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      tasks: [
        { id: 'bad', title: 'Bad', schedule },
        { id: 'good', title: 'Good' },
      ],
    });

    expect(result.document?.tasks.map((task) => task.id)).toEqual(['good']);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
  });

  it('rejects unsupported JSON values without losing an otherwise valid document', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const sparse = Array.from({ length: 2 });
    sparse[0] = 'only';

    const result = parseGanttDocument({
      schemaVersion: 1,
      metadata: cycle,
      tasks: [
        { id: 'bad-date', title: 'Bad Date', fields: { value: new Date(0) } },
        { id: 'bad-sparse', title: 'Bad Sparse', fields: { value: sparse } },
        { id: 'good', title: 'Good', fields: { finite: -1 } },
      ],
    });

    expect(result.document?.metadata).toBeUndefined();
    expect(result.document?.tasks.map((task) => task.id)).toEqual(['good']);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'value.invalid-json'),
    ).toHaveLength(3);
  });

  it('omits invalid root metadata and revision but preserves canonical collections', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      metadata: ['not-an-object'],
      revision: Number.POSITIVE_INFINITY,
    });

    expect(result.document).toEqual({
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [],
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      '/revision',
      '/metadata',
    ]);
  });
});
