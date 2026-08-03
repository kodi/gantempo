import { Gantt, type GanttDocumentChange } from '@gantempo/gantt';
import { useState, type ReactElement } from 'react';

import {
  chartFrameActionsClasses,
  chartFrameBaseClasses,
  chartFrameElevatedClasses,
  chartFrameThemeClasses,
  chartFrameToolbarClasses,
  narrowTimeHeaderClasses,
} from './chart-frame';
import type { PlaygroundScenario, ScenarioTheme } from './scenarios';

type ScenarioSize = ScenarioGanttProps['size'];

const frameSizeClasses: Readonly<Record<ScenarioSize, string>> = Object.freeze({
  main: chartFrameElevatedClasses,
  matrix: 'rounded-[11px] shadow-none',
  navigation: chartFrameElevatedClasses,
});

const toolbarSizeClasses: Readonly<Record<ScenarioSize, string>> = Object.freeze({
  main: 'min-h-[76px]',
  matrix: 'min-h-[55px] px-3.5',
  navigation: 'min-h-[70px]',
});

interface ScenarioGanttProps {
  readonly editable?: boolean;
  readonly scenario: PlaygroundScenario;
  readonly size: 'main' | 'matrix' | 'navigation';
  readonly theme?: ScenarioTheme;
  readonly onRangeChange?: (range: PlaygroundScenario['range']) => void;
}

function formatRange(range: PlaygroundScenario['range'], timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    timeZone,
  });

  return `${formatter.format(range.start)} – ${formatter.format(range.end)}`;
}

export function ScenarioGantt({
  editable = false,
  onRangeChange,
  scenario,
  size,
  theme,
}: ScenarioGanttProps): ReactElement {
  const [document, setDocument] = useState(scenario.document);
  const [range, setRange] = useState(scenario.range);
  const chromeTheme = theme ?? scenario.theme;
  const classes = `${chartFrameBaseClasses} ${chartFrameThemeClasses[chromeTheme]} ${frameSizeClasses[size]}`;

  return (
    <div
      className={classes}
      data-scenario-size={size}
      data-theme={chromeTheme}
      data-visible-range-end={range.end}
      data-visible-range-start={range.start}
    >
      <div className={`${chartFrameToolbarClasses} ${toolbarSizeClasses[size]}`}>
        <div>
          <strong>{scenario.title}</strong>
          <span>{formatRange(range, scenario.timeZone)}</span>
        </div>
        <div aria-label="Playground view options" className={chartFrameActionsClasses}>
          <button disabled title="Today jump is not implemented yet" type="button">
            Today
          </button>
          <button
            aria-label="··· More options (not implemented)"
            disabled
            title="View options are not implemented yet"
            type="button"
          >
            ···
          </button>
        </div>
      </div>

      <Gantt
        className={narrowTimeHeaderClasses}
        {...(size === 'matrix'
          ? {
              classNames: {
                laneHeader: 'px-[9px]! text-[9px]!',
                taskContent: 'text-[8px]!',
              },
            }
          : {})}
        density={scenario.density}
        document={document}
        {...(size === 'main' ? { features: { properties: true } } : {})}
        label={`${scenario.title} chart`}
        appearanceVariants={scenario.appearanceVariants}
        {...(editable
          ? {
              onDocumentChange: (change: GanttDocumentChange) => setDocument(change.document),
            }
          : {})}
        onRangeChange={(nextRange) => {
          setRange(nextRange);
          onRangeChange?.(nextRange);
        }}
        range={range}
        taskVariants={scenario.taskVariants}
        theme={theme ?? scenario.themeDefinition ?? scenario.theme}
        tickAnchor={scenario.tickAnchor}
        tickInterval={scenario.tickInterval}
        timeZone={scenario.timeZone}
        {...(scenario.view === undefined ? {} : { view: scenario.view })}
      />
    </div>
  );
}
