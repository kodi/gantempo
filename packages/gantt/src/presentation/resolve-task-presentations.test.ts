import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { resolveTaskPresentations } from './resolve-task-presentations';

function document(tasks: GanttDocument['tasks']): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks,
  };
}

describe('resolveTaskPresentations', () => {
  it('derives nested summary spans, fallback intervals, counts, and canonical progress', () => {
    const input = document([
      {
        id: 'root',
        kind: 'summary',
        progress: 0.25,
        schedule: { end: 200, mode: 'instant', start: 100 },
        segments: [],
        title: 'Root',
      },
      {
        id: 'nested',
        kind: 'summary',
        parentId: 'root',
        segments: [],
        title: 'Nested',
      },
      {
        id: 'leaf',
        kind: 'task',
        parentId: 'nested',
        schedule: { end: 30, mode: 'instant', start: 10 },
        segments: [],
        title: 'Leaf',
      },
      {
        id: 'missing',
        kind: 'task',
        parentId: 'nested',
        segments: [],
        title: 'Missing',
      },
      {
        id: 'point',
        kind: 'milestone',
        parentId: 'root',
        schedule: { end: 50, mode: 'instant', start: 50 },
        segments: [],
        title: 'Point',
      },
      {
        id: 'fallback',
        kind: 'summary',
        schedule: { end: 80, mode: 'instant', start: 70 },
        segments: [],
        title: 'Fallback',
      },
      { id: 'empty', kind: 'summary', segments: [], title: 'Empty' },
    ]);
    const snapshot = structuredClone(input);

    const result = resolveTaskPresentations(input, 'UTC');
    const byId = new Map(result.presentations.map((item) => [item.taskId, item]));

    expect(byId.get('nested')).toEqual({
      interval: { end: 30, source: 'descendants', start: 10 },
      kind: 'summary',
      summary: {
        descendantCount: 2,
        resolvedDescendantCount: 1,
        unresolvedDescendantCount: 1,
      },
      taskId: 'nested',
    });
    expect(byId.get('root')).toEqual({
      interval: { end: 50, source: 'descendants', start: 10 },
      kind: 'summary',
      summary: {
        descendantCount: 4,
        resolvedDescendantCount: 3,
        unresolvedDescendantCount: 1,
      },
      taskId: 'root',
    });
    expect(byId.get('fallback')?.interval).toEqual({
      end: 80,
      source: 'canonical',
      start: 70,
    });
    expect(byId.get('empty')).toEqual({
      kind: 'summary',
      summary: {
        descendantCount: 0,
        resolvedDescendantCount: 0,
        unresolvedDescendantCount: 0,
      },
      taskId: 'empty',
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'layout.missing-schedule',
      'layout.missing-schedule',
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.presentations)).toBe(true);
    expect(Object.isFrozen(byId.get('root')?.summary)).toBe(true);
    expect(input).toEqual(snapshot);
  });

  it('resolves all-day spans in the explicit zone and diagnoses unequal milestones', () => {
    const result = resolveTaskPresentations(
      document([
        {
          id: 'all-day',
          kind: 'task',
          schedule: {
            endDate: '2026-03-30',
            mode: 'all-day',
            startDate: '2026-03-29',
          },
          segments: [],
          title: 'All day',
        },
        {
          id: 'milestone',
          kind: 'milestone',
          schedule: { end: 30, mode: 'instant', start: 20 },
          segments: [],
          title: 'Milestone',
        },
      ]),
      'Europe/Belgrade',
    );

    expect(result.presentations[0]?.interval).toEqual({
      end: Date.UTC(2026, 2, 29, 22),
      source: 'canonical',
      start: Date.UTC(2026, 2, 28, 23),
    });
    expect(result.presentations[1]?.interval).toEqual({
      end: 20,
      source: 'canonical',
      start: 20,
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'presentation.milestone-interval',
        severity: 'warning',
      }),
    ]);
  });

  it('derives a 5,000-level summary chain without recursive traversal', () => {
    const tasks: GanttDocument['tasks'][number][] = Array.from({ length: 5_000 }, (_, index) => ({
      id: `task-${index}`,
      kind: index === 4_999 ? ('task' as const) : ('summary' as const),
      ...(index === 0 ? {} : { parentId: `task-${index - 1}` }),
      ...(index === 4_999 ? { schedule: { end: 20, mode: 'instant' as const, start: 10 } } : {}),
      segments: [],
      title: `Task ${index}`,
    }));

    const result = resolveTaskPresentations(document(tasks), 'UTC');

    expect(result.presentations[0]).toMatchObject({
      interval: { end: 20, source: 'descendants', start: 10 },
      summary: {
        descendantCount: 4_999,
        resolvedDescendantCount: 4_999,
        unresolvedDescendantCount: 0,
      },
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('diagnoses an all-day boundary skipped entirely in the explicit zone', () => {
    const result = resolveTaskPresentations(
      document([
        {
          id: 'skipped',
          kind: 'task',
          schedule: {
            endDate: '2011-12-31',
            mode: 'all-day',
            startDate: '2011-12-30',
          },
          segments: [],
          title: 'Skipped',
        },
      ]),
      'Pacific/Apia',
    );

    expect(result.presentations[0]?.interval).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'presentation.all-day-date-unavailable' }),
    ]);
  });
});
