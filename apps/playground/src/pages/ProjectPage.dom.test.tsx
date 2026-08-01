// @vitest-environment jsdom

import { parseGanttDocument, serializeGanttDocument } from '@gantempo/gantt';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Playground } from '../Playground';
import { createProjectDocument } from '../project-fixture';
import { ProjectPage, parseProjectPageOptions } from './ProjectPage';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('project playground public consumer', () => {
  it('parses a bounded, deterministic route contract', () => {
    expect(parseProjectPageOptions('')).toEqual({
      cycle: false,
      direction: 'ltr',
      locale: 'en-US',
      ownership: 'controlled',
    });
    expect(
      parseProjectPageOptions('?ownership=uncontrolled&locale=sr-Latn&direction=rtl&cycle=1'),
    ).toEqual({
      cycle: true,
      direction: 'rtl',
      locale: 'sr-Latn',
      ownership: 'uncontrolled',
    });
    const serialized = serializeGanttDocument(createProjectDocument(true));
    const parsed = parseGanttDocument(JSON.parse(serialized));
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['dependency.cycle']);
    expect(serializeGanttDocument(parsed.document!)).toBe(serialized);
  });

  it('routes the deep fixture with kind-specific rendering and nonvisual relationships', async () => {
    window.history.replaceState({}, '', '/project?ownership=controlled&locale=en-US&direction=ltr');
    const mounted = render(<Playground />);

    expect(screen.getByRole('link', { name: 'Project' }).getAttribute('aria-current')).toBe('page');
    const chart = screen.getByRole('region', { name: 'Community launch chart' });
    expect(chart.getAttribute('dir')).toBe('ltr');
    const rows = screen.getByRole('treegrid').querySelectorAll('[role="row"][aria-level]');
    expect(Array.from(rows).map((row) => row.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '3',
      '3',
      '2',
      '2',
      '3',
      '4',
      '4',
      '3',
      '3',
      '3',
    ]);
    expect(mounted.container.querySelectorAll('[data-gt-part="summary"]')).toHaveLength(4);
    expect(mounted.container.querySelectorAll('[data-gt-part="milestone"]')).toHaveLength(2);
    expect(mounted.container.querySelectorAll('[data-gt-part="dependency"]')).toHaveLength(4);
    expect(
      Array.from(mounted.container.querySelectorAll('[data-gt-part="dependency"]'))
        .map((path) => path.getAttribute('data-type'))
        .sort((left, right) => (left ?? '').localeCompare(right ?? '')),
    ).toEqual(['finish-to-finish', 'finish-to-start', 'start-to-finish', 'start-to-start']);
    expect(screen.getByLabelText('Dependencies').querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Fit project' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Zoom in' })).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Project locale' }).getAttribute('name')).toBe(
      'project-locale',
    );
    expect(screen.getByRole('combobox', { name: 'Project direction' }).getAttribute('name')).toBe(
      'project-direction',
    );
    expect(
      screen.getByRole('searchbox', { name: 'Filter project tasks' }).getAttribute('name'),
    ).toBe('project-filter');
    expect(
      screen.getByRole('combobox', { name: 'Sort project siblings' }).getAttribute('name'),
    ).toBe('project-sort');
    expect((await axe.run(mounted.container)).violations).toEqual([]);
  });

  it('filters descendants with their ancestors and acknowledges controlled edits', async () => {
    const mounted = render(
      <ProjectPage search="?ownership=controlled&locale=en-US&direction=ltr" />,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter project tasks' }), {
      target: { value: 'Public API' },
    });
    expect(screen.getByRole('treegrid').querySelectorAll('[role="row"][aria-level]')).toHaveLength(
      4,
    );
    expect(mounted.container.querySelector('[data-task-id="project"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-task-id="delivery"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-task-id="build"]')).not.toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter project tasks' }), {
      target: { value: '' },
    });
    expect(screen.getByRole('treegrid').querySelectorAll('[role="row"][aria-level]')).toHaveLength(
      12,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rename API' }));
    await waitFor(() =>
      expect(screen.getByTestId('project-consumer-status').textContent).toContain(
        'Controlled candidate acknowledged: task.update',
      ),
    );
    expect(mounted.container.textContent).toContain('Public API acknowledged');
  });

  it('lets the runtime own edits and keeps read-only Arabic RTL inspectable', async () => {
    const uncontrolled = render(
      <ProjectPage search="?ownership=uncontrolled&locale=sr-Latn&direction=ltr" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename API' }));
    await waitFor(() =>
      expect(screen.getByTestId('project-consumer-status').textContent).toContain(
        'Runtime committed: task.update',
      ),
    );
    uncontrolled.unmount();

    const readOnly = render(<ProjectPage search="?ownership=read-only&locale=ar&direction=rtl" />);
    const chart = screen.getByRole('region', { name: 'مخطط إطلاق المجتمع' });
    expect(chart.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('button', { name: 'ملاءمة المشروع' })).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Rename API' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(readOnly.container.querySelector('[data-gt-part="link-handle"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Public API,/ }));
    const readOnlyDialog = await screen.findByRole('dialog');
    expect(readOnlyDialog.getAttribute('aria-readonly')).toBe('true');
    expect(
      (within(readOnlyDialog).getByRole('textbox', { name: 'Title' }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(within(readOnlyDialog).queryByRole('button', { name: 'Save task' })).toBeNull();
  });

  it('keeps the opt-in cyclic document intact and reports diagnostics', async () => {
    expect(createProjectDocument(true).dependencies).toHaveLength(5);
    const mounted = render(
      <ProjectPage search="?ownership=controlled&locale=en-US&direction=ltr&cycle=1" />,
    );
    await waitFor(() =>
      expect(
        Number(
          mounted.container
            .querySelector('[data-gt-part="root"]')
            ?.getAttribute('data-diagnostic-count'),
        ),
      ).toBeGreaterThan(2),
    );
    expect(
      mounted.container.querySelectorAll('[data-gt-part="dependency-summaries"] li'),
    ).toHaveLength(5);
    expect(screen.getByText(/automatic scheduling is not performed/)).not.toBeNull();
  });
});
