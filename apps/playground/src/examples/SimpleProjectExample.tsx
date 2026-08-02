import { Gantt, useGanttDocument, type GanttDocumentStatus } from '@gantempo/gantt';
import type { ReactElement } from 'react';

import { simpleProjectApi } from './simple-project-api';
import './simple-project-example.css';

const RANGE = Object.freeze({
  start: Date.UTC(2026, 7, 1),
  end: Date.UTC(2026, 8, 1),
});

function statusLabel(status: GanttDocumentStatus, dirty: boolean): string {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  if (status === 'save-error') return 'Save failed — try again';
  if (dirty) return 'Unsaved changes';
  return 'All changes are local';
}

export function SimpleProjectExample(): ReactElement {
  const project = useGanttDocument(simpleProjectApi);

  if (project.ganttProps === undefined) {
    return (
      <section aria-busy={project.status === 'loading'} className="simple-project-example">
        <div className="simple-project-example__state">
          <p role={project.status === 'loading' ? 'status' : 'alert'}>
            {project.status === 'loading' ? 'Loading project…' : project.error?.message}
          </p>
          {project.status === 'load-error' ? (
            <button onClick={project.reload} type="button">
              Try again
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Simple project example" className="simple-project-example">
      <div className="simple-project-example__toolbar">
        <output aria-live="polite">{statusLabel(project.status, project.dirty)}</output>
        <button disabled={!project.canSave} onClick={() => void project.save()} type="button">
          {project.status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      <Gantt
        {...project.ganttProps}
        className="simple-project-example__chart"
        defaultRange={RANGE}
        features={{ properties: true, tooltip: true }}
        label="API-loaded project"
        timeScale={{ kind: 'adaptive' }}
        timeZone="UTC"
        view={{ kind: 'project' }}
      />
    </section>
  );
}
