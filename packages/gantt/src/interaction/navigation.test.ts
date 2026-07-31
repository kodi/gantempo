import { describe, expect, it } from 'vite-plus/test';

import type { ChartScene, LaneRowPrimitive, TaskBarPrimitive } from '../render/primitives';
import { createInteractionHitTestIndex } from './hit-test';
import {
  interactionOccurrences,
  navigateInteractionOccurrence,
  navigateRuntimeOccurrence,
} from './navigation';

function lane(viewKey: string, y: number, height = 60): LaneRowPrimitive {
  return {
    viewKey,
    laneId: viewKey,
    source: { kind: 'document-lane', laneId: viewKey },
    title: viewKey,
    y,
    height,
  };
}

function task(
  viewKey: string,
  laneViewKey: string,
  taskId: string,
  x: number,
  y: number,
): TaskBarPrimitive {
  return {
    viewKey,
    laneViewKey,
    placementId: viewKey,
    taskId,
    laneId: laneViewKey,
    source: { kind: 'document-placement', placementId: viewKey, laneId: laneViewKey },
    title: viewKey,
    start: x * 1_000,
    end: (x + 0.1) * 1_000,
    x,
    width: 0.1,
    y,
    height: 24,
    presentation: { geometry: { kind: 'bar' }, intervalSource: 'canonical', kind: 'task' },
    clippedStart: false,
    clippedEnd: false,
  };
}

function fixture() {
  const lanes = [lane('same', 0), lane('empty', 60, 70), lane('lower', 130, 80), lane('last', 210)];
  const tasks = [
    task('same', 'same', 'repeated', 0.1, 18),
    task('same-later', 'same', 'repeated', 0.6, 18),
    task('lower-left', 'lower', 'lower-left', 0.2, 158),
    task('lower-right', 'lower', 'lower-right', 0.75, 158),
    task('last-task', 'last', 'last', 0.58, 228),
  ];
  const scene: ChartScene = {
    dependencyPaths: [],
    dependencySummaries: [],
    range: { start: 0, end: 1_000 },
    bounds: {
      headerHeight: 40,
      laneColumnWidth: 160,
      defaultLaneHeight: 60,
      timelineHeight: 270,
      totalHeight: 310,
    },
    ticks: [],
    gridLines: [],
    lanes,
    taskBars: tasks,
    diagnostics: [],
  };
  return createInteractionHitTestIndex(scene, {
    x: 0,
    y: 0,
    width: 1_000,
    height: 270,
    verticalStart: 0,
  });
}

describe('visual occurrence navigation', () => {
  it('navigates left/right/home/end within a lane by geometry', () => {
    const index = fixture();
    const first = index.tasks[0]!.target;
    const second = index.tasks[1]!.target;

    expect(navigateInteractionOccurrence(index, first, 'right')?.viewKey).toBe(second.viewKey);
    expect(navigateInteractionOccurrence(index, second, 'left')?.viewKey).toBe(first.viewKey);
    expect(navigateInteractionOccurrence(index, second, 'home')?.viewKey).toBe(first.viewKey);
    expect(navigateInteractionOccurrence(index, first, 'end')?.viewKey).toBe(second.viewKey);
    expect(navigateInteractionOccurrence(index, first, 'left')).toBeUndefined();
  });

  it('skips empty lanes and chooses the closest horizontal occurrence vertically', () => {
    const index = fixture();
    const upper = index.tasks[1]!.target;
    const lower = navigateInteractionOccurrence(index, upper, 'down');
    const last = navigateInteractionOccurrence(index, lower!, 'down');

    expect(lower?.viewKey).toBe('lower-right');
    expect(last?.viewKey).toBe('last-task');
    expect(navigateInteractionOccurrence(index, last!, 'up')?.viewKey).toBe('lower-right');
  });

  it('keeps repeated task occurrences and lane/task cross-family keys distinct', () => {
    const index = fixture();
    const occurrences = interactionOccurrences(index);

    expect(occurrences.filter((item) => item.target.kind === 'task')).toHaveLength(5);
    expect(
      occurrences
        .filter((item) => item.target.kind === 'task' && item.target.taskId === 'repeated')
        .map((item) => item.target.viewKey),
    ).toEqual(['same', 'same-later']);
    expect(index.lanes[0]?.target).toMatchObject({ kind: 'lane', viewKey: 'same' });
    expect(index.tasks[0]?.target).toMatchObject({ kind: 'task', viewKey: 'same' });
    expect(
      navigateInteractionOccurrence(
        index,
        {
          kind: 'task',
          laneViewKey: 'missing',
          taskId: 'repeated',
          viewKey: 'offscreen',
        },
        'right',
      ),
    ).toBeUndefined();
  });

  it('navigates the full runtime catalog independently of visible hit-test tasks', () => {
    const index = fixture();
    const visible = interactionOccurrences(index).slice(0, 2);
    const fullCatalog = interactionOccurrences(index);
    const current = visible[1]!.target;
    expect(current.kind).toBe('task');
    if (current.kind !== 'task') {
      throw new Error('Expected a task occurrence.');
    }

    expect(navigateRuntimeOccurrence(fullCatalog, current, 'down')).toMatchObject({
      viewKey: 'lower-right',
    });
    expect(navigateRuntimeOccurrence(visible, current, 'down')).toBeUndefined();
  });
});
