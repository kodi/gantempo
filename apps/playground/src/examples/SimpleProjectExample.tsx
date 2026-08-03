import { Gantt } from '@gantempo/gantt';
import { useGanttDocumentQuery } from '@gantempo/gantt/react-query';
import type { ReactElement } from 'react';

import { loadSimpleProject, saveSimpleProject } from './simple-project-api';

const RANGE = {
  start: Date.UTC(2026, 7, 1),
  end: Date.UTC(2026, 8, 1),
} as const;

export function SimpleProjectExample(): ReactElement {
  const project = useGanttDocumentQuery({
    mutationFn: saveSimpleProject,
    queryFn: loadSimpleProject,
    queryKey: ['project', 'simple-example'],
  });

  let status = project.mutation.isSuccess ? 'Saved' : 'All changes are local';
  if (project.dirty) status = 'Unsaved changes';
  if (project.mutation.isError) status = 'Save failed — try again';
  if (project.mutation.isPending) status = 'Saving…';

  if (project.ganttProps === undefined) {
    return (
      <p
        className="m-0 flex min-h-[250px] items-center justify-center rounded-2xl border border-slate-700/10 bg-white p-6 text-center text-xs text-slate-500 shadow-[0_18px_44px_rgb(36_48_68/8%)]"
        role="status"
      >
        {project.query.error?.message ?? 'Loading project…'}
      </p>
    );
  }

  return (
    <section
      aria-label="Simple project example"
      className="overflow-hidden rounded-2xl border border-slate-700/10 bg-white shadow-[0_18px_44px_rgb(36_48_68/8%)]"
    >
      <div className="flex min-h-[58px] items-center justify-end gap-3.5 border-b border-slate-700/10 bg-slate-50 px-3.5 py-2.5">
        <output aria-live="polite" className="text-[11px] text-slate-500">
          {status}
        </output>
        <button
          className="min-h-9 rounded-[9px] border border-[#176b57] bg-[#176b57] px-3.5 text-[11px] font-bold text-white outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-3 focus-visible:outline-[#176b57]/25"
          disabled={!project.canSave}
          onClick={() => void project.save()}
          type="button"
        >
          {project.mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      <Gantt
        {...project.ganttProps}
        className="h-[430px]! rounded-none! border-0! shadow-none! max-[561px]:h-[470px]!"
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
