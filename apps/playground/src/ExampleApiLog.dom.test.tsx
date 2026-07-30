// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { ExampleApiLog } from './ExampleApiLog';
import type { ExampleApiWrite } from './example-persistence';

function scheduleWrite(operationId: string, start: string, nextStart: string): ExampleApiWrite {
  return {
    baseRevision: 'server-r17',
    changes: [
      {
        before: {
          end: '2026-08-02T00:00:00.000Z',
          start,
        },
        task: { id: 'task-1', title: 'Work item 1' },
        type: 'task.schedule.updated',
        update: {
          end: '2026-08-06T00:00:00.000Z',
          start: nextStart,
        },
      },
    ],
    operationId,
  };
}

afterEach(() => cleanup());

describe('ExampleApiLog', () => {
  it('shows a concise newest-first summary and expands to raw JSON', async () => {
    const older = scheduleWrite(
      'example-operation-001',
      '2026-07-29T00:00:00.000Z',
      '2026-08-02T00:00:00.000Z',
    );
    const newer = scheduleWrite(
      'example-operation-002',
      '2026-08-02T00:00:00.000Z',
      '2026-08-03T00:00:00.000Z',
    );
    const mounted = render(<ExampleApiLog entries={[older, newer]} />);

    expect(screen.getByRole('region', { name: 'Recent API writes' })).not.toBeNull();
    expect(screen.getByText('2 / 10 retained')).not.toBeNull();
    expect(
      screen.getByText('Aug 2, 2026 – Aug 2, 2026 → Aug 3, 2026 – Aug 6, 2026'),
    ).not.toBeNull();

    const operations = Array.from(
      mounted.container.querySelectorAll('.api-log-entry__operation'),
      (element) => element.textContent,
    );
    expect(operations).toEqual(['example-operation-002', 'example-operation-001']);

    const summary = screen.getAllByText('Work item 1')[0]?.closest('summary');
    const details = summary?.closest('details');
    expect(details?.open).toBe(false);
    fireEvent.click(summary!);
    expect(details?.open).toBe(true);
    expect(screen.getByLabelText('Raw JSON for example-operation-002').textContent).toContain(
      '"operationId": "example-operation-002"',
    );

    const accessibility = await axe.run(mounted.container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('renders an informative empty state', () => {
    render(<ExampleApiLog entries={[]} />);

    expect(screen.getByText('No writes yet')).not.toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
