import { describe, expect, it } from 'vite-plus/test';

import { clippedBarGeometry, joinClasses, laneStyle, percent } from './presentation';

describe('React presentation adapters', () => {
  it('keeps clipped rounded caps outside the visible SVG interval', () => {
    expect(clippedBarGeometry(0, 0.25, 'ltr', true, false)).toEqual({
      width: 'calc(25% + 6px)',
      x: 'calc(0% - 6px)',
    });
    expect(clippedBarGeometry(0.75, 0.25, 'rtl', true, false)).toEqual({
      width: 'calc(25% + 6px)',
      x: '75%',
    });
  });

  it('derives stable lane CSS and class strings', () => {
    expect(percent(0.125)).toBe('12.5%');
    expect(laneStyle(58, 87, 58)).toEqual({
      '--gt-lane-height-ratio': 1.5,
      height: 87,
      position: 'absolute',
      top: 58,
    });
    expect(joinClasses(undefined, 'first', '', 'second')).toBe('first second');
  });
});
