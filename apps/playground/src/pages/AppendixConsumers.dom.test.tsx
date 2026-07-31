// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { InteractivePage } from './InteractivePage';
import { UncontrolledPage } from './UncontrolledPage';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('M4 appendix playground consumers', () => {
  it('uses the public properties and progress surface in the controlled consumer', () => {
    const mounted = render(<InteractivePage />);
    const task = screen.getByRole('button', { name: /^Work item 1,/ });

    expect(task.querySelector('[data-gt-part="progress-handle"]')).not.toBeNull();
    fireEvent.click(task);

    const dialog = screen.getByRole('dialog', { name: 'Edit Work item 1 properties' });
    expect((within(dialog).getByLabelText('Progress (percent)') as HTMLInputElement).value).toBe(
      '80',
    );
    expect((within(dialog).getByLabelText('Current lane') as HTMLSelectElement).value).toBe(
      'discovery',
    );
    expect(
      mounted.container
        .querySelector('[data-task-id="interactive-task-2"]')
        ?.getAttribute('data-gt-variant'),
    ).toBe('neutral');
  });

  it('uses the same public surface with runtime-owned document and derived topology', () => {
    render(<UncontrolledPage />);
    const task = screen.getByRole('button', { name: /^Mapped resource task,/ });

    expect(task.querySelector('[data-gt-part="progress-handle"]')).not.toBeNull();
    fireEvent.click(task);

    const dialog = screen.getByRole('dialog', {
      name: 'Edit Mapped resource task properties',
    });
    expect((within(dialog).getByLabelText('Progress (percent)') as HTMLInputElement).value).toBe(
      '35',
    );
    expect(within(dialog).queryByLabelText('Current lane')).toBeNull();
    expect(dialog.textContent).toContain(
      'Lane movement is unavailable for this derived occurrence.',
    );
  });
});
