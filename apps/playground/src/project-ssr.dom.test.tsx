// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { hydrateProjectPage } from './project-hydrate';
import { renderProjectPage } from './project-ssr';

afterEach(() => {
  document.body.replaceChildren();
});

describe('project playground SSR and hydration', () => {
  it('hydrates the explicit package-root inputs without recoverable mismatches', async () => {
    const search = '?ownership=controlled&locale=ar&direction=rtl';
    const markup = renderProjectPage(search);
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('مخطط إطلاق المجتمع');
    expect(markup).toContain('data-gt-part="dependency"');

    const container = document.createElement('main');
    container.innerHTML = markup;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateProjectPage> | undefined;
    await act(async () => {
      root = hydrateProjectPage(container, search, { onRecoverableError });
      await Promise.resolve();
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector('[data-gt-part="root"]')?.getAttribute('dir')).toBe('rtl');
    await act(async () => root?.unmount());
  });
});
