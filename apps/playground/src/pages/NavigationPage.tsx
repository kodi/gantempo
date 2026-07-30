import { useState, type ReactElement } from 'react';

import { ScenarioGantt } from '../ScenarioGantt';
import {
  NAVIGATION_EVENT_COUNT,
  NAVIGATION_INITIAL_RANGE,
  NAVIGATION_LANE_COUNT,
  NAVIGATION_PERIOD_END,
  NAVIGATION_PERIOD_START,
  navigationScenario,
} from '../scenarios';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

function formatRange(range: { readonly end: number; readonly start: number }): string {
  return `${dateFormatter.format(range.start)} – ${dateFormatter.format(range.end)}`;
}

export function NavigationPage(): ReactElement {
  const [visibleRange, setVisibleRange] = useState(NAVIGATION_INITIAL_RANGE);

  return (
    <div className="page page--navigation">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Two-axis stress consumer</p>
          <h1>Navigation</h1>
          <p>
            A deterministic, network-free portfolio proves controlled semantic time panning and
            virtualized lane navigation against a realistic long-range surface.
          </p>
        </div>
        <div className="page-intro__meta">
          <span>{NAVIGATION_EVENT_COUNT} events</span>
          <span>{NAVIGATION_LANE_COUNT} lanes</span>
          <span>12-week viewport</span>
        </div>
      </header>

      <section aria-label="Navigation fixture summary" className="navigation-summary">
        <div>
          <span>Covered period</span>
          <strong>
            {formatRange({ start: NAVIGATION_PERIOD_START, end: NAVIGATION_PERIOD_END })}
          </strong>
        </div>
        <div>
          <span>Current visible range</span>
          <strong data-testid="navigation-visible-range">{formatRange(visibleRange)}</strong>
        </div>
        <p>
          Pan time with a horizontal wheel or trackpad gesture, Shift plus a vertical wheel, a
          primary drag on the header, or a middle drag on the timeline. Use PageUp/PageDown for
          lanes and Alt+PageUp/Alt+PageDown for time. Browser zoom modifiers pass through.
        </p>
      </section>

      <ScenarioGantt
        editable
        onRangeChange={setVisibleRange}
        scenario={navigationScenario}
        size="navigation"
      />

      <p className="page-note">
        The required range stays controlled by this consumer. Each accepted navigation proposal is
        acknowledged into local React state; document commands and history remain separate.
      </p>
    </div>
  );
}
