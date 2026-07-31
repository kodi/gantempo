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
  });

  it('retains non-color task states and system media fallbacks', () => {
    expect(stylesheet).toContain("[data-selected='true']");
    expect(stylesheet).toContain("[data-rejected='true']");
    expect(stylesheet).toContain('stroke-dasharray: 4 2');
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesheet).toContain('@media (forced-colors: active)');
    expect(stylesheet).toContain('fill: Canvas');
    expect(stylesheet).toContain('fill: Highlight');
    expect(stylesheet).toContain('transition: none');
  });
});
