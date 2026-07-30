import { describe, expect, it } from 'vite-plus/test';

import {
  applyGanttCommand,
  applyGanttPatches,
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
  type GanttCommand,
  type GanttDocument,
  type GanttAppearanceReference,
  type GanttPatch,
  type TaskMoveCommand,
  type TaskResizeCommand,
} from './index';

const document: GanttDocument = Object.freeze({
  assignments: Object.freeze([]),
  dependencies: Object.freeze([]),
  lanes: Object.freeze([]),
  placements: Object.freeze([]),
  resources: Object.freeze([]),
  revision: 'server-owned',
  schemaVersion: 1,
  tasks: Object.freeze([]),
});

describe('public change-kernel facade', () => {
  it('supports command, patch, transaction, and bounded history through root imports', () => {
    const appearance: GanttAppearanceReference = { variant: 'customer:blocked' };
    const move: TaskMoveCommand = {
      delta: 5,
      id: '42',
      type: 'task.move',
    };
    const resize: TaskResizeCommand = {
      edge: 'end',
      id: '42',
      time: 30,
      type: 'task.resize',
    };
    const command: GanttCommand = {
      commands: [
        {
          type: 'task.add',
          value: {
            appearance,
            description: 'Public portable properties',
            fields: { source: 'facade' },
            id: 42,
            schedule: { end: 20, mode: 'instant', start: 10 },
            title: 'Public change',
          },
        },
        move,
        resize,
        {
          changes: { progress: 0.5 },
          id: '42',
          type: 'task.update',
        },
      ],
      type: 'transaction',
    };
    const outcome = applyGanttCommand(document, command);

    expect(outcome.status).toBe('committed');
    expect(outcome.document.revision).toBe('server-owned');
    expect(outcome.document.tasks[0]).toMatchObject({
      appearance,
      description: 'Public portable properties',
      fields: { source: 'facade' },
      id: '42',
      progress: 0.5,
      schedule: { end: 30, mode: 'instant', start: 15 },
    });
    const patches: readonly GanttPatch[] = outcome.patches;
    const replay = applyGanttPatches(document, patches);
    expect(replay.status).toBe('applied');
    expect(replay.document).toEqual(outcome.document);

    const committed = commitGanttHistory(createGanttHistory(document, 2), outcome);
    expect(committed.status).toBe('applied');
    expect(committed.history.past).toHaveLength(1);
    const undone = undoGanttHistory(committed.history);
    expect(undone.status).toBe('applied');
    expect(undone.history.document).toEqual(document);
    const redone = redoGanttHistory(undone.history);
    expect(redone.status).toBe('applied');
    expect(redone.history.document).toEqual(outcome.document);
  });
});
