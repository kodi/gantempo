import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_ROOT = dirname(SOURCE_ROOT);
const THIS_TEST = fileURLToPath(import.meta.url);

const mainStylesheet = `@layer theme, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities) source('./');
@source '../index.html';

@theme {
  --color-brand: #176b57;
  --color-brand-light: #217a65;
  --color-canvas: #f3f1eb;
  --color-ink: #243044;
  --color-ink-strong: #182435;
  --color-muted: #59616d;
  --color-panel: #ffffff;
  --color-panel-soft: #fbfcfa;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-sans:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
`;

const exampleStylesheet = `@layer theme, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
`;

const legacyClassNames = [
  'api-log',
  'api-log-entry',
  'api-log-entry__badge',
  'api-log-entry__chevron',
  'api-log-entry__details',
  'api-log-entry__meta',
  'api-log-entry__raw',
  'api-log-entry__summary',
  'api-log-stream',
  'api-log-stream__empty',
  'api-log-stream__heading',
  'api-log-stream__list',
  'api-log__header',
  'chart-frame',
  'chart-frame--compact',
  'chart-frame--interactive',
  'chart-frame--main',
  'chart-frame--matrix',
  'chart-frame--navigation',
  'chart-frame--project',
  'chart-frame__actions',
  'chart-frame__toolbar',
  'custom-details',
  'custom-details__actions',
  'custom-details__description',
  'custom-details__display',
  'custom-details__error',
  'custom-details__form-grid',
  'custom-details__header',
  'custom-details__wide-field',
  'example-guide__intro',
  'example-result',
  'example-result__header',
  'example-source',
  'example-step',
  'example-step__content',
  'example-step__number',
  'example-steps',
  'interactive-chart-count',
  'interactive-column-cell',
  'interactive-controls',
  'interactive-controls__buttons',
  'interactive-controls__separator',
  'interactive-controls__status',
  'interactive-lane-header',
  'interactive-surface-editor',
  'interactive-surface-menu',
  'interactive-surface-tooltip',
  'interactive-task-content',
  'navigation-summary',
  'page--navigation',
  'page--project',
  'project-controls',
  'project-controls__choices',
  'project-controls__cycle',
  'project-status',
  'scenario-card',
  'scenario-card__header',
  'scenario-matrix',
  'uncontrolled-task--pending',
] as const;

function appSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'dist' ? [] : appSourceFiles(path);
    return /\.(?:css|html|less|sass|scss|ts|tsx)$/.test(entry.name) && path !== THIS_TEST
      ? [path]
      : [];
  });
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('playground Tailwind source boundary', () => {
  it('keeps the only playground stylesheets selector-free and directive-only', () => {
    const stylesheets = appSourceFiles(PLAYGROUND_ROOT)
      .filter((path) => /\.(?:css|less|sass|scss)$/.test(path))
      .map((path) => relative(PLAYGROUND_ROOT, path))
      .sort();

    expect(stylesheets).toEqual(['src/examples/styles.css', 'src/styles.css']);
    expect(readFileSync(join(SOURCE_ROOT, 'styles.css'), 'utf8')).toBe(mainStylesheet);
    expect(readFileSync(join(SOURCE_ROOT, 'examples/styles.css'), 'utf8')).toBe(exampleStylesheet);
  });

  it('rejects legacy classes, private package targets, and alternate styling systems', () => {
    const legacyClassPattern = new RegExp(
      `(?:^|[\\s."'\\x60])(?:${legacyClassNames.map(escapeRegularExpression).join('|')})(?=$|[\\s"'\\x60])`,
      'm',
    );
    const dynamicUtilityFragment =
      /\b(?:bg|border|bottom|col-span|font|gap|grid-cols|h|left|m[trblxy]?|max-[hw]|min-[hw]|opacity|outline|p[trblxy]?|right|ring|rotate|rounded|scale|shadow|text|top|translate-[xy]|w|z)-[^\s"'`]*\$\{/;
    const cssInJs =
      /(?:@emotion|styled-components)|(?:\bcss|\bstyled(?:\.[A-Za-z_$][\w$]*|\([^)]*\))?)\s*`|<style\b/;

    const violations = appSourceFiles(PLAYGROUND_ROOT).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const problems = [
        legacyClassPattern.test(source) ? 'legacy presentation class' : undefined,
        /\.gt-gantt__/.test(source) ? 'private package class target' : undefined,
        /@apply\b/.test(source) ? '@apply directive' : undefined,
        /\.module\.(?:css|less|sass|scss)$/.test(path) ? 'CSS Module' : undefined,
        cssInJs.test(source) ? 'CSS-in-JS' : undefined,
        dynamicUtilityFragment.test(source) ? 'dynamic utility fragment' : undefined,
      ].filter((problem): problem is string => problem !== undefined);

      return problems.map((problem) => `${relative(PLAYGROUND_ROOT, path)}: ${problem}`);
    });

    expect(violations).toEqual([]);
  });
});
