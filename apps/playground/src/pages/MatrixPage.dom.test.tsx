// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { matrixScenarios } from '../scenarios';
import { MatrixPage } from './MatrixPage';

afterEach(cleanup);

describe('matrix playground presentation recipes', () => {
  it('keeps every focused recipe data-agnostic and hidden by default', () => {
    const { container } = render(<MatrixPage />);
    const toggles = screen.getAllByRole('button', { name: 'Show code' });

    expect(toggles).toHaveLength(matrixScenarios.length);
    expect(container.querySelectorAll('[data-gt-part="root"]')).toHaveLength(
      matrixScenarios.length,
    );
    const ganttRoots = container.querySelectorAll<HTMLElement>('[data-gt-part="root"]');

    for (const [index, scenario] of matrixScenarios.entries()) {
      const panelId = toggles[index]!.getAttribute('aria-controls')!;
      const panel = container.querySelector<HTMLElement>(`#${panelId}`)!;
      expect(panel.hidden).toBe(true);
      expect(panel.getAttribute('aria-label')).toBe(`${scenario.title} code`);
      expect(panel.querySelector('code.shiki.language-tsx')?.textContent).toBe(
        scenario.source.trim(),
      );
      expect(panel.querySelector('[data-shiki-token]')).not.toBeNull();
      expect(scenario.source).toContain('<Gantt');
      expect(scenario.source).not.toMatch(/fetch|QueryClient|mutationFn|saveSimpleProject/i);
      expect(ganttRoots[index]?.dataset.gtTheme).toBe(
        scenario.themeDefinition?.id ?? scenario.theme,
      );
      expect(ganttRoots[index]?.dataset.gtThemeMode).toBe(
        scenario.themeDefinition?.mode ?? scenario.theme,
      );
      expect(ganttRoots[index]?.dataset.gtDensity).toBe(scenario.density);
    }

    expect(matrixScenarios[0]?.source).toContain('density="compact"');
    expect(matrixScenarios[1]?.source).toContain('theme="dark"');
    expect(matrixScenarios[2]?.source).toContain('defineGanttTheme');
    expect(matrixScenarios[3]?.source).toContain('theme="high-contrast"');
  });

  it('reveals and hides each recipe independently with an associated control', async () => {
    const mounted = render(<MatrixPage />);
    const toggles = screen.getAllByRole<HTMLButtonElement>('button', { name: 'Show code' });
    const firstPanelId = toggles[0]!.getAttribute('aria-controls')!;
    const secondPanelId = toggles[1]!.getAttribute('aria-controls')!;
    const firstPanel = mounted.container.querySelector<HTMLElement>(`#${firstPanelId}`)!;
    const secondPanel = mounted.container.querySelector<HTMLElement>(`#${secondPanelId}`)!;

    expect(toggles[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(firstPanel.hidden).toBe(true);
    expect(secondPanel.hidden).toBe(true);

    fireEvent.click(toggles[0]!);

    expect(screen.getByRole('button', { name: 'Hide code' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(firstPanel.hidden).toBe(false);
    expect(firstPanel.textContent).toContain("view={{ kind: 'project' }}");
    expect(secondPanel.hidden).toBe(true);
    expect((await axe.run(mounted.container)).violations).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Hide code' }));
    expect(firstPanel.hidden).toBe(true);
  });
});
