import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedViewLane, ViewLaneKey, ViewPlacementKey } from '../view/types';
import type { ResolvedIntervalPlacement } from './resolve-placement-intervals';
import { stackLanes } from './stack-lanes';

function lane(id: string, minimumHeight?: number, sourceOrder = 0): ResolvedViewLane {
  return {
    key: id as ViewLaneKey,
    title: id,
    sourceOrder,
    ...(minimumHeight === undefined ? {} : { minimumHeight }),
    source: { kind: 'custom', viewId: 'test', customLaneKey: id },
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
    key: id as ViewPlacementKey,
    laneKey: laneId as ViewLaneKey,
    taskId: id,
    sourceOrder,
    source: { kind: 'project-task', taskId: id },
    start,
    end,
  };
}

describe('stackLanes', () => {
  it('shares tracks at touching boundaries and separates true overlaps', () => {
    const layout = stackLanes(
      [lane('lane')],
      [
        interval('a', 'lane', 0, 10, 0),
        interval('b', 'lane', 10, 20, 1),
        interval('c', 'lane', 5, 15, 2),
      ],
    );

    expect(layout.lanes[0]?.placements.map(({ key, track }) => [key, track])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 1],
    ]);
    expect(layout.lanes[0]).toMatchObject({ y: 0, height: 88, stackCount: 2 });
    expect(layout.lanes[0]?.placements.map((placement) => placement.y)).toEqual([17, 17, 47]);
  });

  it('uses the complete tie-break while retaining resolved placement order', () => {
    const placements = [
      interval('later-key', 'lane', 0, 10, 1),
      interval('first-key', 'lane', 0, 10, 0),
      interval('nested', 'lane', 2, 8, 2),
    ];

    const layout = stackLanes([lane('lane')], placements);

    expect(layout.lanes[0]?.placements.map((placement) => placement.key)).toEqual([
      'later-key',
      'first-key',
      'nested',
    ]);
    expect(layout.lanes[0]?.placements.map((placement) => placement.track)).toEqual([1, 0, 2]);
    expect(layout.lanes[0]?.stackCount).toBe(3);
  });

  it('preserves empty lanes, outer minimums, contiguous offsets, and exact total height', () => {
    const layout = stackLanes(
      [lane('empty', 90, 0), lane('short', 20, 1), lane('dense', undefined, 2)],
      [
        interval('short-a', 'short', 0, 1, 0),
        interval('dense-a', 'dense', 0, 2, 1),
        interval('dense-b', 'dense', 0, 2, 2),
      ],
      { barHeight: 10, paddingTop: 2, paddingBottom: 3, stackGap: 4 },
    );

    expect(layout.lanes.map(({ y, height, stackCount }) => ({ y, height, stackCount }))).toEqual([
      { y: 0, height: 90, stackCount: 0 },
      { y: 90, height: 20, stackCount: 1 },
      { y: 110, height: 58, stackCount: 2 },
    ]);
    expect(layout.totalHeight).toBe(168);
  });

  it('assigns one track per entry in a dense 256-placement fixture', () => {
    const placements = Array.from({ length: 256 }, (_, index) =>
      interval(`dense-${index}`, 'dense', 0, 100, index),
    );

    const layout = stackLanes([lane('dense')], placements);

    expect(layout.lanes[0]?.stackCount).toBe(256);
    expect(new Set(layout.lanes[0]?.placements.map((placement) => placement.track)).size).toBe(256);
  });

  it('rejects invalid metrics, lane minimums, duplicate keys, and missing lanes', () => {
    expect(() => stackLanes([], [], { barHeight: 0 })).toThrow(RangeError);
    expect(() => stackLanes([], [], { paddingTop: -1 })).toThrow(RangeError);
    expect(() => stackLanes([lane('lane', Number.NaN)], [])).toThrow(RangeError);
    expect(() => stackLanes([lane('lane'), lane('lane')], [])).toThrow(RangeError);
    expect(() =>
      stackLanes(
        [lane('lane')],
        [interval('same', 'lane', 0, 1, 0), interval('same', 'lane', 1, 2, 1)],
      ),
    ).toThrow(RangeError);
    expect(() => stackLanes([lane('lane')], [interval('missing', 'other', 0, 1, 0)])).toThrow(
      RangeError,
    );
  });

  it('does not mutate frozen lane, placement, or metric inputs', () => {
    const lanes = Object.freeze([Object.freeze(lane('lane'))]);
    const placements = Object.freeze([Object.freeze(interval('a', 'lane', 0, 1, 0))]);
    const metrics = Object.freeze({ stackGap: 3 });

    const layout = stackLanes(lanes, placements, metrics);

    expect(layout.lanes[0]?.placements[0]).not.toBe(placements[0]);
    expect(Object.isFrozen(layout.lanes[0]?.placements)).toBe(true);
    expect(lanes[0]?.title).toBe('lane');
    expect(metrics.stackGap).toBe(3);
  });
});
