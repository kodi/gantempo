// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { MainPage } from './MainPage';

afterEach(cleanup);

describe('main playground page', () => {
  it('switches the primary chart through every supported theme', () => {
    const { container } = render(<MainPage />);
    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Chart theme' });
    const chart = container.querySelector('[data-theme]');
    const gantt = container.querySelector('[data-gt-part="root"]');

    expect(selector.value).toBe('light');
    expect(chart?.getAttribute('data-theme')).toBe('light');
    expect(gantt?.getAttribute('data-gt-theme')).toBe('light');
    expect(gantt?.getAttribute('data-gt-theme-mode')).toBe('light');
    const repeated = Array.from(
      container.querySelectorAll<SVGGElement>('[data-task-id="requirements"]'),
    );
    expect(repeated).toHaveLength(2);
    expect(repeated.map((task) => task.dataset.gtVariant)).toEqual(['accent', 'warning']);
    expect(
      container.querySelector('[data-task-id="qa"]')?.getAttribute('data-gt-appearance-resolution'),
    ).toBe('unresolved');
    expect(
      container.querySelector('[data-gt-part="root"]')?.getAttribute('data-diagnostic-count'),
    ).toBe('1');
    expect(container.querySelector('[data-gt-part="progress-handle"]')).toBeNull();

    fireEvent.change(selector, { target: { value: 'dark' } });
    expect(selector.value).toBe('dark');
    expect(chart?.getAttribute('data-theme')).toBe('dark');
    expect(gantt?.getAttribute('data-gt-theme')).toBe('dark');
    expect(gantt?.getAttribute('data-gt-theme-mode')).toBe('dark');

    fireEvent.change(selector, { target: { value: 'high-contrast' } });
    expect(selector.value).toBe('high-contrast');
    expect(chart?.getAttribute('data-theme')).toBe('high-contrast');
    expect(gantt?.getAttribute('data-gt-theme')).toBe('high-contrast');
    expect(gantt?.getAttribute('data-gt-theme-mode')).toBe('high-contrast');
  });
});
