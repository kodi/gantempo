// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { Gantt } from './Gantt';
import type { GanttProps } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function fixture(title = 'Žetva العربية'): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [{ id: 'lane', title: 'Tim فريق' }],
    placements: [{ id: 'placement', laneId: 'lane', taskId: 'task' }],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'task',
        kind: 'task',
        progress: 0.5,
        schedule: { end: START + 3 * DAY, mode: 'instant', start: START + DAY },
        segments: [],
        title,
      },
    ],
  };
}

const baseProps = {
  defaultDocument: fixture(),
  defaultRange: { end: START + 7 * DAY, start: START },
  tickAnchor: START,
  tickInterval: DAY,
  timeZone: 'UTC',
} as const;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  cleanup();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('Gantt localization and RTL integration', () => {
  it('isolates opposite directions, messages, formatter context, and mirrored time geometry', () => {
    const uses: string[] = [];
    const diagnosticCodes = new Set<string>();
    const mounted = render(
      <>
        <Gantt
          {...baseProps}
          direction="ltr"
          label="English chart"
          locale="sr-Latn-RS"
          messages={{ 'zoom.in': 'Uvećaj' }}
        />
        <Gantt
          {...baseProps}
          direction="rtl"
          features={{ properties: true }}
          formatters={{
            dateTime(_value, context) {
              uses.push(`${context.direction}:${context.locale}:${context.use}`);
              return 'زمن';
            },
            message: () => '',
            number: () => '',
          }}
          label="مخطط عربي"
          locale="ar"
          messages={{ 'zoom.in': 'تكبير' }}
          onDiagnostics={(diagnostics) => {
            for (const diagnostic of diagnostics) diagnosticCodes.add(diagnostic.code);
          }}
        />
      </>,
    );

    const roots = mounted.container.querySelectorAll<HTMLElement>('[data-gt-part="root"]');
    expect(Array.from(roots, (root) => root.dir)).toEqual(['ltr', 'rtl']);
    expect(roots[0]!.getAttribute('aria-label')).toBe('English chart');
    expect(roots[1]!.getAttribute('aria-label')).toBe('مخطط عربي');
    expect(roots[0]!.querySelector('[aria-label="Uvećaj"]')).not.toBeNull();
    expect(roots[1]!.querySelector('[aria-label="تكبير"]')).not.toBeNull();
    expect(roots[0]!.querySelector('[aria-label="تكبير"]')).toBeNull();
    expect(roots[1]!.querySelector('[aria-label="Uvećaj"]')).toBeNull();

    const ltrTicks = roots[0]!.querySelectorAll<HTMLElement>('[data-gt-part="time-header"] > span');
    const rtlTicks = roots[1]!.querySelectorAll<HTMLElement>('[data-gt-part="time-header"] > span');
    expect(ltrTicks[0]!.style.left).toBe('0%');
    expect(rtlTicks[0]!.style.left).toBe('100%');
    expect(rtlTicks[0]!.textContent).toBe('زمن');
    expect(uses).toContain('rtl:ar:tick-major');
    expect(diagnosticCodes).toEqual(new Set(['format.message', 'format.number']));

    fireEvent.click(roots[1]!.querySelector<HTMLElement>('[data-task-id="task"]')!);
    expect(document.body.querySelector<HTMLElement>('[role="dialog"]')?.dir).toBe('rtl');
  });

  it('server-renders and hydrates deterministic non-default locale and direction markup', async () => {
    const props: GanttProps = {
      ...baseProps,
      direction: 'rtl',
      locale: 'ar',
      messages: { 'chart.label': 'مخطط المشروع', 'zoom.fit': 'ملاءمة المشروع' },
    };
    const markup = renderToString(<Gantt {...props} />);
    const host = document.createElement('div');
    host.innerHTML = markup;
    document.body.append(host);
    const errors: unknown[] = [];
    let root!: ReturnType<typeof hydrateRoot>;

    await act(async () => {
      root = hydrateRoot(host, <Gantt {...props} />, {
        onRecoverableError(error) {
          errors.push(error);
        },
      });
    });

    expect(errors).toEqual([]);
    expect(host.querySelector<HTMLElement>('[data-gt-part="root"]')?.dir).toBe('rtl');
    expect(host.querySelector('[data-gt-part="root"]')?.getAttribute('aria-label')).toBe(
      'مخطط المشروع',
    );
    expect(host.querySelector('[aria-label="ملاءمة المشروع"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
