// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { MainPage } from './MainPage';

afterEach(cleanup);

describe('main playground page', () => {
  it('switches the primary chart through every supported theme', () => {
    const { container } = render(<MainPage />);
    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Chart theme' });
    const chart = container.querySelector('.chart-frame');

    expect(selector.value).toBe('light');
    expect(chart?.getAttribute('data-theme')).toBe('light');

    fireEvent.change(selector, { target: { value: 'dark' } });
    expect(selector.value).toBe('dark');
    expect(chart?.getAttribute('data-theme')).toBe('dark');

    fireEvent.change(selector, { target: { value: 'high-contrast' } });
    expect(selector.value).toBe('high-contrast');
    expect(chart?.getAttribute('data-theme')).toBe('high-contrast');
  });
});
