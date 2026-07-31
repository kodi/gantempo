import type { GanttAppearanceVariantOption } from '@gantempo/gantt';

export const PLAYGROUND_APPEARANCE_VARIANTS: readonly GanttAppearanceVariantOption[] =
  Object.freeze([
    Object.freeze({
      id: 'accent',
      label: 'Primary work',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-color-task)',
        'lane.surface': 'color-mix(in srgb, var(--gt-color-task) 7%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-color-task) 76%, black)',
        'task.fill': 'var(--gt-color-task)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-color-task) 72%, black)',
        'task.text': 'var(--gt-color-task-text)',
      }),
    }),
    Object.freeze({
      id: 'neutral',
      label: 'Supporting work',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-task-neutral)',
        'lane.surface': 'color-mix(in srgb, var(--gt-task-neutral) 22%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-task-neutral) 72%, black)',
        'task.fill': 'var(--gt-task-neutral)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-task-neutral) 68%, black)',
        'task.text': 'var(--gt-task-muted-text)',
      }),
    }),
    Object.freeze({
      id: 'success',
      label: 'Ready',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-task-success)',
        'lane.surface': 'color-mix(in srgb, var(--gt-task-success) 15%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-task-success) 72%, black)',
        'task.fill': 'var(--gt-task-success)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-task-success) 78%, black)',
        'task.text': 'var(--gt-task-muted-text)',
      }),
    }),
    Object.freeze({
      id: 'warning',
      label: 'At risk',
      tokens: Object.freeze({
        'lane.accent': 'var(--gt-task-warning)',
        'lane.surface': 'color-mix(in srgb, var(--gt-task-warning) 15%, transparent)',
        'task.border': 'color-mix(in srgb, var(--gt-task-warning) 72%, black)',
        'task.fill': 'var(--gt-task-warning)',
        'task.progressFill': 'color-mix(in srgb, var(--gt-task-warning) 70%, black)',
        'task.text': 'var(--gt-task-muted-text)',
      }),
    }),
  ]);
