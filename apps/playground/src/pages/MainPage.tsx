import type { ReactElement } from 'react';

import { ScenarioGantt } from '../ScenarioGantt';
import { mainScenario } from '../scenarios';

export function MainPage(): ReactElement {
  return (
    <div className="page page--main">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Daily development case</p>
          <h1>{mainScenario.title}</h1>
          <p>{mainScenario.description}</p>
        </div>
        <div className="page-intro__meta">
          <span>Theme: {mainScenario.theme}</span>
          <span>Density: {mainScenario.density}</span>
        </div>
      </header>

      <ScenarioGantt scenario={mainScenario} size="main" />

      <p className="page-note">
        This is the stable, full-size surface for developing the primary Gantt workflow.
      </p>
    </div>
  );
}
