import { describe, expect, it } from 'vite-plus/test';

import { indexLanes, indexPlacements, indexTasks } from './indexes';
import type { LaneRecord, PlacementRecord, TaskRecord } from './types';

describe('record indexes', () => {
  it('preserves first-seen order without mutating input arrays', () => {
    const tasks: readonly TaskRecord[] = Object.freeze([
      Object.freeze({ id: 'task-a', kind: 'task', segments: [], title: 'A' }),
      Object.freeze({ id: 'task-b', kind: 'task', segments: [], title: 'B' }),
    ]);

    const result = indexTasks(tasks);

    expect(result.ordered.map((task) => task.id)).toEqual(['task-a', 'task-b']);
    expect(result.byId.get('task-b')?.title).toBe('B');
    expect(tasks.map((task) => task.id)).toEqual(['task-a', 'task-b']);
  });

  it('omits later duplicate IDs and emits focused diagnostics', () => {
    const tasks: readonly TaskRecord[] = [
      { id: 'task-a', kind: 'task', segments: [], title: 'First' },
      { id: 'task-a', kind: 'task', segments: [], title: 'Duplicate' },
    ];
    const lanes: readonly LaneRecord[] = [
      { id: 'lane-a', title: 'First' },
      { id: 'lane-a', title: 'Duplicate' },
    ];
    const placements: readonly PlacementRecord[] = [
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' },
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-b' },
    ];

    const taskResult = indexTasks(tasks);
    const laneResult = indexLanes(lanes);
    const placementResult = indexPlacements(placements);

    expect(taskResult.ordered).toEqual([
      { id: 'task-a', kind: 'task', segments: [], title: 'First' },
    ]);
    expect(taskResult.diagnostics[0]?.code).toBe('record.duplicate-task');
    expect(laneResult.ordered).toEqual([{ id: 'lane-a', title: 'First' }]);
    expect(laneResult.diagnostics[0]?.code).toBe('record.duplicate-lane');
    expect(placementResult.ordered).toHaveLength(1);
    expect(placementResult.diagnostics[0]?.code).toBe('record.duplicate-placement');
  });
});
