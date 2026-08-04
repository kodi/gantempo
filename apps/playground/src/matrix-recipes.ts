export const MATRIX_RECIPE_SOURCES = Object.freeze({
  compactProject: `import { Gantt } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

const WEEK = 7 * 24 * 60 * 60 * 1000;

<Gantt
  defaultDocument={document}
  defaultRange={range}
  density="compact"
  label="Flat project view chart"
  tickAnchor={range.start}
  tickInterval={WEEK}
  timeZone="Europe/Belgrade"
  view={{ kind: 'project' }}
/>
`,
  customPhase: `import { Gantt, type GanttViewDefinition } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

const phaseView: GanttViewDefinition = {
  id: 'delivery-phases',
  kind: 'custom',
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

<Gantt
  defaultDocument={document}
  defaultRange={range}
  label="Custom phase grouping chart"
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  theme="dark"
  view={phaseView}
/>
`,
  resourceOverlap: `import { defineGanttTheme, Gantt } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

const resourceTheme = defineGanttTheme({
  id: 'resource-planning',
  mode: 'light',
  tokens: {
    'color.accent': '#27806a',
    'variant.neutral': '#dde3e4',
    'variant.success': '#bfe6c4',
    'variant.warning': '#f0d7a5',
  },
});

<Gantt
  defaultDocument={document}
  defaultRange={range}
  label="Resource overlap chart"
  taskVariants={{
    'alex-a': 'accent',
    'alex-b': 'warning',
    'sam-a': 'success',
    'taylor-a': 'neutral',
  }}
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  theme={resourceTheme}
  view={{ kind: 'resource' }}
/>
`,
  explicitSegments: `import { Gantt, type GanttViewDefinition } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

const segmentView: GanttViewDefinition = {
  id: 'segment-proof',
  kind: 'custom',
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
    { key: 'review', laneKey: 'campaign', taskId: 'campaign-review' },
  ],
};

<Gantt
  defaultDocument={document}
  defaultRange={range}
  label="Explicit segments chart"
  taskVariants={{ campaign: 'accent', 'campaign-review': 'warning' }}
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  theme="high-contrast"
  view={segmentView}
/>
`,
  emptyState: `import { Gantt } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

<Gantt
  defaultDocument={document}
  defaultRange={range}
  label="Empty state chart"
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  theme="high-contrast"
  view={{ kind: 'project' }}
/>
`,
});
