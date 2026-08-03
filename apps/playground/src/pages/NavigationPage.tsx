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
    <div className="page--navigation mx-auto w-full max-w-[1480px] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[26px] flex items-end justify-between gap-8 max-[900px]:items-start max-[900px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            Two-axis stress consumer
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            Navigation
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            A deterministic, network-free portfolio proves controlled semantic time panning and
            virtualized lane navigation against a realistic long-range surface.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-[#69717e] max-[561px]:flex-wrap">
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {NAVIGATION_EVENT_COUNT} events
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {NAVIGATION_LANE_COUNT} lanes
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            12-week viewport
          </span>
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

      <p className="mt-4 mr-0 mb-0 ml-0.5 text-xs text-[#626a76]">
        The required range stays controlled by this consumer. Each accepted navigation proposal is
        acknowledged into local React state; document commands and history remain separate.
      </p>
    </div>
  );
}
