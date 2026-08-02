import { useEffect, useState, type ReactElement, type ReactNode } from 'react';

import { SimpleProjectExample } from '../examples/SimpleProjectExample';
import componentSource from '../examples/SimpleProjectExample.tsx?raw';
import { SIMPLE_PROJECT_ENDPOINT } from '../examples/simple-project-api';
import adapterSource from '../examples/simple-project-api.ts?raw';
import exampleStylesSource from '../examples/simple-project-example.css?raw';

const INSTALL_SOURCE = `pnpm add @gantempo/gantt react react-dom`;

function SourcePanel({
  children,
  filename,
  open = false,
}: {
  readonly children: string;
  readonly filename: string;
  readonly open?: boolean;
}): ReactElement {
  return (
    <details className="example-source" open={open}>
      <summary>
        <span>{filename}</span>
        <span>View complete file</span>
      </summary>
      <pre tabIndex={0}>
        <code>{children.trim()}</code>
      </pre>
    </details>
  );
}

function Step({
  children,
  number,
  title,
}: {
  readonly children: ReactNode;
  readonly number: number;
  readonly title: string;
}): ReactElement {
  return (
    <li className="example-step">
      <div className="example-step__number" aria-hidden="true">
        {number}
      </div>
      <div className="example-step__content">
        <h2>{title}</h2>
        {children}
      </div>
    </li>
  );
}

function formatFixtureSource(source: string): string {
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
}

export function SimpleProjectExamplePage(): ReactElement {
  const [fixtureSource, setFixtureSource] = useState('Loading the API fixture…');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(SIMPLE_PROJECT_ENDPOINT, { signal: controller.signal });
        if (!response.ok) throw new Error(`Fixture returned ${response.status}.`);
        setFixtureSource(formatFixtureSource(await response.text()));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFixtureSource(
          `Unable to display the fixture source: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <div className="page page--example-guide">
      <header className="page-intro example-guide__intro">
        <div>
          <p className="eyebrow">Simple · API-loaded · controlled</p>
          <h1>Project plan in a real application</h1>
          <p>
            Fetch unknown JSON, validate it at the package boundary, acknowledge edits into React
            state, and explicitly save the resulting document. Every file below powers the final
            working example.
          </p>
        </div>
        <div className="page-intro__meta">
          <span>~10 minute integration</span>
          <span>9 tasks</span>
          <span>5 dependencies</span>
        </div>
      </header>

      <section aria-labelledby="example-contract-title" className="example-contract">
        <div>
          <p className="eyebrow">Integration boundary</p>
          <h2 id="example-contract-title">A real GET, an honest mock Save</h2>
          <p>
            The playground fetches <code>{SIMPLE_PROJECT_ENDPOINT}</code> like an API response. It
            is a static asset, so Save serializes the controlled document and sends it to an
            in-memory adapter with simulated latency. Replace that one function with your own
            request.
          </p>
        </div>
        <div className="example-contract__flow" aria-label="Example data flow">
          <span>fetch</span>
          <span aria-hidden="true">→</span>
          <span>parse</span>
          <span aria-hidden="true">→</span>
          <span>control</span>
          <span aria-hidden="true">→</span>
          <span>serialize</span>
          <span aria-hidden="true">→</span>
          <span>save</span>
        </div>
      </section>

      <ol className="example-steps">
        <Step number={1} title="Install the package and stylesheet">
          <p>
            Install the React package, then import its structural and visual stylesheet once from
            your application entry point.
          </p>
          <SourcePanel filename="terminal" open>
            {INSTALL_SOURCE}
          </SourcePanel>
          <div className="example-inline-code">
            <code>import '@gantempo/gantt/styles.css';</code>
          </div>
        </Step>

        <Step number={2} title="Return an API-shaped project document">
          <p>
            Keep transport dates and IDs in their wire format. The public parser converts this
            unknown payload into the canonical document used by React.
          </p>
          <SourcePanel filename="public/api/examples/simple-project.json">
            {fixtureSource}
          </SourcePanel>
        </Step>

        <Step number={3} title="Create the application API adapter">
          <p>
            Fetch first, parse at the trust boundary, and reject fatal documents before they reach
            the chart. Save receives the already acknowledged canonical document.
          </p>
          <SourcePanel filename="simple-project-api.ts" open>
            {adapterSource}
          </SourcePanel>
        </Step>

        <Step number={4} title="Own the editable document in React">
          <p>
            Loading and persistence belong to the application. Gantempo proposes an immutable
            document; the application installs it immediately and decides when to save.
          </p>
          <SourcePanel filename="SimpleProjectExample.tsx" open>
            {componentSource}
          </SourcePanel>
        </Step>

        <Step number={5} title="Give the integration a bounded layout">
          <p>
            The chart responds to its measured container. These styles provide the application card,
            toolbar, loading state, and narrow-screen behavior used below.
          </p>
          <SourcePanel filename="simple-project-example.css">{exampleStylesSource}</SourcePanel>
        </Step>
      </ol>

      <section aria-labelledby="working-example-title" className="example-result">
        <div className="example-result__header">
          <div>
            <p className="eyebrow">Final working example</p>
            <h2 id="working-example-title">Edit the API-loaded project</h2>
            <p>
              Use the application toolbar command, open a task to change its properties, drag an
              instant task, or navigate with mouse and trackpad—then save the controlled draft.
            </p>
          </div>
          <ul aria-label="Features demonstrated">
            <li>Hierarchy and summaries</li>
            <li>Milestones and dependencies</li>
            <li>Progress and properties</li>
            <li>Adaptive zoom and direct navigation</li>
          </ul>
        </div>
        <SimpleProjectExample />
        <p className="example-result__note">
          Dependency links are manual and diagnostic. This Community example does not move dates
          automatically or imply critical-path, calendar, or resource-leveling behavior.
        </p>
      </section>
    </div>
  );
}
