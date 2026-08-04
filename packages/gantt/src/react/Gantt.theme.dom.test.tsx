// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { defineGanttTheme } from '../theme';
import { Gantt } from './Gantt';
import { reactTestDocument, reactTestProps } from './Gantt.test-fixtures';

afterEach(cleanup);

describe('Gantt theme and density props', () => {
  it('defaults to light/comfortable and switches renderer-backed density', () => {
    const document = reactTestDocument();
    const mounted = render(<Gantt {...reactTestProps()} defaultDocument={document} />);
    const root = screen.getByRole('region', { name: 'Gantt chart' });

    expect(root.dataset.gtTheme).toBe('light');
    expect(root.dataset.gtThemeMode).toBe('light');
    expect(root.dataset.gtDensity).toBe('comfortable');
    expect(root.style.getPropertyValue('--gt-header-height')).toBe('40px');
    expect(root.style.getPropertyValue('--gt-row-height')).toBe('58px');
    expect(
      mounted.container.querySelector<HTMLElement>('[data-gt-part="lane"]')?.style.height,
    ).toBe('58px');

    mounted.rerender(
      <Gantt {...reactTestProps()} defaultDocument={document} density="compact" theme="dark" />,
    );

    expect(root.dataset.gtTheme).toBe('dark');
    expect(root.dataset.gtThemeMode).toBe('dark');
    expect(root.dataset.gtDensity).toBe('compact');
    expect(root.style.getPropertyValue('--gt-header-height')).toBe('34px');
    expect(root.style.getPropertyValue('--gt-row-height')).toBe('38px');
    expect(
      mounted.container.querySelector<HTMLElement>('[data-gt-part="lane"]')?.style.height,
    ).toBe('38px');
  });

  it('applies custom tokens over a built-in mode and resynchronizes the external portal host', () => {
    const ganttDocument = reactTestDocument();
    const firstTheme = defineGanttTheme({
      id: 'acme-night',
      mode: 'dark',
      tokens: {
        'color.surface': '#101714',
        'color.text': '#f4fff9',
        'overlay.zIndex': 1200,
      },
    });
    const mounted = render(
      <Gantt
        {...reactTestProps()}
        defaultDocument={ganttDocument}
        density="touch"
        theme={firstTheme}
      />,
    );
    const root = screen.getByRole('region', { name: 'Gantt chart' });
    const overlayHost = document.body.querySelector<HTMLElement>(
      '[data-gt-part="overlay-host"][data-gt-overlay-boundary="viewport"]',
    )!;

    expect(root.dataset.gtTheme).toBe('acme-night');
    expect(root.dataset.gtThemeMode).toBe('dark');
    expect(root.style.getPropertyValue('--gt-color-surface')).toBe('#101714');
    expect(root.style.getPropertyValue('--gt-row-height')).toBe('74px');
    expect(overlayHost.dataset.gtTheme).toBe('acme-night');
    expect(overlayHost.dataset.gtThemeMode).toBe('dark');
    expect(overlayHost.dataset.gtDensity).toBe('touch');
    expect(overlayHost.style.getPropertyValue('--gt-color-surface')).toBe('#101714');
    expect(overlayHost.style.getPropertyValue('--gt-z-overlay')).toBe('1200');

    const secondTheme = defineGanttTheme({
      id: 'acme-day',
      tokens: { 'color.surface': '#fffdf5', 'overlay.zIndex': 1300 },
    });
    mounted.rerender(
      <Gantt
        {...reactTestProps()}
        defaultDocument={ganttDocument}
        density="compact"
        theme={secondTheme}
        themeRevision="host-mode-2"
      />,
    );

    expect(overlayHost.dataset.gtTheme).toBe('acme-day');
    expect(overlayHost.dataset.gtThemeMode).toBe('light');
    expect(overlayHost.dataset.gtDensity).toBe('compact');
    expect(overlayHost.style.getPropertyValue('--gt-color-surface')).toBe('#fffdf5');
    expect(overlayHost.style.getPropertyValue('--gt-z-overlay')).toBe('1300');
  });

  it('renders deterministic SSR theme attributes and custom properties', () => {
    const theme = defineGanttTheme({
      id: 'server-brand',
      mode: 'high-contrast',
      tokens: { 'color.accent': '#0044aa' },
    });
    const markup = renderToString(
      <Gantt
        {...reactTestProps()}
        defaultDocument={reactTestDocument()}
        density="compact"
        theme={theme}
      />,
    );

    expect(markup).toContain('data-gt-theme="server-brand"');
    expect(markup).toContain('data-gt-theme-mode="high-contrast"');
    expect(markup).toContain('data-gt-density="compact"');
    expect(markup).toContain('--gt-color-task:#0044aa');
    expect(markup).toContain('--gt-row-height:38px');
  });
});
