import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';

import { Gantt, type GanttDocument, type GanttViewDefinition } from './index';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

const document: GanttDocument = {
  schemaVersion: 1,
  tasks: [
    {
      id: 'task',
      title: 'Task',
      kind: 'task',
      schedule: { mode: 'instant', start: START, end: START + 2 * DAY },
      segments: [
        {
          id: 'segment',
          schedule: { mode: 'instant', start: START + DAY, end: START + 2 * DAY },
        },
      ],
    },
  ],
  resources: [{ id: 'resource', title: 'Resource' }],
  lanes: [{ id: 'lane', title: 'Lane' }],
  assignments: [{ id: 'assignment', taskId: 'task', resourceId: 'resource' }],
  placements: [{ id: 'placement', taskId: 'task', laneId: 'lane' }],
  dependencies: [],
};

function render(view?: GanttViewDefinition): string {
  return renderToStaticMarkup(
    <Gantt
      document={document}
      range={{ start: START, end: START + 3 * DAY }}
      tickAnchor={START}
      tickInterval={DAY}
      timeZone="UTC"
      {...(view === undefined ? {} : { view })}
    />,
  );
}

describe('public view-kernel facade', () => {
  it('keeps persisted document view as the default', () => {
    const markup = render();

    expect(markup).toContain('data-lane-id="lane"');
    expect(markup).toContain('data-placement-id="placement"');
  });

  it('selects a flat project view through the root package', () => {
    const markup = render({ kind: 'project' });

    expect(markup).toContain('title="Task"');
    expect(markup).toContain('data-task-id="task"');
    expect(markup).not.toContain('data-placement-id=');
  });

  it('selects assignment-derived resource provenance through the root package', () => {
    const markup = render({ kind: 'resource' });

    expect(markup).toContain('data-resource-id="resource"');
    expect(markup).toContain('data-assignment-id="assignment"');
  });

  it('selects custom segment-backed descriptors through the root package', () => {
    const markup = render({
      kind: 'custom',
      id: 'custom',
      lanes: [{ key: 'custom-lane', title: 'Custom lane' }],
      placements: [
        {
          key: 'custom-placement',
          laneKey: 'custom-lane',
          taskId: 'task',
          segmentId: 'segment',
        },
      ],
    });

    expect(markup).toContain('Custom lane');
    expect(markup).toContain('data-segment-id="segment"');
    expect(markup).toContain('Task, Jul 30, 2026, 12:00 AM to Jul 31, 2026, 12:00 AM');
  });
});
