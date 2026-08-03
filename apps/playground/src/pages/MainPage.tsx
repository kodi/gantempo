import { useState, type ReactElement } from 'react';

import { ScenarioGantt } from '../ScenarioGantt';
import { mainScenario, type ScenarioTheme } from '../scenarios';

const THEMES = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'High contrast', value: 'high-contrast' },
] as const satisfies readonly { readonly label: string; readonly value: ScenarioTheme }[];

export function MainPage(): ReactElement {
  const [theme, setTheme] = useState<ScenarioTheme>(mainScenario.theme);

  return (
    <div className="mx-auto w-full max-w-[1480px] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[26px] flex items-end justify-between gap-8 max-[901px]:items-start max-[901px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            Daily development case
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            {mainScenario.title}
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            {mainScenario.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-[#69717e] max-[561px]:flex-wrap">
          <label className="flex items-center gap-[7px] rounded-lg border border-ink/10 bg-white/45 py-1 pr-[5px] pl-2.5">
            <span className="p-0">Theme</span>
            <select
              aria-label="Chart theme"
              className="min-h-[26px] cursor-pointer rounded-md border border-ink/15 bg-white py-0 pr-6 pl-2 font-[inherit] font-semibold text-[#435064] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/25"
              name="chart-theme"
              onChange={(event) => setTheme(event.currentTarget.value as ScenarioTheme)}
              value={theme}
            >
              {THEMES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            Density: {mainScenario.density}
          </span>
        </div>
      </header>

      <ScenarioGantt scenario={mainScenario} size="main" theme={theme} />

      <p className="mt-4 mr-0 mb-0 ml-0.5 text-xs text-[#626a76]">
        This is the stable, full-size surface for developing the primary Gantt workflow.
      </p>
    </div>
  );
}
