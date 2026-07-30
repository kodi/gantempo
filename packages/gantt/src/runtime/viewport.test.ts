import { describe, expect, it } from 'vite-plus/test';

import {
  createUnmeasuredViewport,
  measureViewport,
  resolveRuntimeViewportOptions,
  viewportForIntent,
} from './viewport';

describe('measured runtime viewport', () => {
  it('derives asymmetric overscan and retains focused geometry outside the visible window', () => {
    const options = resolveRuntimeViewportOptions({
      overscanBefore: 10,
      overscanAfter: 20,
    });

    expect(
      measureViewport(
        {
          clientHeight: 100,
          clientWidth: 800,
          verticalStart: 200,
          retainedRange: { start: 500, end: 524 },
        },
        options,
      ),
    ).toEqual({
      clientHeight: 100,
      clientWidth: 800,
      overscanAfter: 20,
      overscanBefore: 10,
      queryVerticalExtent: 334,
      queryVerticalStart: 190,
      status: 'measured',
      verticalStart: 200,
    });

    expect(
      measureViewport(
        {
          clientHeight: 100,
          clientWidth: 800,
          verticalStart: 200,
          retainedRange: { start: 40, end: 64 },
        },
        options,
      ),
    ).toMatchObject({
      queryVerticalStart: 40,
      queryVerticalExtent: 280,
    });
  });

  it('keeps deterministic unmeasured state and recomputes a measured session intent', () => {
    const options = resolveRuntimeViewportOptions({
      overscanBefore: 10,
      overscanAfter: 20,
    });
    const unmeasured = createUnmeasuredViewport(12, options);
    const measured = measureViewport(
      { clientHeight: 100, clientWidth: 800, verticalStart: 12 },
      options,
    );

    expect(unmeasured).toMatchObject({
      status: 'unmeasured',
      clientHeight: 0,
      clientWidth: 0,
      queryVerticalExtent: 0,
      queryVerticalStart: 12,
    });
    expect(viewportForIntent(unmeasured, 30, options)).toMatchObject({
      status: 'unmeasured',
      verticalStart: 30,
      queryVerticalStart: 30,
    });
    expect(viewportForIntent(measured, 30, options)).toMatchObject({
      status: 'measured',
      verticalStart: 30,
      queryVerticalStart: 20,
      queryVerticalExtent: 130,
    });
  });

  it('rejects non-finite, negative, or reversed numeric inputs', () => {
    expect(() => resolveRuntimeViewportOptions({ overscanBefore: -1 })).toThrow('overscanBefore');
    const options = resolveRuntimeViewportOptions(undefined);
    expect(() =>
      measureViewport({ clientHeight: Number.NaN, clientWidth: 1, verticalStart: 0 }, options),
    ).toThrow('clientHeight');
    expect(() =>
      measureViewport(
        {
          clientHeight: 1,
          clientWidth: 1,
          verticalStart: 0,
          retainedRange: { start: 10, end: 10 },
        },
        options,
      ),
    ).toThrow('retainedRange');
  });
});
