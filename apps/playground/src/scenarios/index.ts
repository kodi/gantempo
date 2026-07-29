import type { EntityId, GanttDocument, TimeRange } from '@gantempo/gantt';

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

const mainDocument: GanttDocument = {
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
      title: 'Requirements',
      schedule: { mode: 'instant', start: Date.UTC(2026, 6, 30), end: Date.UTC(2026, 7, 6) },
    },
    {
      id: 'wireframes',
      title: 'Wireframes',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 4), end: Date.UTC(2026, 7, 11) },
    },
    {
      id: 'review',
      title: 'Review',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 12), end: Date.UTC(2026, 7, 16) },
    },
    {
      id: 'build',
      title: 'Implementation',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 9), end: Date.UTC(2026, 7, 20) },
    },
    {
      id: 'qa',
      title: 'QA',
      schedule: { mode: 'instant', start: Date.UTC(2026, 7, 19), end: Date.UTC(2026, 7, 24) },
    },
    {
      id: 'launch',
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

export const mainScenario: PlaygroundScenario = {
  ...TIME_AXIS,
  id: 'main-project',
  title: 'Website launch plan',
  description: 'The primary project view used for everyday development.',
  theme: 'light',
  density: 'comfortable',
  document: mainDocument,
  taskVariants: mainTaskVariants,
};

export const matrixScenarios: readonly PlaygroundScenario[] = [
  {
    ...mainScenario,
    id: 'compact-project',
    title: 'Compact project',
    description: 'The main data at a tighter row density.',
    density: 'compact',
  },
  {
    ...mainScenario,
    id: 'dark-project',
    title: 'Dark theme',
    description: 'The primary project with dark surface tokens.',
    theme: 'dark',
  },
  {
    ...TIME_AXIS,
    id: 'resource-overlap',
    title: 'Resource overlap',
    description: 'Multiple scheduled tasks sharing the same lane.',
    theme: 'light',
    density: 'comfortable',
    document: {
      schemaVersion: 1,
      lanes: [
        { id: 'alex', title: 'Alex Morgan' },
        { id: 'sam', title: 'Sam Rivera' },
        { id: 'taylor', title: 'Taylor Kim' },
      ],
      tasks: [
        {
          id: 'alex-a',
          title: 'Research',
          schedule: {
            mode: 'instant',
            start: Date.UTC(2026, 6, 31),
            end: Date.UTC(2026, 7, 10),
          },
        },
        {
          id: 'alex-b',
          title: 'Review',
          schedule: {
            mode: 'instant',
            start: Date.UTC(2026, 7, 13),
            end: Date.UTC(2026, 7, 20),
          },
        },
        {
          id: 'sam-a',
          title: 'Prototype',
          schedule: {
            mode: 'instant',
            start: Date.UTC(2026, 7, 6),
            end: Date.UTC(2026, 7, 19),
          },
        },
        {
          id: 'taylor-a',
          title: 'Handoff',
          schedule: {
            mode: 'instant',
            start: Date.UTC(2026, 7, 18),
            end: Date.UTC(2026, 7, 26),
          },
        },
      ],
      placements: [
        { id: 'place-alex-a', laneId: 'alex', taskId: 'alex-a' },
        { id: 'place-alex-b', laneId: 'alex', taskId: 'alex-b' },
        { id: 'place-sam-a', laneId: 'sam', taskId: 'sam-a' },
        { id: 'place-taylor-a', laneId: 'taylor', taskId: 'taylor-a' },
      ],
    },
    taskVariants: {
      'alex-a': 'accent',
      'alex-b': 'warning',
      'sam-a': 'success',
      'taylor-a': 'neutral',
    },
  },
  {
    ...TIME_AXIS,
    id: 'empty-state',
    title: 'Empty state',
    description: 'A high-contrast project before work is scheduled.',
    theme: 'high-contrast',
    density: 'comfortable',
    document: { schemaVersion: 1, lanes: [], tasks: [], placements: [] },
    taskVariants: {},
  },
];
