// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Playground } from '../Playground';
import { InteractiveCustomPage } from './InteractiveCustomPage';

async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const result = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  expect(result.violations.map((violation) => violation.id)).toEqual([]);
}

function installGeometry(container: HTMLElement): void {
  const body = container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = container.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 232 },
    clientWidth: { configurable: true, value: 900 },
  });
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: 696 });
  body.getBoundingClientRect = () =>
    ({
      bottom: 232,
      height: 232,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  timeline.getBoundingClientRect = () =>
    ({
      bottom: 232,
      height: 232,
      left: 204,
      right: 900,
      top: 0,
      width: 696,
      x: 204,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  fireEvent(window, new Event('resize'));
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  window.history.replaceState({}, '', '/');
});

describe('Interactive Custom playground consumer', () => {
  it('routes and labels the separate custom consumer without changing the existing route', () => {
    window.history.pushState({}, '', '/interactive-custom');
    render(<Playground />);

    expect(screen.getByRole('heading', { level: 1, name: 'Interactive Custom' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Interactive Custom' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.queryByText('Persistence boundary')).toBeNull();

    cleanup();
    window.history.replaceState({}, '', '/interactive');
    render(<Playground />);
    expect(screen.getByRole('heading', { level: 1, name: 'Interactive' })).toBeTruthy();
  });

  it('opens a named application-owned display panel from task activation', async () => {
    const mounted = render(<InteractiveCustomPage />);
    installGeometry(mounted.container);
    const task = screen.getByRole('button', { name: /^Work item 1,/ });

    task.focus();
    fireEvent.keyDown(task, { key: 'Enter' });

    const panel = screen.getByRole('region', { name: 'Work item 1 details' });
    expect(within(panel).getByText('Display mode')).toBeTruthy();
    expect(within(panel).getByText('80%')).toBeTruthy();
    expect(within(panel).getByText('Discovery')).toBeTruthy();
    expect(panel.closest('[data-gt-part="overlay-host"]')).toBeNull();
    expect(document.activeElement).toBe(panel);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mounted.container.querySelector('[data-api-log-part]')).toBeNull();
    expect(mounted.container.querySelector('pre')).toBeNull();
    await expectNoAxeViolations(mounted.container);
  });

  it('edits task and placement fields through one controlled transaction with history', async () => {
    const user = userEvent.setup();
    const mounted = render(<InteractiveCustomPage />);
    const task = screen.getByRole('button', { name: /^Work item 1,/ });
    task.focus();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await screen.findByRole('menu', { name: 'Work item 1 actions' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit properties' }));

    const form = screen.getByRole('form', { name: 'Edit Work item 1 properties' });
    expect(within(form).getByLabelText('Title')).toBe(document.activeElement);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.clear(within(form).getByLabelText('Title'));
    await user.type(within(form).getByLabelText('Title'), 'Custom updated');
    await user.clear(within(form).getByLabelText('Description'));
    await user.type(within(form).getByLabelText('Description'), 'Owned by the playground.');
    await user.clear(within(form).getByLabelText('Progress (percent)'));
    await user.type(within(form).getByLabelText('Progress (percent)'), '65');
    await user.selectOptions(within(form).getByLabelText('Appearance'), 'warning');
    await user.selectOptions(within(form).getByLabelText('Current lane'), 'release');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Edit Work item 1 properties' })).toBeNull(),
    );
    const display = screen.getByRole('region', { name: 'Custom updated details' });
    expect(within(display).getByText('Display mode')).toBeTruthy();
    expect(within(display).getByText('Owned by the playground.')).toBeTruthy();
    expect(within(display).getByText('65%')).toBeTruthy();
    expect(within(display).getByText('At risk')).toBeTruthy();
    expect(within(display).getByText('Release')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Custom updated,/ })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Work item 1 details' })).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /^Work item 1,/ })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Redo' }).disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Custom updated details' })).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /^Custom updated,/ })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await expectNoAxeViolations(mounted.container);
  });

  it('validates inline and cancels without mutating the controlled document', async () => {
    const user = userEvent.setup();
    render(<InteractiveCustomPage />);
    const task = screen.getByRole('button', { name: /^Work item 2,/ });
    fireEvent.contextMenu(task);
    await user.click(
      within(await screen.findByRole('menu', { name: 'Work item 2 actions' })).getByRole(
        'menuitem',
        { name: 'Edit properties' },
      ),
    );

    const form = screen.getByRole('form', { name: 'Edit Work item 2 properties' });
    await user.clear(within(form).getByLabelText('Title'));
    fireEvent.change(within(form).getByLabelText('End (UTC)'), {
      target: { value: '2026-07-30T00:00' },
    });
    await user.clear(within(form).getByLabelText('Progress (percent)'));
    await user.type(within(form).getByLabelText('Progress (percent)'), '101');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(within(form).getByText('Title is required.')).toBeTruthy();
    expect(within(form).getByText('End must be after start.')).toBeTruthy();
    expect(within(form).getByText('Progress must be a whole number from 0 to 100.')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(true);

    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('region', { name: 'Work item 2 details' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Work item 2,/ })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(true);
  });

  it('treats an unchanged save as display-only and closes safely after deletion', async () => {
    const user = userEvent.setup();
    const mounted = render(<InteractiveCustomPage />);
    installGeometry(mounted.container);
    const first = screen.getByRole('button', { name: /^Work item 1,/ });
    fireEvent.contextMenu(first);
    await user.click(
      within(await screen.findByRole('menu', { name: 'Work item 1 actions' })).getByRole(
        'menuitem',
        { name: 'Edit properties' },
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('region', { name: 'Work item 1 details' })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(true);
    expect(screen.getByText(/no history entry was created/i)).toBeTruthy();

    screen.getByRole('button', { name: /^Work item 3,/ }).focus();
    fireEvent.keyDown(screen.getByRole('button', { name: /^Work item 3,/ }), { key: 'Enter' });
    expect(screen.getByRole('region', { name: 'Work item 3 details' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove latest' }));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Work item 3 details' })).toBeNull(),
    );
    expect(screen.getByText(/panel closed because its canonical task was deleted/i)).toBeTruthy();
  });
});
