import { describe, expect, it } from 'vite-plus/test';

import { createGanttLocalization } from './format';

describe('Gantt localization', () => {
  it('normalizes explicit locale, time zone, and direction without host defaults', () => {
    const localization = createGanttLocalization({
      direction: 'rtl',
      locale: 'sr-latn-rs',
      timeZone: 'Europe/Belgrade',
    });

    expect(localization).toMatchObject({
      diagnostics: [],
      direction: 'rtl',
      locale: 'sr-Latn-RS',
      timeZone: 'Europe/Belgrade',
    });
    expect(localization.dateTime(Date.UTC(2026, 6, 31, 12), 'task-start')).toMatch(/2026/);
    expect(localization.number(50, 'progress')).toBe('50');

    const western = createGanttLocalization({
      locale: 'en-US',
      timeZone: 'America/Los_Angeles',
    });
    expect(western.date('2026-07-31', 'task-start')).toContain('Jul 31, 2026');
  });

  it('interpolates message overrides before applying a bounded message formatter', () => {
    const descriptors: string[] = [];
    const localization = createGanttLocalization({
      formatters: {
        message(descriptor) {
          descriptors.push(descriptor.key);
          return `⟦${descriptor.defaultMessage}⟧`;
        },
      },
      messages: { 'tree.expand': 'Otvori {title} — {missing}' },
      timeZone: 'UTC',
    });

    expect(localization.message('tree.expand', { title: 'Žetva' })).toBe(
      '⟦Otvori Žetva — {missing}⟧',
    );
    expect(descriptors).toEqual(['tree.expand']);
  });

  it('passes semantic context to each formatter', () => {
    const contexts: string[] = [];
    const localization = createGanttLocalization({
      direction: 'rtl',
      formatters: {
        date(value, context) {
          contexts.push(`${value}:${context.use}:${context.direction}`);
          return 'datum';
        },
        dateTime(value, context) {
          contexts.push(`${value}:${context.use}:${context.locale}:${context.timeZone}`);
          return 'vreme';
        },
        number(value, context) {
          contexts.push(`${value}:${context.use}:${context.direction}`);
          return 'broj';
        },
      },
      locale: 'sr-Latn-RS',
      timeZone: 'Europe/Belgrade',
    });

    expect(localization.date('2026-07-31', 'task-end')).toBe('datum');
    expect(localization.dateTime(100, 'tick-minor')).toBe('vreme');
    expect(localization.number(0.5, 'dependency-lag')).toBe('broj');
    expect(contexts).toEqual([
      '2026-07-31:task-end:rtl',
      '100:tick-minor:sr-Latn-RS:Europe/Belgrade',
      '0.5:dependency-lag:rtl',
    ]);
  });

  it('falls back deterministically and diagnoses invalid inputs and formatter output', () => {
    const localization = createGanttLocalization({
      formatters: {
        date: () => '',
        dateTime: () => {
          throw new Error('consumer failure');
        },
        message: () => '',
        number: () => '',
      },
      locale: 'not_a_locale',
      timeZone: 'not/a-zone',
    });

    expect(localization.date('2026-07-31', 'task-start')).toContain('2026');
    expect(localization.dateTime(0, 'tick-major')).toContain('1970');
    expect(localization.message('zoom.in')).toBe('Zoom in');
    expect(localization.number(12, 'progress')).toBe('12');
    expect(localization.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'format.invalid-locale',
      'format.invalid-time-zone',
      'format.date',
      'format.date-time',
      'format.message',
      'format.number',
    ]);
  });
});
