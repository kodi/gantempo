import type { ReactElement } from 'react';

import { ScenarioGantt } from '../ScenarioGantt';
import { matrixScenarios } from '../scenarios';

export function MatrixPage(): ReactElement {
  return (
    <div className="page">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Visual comparison</p>
          <h1>Scenario matrix</h1>
          <p>Simple side-by-side coverage for options, content density, and themes.</p>
        </div>
        <div className="scenario-count">{matrixScenarios.length} scenarios</div>
      </header>

      <div className="scenario-matrix">
        {matrixScenarios.map((scenario) => (
          <article className="scenario-card" key={scenario.id}>
            <header className="scenario-card__header">
              <div>
                <h2>{scenario.title}</h2>
                <p>{scenario.description}</p>
              </div>
              <span>{scenario.theme}</span>
            </header>
            <ScenarioGantt scenario={scenario} size="matrix" />
          </article>
        ))}
      </div>
    </div>
  );
}
