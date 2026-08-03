import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { routeDependency } from './route-dependencies';

const from = Object.freeze({
  bottom: 30,
  endX: 0.3,
  hidden: false,
  startX: 0.1,
  taskId: 'from',
  top: 10,
  viewKey: 'from-view',
  y: 20,
});
const to = Object.freeze({
  bottom: 90,
  endX: 0.8,
  hidden: false,
  startX: 0.6,
  taskId: 'to',
  top: 70,
  viewKey: 'to-view',
  y: 80,
});

describe('routeDependency', () => {
  it.each([
    ['finish-to-start', 0.3, 0.6],
    ['start-to-start', 0.1, 0.6],
    ['finish-to-finish', 0.3, 0.8],
    ['start-to-finish', 0.1, 0.8],
  ] as const)('uses semantic anchors for %s', (type, sourceX, targetX) => {
    const route = routeDependency(
      { dependencyId: type, from, rank: 0, to, type },
      { bottom: 100, top: 0 },
    );
    expect(route?.points[0]?.x).toBe(sourceX);
    expect(route?.points.at(-1)?.x).toBe(targetX);
  });

  it('clips virtualized endpoints to stable continuation points', () => {
    const route = routeDependency(
      { dependencyId: 'clipped', from, rank: 2, to, type: 'finish-to-start' },
      { bottom: 65, top: 35 },
    );
    expect(route).toMatchObject({ clippedStart: true, clippedEnd: true });
    expect(route?.points[0]?.y).toBe(35);
    expect(route?.points.at(-1)?.y).toBe(65);
  });

  it('routes an earlier finish-to-start target through the inter-row gutter', () => {
    const route = routeDependency(
      {
        dependencyId: 'earlier-target',
        from,
        rank: 0,
        to: { ...to, endX: 0.4, startX: 0.2 },
        type: 'finish-to-start',
      },
      { bottom: 100, top: 0 },
    );

    expect(route?.points).toEqual([
      { x: 0.3, y: 20 },
      { x: 0.312, y: 20 },
      { x: 0.312, y: 50 },
      { x: 0.188, y: 50 },
      { x: 0.188, y: 80 },
      { x: 0.2, y: 80 },
    ]);
  });

  it('omits a route that does not intersect the viewport', () => {
    expect(
      routeDependency(
        { dependencyId: 'outside', from, rank: 0, to, type: 'finish-to-start' },
        { bottom: 160, top: 120 },
      ),
    ).toBeUndefined();
  });

  it('is deterministic for the same semantic identity and rank', () => {
    const input = { dependencyId: 'stable', from, rank: 4, to, type: 'start-to-finish' as const };
    expect(routeDependency(input, { bottom: 100, top: 0 })).toEqual(
      routeDependency(input, { bottom: 100, top: 0 }),
    );
  });

  it('keeps semantic anchors while preparing physical channels for RTL', () => {
    const route = routeDependency(
      {
        dependencyId: 'rtl',
        direction: 'rtl',
        from: { ...from, endX: 0.7, startX: 0.9 },
        rank: 0,
        to: { ...to, endX: 0.2, startX: 0.4 },
        type: 'finish-to-start',
      },
      { bottom: 100, top: 0 },
    );
    expect(route?.points[0]?.x).toBe(0.7);
    expect(route?.points[1]?.x).toBeLessThan(0.7);
    expect(route?.points.at(-1)?.x).toBe(0.4);
  });

  it('always returns finite, clipped, deterministic geometry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'finish-to-finish' as const,
          'finish-to-start' as const,
          'start-to-finish' as const,
          'start-to-start' as const,
        ),
        fc.integer({ max: 100, min: 0 }),
        fc.double({ max: 2, min: -1, noDefaultInfinity: true, noNaN: true }),
        fc.double({ max: 2, min: -1, noDefaultInfinity: true, noNaN: true }),
        fc.double({ max: 1_500, min: -500, noDefaultInfinity: true, noNaN: true }),
        fc.double({ max: 2, min: -1, noDefaultInfinity: true, noNaN: true }),
        fc.double({ max: 2, min: -1, noDefaultInfinity: true, noNaN: true }),
        fc.double({ max: 1_500, min: -500, noDefaultInfinity: true, noNaN: true }),
        (type, rank, fromStartX, fromEndX, fromY, toStartX, toEndX, toY) => {
          const input = {
            dependencyId: 'property',
            from: { ...from, endX: fromEndX, startX: fromStartX, y: fromY },
            rank,
            to: { ...to, endX: toEndX, startX: toStartX, y: toY },
            type,
          };
          const route = routeDependency(input, { bottom: 1_000, top: 0 });
          expect(route).toEqual(routeDependency(input, { bottom: 1_000, top: 0 }));
          for (const current of route?.points ?? []) {
            expect(Number.isFinite(current.x)).toBe(true);
            expect(Number.isFinite(current.y)).toBe(true);
            expect(current.x).toBeGreaterThanOrEqual(0);
            expect(current.x).toBeLessThanOrEqual(1);
            expect(current.y).toBeGreaterThanOrEqual(0);
            expect(current.y).toBeLessThanOrEqual(1_000);
          }
        },
      ),
      { numRuns: 80, seed: 20_260_731 },
    );
  });
});
