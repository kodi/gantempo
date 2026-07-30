import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { CommandOutcome, GanttCommand } from './types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

function expectCommittedRoundTrip(
  before: ReturnType<typeof createPatchTestDocument>,
  outcome: CommandOutcome,
) {
  expect(outcome.status).toBe('committed');
  if (outcome.status !== 'committed') {
    return;
  }
  const replay = applyGanttPatches(before, outcome.patches);
  expect(replay.status).toBe('applied');
  expect(serializeGanttDocument(replay.document)).toBe(serializeGanttDocument(outcome.document));
  const inverted = applyGanttPatches(outcome.document, outcome.inversePatches);
  expect(inverted.status).toBe('applied');
  expect(serializeGanttDocument(inverted.document)).toBe(serializeGanttDocument(before));
}

describe('applyGanttCommand', () => {
  it('normalizes and applies add/set commands across all six document collections', () => {
    let document = createPatchTestDocument();
    const commands: readonly GanttCommand[] = [
      {
        type: 'task.add',
        value: {
          id: 3,
          title: 'Third',
          schedule: {
            end: '2026-07-30T11:00:00+02:00',
            mode: 'instant',
            start: '2026-07-30T10:00:00+02:00',
          },
        },
      },
      { type: 'resource.add', value: { id: 2, title: 'Second team' } },
      {
        type: 'lane.add',
        value: { id: 2, resourceId: 2, title: 'Second lane' },
      },
      {
        type: 'assignment.set',
        value: { id: 2, resourceId: 2, taskId: 3 },
      },
      {
        type: 'placement.add',
        value: { assignmentId: 2, id: 2, laneId: 2, taskId: 3 },
      },
      {
        type: 'dependency.add',
        value: {
          fromTaskId: 'task-1',
          id: 2,
          toTaskId: 3,
          type: 'finish-to-start',
        },
      },
    ];

    for (const command of commands) {
      const before = document;
      const outcome = applyGanttCommand(before, command);
      expectCommittedRoundTrip(before, outcome);
      expect(outcome.status).toBe('committed');
      document = outcome.document;
    }

    expect(document.tasks.at(-1)).toMatchObject({
      id: '3',
      kind: 'task',
      schedule: {
        end: Date.parse('2026-07-30T11:00:00+02:00'),
        start: Date.parse('2026-07-30T10:00:00+02:00'),
      },
      segments: [],
    });
    expect(document.resources.at(-1)?.id).toBe('2');
    expect(document.lanes.at(-1)).toMatchObject({ id: '2', resourceId: '2' });
    expect(document.assignments.at(-1)).toMatchObject({
      id: '2',
      resourceId: '2',
      taskId: '3',
    });
    expect(document.placements.at(-1)).toMatchObject({
      assignmentId: '2',
      id: '2',
      laneId: '2',
      taskId: '3',
    });
    expect(document.dependencies.at(-1)).toMatchObject({
      fromTaskId: 'task-1',
      id: '2',
      toTaskId: '3',
    });
  });

  it('updates tasks, resources, lanes, assignments, and placements with explicit clears', () => {
    const base = createPatchTestDocument();
    const task = applyGanttCommand(base, {
      changes: {
        appearance: { variant: '  customer:blocked  ' },
        description: 'Canonical details',
        fields: null,
        progress: 0.5,
        title: 'Changed task',
      },
      id: 'task-1',
      type: 'task.update',
    });
    expect(task.status).toBe('committed');
    expect(task.document.tasks[0]).toMatchObject({
      appearance: { variant: 'customer:blocked' },
      description: 'Canonical details',
      progress: 0.5,
      title: 'Changed task',
    });
    expect(task.document.tasks[0]).not.toHaveProperty('fields');

    const resource = applyGanttCommand(task.document, {
      changes: { capacity: null, title: 'Changed resource' },
      id: 'resource-1',
      type: 'resource.update',
    });
    expect(resource.status).toBe('committed');
    expect(resource.document.resources[0]).not.toHaveProperty('capacity');

    const lane = applyGanttCommand(resource.document, {
      changes: { appearance: { variant: '  customer:team-blue  ' }, order: 4, resourceId: null },
      id: 'shared',
      type: 'lane.update',
    });
    expect(lane.status).toBe('committed');
    expect(lane.document.lanes[0]).toMatchObject({
      appearance: { variant: 'customer:team-blue' },
      order: 4,
    });
    expect(lane.document.lanes[0]).not.toHaveProperty('resourceId');

    const assignment = applyGanttCommand(lane.document, {
      type: 'assignment.set',
      value: {
        allocation: 0.5,
        id: 'shared',
        resourceId: 'resource-1',
        taskId: 'task-1',
      },
    });
    expect(assignment.status).toBe('committed');
    expect(assignment.document.assignments[0]?.allocation).toBe(0.5);

    const placement = applyGanttCommand(assignment.document, {
      assignmentId: null,
      id: 'shared',
      laneId: 'shared',
      order: 2,
      segmentId: null,
      type: 'placement.move',
    });
    expect(placement.status).toBe('committed');
    expect(placement.document.placements[0]).toMatchObject({ order: 2 });
    expect(placement.document.placements[0]).not.toHaveProperty('assignmentId');
    expect(placement.document.placements[0]).not.toHaveProperty('segmentId');

    const cleared = applyGanttCommand(placement.document, {
      changes: { appearance: null, description: null },
      id: 'task-1',
      type: 'task.update',
    });
    expect(cleared.status).toBe('committed');
    expect(cleared.document.tasks[0]).not.toHaveProperty('appearance');
    expect(cleared.document.tasks[0]).not.toHaveProperty('description');
  });

  it('returns frozen deterministic no-ops without retaining mutable payload references', () => {
    const base = createPatchTestDocument();
    const input = {
      fields: { nested: { enabled: true } },
      id: 'task-3',
      title: 'Mutable input',
    };
    const first = applyGanttCommand(base, { type: 'task.add', value: input });
    const second = applyGanttCommand(base, { type: 'task.add', value: input });

    expect(first).toEqual(second);
    expect(first.status).toBe('committed');
    input.fields.nested.enabled = false;
    expect(first.document.tasks.at(-1)?.fields).toEqual({ nested: { enabled: true } });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.affected)).toBe(true);
    expect(Object.isFrozen(first.document.tasks.at(-1)?.fields)).toBe(true);

    const noOp = applyGanttCommand(first.document, {
      changes: { title: 'Mutable input' },
      id: 'task-3',
      type: 'task.update',
    });
    expect(noOp.status).toBe('committed');
    expect(noOp.document).toBe(first.document);
    expect(noOp.patches).toEqual([]);
    expect(noOp.inversePatches).toEqual([]);
  });

  it('rejects unknown fields, immutable IDs, malformed values, duplicates, and references', () => {
    const base = createPatchTestDocument();
    const cases: readonly GanttCommand[] = [
      {
        changes: { id: 'changed' },
        id: 'task-1',
        type: 'task.update',
      } as unknown as GanttCommand,
      {
        type: 'task.add',
        value: { id: 'task-1', title: 'Duplicate' },
      },
      {
        type: 'resource.add',
        value: { capacity: Number.POSITIVE_INFINITY, id: 'bad', title: 'Bad' },
      },
      {
        type: 'placement.add',
        value: { id: 'bad', laneId: 'missing', taskId: 'task-1' },
      },
      {
        type: 'task.add',
        value: { id: 'unknown', title: 'Unknown', typo: true },
      } as unknown as GanttCommand,
      {
        changes: { appearance: { variant: 'bad\u0000variant' } },
        id: 'task-1',
        type: 'task.update',
      },
    ];

    for (const command of cases) {
      const outcome = applyGanttCommand(base, command);
      expect(outcome.status).toBe('rejected');
      expect(outcome.document).toBe(base);
      expect(outcome.patches).toEqual([]);
      expect(outcome.inversePatches).toEqual([]);
      expect(outcome.diagnostics.length).toBeGreaterThan(0);
    }
  });
});
