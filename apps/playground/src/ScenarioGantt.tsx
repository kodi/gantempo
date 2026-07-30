import { Gantt } from '@gantempo/gantt';
import type { ReactElement } from 'react';

import type { PlaygroundScenario } from './scenarios';

interface ScenarioGanttProps {
  readonly scenario: PlaygroundScenario;
  readonly size: 'main' | 'matrix';
}

function formatRange(scenario: PlaygroundScenario): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    timeZone: scenario.timeZone,
  });

  return `${formatter.format(scenario.range.start)} – ${formatter.format(scenario.range.end)}`;
}

export function ScenarioGantt({ scenario, size }: ScenarioGanttProps): ReactElement {
  const classes = ['chart-frame', `chart-frame--${size}`, `chart-frame--${scenario.density}`].join(
    ' ',
  );

  return (
    <div className={classes} data-theme={scenario.theme}>
      <div className="chart-frame__toolbar">
        <div>
          <strong>{scenario.title}</strong>
          <span>{formatRange(scenario)}</span>
        </div>
        <div aria-label="Playground view options" className="chart-frame__actions">
          <button disabled title="Timeline navigation is not implemented yet" type="button">
            Today
          </button>
          <button
            aria-label="More options (not implemented)"
            disabled
            title="View options are not implemented yet"
            type="button"
          >
            ···
          </button>
        </div>
      </div>

      <Gantt
        className="chart-frame__chart"
        document={scenario.document}
        label={`${scenario.title} chart`}
        range={scenario.range}
        taskVariants={scenario.taskVariants}
        tickAnchor={scenario.tickAnchor}
        tickInterval={scenario.tickInterval}
        timeZone={scenario.timeZone}
        {...(scenario.view === undefined ? {} : { view: scenario.view })}
      />
    </div>
  );
}
