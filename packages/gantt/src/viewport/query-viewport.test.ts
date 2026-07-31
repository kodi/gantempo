import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedViewLane, ViewLaneKey, ViewPlacementKey } from '../view/types';
import type { ResolvedIntervalPlacement } from '../layout/resolve-placement-intervals';
import { stackLanes } from '../layout/stack-lanes';
import { createViewportKernel } from './create-viewport-kernel';
import { queryViewport, queryViewportWithWork } from './query-viewport';
import { queryViewportBruteForce } from './test-oracle';

function lane(id: string, sourceOrder: number, minimumHeight = 10): ResolvedViewLane {
  return {
    key: id as ViewLaneKey,
    title: id,
    sourceOrder,
    minimumHeight,
    source: { kind: 'custom', viewId: 'viewport', customLaneKey: id },
  };
}

function interval(
  id: string,
  laneId: string,
  start: number,
  end: number,
  sourceOrder: number,
): ResolvedIntervalPlacement {
  return {
    intervalSource: 'canonical',
    kind: 'task',
    key: id as ViewPlacementKey,
    laneKey: laneId as ViewLaneKey,
    taskId: id,
    sourceOrder,
    source: { kind: 'project-task', taskId: id },
    start,
    end,
  };
}

describe('viewport kernel', () => {
  it('uses half-open boundaries in both dimensions and preserves absolute geometry', () => {
    const layout = stackLanes(
      [lane('a', 0, 20), lane('b', 1, 30), lane('c', 2, 40)],
      [
        interval('before', 'b', 0, 10, 0),
        interval('left-touch', 'b', 10, 20, 1),
        interval('visible', 'b', 20, 30, 2),
        interval('right-touch', 'b', 30, 40, 3),
      ],
      { barHeight: 5, paddingTop: 0, paddingBottom: 0, stackGap: 0 },
    );
    const kernel = createViewportKernel(layout);

    const result = queryViewport(kernel, {
      timeRange: { start: 20, end: 30 },
      verticalStart: 20,
      verticalExtent: 30,
    });

    expect(result.lanes.map((item) => item.key)).toEqual(['b']);
    expect(result.placements.map((item) => item.key)).toEqual(['visible']);
    expect(result.lanes[0]).toMatchObject({ y: 20, height: 30 });
    expect(result.contentBounds).toEqual({
      height: 90,
      timeRange: { start: 0, end: 40 },
    });
  });

  it('includes milestone points at the range start and excludes them at the range end', () => {
    const layout = stackLanes(
      [lane('lane', 0)],
      [
        { ...interval('start', 'lane', 20, 20, 0), kind: 'milestone' },
        { ...interval('middle', 'lane', 25, 25, 1), kind: 'milestone' },
        { ...interval('end', 'lane', 30, 30, 2), kind: 'milestone' },
      ],
    );
    const result = queryViewport(createViewportKernel(layout), {
      timeRange: { end: 30, start: 20 },
      verticalExtent: 58,
      verticalStart: 0,
    });

    expect(result.placements.map((item) => item.key)).toEqual(['start', 'middle']);
  });

  it('finds long intervals that begin far before the query start', () => {
    const layout = stackLanes(
      [lane('lane', 0)],
      [
        interval('long', 'lane', -10_000, 10_000, 0),
        ...Array.from({ length: 63 }, (_, index) =>
          interval(`short-${index}`, 'lane', index * 10, index * 10 + 2, index + 1),
        ),
      ],
    );
    const kernel = createViewportKernel(layout);

    const indexed = queryViewport(kernel, {
      timeRange: { start: 5_000, end: 5_010 },
      verticalStart: 0,
      verticalExtent: layout.totalHeight,
    });

    expect(indexed.placements.map((item) => item.key)).toEqual(['long']);
  });

  it('returns visible lanes even when their time window contains no bars', () => {
    const kernel = createViewportKernel(stackLanes([lane('empty', 0)], []));

    const result = queryViewport(kernel, {
      timeRange: { start: 1, end: 2 },
      verticalStart: 0,
      verticalExtent: 5,
    });

    expect(result.lanes).toHaveLength(1);
    expect(result.placements).toEqual([]);
    expect(result.contentBounds).toEqual({ height: 34 });
  });

  it('returns empty collections past content and rejects invalid query values', () => {
    const kernel = createViewportKernel(stackLanes([lane('lane', 0)], []));

    expect(
      queryViewport(kernel, {
        timeRange: { start: 0, end: 1 },
        verticalStart: 100,
        verticalExtent: 10,
      }).lanes,
    ).toEqual([]);
    expect(() =>
      queryViewport(kernel, {
        timeRange: { start: 1, end: 1 },
        verticalStart: 0,
        verticalExtent: 1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      queryViewport(kernel, {
        timeRange: { start: 0, end: 1 },
        verticalStart: -1,
        verticalExtent: 1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      queryViewport(kernel, {
        timeRange: { start: 0, end: 1 },
        verticalStart: 0,
        verticalExtent: 0,
      }),
    ).toThrow(RangeError);
  });

  it('matches the brute-force oracle and returns fresh result arrays on repeated queries', () => {
    const kernel = createViewportKernel(
      stackLanes(
        [lane('a', 0, 20), lane('b', 1, 30)],
        [interval('a', 'a', 0, 100, 0), interval('b', 'b', 10, 20, 1)],
      ),
    );
    const query = {
      timeRange: { start: 15, end: 25 },
      verticalStart: 10,
      verticalExtent: 30,
    };

    const first = queryViewport(kernel, query);
    const second = queryViewport(kernel, query);

    expect(first).toEqual(queryViewportBruteForce(kernel, query));
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.lanes).not.toBe(second.lanes);
    expect(Object.isFrozen(kernel.lanes)).toBe(true);
  });

  it('does not visit unrelated lanes or every interval during an ordinary query', () => {
    const lanes = Array.from({ length: 1_000 }, (_, index) => lane(`lane-${index}`, index));
    const placements = lanes.flatMap((item, laneIndex) =>
      Array.from({ length: 64 }, (_, intervalIndex) =>
        interval(
          `${laneIndex}-${intervalIndex}`,
          item.key,
          intervalIndex * 10,
          intervalIndex * 10 + 2,
          intervalIndex,
        ),
      ),
    );
    const layout = stackLanes(lanes, placements);
    const kernel = createViewportKernel(layout);
    const target = kernel.lanes[500]!;

    const { result, work } = queryViewportWithWork(kernel, {
      timeRange: { start: 321, end: 322 },
      verticalStart: target.y,
      verticalExtent: target.height,
    });

    expect(result.lanes).toHaveLength(1);
    expect(work.laneCandidates).toBe(1);
    expect(work.intervalNodesVisited).toBeLessThan(64);
  });

  it('rejects malformed non-contiguous layout instead of repairing it', () => {
    const valid = stackLanes([lane('lane', 0)], []);
    const malformed = {
      ...valid,
      totalHeight: valid.totalHeight + 1,
    };

    expect(() => createViewportKernel(malformed)).toThrow(RangeError);
  });
});
