export const MATRIX_RECIPE_SOURCES = Object.freeze({
  compactProject: `import { Gantt } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

const WEEK = 7 * 24 * 60 * 60 * 1000;

<Gantt
  className="compact-project-gantt"
  defaultDocument={document}
  defaultRange={range}
  label="Flat project view chart"
  tickAnchor={range.start}
  tickInterval={WEEK}
  timeZone="Europe/Belgrade"
  view={{ kind: 'project' }}
/>

/* styles.css */
.compact-project-gantt {
  --gt-header-height: 34px;
  --gt-row-height: 38px;
}`,
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
  className="dark-gantt"
  defaultDocument={document}
  defaultRange={range}
  label="Custom phase grouping chart"
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  view={phaseView}
/>

/* styles.css */
.dark-gantt {
  --gt-color-surface: #18211f;
  --gt-color-surface-muted: #18211f;
  --gt-color-border: #34423e;
  --gt-color-grid: #2a3733;
  --gt-color-text: #edf3f0;
  --gt-color-text-muted: #99a7a2;
  --gt-color-task: #79cdb5;
  --gt-color-task-text: #11251f;
}`,
  resourceOverlap: `import { Gantt } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

<Gantt
  className="resource-gantt"
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
  view={{ kind: 'resource' }}
/>

/* styles.css */
.resource-gantt {
  --gt-color-task: #27806a;
  --gt-task-neutral: #dde3e4;
  --gt-task-success: #bfe6c4;
  --gt-task-warning: #f0d7a5;
}`,
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
  className="high-contrast-gantt"
  defaultDocument={document}
  defaultRange={range}
  label="Explicit segments chart"
  taskVariants={{ campaign: 'accent', 'campaign-review': 'warning' }}
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  view={segmentView}
/>

/* styles.css */
.high-contrast-gantt {
  --gt-color-surface: #fff;
  --gt-color-border: #111;
  --gt-color-grid: #444;
  --gt-color-text: #000;
  --gt-color-text-muted: #111;
  --gt-color-task: #005fcc;
  --gt-color-task-text: #fff;
  border: 2px solid var(--gt-color-border);
}`,
  emptyState: `import { Gantt } from '@gantempo/gantt';
import '@gantempo/gantt/styles.css';

<Gantt
  className="empty-project-gantt"
  defaultDocument={document}
  defaultRange={range}
  label="Empty state chart"
  tickAnchor={range.start}
  tickInterval={7 * 24 * 60 * 60 * 1000}
  timeZone="Europe/Belgrade"
  view={{ kind: 'project' }}
/>

/* styles.css */
.empty-project-gantt {
  --gt-color-surface: #fff;
  --gt-color-border: #111;
  --gt-color-grid: #444;
  --gt-color-text: #000;
  --gt-color-text-muted: #111;
  --gt-color-empty: #111;
  border: 2px solid var(--gt-color-border);
}`,
});
