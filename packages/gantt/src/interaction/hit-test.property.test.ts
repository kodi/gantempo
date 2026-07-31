import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { ChartScene, LaneRowPrimitive, TaskBarPrimitive } from '../render/primitives';
import { createInteractionHitTestIndex, hitTestInteraction } from './hit-test';
import type {
  InteractionHit,
  InteractionHitTestIndex,
  InteractionPoint,
  InteractionPointerType,
  InteractionTaskNode,
} from './types';

const PROPERTY_SEED = 20_260_730;
const PROPERTY_RUNS = 250;

function contains(
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  point: InteractionPoint,
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function bruteForce(
  index: InteractionHitTestIndex,
  point: InteractionPoint,
  pointerType: InteractionPointerType,
):
  | {
      readonly edge?: 'end' | 'start';
      readonly kind: InteractionHit['kind'];
      readonly lane: string;
      readonly task?: string;
    }
  | undefined {
  if (!contains(index.timeline, point)) {
    return undefined;
  }
  const radius = pointerType === 'touch' ? 22 : pointerType === 'pen' ? 8 : 6;
  const minimumHeight = pointerType === 'touch' ? 44 : pointerType === 'pen' ? 28 : 0;
  const edges: {
    readonly distance: number;
    readonly edge: 'end' | 'start';
    readonly task: InteractionTaskNode;
  }[] = [];
  for (const task of index.tasks) {
    const height = Math.max(task.rect.height, minimumHeight);
    const top = task.rect.y - (height - task.rect.height) / 2;
    if (point.y < top || point.y >= top + height) {
      continue;
    }
    if (!task.primitive.clippedStart) {
      const distance = Math.abs(point.x - task.rect.x);
      if (distance <= radius) {
        edges.push({ distance, edge: 'start', task });
      }
    }
    if (!task.primitive.clippedEnd) {
      const distance = Math.abs(point.x - task.rect.x - task.rect.width);
      if (distance <= radius) {
        edges.push({ distance, edge: 'end', task });
      }
    }
  }
  edges.sort(
    (left, right) =>
      left.distance - right.distance ||
      right.task.paintOrder - left.task.paintOrder ||
      (left.edge === right.edge ? 0 : left.edge === 'start' ? -1 : 1),
  );
  const edge = edges[0];
  if (edge !== undefined) {
    return {
      edge: edge.edge,
      kind: 'task-edge',
      lane: edge.task.lane.target.viewKey,
      task: edge.task.target.viewKey,
    };
  }
  const body = [...index.tasks]
    .filter((task) => contains(task.rect, point))
    .sort((left, right) => right.paintOrder - left.paintOrder)[0];
  if (body !== undefined) {
    return {
      kind: 'task-body',
      lane: body.lane.target.viewKey,
      task: body.target.viewKey,
    };
  }
  const lane = index.lanes.find((candidate) => contains(candidate.rect, point));
  return lane === undefined ? undefined : { kind: 'timeline-position', lane: lane.target.viewKey };
}

function summary(hit: InteractionHit | undefined) {
  return hit === undefined
    ? undefined
    : {
        kind: hit.kind,
        lane: hit.lane.target.viewKey,
        ...(hit.kind === 'task-edge' ? { edge: hit.edge } : {}),
        ...(hit.kind === 'timeline-position' ? {} : { task: hit.task.target.viewKey }),
      };
}

describe(`hit-test brute-force parity seed=${PROPERTY_SEED}`, () => {
  it('matches visible primitive scanning across dense fixed-seed geometry', () => {
    fc.assert(
      fc.property(
        fc.record({
          laneHeights: fc.array(fc.integer({ min: 40, max: 120 }), {
            minLength: 1,
            maxLength: 8,
          }),
          pointX: fc.integer({ min: -100, max: 1_100 }),
          pointY: fc.integer({ min: -100, max: 1_000 }),
          pointerType: fc.constantFrom('mouse' as const, 'pen' as const, 'touch' as const),
          tasks: fc.array(
            fc.record({
              clippedEnd: fc.boolean(),
              clippedStart: fc.boolean(),
              height: fc.integer({ min: 8, max: 36 }),
              lane: fc.nat({ max: 100 }),
              offsetY: fc.nat({ max: 100 }),
              width: fc.integer({ min: 1, max: 400 }),
              x: fc.integer({ min: 0, max: 999 }),
            }),
            { maxLength: 40 },
          ),
        }),
        ({ laneHeights, pointX, pointY, pointerType, tasks: taskSpecs }) => {
          let y = 0;
          const lanes: LaneRowPrimitive[] = laneHeights.map((height, index) => {
            const lane = {
              viewKey: `lane-${index}`,
              laneId: `lane-${index}`,
              source: { kind: 'document-lane' as const, laneId: `lane-${index}` },
              title: `Lane ${index}`,
              y,
              height,
            };
            y += height;
            return lane;
          });
          const tasks: TaskBarPrimitive[] = taskSpecs.map((specification, index) => {
            const lane = lanes[specification.lane % lanes.length]!;
            const laneId = lane.laneId!;
            const width = Math.min(specification.width, 1_000 - specification.x);
            const height = Math.min(specification.height, lane.height);
            const offset = specification.offsetY % Math.max(1, lane.height - height + 1);
            return {
              viewKey: `task-view-${index}`,
              laneViewKey: lane.viewKey,
              placementId: `placement-${index}`,
              taskId: `task-${index}`,
              laneId,
              source: {
                kind: 'document-placement',
                placementId: `placement-${index}`,
                laneId,
              },
              title: `Task ${index}`,
              start: specification.x,
              end: specification.x + width,
              x: specification.x / 1_000,
              width: width / 1_000,
              y: lane.y + offset,
              height,
              presentation: {
                geometry: { kind: 'bar' },
                intervalSource: 'canonical',
                kind: 'task',
              },
              clippedStart: specification.clippedStart,
              clippedEnd: specification.clippedEnd,
            };
          });
          const scene: ChartScene = {
            dependencyPaths: [],
            dependencySummaries: [],
            range: { start: 0, end: 1_000 },
            bounds: {
              headerHeight: 40,
              laneColumnWidth: 160,
              defaultLaneHeight: 60,
              timelineHeight: y,
              totalHeight: y + 40,
            },
            ticks: [],
            gridLines: [],
            lanes,
            taskBars: tasks,
            diagnostics: [],
          };
          const index = createInteractionHitTestIndex(scene, {
            x: 0,
            y: 0,
            width: 1_000,
            height: y,
            verticalStart: 0,
          });
          const point = { x: pointX, y: pointY };
          expect(summary(hitTestInteraction(index, point, pointerType))).toEqual(
            bruteForce(index, point, pointerType),
          );
        },
      ),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
        verbose: true,
      },
    );
  });
});
