import { describe, expect, it } from 'vite-plus/test';

import type { GanttCommand } from '../commands/types';
import type { GanttDocument } from '../model/types';
import type { ChartScene } from '../render/primitives';
import { mapInteractionIntent } from './command-mapping';
import { createInteractionHitTestIndex } from './hit-test';
import type {
  InteractionCreateIntent,
  InteractionMoveIntent,
  InteractionResizeIntent,
} from './types';

function fixture() {
  const document: GanttDocument = {
    schemaVersion: 1,
    tasks: [
      {
        id: 'instant',
        kind: 'task',
        title: 'Instant',
        segments: [],
        schedule: { mode: 'instant', start: 100, end: 300 },
      },
      {
        id: 'all-day',
        kind: 'task',
        title: 'All day',
        segments: [],
        schedule: { mode: 'all-day', startDate: '2026-07-30', endDate: '2026-07-31' },
      },
    ],
    resources: [],
    lanes: [
      { id: 'lane-a', title: 'Lane A' },
      { id: 'lane-b', title: 'Lane B' },
    ],
    assignments: [],
    placements: [{ id: 'placement-a', taskId: 'instant', laneId: 'lane-a' }],
    dependencies: [],
  };
  const scene: ChartScene = {
    range: { start: 0, end: 1_000 },
    bounds: {
      headerHeight: 40,
      laneColumnWidth: 160,
      defaultLaneHeight: 60,
      timelineHeight: 120,
      totalHeight: 160,
    },
    ticks: [],
    gridLines: [],
    lanes: [
      {
        viewKey: 'lane-a-view',
        laneId: 'lane-a',
        source: { kind: 'document-lane', laneId: 'lane-a' },
        title: 'Lane A',
        y: 0,
        height: 60,
      },
      {
        viewKey: 'lane-b-view',
        laneId: 'lane-b',
        source: { kind: 'document-lane', laneId: 'lane-b' },
        title: 'Lane B',
        y: 60,
        height: 60,
      },
    ],
    taskBars: [
      {
        viewKey: 'instant-view',
        laneViewKey: 'lane-a-view',
        placementId: 'placement-a',
        taskId: 'instant',
        laneId: 'lane-a',
        source: {
          kind: 'document-placement',
          placementId: 'placement-a',
          laneId: 'lane-a',
        },
        title: 'Instant',
        start: 100,
        end: 300,
        x: 0.1,
        width: 0.2,
        y: 18,
        height: 24,
        clippedStart: false,
        clippedEnd: false,
      },
    ],
    diagnostics: [],
  };
  const index = createInteractionHitTestIndex(scene, {
    x: 0,
    y: 0,
    width: 1_000,
    height: 120,
    verticalStart: 0,
  });
  return { document, index, task: index.tasks[0]! };
}

function moveIntent(
  delta: number,
  destinationViewKey = 'lane-a-view',
  destinationLaneId = 'lane-a',
): InteractionMoveIntent {
  const { index, task } = fixture();
  const destination = index.lanes.find(
    (lane) => lane.target.viewKey === destinationViewKey,
  )!.target;
  return {
    delta,
    destination: { ...destination, laneId: destinationLaneId },
    end: 300 + delta,
    kind: 'move',
    source: task.target,
    sourceEnd: 300,
    sourceStart: 100,
    start: 100 + delta,
    task,
  };
}

describe('interaction command mapping', () => {
  it('maps horizontal, vertical, combined, and resize intent to semantic commands', () => {
    const { document, task, index } = fixture();
    expect(mapInteractionIntent(moveIntent(100), { document })).toEqual({
      command: { delta: 100, id: 'instant', type: 'task.move' },
      status: 'mapped',
    });
    expect(mapInteractionIntent(moveIntent(0, 'lane-b-view', 'lane-b'), { document })).toEqual({
      command: { id: 'placement-a', laneId: 'lane-b', type: 'placement.move' },
      status: 'mapped',
    });
    expect(mapInteractionIntent(moveIntent(100, 'lane-b-view', 'lane-b'), { document })).toEqual({
      command: {
        commands: [
          { delta: 100, id: 'instant', type: 'task.move' },
          { id: 'placement-a', laneId: 'lane-b', type: 'placement.move' },
        ],
        type: 'transaction',
      },
      status: 'mapped',
    });

    const resize: InteractionResizeIntent = {
      destination: index.lanes[0]!.target,
      edge: 'end',
      end: 400,
      kind: 'resize',
      source: task.target,
      sourceEnd: 300,
      sourceStart: 100,
      start: 100,
      task,
      time: 400,
    };
    expect(mapInteractionIntent(resize, { document })).toEqual({
      command: { edge: 'end', id: 'instant', time: 400, type: 'task.resize' },
      status: 'mapped',
    });
  });

  it('fails closed for all-day, segment, invalid interval, and ambiguous provenance', () => {
    const { document, task, index } = fixture();
    const allDay = {
      ...moveIntent(100),
      source: { ...task.target, taskId: 'all-day' },
    } satisfies InteractionMoveIntent;
    expect(mapInteractionIntent(allDay, { document })).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'command.unsupported-schedule' },
    });

    const segment = {
      ...moveIntent(100),
      source: { ...task.target, segmentId: 'segment-a' },
    } satisfies InteractionMoveIntent;
    expect(mapInteractionIntent(segment, { document })).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'command.unsupported-target' },
    });

    const invalidResize: InteractionResizeIntent = {
      destination: index.lanes[0]!.target,
      edge: 'start',
      end: 300,
      kind: 'resize',
      source: task.target,
      sourceEnd: 300,
      sourceStart: 100,
      start: 400,
      task,
      time: 400,
    };
    expect(mapInteractionIntent(invalidResize, { document })).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'command.invalid-interval' },
    });

    const ambiguous = {
      ...moveIntent(0, 'lane-b-view', 'lane-b'),
      source: {
        kind: 'task' as const,
        laneViewKey: 'resource-a',
        resourceId: 'resource-a',
        taskId: 'instant',
        viewKey: 'derived-occurrence',
      },
    };
    expect(mapInteractionIntent(ambiguous, { document })).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'command.unsupported-target' },
    });
  });

  it('freezes mapper inputs and clones mapped commands for derived moves and creation', () => {
    const { document, index } = fixture();
    const mutableCommand: GanttCommand = {
      changes: { title: 'Mapped' },
      id: 'instant',
      type: 'task.update',
    };
    let moveInputFrozen = false;
    const ambiguous = {
      ...moveIntent(100, 'lane-b-view', 'lane-b'),
      source: {
        kind: 'task' as const,
        laneViewKey: 'resource-a',
        resourceId: 'resource-a',
        taskId: 'instant',
        viewKey: 'derived-occurrence',
      },
    };
    const move = mapInteractionIntent(ambiguous, {
      document,
      mappers: {
        moveOccurrence(intent) {
          moveInputFrozen =
            Object.isFrozen(intent) &&
            Object.isFrozen(intent.source) &&
            Object.isFrozen(intent.destination);
          return { command: mutableCommand, status: 'mapped' };
        },
      },
    });
    (mutableCommand.changes as { title?: string }).title = 'Mutated later';

    expect(moveInputFrozen).toBe(true);
    expect(move).toEqual({
      command: { changes: { title: 'Mapped' }, id: 'instant', type: 'task.update' },
      status: 'mapped',
    });
    expect(Object.isFrozen(move)).toBe(true);
    expect(move.status === 'mapped' && Object.isFrozen(move.command)).toBe(true);

    const create: InteractionCreateIntent = {
      destination: index.lanes[1]!.target,
      end: 600,
      kind: 'create',
      start: 500,
    };
    expect(
      mapInteractionIntent(create, {
        document,
        mappers: {
          createTask(intent) {
            expect(Object.isFrozen(intent)).toBe(true);
            return {
              command: {
                type: 'transaction',
                commands: [
                  {
                    type: 'task.add',
                    value: {
                      id: 'created',
                      title: 'Created',
                      schedule: { mode: 'instant', start: intent.start, end: intent.end },
                    },
                  },
                  {
                    type: 'placement.add',
                    value: {
                      id: 'created-placement',
                      taskId: 'created',
                      laneId: intent.destination.laneId!,
                    },
                  },
                ],
              },
              status: 'mapped',
            };
          },
        },
      }),
    ).toMatchObject({
      status: 'mapped',
      command: { type: 'transaction' },
    });
  });

  it('turns absent, thrown, or invalid mappers into stable rejection results', () => {
    const { document, index } = fixture();
    const create: InteractionCreateIntent = {
      destination: index.lanes[1]!.target,
      end: 600,
      kind: 'create',
      start: 500,
    };
    expect(mapInteractionIntent(create, { document })).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'command.unsupported-target' },
    });
    expect(
      mapInteractionIntent(create, {
        document,
        mappers: {
          createTask() {
            throw new Error('Host failure');
          },
        },
      }),
    ).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'runtime.callback-threw' },
    });
    expect(
      mapInteractionIntent(create, {
        document,
        mappers: {
          createTask: (() => null) as never,
        },
      }),
    ).toMatchObject({
      status: 'rejected',
      diagnostic: { code: 'command.invalid-payload' },
    });
  });
});
