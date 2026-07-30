import type { EntityId, GanttDocument, GanttViewDefinition, TimeRange } from '@gantempo/gantt';

export type ScenarioTheme = 'dark' | 'high-contrast' | 'light';
export type ScenarioDensity = 'comfortable' | 'compact';
export type ScenarioTaskTone = 'accent' | 'neutral' | 'success' | 'warning';

export interface PlaygroundScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly theme: ScenarioTheme;
  readonly density: ScenarioDensity;
  readonly document: GanttDocument;
  readonly view?: GanttViewDefinition;
  readonly range: TimeRange;
  readonly tickAnchor: number;
  readonly tickInterval: number;
  readonly timeZone: string;
  readonly taskVariants: Readonly<Record<EntityId, ScenarioTaskTone>>;
}

const DAY = 24 * 60 * 60 * 1000;
const RANGE_START = Date.UTC(2026, 6, 29);
const RANGE_END = Date.UTC(2026, 7, 27);
const RANGE: TimeRange = Object.freeze({ start: RANGE_START, end: RANGE_END });
const TIME_AXIS = Object.freeze({
  range: RANGE,
  tickAnchor: RANGE_START,
  tickInterval: 7 * DAY,
  timeZone: 'Europe/Belgrade',
});
const EMPTY_RELATIONSHIPS = Object.freeze({
  assignments: Object.freeze([]),
  dependencies: Object.freeze([]),
  resources: Object.freeze([]),
});

const mainDocument: GanttDocument = {
  ...EMPTY_RELATIONSHIPS,
  schemaVersion: 1,
  lanes: [
    { id: 'discovery', title: 'Discovery' },
    { id: 'design', title: 'Design' },
    { id: 'delivery', title: 'Delivery' },
    { id: 'release', title: 'Release' },
  ],
  tasks: [
    {
      id: 'requirements',
      kind: 'task',
      segments: [],
      title: 'Requirements',
      schedule: { mode: 'instant', start: Date.UTC(2026, 6, 30), end: Date.UTC(2026, 7, 6) },
    },
    {
      id: 'wireframes',
      kind: 'task',
      segments: [],
      title: 'Wireframes',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 4), end: Date.UTC(2026, 7, 11) },
    },
    {
      id: 'review',
      kind: 'task',
      segments: [],
      title: 'Review',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 12), end: Date.UTC(2026, 7, 16) },
    },
    {
      id: 'build',
      kind: 'task',
      segments: [],
      title: 'Implementation',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 9), end: Date.UTC(2026, 7, 20) },
    },
    {
      id: 'qa',
      kind: 'task',
      segments: [],
      title: 'QA',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 19), end: Date.UTC(2026, 7, 24) },
    },
    {
      id: 'launch',
      kind: 'task',
      segments: [],
      title: 'Launch',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 25), end: Date.UTC(2026, 7, 28) },
    },
  ],
  placements: [
    { id: 'place-requirements', taskId: 'requirements', laneId: 'discovery' },
    { id: 'place-wireframes', taskId: 'wireframes', laneId: 'design' },
    { id: 'place-review', taskId: 'review', laneId: 'design' },
    { id: 'place-build', taskId: 'build', laneId: 'delivery' },
    { id: 'place-qa', taskId: 'qa', laneId: 'release' },
    { id: 'place-launch', taskId: 'launch', laneId: 'release' },
  ],
};

const mainTaskVariants: Readonly<Record<EntityId, ScenarioTaskTone>> = {
  requirements: 'accent',
  wireframes: 'success',
  review: 'neutral',
  build: 'accent',
  qa: 'warning',
  launch: 'success',
};

const customPhaseView: GanttViewDefinition = {
  kind: 'custom',
  id: 'delivery-phases',
  lanes: [
    { key: 'shape', title: 'Shape the work', minimumHeight: 68 },
    { key: 'ship', title: 'Ship the work', minimumHeight: 76 },
  ],
  placements: [
    { key: 'requirements', laneKey: 'shape', taskId: 'requirements' },
    { key: 'wireframes', laneKey: 'shape', taskId: 'wireframes' },
    { key: 'review', laneKey: 'shape', taskId: 'review' },
    { key: 'build', laneKey: 'ship', taskId: 'build' },
    { key: 'qa', laneKey: 'ship', taskId: 'qa' },
    { key: 'launch', laneKey: 'ship', taskId: 'launch' },
  ],
};

const resourceDocument: GanttDocument = {
  schemaVersion: 1,
  lanes: [],
  placements: [],
  dependencies: [],
  resources: [
    { id: 'alex', title: 'Alex Morgan' },
    { id: 'sam', title: 'Sam Rivera' },
    { id: 'taylor', title: 'Taylor Kim' },
  ],
  tasks: [
    {
      id: 'alex-a',
      kind: 'task',
      segments: [],
      title: 'Research',
      schedule: {
        mode: 'instant',
        start: Date.UTC(2026, 6, 31),
        end: Date.UTC(2026, 7, 10),
      },
    },
    {
      id: 'alex-b',
      kind: 'task',
      segments: [],
      title: 'Review',
      schedule: {
        mode: 'instant',
        start: Date.UTC(2026, 7, 5),
        end: Date.UTC(2026, 7, 20),
      },
    },
    {
      id: 'sam-a',
      kind: 'task',
      segments: [],
      title: 'Prototype',
      schedule: {
        mode: 'instant',
        start: Date.UTC(2026, 7, 6),
        end: Date.UTC(2026, 7, 19),
      },
    },
    {
      id: 'taylor-a',
      kind: 'task',
      segments: [],
      title: 'Handoff',
      schedule: {
        mode: 'instant',
        start: Date.UTC(2026, 7, 18),
        end: Date.UTC(2026, 7, 26),
      },
    },
  ],
  assignments: [
    { id: 'assign-alex-a', taskId: 'alex-a', resourceId: 'alex' },
    { id: 'assign-alex-b', taskId: 'alex-b', resourceId: 'alex' },
    { id: 'assign-sam-a', taskId: 'sam-a', resourceId: 'sam' },
    { id: 'assign-taylor-a', taskId: 'taylor-a', resourceId: 'taylor' },
  ],
};

const segmentDocument: GanttDocument = {
  ...EMPTY_RELATIONSHIPS,
  schemaVersion: 1,
  lanes: [],
  placements: [],
  tasks: [
    {
      id: 'campaign',
      kind: 'task',
      title: 'Campaign',
      schedule: {
        mode: 'instant',
        start: Date.UTC(2026, 7, 1),
        end: Date.UTC(2026, 7, 21),
      },
      segments: [
        {
          id: 'campaign-shape',
          schedule: {
            mode: 'instant',
            start: Date.UTC(2026, 7, 1),
            end: Date.UTC(2026, 7, 9),
          },
        },
        {
          id: 'campaign-ship',
          schedule: {
            mode: 'instant',
            start: Date.UTC(2026, 7, 13),
            end: Date.UTC(2026, 7, 21),
          },
        },
      ],
    },
    {
      id: 'campaign-review',
      kind: 'task',
      title: 'Cross-segment review',
      schedule: {
        mode: 'instant',
        start: Date.UTC(2026, 7, 6),
        end: Date.UTC(2026, 7, 16),
      },
      segments: [],
    },
  ],
};

const segmentView: GanttViewDefinition = {
  kind: 'custom',
  id: 'segment-proof',
  lanes: [
    { key: 'campaign', title: 'Campaign segments', minimumHeight: 96 },
    { key: 'reserved', title: 'Reserved space', minimumHeight: 64 },
  ],
  placements: [
    {
      key: 'shape',
      laneKey: 'campaign',
      taskId: 'campaign',
      segmentId: 'campaign-shape',
    },
    {
      key: 'ship',
      laneKey: 'campaign',
      taskId: 'campaign',
      segmentId: 'campaign-ship',
    },
    {
      key: 'review',
      laneKey: 'campaign',
      taskId: 'campaign-review',
    },
  ],
};

export const mainScenario: PlaygroundScenario = {
  ...TIME_AXIS,
  id: 'main-project',
  title: 'Website launch plan',
  description: 'Persisted lanes and placements in the default document view.',
  theme: 'light',
  density: 'comfortable',
  document: mainDocument,
  taskVariants: mainTaskVariants,
};

export const matrixScenarios: readonly PlaygroundScenario[] = [
  {
    ...mainScenario,
    id: 'compact-project',
    title: 'Flat project view',
    description: 'One task-backed lane per canonical task in compact density.',
    density: 'compact',
    view: { kind: 'project' },
  },
  {
    ...mainScenario,
    id: 'dark-custom',
    title: 'Custom phase grouping',
    description: 'Application-defined data-only lanes on dark theme tokens.',
    theme: 'dark',
    view: customPhaseView,
  },
  {
    ...TIME_AXIS,
    id: 'resource-overlap',
    title: 'Resource overlap',
    description: 'Assignment-derived resource lanes with genuine stacked overlap.',
    theme: 'light',
    density: 'comfortable',
    document: resourceDocument,
    view: { kind: 'resource' },
    taskVariants: {
      'alex-a': 'accent',
      'alex-b': 'warning',
      'sam-a': 'success',
      'taylor-a': 'neutral',
    },
  },
  {
    ...TIME_AXIS,
    id: 'segment-variable-height',
    title: 'Explicit segments',
    description: 'Segment-backed placements and variable minimum lane heights.',
    theme: 'high-contrast',
    density: 'comfortable',
    document: segmentDocument,
    view: segmentView,
    taskVariants: {
      campaign: 'accent',
      'campaign-review': 'warning',
    },
  },
  {
    ...TIME_AXIS,
    id: 'empty-state',
    title: 'Empty state',
    description: 'A high-contrast project before work is scheduled.',
    theme: 'high-contrast',
    density: 'comfortable',
    document: {
      ...EMPTY_RELATIONSHIPS,
      schemaVersion: 1,
      lanes: [],
      placements: [],
      tasks: [],
    },
    taskVariants: {},
  },
];

export const NAVIGATION_EVENT_COUNT = 144;
export const NAVIGATION_LANE_COUNT = 36;
export const NAVIGATION_PERIOD_START = Date.UTC(2025, 0, 1);
export const NAVIGATION_PERIOD_END = Date.UTC(2026, 6, 1);
export const NAVIGATION_INITIAL_RANGE: TimeRange = Object.freeze({
  start: Date.UTC(2025, 5, 1),
  end: Date.UTC(2025, 5, 1) + 12 * 7 * DAY,
});

const navigationLanes = Array.from({ length: NAVIGATION_LANE_COUNT }, (_, index) => ({
  id: `navigation-lane-${String(index + 1).padStart(2, '0')}`,
  title: `Portfolio lane ${String(index + 1).padStart(2, '0')}`,
}));

const navigationTasks = Array.from({ length: NAVIGATION_EVENT_COUNT }, (_, index) => {
  const distributedStart =
    NAVIGATION_PERIOD_START +
    Math.floor(
      (index * ((NAVIGATION_PERIOD_END - NAVIGATION_PERIOD_START) / DAY - 21)) /
        (NAVIGATION_EVENT_COUNT - 1),
    ) *
      DAY;
  const start =
    index === 40
      ? NAVIGATION_INITIAL_RANGE.start - 5 * DAY
      : index === 64
        ? NAVIGATION_INITIAL_RANGE.end - 5 * DAY
        : index === NAVIGATION_EVENT_COUNT - 1
          ? NAVIGATION_PERIOD_END - 14 * DAY
          : distributedStart;
  const end =
    index === NAVIGATION_EVENT_COUNT - 1
      ? NAVIGATION_PERIOD_END
      : start + (6 + (index % 5) * 2) * DAY;
  return {
    id: `navigation-task-${String(index + 1).padStart(3, '0')}`,
    kind: 'task' as const,
    schedule: { end, mode: 'instant' as const, start },
    segments: [],
    title: `Portfolio event ${String(index + 1).padStart(3, '0')}`,
  };
});

const navigationDocument: GanttDocument = {
  assignments: [],
  dependencies: [],
  lanes: navigationLanes,
  placements: navigationTasks.map((task, index) => ({
    id: `navigation-placement-${String(index + 1).padStart(3, '0')}`,
    laneId: navigationLanes[Math.floor(index / 4)]!.id,
    taskId: task.id,
  })),
  resources: [],
  schemaVersion: 1,
  tasks: navigationTasks,
};

export const navigationScenario: PlaygroundScenario = {
  density: 'comfortable',
  description:
    'Deterministic long-range navigation across scheduled work before, inside, and after the initial viewport.',
  document: navigationDocument,
  id: 'long-range-navigation',
  range: NAVIGATION_INITIAL_RANGE,
  taskVariants: Object.fromEntries(
    navigationTasks.map((task, index) => [
      task.id,
      (['accent', 'success', 'warning', 'neutral'] as const)[index % 4]!,
    ]),
  ),
  theme: 'light',
  tickAnchor: NAVIGATION_INITIAL_RANGE.start,
  tickInterval: 14 * DAY,
  timeZone: 'UTC',
  title: 'Long-range portfolio navigation',
};
