import { describe, expect, it } from 'vite-plus/test';

import {
  defineGanttTheme,
  GANTT_BUILT_IN_THEMES,
  GANTT_DENSITY_METRICS,
  resolveGanttTheme,
  type GanttThemeDefinition,
} from './theme';

describe('public Gantt themes', () => {
  it('publishes complete immutable built-in definitions', () => {
    expect(Object.keys(GANTT_BUILT_IN_THEMES)).toEqual(['dark', 'high-contrast', 'light']);
    for (const [name, theme] of Object.entries(GANTT_BUILT_IN_THEMES)) {
      expect(theme.id).toBe(name);
      expect(theme.mode).toBe(name);
      expect(Object.isFrozen(theme)).toBe(true);
      expect(Object.isFrozen(theme.tokens)).toBe(true);
      expect(theme.tokens['color.surface']).toBeTypeOf('string');
      expect(theme.tokens['color.text']).toBeTypeOf('string');
      expect(theme.tokens['color.focus']).toBeTypeOf('string');
    }
  });

  it('normalizes custom definitions and maps only their explicit browser overrides', () => {
    const definition = defineGanttTheme({
      id: '  acme-night  ',
      mode: 'dark',
      tokens: {
        'color.surface': '#101714',
        'font.family': 'Inter, sans-serif',
        'overlay.zIndex': 1200,
      },
    });
    const resolved = resolveGanttTheme(definition);

    expect(definition.id).toBe('acme-night');
    expect(resolved).toMatchObject({ id: 'acme-night', mode: 'dark' });
    expect(resolved.style).toEqual({
      '--gt-color-surface': '#101714',
      '--gt-font-family': 'Inter, sans-serif',
      '--gt-z-overlay': 1200,
    });
    expect(Object.isFrozen(resolved.style)).toBe(true);
  });

  it('rejects empty ids, unknown tokens, and unusable values', () => {
    expect(() => defineGanttTheme({ id: ' ', tokens: {} })).toThrow(/non-empty/);
    expect(() =>
      defineGanttTheme({
        id: 'unknown-token',
        tokens: { privateColor: '#fff' },
      } as unknown as GanttThemeDefinition),
    ).toThrow(/Unsupported Gantt theme token/);
    expect(() =>
      defineGanttTheme({
        id: 'invalid-number',
        tokens: { 'overlay.zIndex': Number.NaN },
      }),
    ).toThrow(/finite number/);
    expect(() =>
      defineGanttTheme({
        id: 'empty-value',
        tokens: { 'color.surface': ' ' },
      }),
    ).toThrow(/non-empty string/);
  });
});

describe('Gantt density metrics', () => {
  it('keeps each preset internally valid and ordered by interaction space', () => {
    expect(GANTT_DENSITY_METRICS.compact.rowHeight).toBe(38);
    expect(GANTT_DENSITY_METRICS.comfortable.rowHeight).toBe(58);
    expect(GANTT_DENSITY_METRICS.touch.rowHeight).toBe(74);

    for (const metrics of Object.values(GANTT_DENSITY_METRICS)) {
      expect(metrics.barHeight + metrics.lanePaddingTop + metrics.lanePaddingBottom).toBe(
        metrics.rowHeight,
      );
      expect(Object.isFrozen(metrics)).toBe(true);
    }
  });
});
