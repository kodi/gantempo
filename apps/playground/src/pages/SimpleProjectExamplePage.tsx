import type { ReactElement, ReactNode } from 'react';

import { SimpleProjectExample } from '../examples/SimpleProjectExample';
import componentSource from '../examples/SimpleProjectExample.tsx?raw';
import adapterSource from '../examples/simple-project-api.ts?raw';

const INSTALL_SOURCE = `pnpm add @gantempo/gantt react react-dom

import '@gantempo/gantt/styles.css';`;

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
      <div aria-hidden="true" className="example-step__number">
        {number}
      </div>
      <div className="example-step__content">
        <h2>{title}</h2>
        {children}
      </div>
    </li>
  );
}

export function SimpleProjectExamplePage(): ReactElement {
  return (
    <div className="page page--example-guide">
      <header className="page-intro example-guide__intro">
        <div>
          <p className="eyebrow">Simple · API-loaded · one hook</p>
          <h1>Your first working Gantt chart</h1>
          <p>
            Give Gantempo two small API functions. The package handles loading, validation, edits,
            and Save state; you render the chart and keep control of your transport.
          </p>
        </div>
        <div className="page-intro__meta">
          <span>~5 minute integration</span>
          <span>5 ordinary tasks</span>
          <span>2 dependencies</span>
        </div>
      </header>

      <ol className="example-steps">
        <Step number={1} title="Install Gantempo">
          <p>Install the React package and import its stylesheet once.</p>
          <SourcePanel filename="terminal + app entry" open>
            {INSTALL_SOURCE}
          </SourcePanel>
        </Step>

        <Step number={2} title="Connect your API">
          <p>
            Load returns ordinary JSON. Save receives the current validated document. This fake
            adapter uses a static JSON response and a short delay.
          </p>
          <SourcePanel filename="simple-project-api.ts" open>
            {adapterSource}
          </SourcePanel>
        </Step>

        <Step number={3} title="Render the chart">
          <p>
            One hook owns the common document lifecycle. Gantempo also supplies the warning
            appearance used by the fixture; pass variants only when you want to override them.
          </p>
          <SourcePanel filename="SimpleProjectExample.tsx" open>
            {componentSource}
          </SourcePanel>
        </Step>
      </ol>

      <section aria-labelledby="working-example-title" className="example-result">
        <div className="example-result__header">
          <div>
            <p className="eyebrow">Final working example</p>
            <h2 id="working-example-title">A small project plan that just works</h2>
            <p>
              Five normal tasks, progress, and two dependency links. Open a task or adjust its
              progress, then save the controlled document.
            </p>
          </div>
        </div>
        <SimpleProjectExample />
      </section>
    </div>
  );
}
