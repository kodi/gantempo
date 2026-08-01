import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../../model/types';
import {
  elapsedDuration,
  itemPropertiesCommand,
  validateItemPropertiesValue,
  validateTaskEditorValue,
} from './editor-commands';

const document: GanttDocument = {
  assignments: [],
  dependencies: [],
  lanes: [
    { id: 'lane-a', title: 'Lane A' },
    { id: 'lane-b', title: 'Lane B' },
  ],
  placements: [{ id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' }],
  resources: [],
  schemaVersion: 1,
  tasks: [
    {
      id: 'summary',
      kind: 'summary',
      segments: [],
      title: 'Summary',
    },
    {
      id: 'task-a',
      kind: 'task',
      schedule: { end: 7_200_000, mode: 'instant', start: 0 },
      segments: [],
      title: 'Task A',
    },
  ],
};

describe('React editor command adapters', () => {
  it('validates legacy editor values without needing a mounted surface', () => {
    expect(validateTaskEditorValue({ end: 2, start: 1, title: 'Task' })).toBeUndefined();
    expect(validateTaskEditorValue({ end: 2, start: 1, title: ' ' })).toBe('Title is required.');
    expect(validateTaskEditorValue({ end: 1, start: 1, title: 'Task' })).toBe(
      'End must be later than start.',
    );
  });

  it('maps one property submission to a stable task-and-placement transaction', () => {
    const initial = {
      end: 7_200_000,
      kind: 'task' as const,
      laneId: 'lane-a',
      placementId: 'placement-a',
      start: 0,
      taskId: 'task-a',
      taskKind: 'task' as const,
      title: 'Task A',
    };
    const value = {
      ...initial,
      laneId: 'lane-b',
      parentId: 'summary',
      progress: 0.5,
      title: 'Renamed',
    };

    expect(validateItemPropertiesValue(initial, value, document)).toBeUndefined();
    expect(itemPropertiesCommand(initial, value, document)).toEqual({
      commands: [
        {
          changes: { parentId: 'summary', progress: 0.5, title: 'Renamed' },
          id: 'task-a',
          type: 'task.update',
        },
        { id: 'placement-a', laneId: 'lane-b', type: 'placement.move' },
      ],
      type: 'transaction',
    });
  });

  it('formats elapsed property duration independently of the editor component', () => {
    expect(
      elapsedDuration({
        end: 93_900_000,
        kind: 'task',
        start: 0,
        taskId: 'task-a',
        taskKind: 'task',
        title: 'Task A',
      }),
    ).toBe('1d 2h 5m');
  });
});
