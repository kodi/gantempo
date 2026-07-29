export type ScenarioTheme = 'dark' | 'high-contrast' | 'light';
export type ScenarioDensity = 'comfortable' | 'compact';
export type ScenarioTaskTone = 'accent' | 'neutral' | 'success' | 'warning';

export interface ScenarioTask {
  id: string;
  label: string;
  start: number;
  width: number;
  tone: ScenarioTaskTone;
}

export interface ScenarioLane {
  id: string;
  label: string;
  tasks: readonly ScenarioTask[];
}

export interface PlaygroundScenario {
  id: string;
  title: string;
  description: string;
  theme: ScenarioTheme;
  density: ScenarioDensity;
  lanes: readonly ScenarioLane[];
}

export const mainScenario: PlaygroundScenario = {
  id: 'main-project',
  title: 'Website launch plan',
  description: 'The primary project view used for everyday development.',
  theme: 'light',
  density: 'comfortable',
  lanes: [
    {
      id: 'discovery',
      label: 'Discovery',
      tasks: [
        {
          id: 'requirements',
          label: 'Requirements',
          start: 4,
          width: 23,
          tone: 'accent',
        },
      ],
    },
    {
      id: 'design',
      label: 'Design',
      tasks: [
        { id: 'wireframes', label: 'Wireframes', start: 20, width: 24, tone: 'success' },
        { id: 'review', label: 'Review', start: 47, width: 13, tone: 'neutral' },
      ],
    },
    {
      id: 'delivery',
      label: 'Delivery',
      tasks: [{ id: 'build', label: 'Implementation', start: 40, width: 36, tone: 'accent' }],
    },
    {
      id: 'release',
      label: 'Release',
      tasks: [
        { id: 'qa', label: 'QA', start: 72, width: 17, tone: 'warning' },
        { id: 'launch', label: 'Launch', start: 91, width: 6, tone: 'success' },
      ],
    },
  ],
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
    id: 'resource-overlap',
    title: 'Resource overlap',
    description: 'Multiple assignments sharing the same lane.',
    theme: 'light',
    density: 'comfortable',
    lanes: [
      {
        id: 'alex',
        label: 'Alex Morgan',
        tasks: [
          { id: 'alex-a', label: 'Research', start: 8, width: 34, tone: 'accent' },
          { id: 'alex-b', label: 'Review', start: 49, width: 24, tone: 'warning' },
        ],
      },
      {
        id: 'sam',
        label: 'Sam Rivera',
        tasks: [{ id: 'sam-a', label: 'Prototype', start: 27, width: 44, tone: 'success' }],
      },
      {
        id: 'taylor',
        label: 'Taylor Kim',
        tasks: [{ id: 'taylor-a', label: 'Handoff', start: 68, width: 25, tone: 'neutral' }],
      },
    ],
  },
  {
    id: 'empty-state',
    title: 'Empty state',
    description: 'A high-contrast project before work is scheduled.',
    theme: 'high-contrast',
    density: 'comfortable',
    lanes: [],
  },
];
