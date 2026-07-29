import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';

import {
  Gantt,
  type AssignmentRecord,
  type DependencyRecord,
  type Diagnostic,
  type GanttDocument,
  type JsonValue,
  type LaneRecord,
  type PlacementRecord,
  type ResourceRecord,
  type TaskRecord,
  type TaskSegment,
} from './index';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 6, 29);
const EMPTY_COLLECTIONS = {
  assignments: [],
  dependencies: [],
  resources: [],
} as const;

function render(document: GanttDocument): string {
  return renderToStaticMarkup(
    <Gantt
      document={document}
      label="Release plan"
      range={{ start: START, end: START + 7 * DAY }}
      tickAnchor={START}
      tickInterval={DAY}
      timeZone="UTC"
    />,
  );
}

describe('Gantt', () => {
  it('uses the default accessible region label', () => {
    const markup = renderToStaticMarkup(
      <Gantt
        document={{
          ...EMPTY_COLLECTIONS,
          schemaVersion: 1,
          lanes: [],
          placements: [],
          tasks: [],
        }}
        range={{ start: START, end: START + 7 * DAY }}
        tickAnchor={START}
        tickInterval={DAY}
        timeZone="UTC"
      />,
    );

    expect(markup).toContain('aria-label="Gantt chart"');
    expect(markup).toContain('role="region"');
  });

  it('renders an accessible hybrid DOM and SVG chart with stable entity identity', () => {
    const markup = render({
      ...EMPTY_COLLECTIONS,
      schemaVersion: 1,
      lanes: [{ id: 'lane-design', title: 'Design lane with a long title' }],
      tasks: [
        {
          id: 'task-review',
          kind: 'task',
          segments: [],
          title: 'Review',
          schedule: { mode: 'instant', start: START - DAY, end: START + 2 * DAY },
        },
      ],
      placements: [{ id: 'placement-review', laneId: 'lane-design', taskId: 'task-review' }],
    });

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Release plan"');
    expect(markup).toContain('data-lane-id="lane-design"');
    expect(markup).toContain('data-task-id="task-review"');
    expect(markup).toContain('data-placement-id="placement-review"');
    expect(markup).toContain('data-clipped-start="true"');
    expect(markup).toContain('<svg aria-label="Scheduled tasks" role="group">');
    expect(markup).toContain('aria-hidden="true" data-gt-part="grid"');
    expect(markup).toContain('Review, Jul 28, 2026, 12:00 AM to Jul 31, 2026, 12:00 AM');
    expect(markup).toContain('<foreignObject');
    expect(markup).toContain('class="gt-gantt__task-label"');
  });

  it('renders a useful empty state without an unlabeled SVG', () => {
    const markup = render({
      ...EMPTY_COLLECTIONS,
      schemaVersion: 1,
      lanes: [],
      placements: [],
      tasks: [],
    });

    expect(markup).toContain('No scheduled work');
    expect(markup).toContain('Add a task to begin planning.');
    expect(markup).not.toContain('<svg');
  });

  it('preserves valid output while exposing diagnostic count', () => {
    const markup = render({
      ...EMPTY_COLLECTIONS,
      schemaVersion: 1,
      lanes: [{ id: 'lane-a', title: 'Lane A' }],
      tasks: [],
      placements: [{ id: 'placement-a', laneId: 'lane-a', taskId: 'missing' }],
    });

    expect(markup).toContain('data-diagnostic-count="1"');
    expect(markup).toContain('Lane A');
  });

  it('exports the complete normalized model and general diagnostic contracts', () => {
    const fields = { nested: ['value', 1, true, null] } satisfies JsonValue;
    const segment: TaskSegment = {
      id: 'segment-a',
      schedule: { mode: 'all-day', startDate: '2026-07-30', endDate: '2026-07-31' },
    };
    const task: TaskRecord = {
      fields,
      id: 'task-a',
      kind: 'task',
      segments: [segment],
      title: 'Task A',
    };
    const resource: ResourceRecord = { id: 'resource-a', title: 'Resource A' };
    const lane: LaneRecord = { id: 'lane-a', resourceId: resource.id, title: 'Lane A' };
    const assignment: AssignmentRecord = {
      id: 'assignment-a',
      resourceId: resource.id,
      taskId: task.id,
    };
    const placement: PlacementRecord = {
      assignmentId: assignment.id,
      id: 'placement-a',
      laneId: lane.id,
      segmentId: segment.id,
      taskId: task.id,
    };
    const dependency: DependencyRecord = {
      fromTaskId: task.id,
      id: 'dependency-a',
      toTaskId: task.id,
      type: 'finish-to-start',
    };
    const document: GanttDocument = {
      assignments: [assignment],
      dependencies: [dependency],
      lanes: [lane],
      placements: [placement],
      resources: [resource],
      schemaVersion: 1,
      tasks: [task],
    };
    const diagnostic: Diagnostic = {
      code: 'value.invalid-id',
      entityIds: [task.id],
      message: 'Invalid ID.',
      path: '/tasks/0/id',
      severity: 'error',
    };

    expect(document.tasks[0]?.segments[0]?.id).toBe('segment-a');
    expect(diagnostic).toMatchObject({ code: 'value.invalid-id', severity: 'error' });
  });
});
