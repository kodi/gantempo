import { Gantt } from '@gantempo/gantt';
import type { CSSProperties, ReactElement } from 'react';

import type { PlaygroundScenario, ScenarioTask } from '../scenarios';

interface PlaceholderGanttProps {
  scenario: PlaygroundScenario;
  size: 'main' | 'matrix';
}

function taskStyle(task: ScenarioTask): CSSProperties {
  return {
    left: `${task.start}%`,
    width: `${task.width}%`,
  };
}

export function PlaceholderGantt({ scenario, size }: PlaceholderGanttProps): ReactElement {
  const classes = ['placeholder', `placeholder--${size}`, `placeholder--${scenario.density}`].join(
    ' ',
  );

  return (
    <div className={classes} data-theme={scenario.theme}>
      <Gantt className="placeholder__region" label={`${scenario.title} preview`}>
        <div className="placeholder__toolbar">
          <div>
            <strong>{scenario.title}</strong>
            <span>Jul 29 – Aug 25</span>
          </div>
          <div aria-label="Placeholder view options" className="placeholder__actions">
            <button type="button">Today</button>
            <button aria-label="More options" type="button">
              ···
            </button>
          </div>
        </div>

        <div className="placeholder__table">
          <div className="placeholder__corner">Work item</div>
          <div className="placeholder__timeline-header">
            <span>Jul 29</span>
            <span>Aug 05</span>
            <span>Aug 12</span>
            <span>Aug 19</span>
          </div>

          {scenario.lanes.length === 0 ? (
            <div className="placeholder__empty">
              <strong>No scheduled work</strong>
              <span>Add a task to begin planning.</span>
            </div>
          ) : (
            scenario.lanes.map((lane) => (
              <div className="placeholder__row" key={lane.id}>
                <div className="placeholder__lane">
                  <span aria-hidden="true" className="placeholder__disclosure">
                    {lane.tasks.length > 1 ? '⌄' : '·'}
                  </span>
                  <span>{lane.label}</span>
                </div>
                <div className="placeholder__track">
                  <span aria-hidden="true" className="placeholder__today" />
                  {lane.tasks.map((task) => (
                    <div
                      className="placeholder__task"
                      data-tone={task.tone}
                      key={task.id}
                      style={taskStyle(task)}
                      title={task.label}
                    >
                      <span>{task.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Gantt>
    </div>
  );
}
