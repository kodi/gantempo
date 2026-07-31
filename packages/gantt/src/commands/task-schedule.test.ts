import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument, TaskRecord } from '../model/types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';
import type { CommandOutcome, GanttCommand } from './types';

function withTasks(tasks: readonly TaskRecord[]): GanttDocument {
  const base = createPatchTestDocument();
  return Object.freeze({
    ...base,
    tasks: Object.freeze([...tasks]),
  });
}

function expectRoundTrip(before: GanttDocument, outcome: CommandOutcome): void {
  expect(outcome.status).toBe('committed');
  if (outcome.status !== 'committed') {
    return;
  }
  const replay = applyGanttPatches(before, outcome.patches);
  expect(replay.status).toBe('applied');
  expect(serializeGanttDocument(replay.document)).toBe(serializeGanttDocument(outcome.document));
  const inverse = applyGanttPatches(outcome.document, outcome.inversePatches);
  expect(inverse.status).toBe('applied');
  expect(serializeGanttDocument(inverse.document)).toBe(serializeGanttDocument(before));
}

function expectRejected(document: GanttDocument, command: GanttCommand, code: string): void {
  const serialized = serializeGanttDocument(document);
  const commandSnapshot = structuredClone(command);
  const outcome = applyGanttCommand(document, command);

  expect(outcome.status).toBe('rejected');
  expect(outcome.document).toBe(document);
  expect(outcome.patches).toEqual([]);
  expect(outcome.inversePatches).toEqual([]);
  expect(outcome.affected).toEqual([]);
  expect(outcome.diagnostics[0]?.code).toBe(code);
  expect(serializeGanttDocument(document)).toBe(serialized);
  expect(command).toEqual(commandSnapshot);
}

describe('semantic task schedule commands', () => {
  it('moves instant schedules by delta or absolute start while preserving duration', () => {
    const base = createPatchTestDocument();
    const deltaCommand = { delta: 7, id: 'task-1', type: 'task.move' } as const;
    const commandSnapshot = structuredClone(deltaCommand);
    const moved = applyGanttCommand(base, deltaCommand);

    expectRoundTrip(base, moved);
    expect(deltaCommand).toEqual(commandSnapshot);
    expect(moved.document.tasks[0]).toMatchObject({
      fields: { priority: 'high' },
      schedule: { end: 27, mode: 'instant', start: 17 },
      segments: [{ id: 'segment-1' }],
    });
    expect(moved.patches).toHaveLength(1);
    expect(moved.inversePatches).toHaveLength(1);
    expect(moved.affected).toEqual([{ collection: 'tasks', id: 'task-1' }]);

    const absolute = applyGanttCommand(moved.document, {
      id: 'task-1',
      start: -5,
      type: 'task.move',
    });
    expectRoundTrip(moved.document, absolute);
    expect(absolute.document.tasks[0]?.schedule).toEqual({
      end: 5,
      mode: 'instant',
      start: -5,
    });
  });

  it('resizes one instant boundary and rejects non-positive results', () => {
    const base = createPatchTestDocument();
    const start = applyGanttCommand(base, {
      edge: 'start',
      id: 'task-1',
      time: 5,
      type: 'task.resize',
    });
    expectRoundTrip(base, start);
    expect(start.document.tasks[0]?.schedule).toEqual({
      end: 20,
      mode: 'instant',
      start: 5,
    });

    const end = applyGanttCommand(start.document, {
      edge: 'end',
      id: 'task-1',
      time: 30,
      type: 'task.resize',
    });
    expectRoundTrip(start.document, end);
    expect(end.document.tasks[0]?.schedule).toEqual({
      end: 30,
      mode: 'instant',
      start: 5,
    });

    expectRejected(
      base,
      { edge: 'start', id: 'task-1', time: 20, type: 'task.resize' },
      'command.invalid-interval',
    );
    expectRejected(
      base,
      { edge: 'end', id: 'task-1', time: 5, type: 'task.resize' },
      'command.invalid-interval',
    );
  });

  it('returns identity-preserving no-ops for unchanged movement and boundaries', () => {
    const base = createPatchTestDocument();
    const commands: readonly GanttCommand[] = [
      { delta: 0, id: 'task-1', type: 'task.move' },
      { id: 'task-1', start: 10, type: 'task.move' },
      { edge: 'start', id: 'task-1', time: 10, type: 'task.resize' },
      { edge: 'end', id: 'task-1', time: 20, type: 'task.resize' },
    ];

    for (const command of commands) {
      const outcome = applyGanttCommand(base, command);
      expect(outcome.status).toBe('committed');
      expect(outcome.document).toBe(base);
      expect(outcome.patches).toEqual([]);
      expect(outcome.inversePatches).toEqual([]);
      expect(outcome.affected).toEqual([]);
    }
  });

  it('fails closed for missing, unscheduled, all-day, malformed, and segment targets', () => {
    const base = createPatchTestDocument();
    const unscheduled = withTasks([
      Object.freeze({
        id: 'unscheduled',
        kind: 'task',
        segments: Object.freeze([]),
        title: 'Unscheduled',
      }),
    ]);
    const zeroWidth = withTasks([
      Object.freeze({
        id: 'zero',
        kind: 'task',
        schedule: Object.freeze({ end: 10, mode: 'instant', start: 10 }),
        segments: Object.freeze([]),
        title: 'Zero',
      }),
    ]);
    const reversed = withTasks([
      Object.freeze({
        id: 'reversed',
        kind: 'task',
        schedule: Object.freeze({ end: 9, mode: 'instant', start: 10 }),
        segments: Object.freeze([]),
        title: 'Reversed',
      }),
    ]);
    const overflowing = withTasks([
      Object.freeze({
        id: 'overflowing',
        kind: 'task',
        schedule: Object.freeze({ end: 9e307, mode: 'instant', start: 8e307 }),
        segments: Object.freeze([]),
        title: 'Overflowing',
      }),
    ]);
    const projectKinds = withTasks([
      Object.freeze({
        id: 'summary',
        kind: 'summary',
        schedule: Object.freeze({ end: 20, mode: 'instant', start: 10 }),
        segments: Object.freeze([]),
        title: 'Summary',
      }),
      Object.freeze({
        id: 'milestone',
        kind: 'milestone',
        schedule: Object.freeze({ end: 10, mode: 'instant', start: 10 }),
        segments: Object.freeze([]),
        title: 'Milestone',
      }),
    ]);

    expectRejected(base, { delta: 1, id: 'missing', type: 'task.move' }, 'command.missing-target');
    expectRejected(
      unscheduled,
      { delta: 1, id: 'unscheduled', type: 'task.move' },
      'command.unsupported-schedule',
    );
    expectRejected(
      base,
      { edge: 'end', id: 'task-2', time: 30, type: 'task.resize' },
      'command.unsupported-target',
    );
    expectRejected(
      zeroWidth,
      { delta: 1, id: 'zero', type: 'task.move' },
      'command.invalid-interval',
    );
    expectRejected(
      reversed,
      { edge: 'end', id: 'reversed', time: 20, type: 'task.resize' },
      'command.invalid-interval',
    );
    expectRejected(
      overflowing,
      { delta: 9e307, id: 'overflowing', type: 'task.move' },
      'command.invalid-interval',
    );
    expectRejected(
      projectKinds,
      { delta: 1, id: 'summary', type: 'task.move' },
      'command.unsupported-target',
    );
    expectRejected(
      projectKinds,
      { edge: 'end', id: 'milestone', time: 20, type: 'task.resize' },
      'command.unsupported-target',
    );
    expectRejected(
      base,
      {
        delta: 1,
        id: 'task-1',
        segmentId: 'segment-1',
        type: 'task.move',
      } as unknown as GanttCommand,
      'command.unsupported-target',
    );
  });

  it('strictly rejects malformed move and resize payloads without coercion', () => {
    const base = createPatchTestDocument();
    const cases: readonly GanttCommand[] = [
      { id: 'task-1', type: 'task.move' } as GanttCommand,
      { delta: 1, id: 'task-1', start: 12, type: 'task.move' } as unknown as GanttCommand,
      { delta: '1', id: 'task-1', type: 'task.move' } as unknown as GanttCommand,
      { id: 'task-1', start: Number.POSITIVE_INFINITY, type: 'task.move' },
      { edge: 'middle', id: 'task-1', time: 12, type: 'task.resize' } as unknown as GanttCommand,
      { edge: 'end', id: 'task-1', time: Number.NaN, type: 'task.resize' },
      { delta: 1, id: 'task-1', typo: true, type: 'task.move' } as unknown as GanttCommand,
    ];

    for (const command of cases) {
      expectRejected(base, command, 'command.invalid-payload');
    }
  });

  it('moves a task whose ID is reused by other families without touching them', () => {
    const base = createPatchTestDocument();
    const added = applyGanttCommand(base, {
      type: 'task.add',
      value: {
        id: 'shared',
        schedule: { end: 40, mode: 'instant', start: 30 },
        title: 'Cross-family task',
      },
    });
    expect(added.status).toBe('committed');
    const moved = applyGanttCommand(added.document, {
      delta: 5,
      id: 'shared',
      type: 'task.move',
    });

    expectRoundTrip(added.document, moved);
    expect(moved.document.tasks.at(-1)?.schedule).toEqual({
      end: 45,
      mode: 'instant',
      start: 35,
    });
    expect(moved.document.lanes).toBe(added.document.lanes);
    expect(moved.document.assignments).toBe(added.document.assignments);
    expect(moved.document.placements).toBe(added.document.placements);
    expect(moved.document.dependencies).toBe(added.document.dependencies);
  });

  it('keeps nested move/resize transactions atomic with one affected task', () => {
    const base = createPatchTestDocument();
    const outcome = applyGanttCommand(base, {
      commands: [
        { delta: 5, id: 'task-1', type: 'task.move' },
        {
          commands: [{ edge: 'end', id: 'task-1', time: 30, type: 'task.resize' }],
          type: 'transaction',
        },
      ],
      type: 'transaction',
    });

    expectRoundTrip(base, outcome);
    expect(outcome.document.tasks[0]?.schedule).toEqual({
      end: 30,
      mode: 'instant',
      start: 15,
    });
    expect(outcome.patches).toHaveLength(2);
    expect(outcome.inversePatches).toHaveLength(2);
    expect(outcome.affected).toEqual([{ collection: 'tasks', id: 'task-1' }]);
  });
});
