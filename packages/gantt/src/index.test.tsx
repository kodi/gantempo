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
  type ParseDocumentResult,
  type ResourceRecord,
  type TaskRecord,
  type TaskSegment,
  parseGanttDocument,
  serializeGanttDocument,
  useGanttSelector,
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
  it('fails clearly when a selector is rendered outside its owning chart', () => {
    function OutsideSelector() {
      useGanttSelector((snapshot) => snapshot.canUndo);
      return null;
    }

    expect(() => renderToStaticMarkup(<OutsideSelector />)).toThrow(
      'runtime.selector-outside-provider',
    );
  });

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
    expect(markup).toContain('role="treegrid"');
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

    expect(markup).toContain('role="treegrid"');
    expect(markup).toContain('aria-label="Release plan"');
    expect(markup).toContain('data-lane-id="lane-design"');
    expect(markup).toContain('data-task-id="task-review"');
    expect(markup).toContain('data-placement-id="placement-review"');
    expect(markup).toContain('data-view-key="gt:v1:');
    expect(markup).toContain('data-clipped-start="true"');
    expect(markup).toContain('<svg role="presentation">');
    expect(markup).toContain('role="button"');
    expect(markup).toContain('aria-hidden="true" data-gt-part="grid"');
    expect(markup).toContain('Review, Jul 28, 2026, 12:00 AM to Jul 31, 2026, 12:00 AM');
    expect(markup).toContain('<foreignObject');
    expect(markup).toContain('class="gt-gantt__task-label"');
  });

  it('renders semantic appearance and progress deterministically during SSR', () => {
    const markup = renderToStaticMarkup(
      <Gantt
        appearanceVariants={[
          {
            id: 'delivery',
            label: 'Delivery',
            tokens: {
              'lane.accent': '#0f766e',
              'task.fill': '#14b8a6',
              'task.progressFill': '#115e59',
              'task.text': '#042f2e',
            },
          },
        ]}
        document={{
          ...EMPTY_COLLECTIONS,
          lanes: [{ appearance: { variant: 'delivery' }, id: 'lane-a', title: 'Lane A' }],
          placements: [{ id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' }],
          schemaVersion: 1,
          tasks: [
            {
              id: 'task-a',
              kind: 'task',
              progress: 0.25,
              schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
              segments: [],
              title: 'Task A',
            },
          ],
        }}
        range={{ end: START + 7 * DAY, start: START }}
        tickAnchor={START}
        tickInterval={DAY}
        timeZone="UTC"
      />,
    );

    expect(markup).toContain('data-gt-part="lane-accent"');
    expect(markup).toContain('data-gt-part="task-track"');
    expect(markup).toContain('data-gt-part="task-progress"');
    expect(markup).toContain('data-gt-variant="delivery"');
    expect(markup).toContain('--gt-task-fill:#14b8a6');
    expect(markup).toContain('25% complete');
    expect(markup).not.toContain('role="progressbar"');
  });

  it('renders customized columns and content deterministically with overlays closed during SSR', () => {
    const markup = renderToStaticMarkup(
      <Gantt
        columns={[
          { header: 'Phase', id: 'phase', width: 140 },
          {
            header: 'Code',
            id: 'code',
            renderCell: ({ lane }) => lane.target.laneId,
            width: 80,
          },
        ]}
        document={{
          ...EMPTY_COLLECTIONS,
          lanes: [{ id: 'lane-a', title: 'Lane A' }],
          placements: [{ id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' }],
          schemaVersion: 1,
          tasks: [
            {
              id: 'task-a',
              kind: 'task',
              schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
              segments: [],
              title: 'Task A',
            },
          ],
        }}
        features={{ contextMenu: true, editor: true, tooltip: true }}
        overlayContainer="root"
        range={{ end: START + 7 * DAY, start: START }}
        slots={{ TaskContent: ({ task }) => <span>Custom {task.title}</span> }}
        tickAnchor={START}
        tickInterval={DAY}
        timeZone="UTC"
      />,
    );

    expect(markup).toContain('aria-colcount="3"');
    expect(markup).toContain('grid-template-columns:140px 80px');
    expect(markup).toContain('Custom Task A');
    expect(markup).not.toContain('role="tooltip"');
    expect(markup).not.toContain('role="menu"');
    expect(markup).not.toContain('role="dialog"');
    expect(markup).toContain('data-gt-overlay-boundary="root"');
  });

  it('renders derived resource and explicit segment provenance through the public view prop', () => {
    const document: GanttDocument = {
      schemaVersion: 1,
      resources: [{ id: 'resource-a', title: 'Ada' }],
      assignments: [{ id: 'assignment-a', taskId: 'task-a', resourceId: 'resource-a' }],
      lanes: [],
      placements: [],
      dependencies: [],
      tasks: [
        {
          id: 'task-a',
          kind: 'task',
          title: 'Task A',
          schedule: { mode: 'instant', start: START, end: START + 3 * DAY },
          segments: [
            {
              id: 'segment-a',
              schedule: { mode: 'instant', start: START + DAY, end: START + 2 * DAY },
            },
          ],
        },
      ],
    };
    const resourceMarkup = renderToStaticMarkup(
      <Gantt
        document={document}
        range={{ start: START, end: START + 7 * DAY }}
        tickAnchor={START}
        tickInterval={DAY}
        timeZone="UTC"
        view={{ kind: 'resource' }}
      />,
    );
    const segmentMarkup = renderToStaticMarkup(
      <Gantt
        document={document}
        range={{ start: START, end: START + 7 * DAY }}
        tickAnchor={START}
        tickInterval={DAY}
        timeZone="UTC"
        view={{
          kind: 'custom',
          id: 'segment-view',
          lanes: [{ key: 'lane', title: 'Segment lane', minimumHeight: 90 }],
          placements: [
            {
              key: 'segment',
              laneKey: 'lane',
              taskId: 'task-a',
              segmentId: 'segment-a',
            },
          ],
        }}
      />,
    );

    expect(resourceMarkup).toContain('data-resource-id="resource-a"');
    expect(resourceMarkup).toContain('data-assignment-id="assignment-a"');
    expect(resourceMarkup).not.toContain('data-placement-id=');
    expect(segmentMarkup).toContain('data-segment-id="segment-a"');
    expect(segmentMarkup).toContain('--gt-lane-height-ratio:1.5517241379310345');
    expect(segmentMarkup).toContain('Task A, Jul 30, 2026, 12:00 AM to Jul 31, 2026, 12:00 AM');
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

  it('exports the intentional document codec without model internals', () => {
    const parsed: ParseDocumentResult = parseGanttDocument({
      schemaVersion: 1,
      tasks: [{ id: 1, title: 'Public boundary' }],
    });

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.document?.tasks[0]).toMatchObject({
      id: '1',
      kind: 'task',
      segments: [],
      title: 'Public boundary',
    });
    expect(serializeGanttDocument(parsed.document!)).toBe(
      '{"schemaVersion":1,"tasks":[{"id":"1","title":"Public boundary","kind":"task","segments":[]}],"resources":[],"lanes":[],"assignments":[],"placements":[],"dependencies":[]}',
    );
  });
});
