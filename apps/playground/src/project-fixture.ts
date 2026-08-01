import type { GanttAppearanceVariantOption, GanttDocument, TimeRange } from '@gantempo/gantt';

const DAY = 24 * 60 * 60 * 1_000;
export const PROJECT_RANGE: TimeRange = Object.freeze({
  end: Date.UTC(2026, 9, 1),
  start: Date.UTC(2026, 6, 1),
});

export const PROJECT_APPEARANCE_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'planning',
    label: 'Planning',
    tokens: Object.freeze({
      'lane.accent': '#7c3aed',
      'task.fill': '#8b5cf6',
      'task.progressFill': '#5b21b6',
      'task.text': '#ffffff',
    }),
  }),
  Object.freeze({
    id: 'delivery',
    label: 'Delivery',
    tokens: Object.freeze({
      'lane.accent': '#0f766e',
      'task.fill': '#14b8a6',
      'task.progressFill': '#115e59',
      'task.text': '#042f2e',
    }),
  }),
  Object.freeze({
    id: 'risk',
    label: 'At risk',
    tokens: Object.freeze({
      'lane.accent': '#b45309',
      'task.fill': '#f59e0b',
      'task.progressFill': '#92400e',
      'task.text': '#111827',
    }),
  }),
]) satisfies readonly GanttAppearanceVariantOption[];

export function createProjectDocument(includeCycle = false): GanttDocument {
  return Object.freeze({
    assignments: Object.freeze([]),
    dependencies: Object.freeze([
      Object.freeze({
        fromTaskId: 'research',
        id: 'research-scope',
        toTaskId: 'scope-approved',
        type: 'finish-to-start' as const,
      }),
      Object.freeze({
        fromTaskId: 'api',
        id: 'api-ui',
        toTaskId: 'ui',
        type: 'start-to-start' as const,
      }),
      Object.freeze({
        fromTaskId: 'api',
        id: 'api-qa',
        lag: Object.freeze({ mode: 'elapsed' as const, unit: 'day' as const, value: 2 }),
        toTaskId: 'qa',
        type: 'finish-to-finish' as const,
      }),
      Object.freeze({
        fromTaskId: 'ui',
        id: 'ui-release',
        toTaskId: 'release',
        type: 'start-to-finish' as const,
      }),
      ...(includeCycle
        ? [
            Object.freeze({
              fromTaskId: 'release',
              id: 'release-api-cycle',
              toTaskId: 'api',
              type: 'finish-to-start' as const,
            }),
          ]
        : []),
    ]),
    lanes: Object.freeze([]),
    placements: Object.freeze([]),
    resources: Object.freeze([]),
    schemaVersion: 1,
    tasks: Object.freeze([
      Object.freeze({
        appearance: Object.freeze({ variant: 'planning' }),
        id: 'project',
        kind: 'summary' as const,
        order: 0,
        progress: 0.42,
        segments: Object.freeze([]),
        title: 'Community launch',
      }),
      Object.freeze({
        id: 'discovery',
        kind: 'summary' as const,
        order: 0,
        parentId: 'project',
        segments: Object.freeze([]),
        title: 'Discovery',
      }),
      Object.freeze({
        id: 'research',
        kind: 'task' as const,
        order: 0,
        parentId: 'discovery',
        progress: 1,
        schedule: Object.freeze({
          endDate: '2026-07-15',
          mode: 'all-day' as const,
          startDate: '2026-07-03',
        }),
        segments: Object.freeze([]),
        title: 'Research and framing',
      }),
      Object.freeze({
        id: 'scope-approved',
        kind: 'milestone' as const,
        order: 1,
        parentId: 'discovery',
        schedule: Object.freeze({
          end: Date.UTC(2026, 6, 18, 12),
          mode: 'instant' as const,
          start: Date.UTC(2026, 6, 18, 12),
        }),
        segments: Object.freeze([]),
        title: 'Scope approved',
      }),
      Object.freeze({
        id: 'empty-track',
        kind: 'summary' as const,
        order: 1,
        parentId: 'project',
        segments: Object.freeze([]),
        title: 'Reserved follow-up',
      }),
      Object.freeze({
        appearance: Object.freeze({ variant: 'delivery' }),
        id: 'delivery',
        kind: 'summary' as const,
        order: 2,
        parentId: 'project',
        segments: Object.freeze([]),
        title: 'Delivery',
      }),
      Object.freeze({
        id: 'build',
        kind: 'summary' as const,
        order: 0,
        parentId: 'delivery',
        segments: Object.freeze([]),
        title: 'Build',
      }),
      Object.freeze({
        id: 'api',
        kind: 'task' as const,
        order: 0,
        parentId: 'build',
        progress: 0.6,
        schedule: Object.freeze({
          end: PROJECT_RANGE.start + 58 * DAY,
          mode: 'instant' as const,
          start: PROJECT_RANGE.start + 27 * DAY,
        }),
        segments: Object.freeze([]),
        title: 'Public API',
      }),
      Object.freeze({
        id: 'ui',
        kind: 'task' as const,
        order: 1,
        parentId: 'build',
        progress: 0.45,
        schedule: Object.freeze({
          end: PROJECT_RANGE.start + 66 * DAY,
          mode: 'instant' as const,
          start: PROJECT_RANGE.start + 34 * DAY,
        }),
        segments: Object.freeze([]),
        title: 'Project UI',
      }),
      Object.freeze({
        appearance: Object.freeze({ variant: 'risk' }),
        id: 'qa',
        kind: 'task' as const,
        order: 1,
        parentId: 'delivery',
        progress: 0.2,
        schedule: Object.freeze({
          end: PROJECT_RANGE.start + 75 * DAY,
          mode: 'instant' as const,
          start: PROJECT_RANGE.start + 57 * DAY,
        }),
        segments: Object.freeze([]),
        title: 'Verification',
      }),
      Object.freeze({
        id: 'release',
        kind: 'milestone' as const,
        order: 2,
        parentId: 'delivery',
        schedule: Object.freeze({
          endDate: '2026-09-22',
          mode: 'all-day' as const,
          startDate: '2026-09-22',
        }),
        segments: Object.freeze([]),
        title: 'Community release',
      }),
      Object.freeze({
        id: 'post-launch',
        kind: 'task' as const,
        order: 3,
        parentId: 'delivery',
        segments: Object.freeze([]),
        title: 'Unscheduled follow-up',
      }),
    ]),
  });
}
