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
    <div className="page page--main">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Daily development case</p>
          <h1>{mainScenario.title}</h1>
          <p>{mainScenario.description}</p>
        </div>
        <div className="page-intro__meta">
          <label className="theme-selector">
            <span>Theme</span>
            <select
              aria-label="Chart theme"
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
          <span>Density: {mainScenario.density}</span>
        </div>
      </header>

      <ScenarioGantt scenario={mainScenario} size="main" theme={theme} />

      <p className="page-note">
        This is the stable, full-size surface for developing the primary Gantt workflow.
      </p>
    </div>
  );
}
