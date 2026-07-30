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
  type GanttPatch,
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
    const command: GanttCommand = {
      commands: [
        {
          type: 'task.add',
          value: {
            fields: { source: 'facade' },
            id: 42,
            title: 'Public change',
          },
        },
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
      fields: { source: 'facade' },
      id: '42',
      progress: 0.5,
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
