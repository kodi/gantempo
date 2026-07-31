import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

const stylesheet = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('semantic appearance stylesheet', () => {
  it('maps every coordinated browser token to a stable rendered part', () => {
    for (const token of [
      '--gt-lane-accent',
      '--gt-lane-surface',
      '--gt-task-border',
      '--gt-task-fill',
      '--gt-task-progress-fill',
      '--gt-task-text',
    ]) {
      expect(stylesheet).toContain(token);
    }
    expect(stylesheet).toContain(".gt-gantt__timeline-cells [data-gt-part='timeline-cell']");
    expect(stylesheet).toContain('.gt-gantt__lane-accent');
    expect(stylesheet).toContain('.gt-gantt__task-bar');
    expect(stylesheet).toContain('.gt-gantt__task-progress');
    expect(stylesheet).toContain("[data-gt-part='progress-handle']");
    expect(stylesheet).toContain("[data-gt-part='progress-hit-target']");
    expect(stylesheet).toContain("[data-gt-part='progress-preview-value']");
    expect(stylesheet).toContain('@media (pointer: coarse)');
    expect(stylesheet).toContain('width: 44px');
  });

  it('retains non-color task states and system media fallbacks', () => {
    expect(stylesheet).toContain('--gt-color-text-muted: #69736c');
    expect(stylesheet).toContain("[data-selected='true']");
    expect(stylesheet).toContain("[data-rejected='true']");
    expect(stylesheet).toContain("[data-progressing='true']");
    expect(stylesheet).toContain('stroke-dasharray: 4 2');
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesheet).toContain('@media (forced-colors: active)');
    expect(stylesheet).toContain('fill: Canvas');
    expect(stylesheet).toContain('fill: Highlight');
    expect(stylesheet).toContain('forced-color-adjust: none');
    expect(stylesheet).toContain('transition: none');
  });
});

describe('lane properties trigger stylesheet', () => {
  it('gives the icon control explicit inset spacing and motion fallback', () => {
    expect(stylesheet).toMatch(
      /\.gt-gantt__lane-properties-trigger\)[^{]*\{[^}]*box-sizing: border-box;[^}]*width: 28px;[^}]*padding: 0 5px;/s,
    );
    expect(stylesheet).toMatch(
      /\.gt-gantt__lane-properties-trigger svg\)[^{]*\{[^}]*width: 16px;[^}]*height: 16px;/s,
    );
    expect(stylesheet).toContain('border: 1px solid transparent');
    expect(stylesheet).toContain('background: transparent');
    expect(stylesheet).toContain('opacity: 0.64');
    expect(stylesheet).toContain('opacity: 0.82');
    expect(stylesheet).toContain('.gt-gantt__lane-properties-trigger:active');
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[^{]*\{[\s\S]*\.gt-gantt__lane-properties-trigger[\s\S]*transition: none;/,
    );
  });
});

describe('default tooltip stylesheet', () => {
  it('lays out a compact human schedule and duration badge', () => {
    expect(stylesheet).toContain('.gt-gantt__tooltip-schedule');
    expect(stylesheet).toContain('.gt-gantt__tooltip-schedule svg');
    expect(stylesheet).toContain('.gt-gantt__tooltip-duration');
    expect(stylesheet).toContain('min-width: min(210px, calc(100% - 16px))');
    expect(stylesheet).toContain('border-radius: 999px');
  });
});
