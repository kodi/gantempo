import { useState, type ReactElement } from 'react';

import { HighlightedCode } from '../HighlightedCode';
import { ScenarioGantt } from '../ScenarioGantt';
import { matrixScenarios, type MatrixScenario } from '../scenarios';

function MatrixScenarioCard({ scenario }: { readonly scenario: MatrixScenario }): ReactElement {
  const [codeVisible, setCodeVisible] = useState(false);
  const codeId = `matrix-source-${scenario.id}`;

  return (
    <article className="scenario-card">
      <header className="scenario-card__header">
        <div>
          <h2>{scenario.title}</h2>
          <p>{scenario.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-[#e9e7e1] px-[7px] py-[5px] text-[10px] font-bold text-[#687181]">
            {scenario.themeDefinition?.id ?? scenario.theme}
          </span>
          <button
            aria-controls={codeId}
            aria-expanded={codeVisible}
            className="min-h-8 rounded-lg border border-ink/15 bg-white/70 px-2.5 text-[10px] font-bold text-brand transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/25"
            onClick={() => setCodeVisible((visible) => !visible)}
            type="button"
          >
            {codeVisible ? 'Hide code' : 'Show code'}
          </button>
        </div>
      </header>
      <ScenarioGantt scenario={scenario} size="matrix" />
      <section
        aria-label={`${scenario.title} code`}
        className="mt-3 overflow-hidden rounded-xl border border-ink/15 bg-[#17211f]"
        hidden={!codeVisible}
        id={codeId}
      >
        <div className="flex min-h-9 items-center justify-between gap-4 bg-[#202c29] px-3.5 font-mono text-[10px] text-[#dfe9e4]">
          <span>GanttExample.tsx + styles.css</span>
          <span className="text-[#96aaa2]">document and range assumed</span>
        </div>
        <pre className="m-0 max-h-[520px] overflow-auto p-4 font-mono text-[10px] leading-[1.6] text-[#e8efec] [tab-size:2]">
          <HighlightedCode language="tsx" source={scenario.source} />
        </pre>
      </section>
    </article>
  );
}

export function MatrixPage(): ReactElement {
  return (
    <div className="page">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Visual comparison</p>
          <h1>Scenario matrix</h1>
          <p>
            Compare views, density, and themes. Show a card's code to see only the presentation
            choices; its document and range are assumed to already exist.
          </p>
        </div>
        <div className="scenario-count">{matrixScenarios.length} scenarios</div>
      </header>

      <div className="scenario-matrix items-start">
        {matrixScenarios.map((scenario) => (
          <MatrixScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  );
}
