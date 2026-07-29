import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';

import { Gantt, type GanttDocument } from './index';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 6, 29);

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
        document={{ schemaVersion: 1, lanes: [], tasks: [], placements: [] }}
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
      schemaVersion: 1,
      lanes: [{ id: 'lane-design', title: 'Design lane with a long title' }],
      tasks: [
        {
          id: 'task-review',
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
    const markup = render({ schemaVersion: 1, lanes: [], tasks: [], placements: [] });

    expect(markup).toContain('No scheduled work');
    expect(markup).toContain('Add a task to begin planning.');
    expect(markup).not.toContain('<svg');
  });

  it('preserves valid output while exposing diagnostic count', () => {
    const markup = render({
      schemaVersion: 1,
      lanes: [{ id: 'lane-a', title: 'Lane A' }],
      tasks: [],
      placements: [{ id: 'placement-a', laneId: 'lane-a', taskId: 'missing' }],
    });

    expect(markup).toContain('data-diagnostic-count="1"');
    expect(markup).toContain('Lane A');
  });
});
