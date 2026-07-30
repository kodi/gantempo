import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttCommand } from './types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

describe('atomic transactions', () => {
  it('lets ordered children observe prior output and flattens nested transactions', () => {
    const base = createPatchTestDocument();
    const outcome = applyGanttCommand(base, {
      commands: [
        { type: 'task.add', value: { id: 'task-3', title: 'Third' } },
        {
          commands: [
            { type: 'resource.add', value: { id: 'resource-2', title: 'Second team' } },
            {
              type: 'lane.add',
              value: { id: 'lane-2', resourceId: 'resource-2', title: 'Second lane' },
            },
          ],
          type: 'transaction',
        },
        {
          type: 'assignment.set',
          value: { id: 'assignment-2', resourceId: 'resource-2', taskId: 'task-3' },
        },
        {
          type: 'placement.add',
          value: {
            assignmentId: 'assignment-2',
            id: 'placement-2',
            laneId: 'lane-2',
            taskId: 'task-3',
          },
        },
        {
          type: 'dependency.add',
          value: {
            fromTaskId: 'task-1',
            id: 'dependency-2',
            toTaskId: 'task-3',
            type: 'finish-to-start',
          },
        },
      ],
      type: 'transaction',
    });

    expect(outcome.status).toBe('committed');
    expect(outcome.patches.map((patch) => patch.target.collection)).toEqual([
      'tasks',
      'resources',
      'lanes',
      'assignments',
      'placements',
      'dependencies',
    ]);
    expect(outcome.document.placements.at(-1)).toMatchObject({
      assignmentId: 'assignment-2',
      laneId: 'lane-2',
      taskId: 'task-3',
    });
    const replay = applyGanttPatches(base, outcome.patches);
    expect(replay.status).toBe('applied');
    expect(serializeGanttDocument(replay.document)).toBe(serializeGanttDocument(outcome.document));
    const restored = applyGanttPatches(outcome.document, outcome.inversePatches);
    expect(restored.status).toBe('applied');
    expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
  });

  it.each([0, 1, 2])(
    'rejects failure at child %s with the original identity and stable path',
    (failureIndex) => {
      const base = createPatchTestDocument();
      const valid = (id: string): GanttCommand => ({
        type: 'task.add',
        value: { id, title: id },
      });
      const commands: GanttCommand[] = [valid('before'), valid('middle'), valid('after')];
      commands[failureIndex] = {
        type: 'task.add',
        value: { id: 'task-1', title: 'Duplicate' },
      };
      const outcome = applyGanttCommand(base, { commands, type: 'transaction' });

      expect(outcome.status).toBe('rejected');
      expect(outcome.document).toBe(base);
      expect(outcome.patches).toEqual([]);
      expect(outcome.inversePatches).toEqual([]);
      expect(outcome.affected).toEqual([]);
      expect(outcome.diagnostics[0]?.path).toBe(`/command/commands/${failureIndex}/value/id`);
    },
  );

  it('preserves nested transaction indexes in rejection diagnostics', () => {
    const base = createPatchTestDocument();
    const outcome = applyGanttCommand(base, {
      commands: [
        {
          commands: [
            { type: 'task.add', value: { id: 'ok', title: 'OK' } },
            { type: 'task.add', value: { id: 'task-1', title: 'Duplicate' } },
          ],
          type: 'transaction',
        },
      ],
      type: 'transaction',
    });

    expect(outcome.status).toBe('rejected');
    expect(outcome.document).toBe(base);
    expect(outcome.diagnostics[0]?.path).toBe('/command/commands/0/commands/1/value/id');
  });

  it('collapses empty, unchanged, and add-then-delete transactions to no-ops', () => {
    const base = createPatchTestDocument();
    const cases: readonly GanttCommand[] = [
      { commands: [], type: 'transaction' },
      {
        commands: [{ changes: { title: 'First' }, id: 'task-1', type: 'task.update' }],
        type: 'transaction',
      },
      {
        commands: [
          { type: 'task.add', value: { id: 'temporary', title: 'Temporary' } },
          { id: 'temporary', type: 'task.delete' },
        ],
        type: 'transaction',
      },
    ];

    for (const command of cases) {
      const outcome = applyGanttCommand(base, command);
      expect(outcome.status).toBe('committed');
      expect(outcome.document).toBe(base);
      expect(outcome.patches).toEqual([]);
      expect(outcome.inversePatches).toEqual([]);
      expect(outcome.affected).toEqual([]);
    }
  });

  it('supports cascade followed by recreation in one atomic outcome', () => {
    const base = createPatchTestDocument();
    const outcome = applyGanttCommand(base, {
      commands: [
        { cascade: true, id: 'task-2', type: 'task.delete' },
        {
          type: 'task.add',
          value: {
            id: 'task-2',
            kind: 'milestone',
            schedule: {
              endDate: '2026-07-30',
              mode: 'all-day',
              startDate: '2026-07-30',
            },
            title: 'Second recreated',
          },
        },
        {
          type: 'dependency.add',
          value: {
            fromTaskId: 'task-1',
            id: 'shared',
            toTaskId: 'task-2',
            type: 'finish-to-start',
          },
        },
      ],
      type: 'transaction',
    });

    expect(outcome.status).toBe('committed');
    expect(outcome.document.tasks.at(-1)?.title).toBe('Second recreated');
    expect(outcome.document.dependencies[0]?.id).toBe('shared');
    const restored = applyGanttPatches(outcome.document, outcome.inversePatches);
    expect(restored.status).toBe('applied');
    expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
  });
});
