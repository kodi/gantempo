import {
  Gantt,
  type Diagnostic,
  type GanttDirection,
  type GanttDocument,
  type GanttDocumentChange,
  type GanttHandle,
  type GanttMessages,
  type GanttViewDefinition,
  type TimeRange,
} from '@gantempo/gantt';
import { useMemo, useRef, useState, type ReactElement } from 'react';

import {
  createProjectDocument,
  PROJECT_APPEARANCE_VARIANTS,
  PROJECT_RANGE,
} from '../project-fixture';

export type ProjectOwnership = 'controlled' | 'read-only' | 'uncontrolled';

export interface ProjectPageOptions {
  readonly cycle: boolean;
  readonly direction: GanttDirection;
  readonly locale: 'ar' | 'en-US' | 'sr-Latn';
  readonly ownership: ProjectOwnership;
}

const MESSAGES: Readonly<Record<ProjectPageOptions['locale'], GanttMessages>> = Object.freeze({
  ar: Object.freeze({
    'chart.label': 'مخطط إطلاق المجتمع',
    'dependency.delete': 'حذف التبعية',
    'dependency.edit': 'تحرير التبعية',
    'dependency.relationships': 'التبعيات',
    'properties.edit': 'تحرير',
    'properties.view': 'عرض',
    'task.kind.milestone': 'معلم',
    'task.kind.summary': 'ملخص',
    'task.kind.task': 'مهمة',
    'tree.collapse': 'طي {title}',
    'tree.expand': 'توسيع {title}',
    'zoom.fit': 'ملاءمة المشروع',
    'zoom.in': 'تكبير',
    'zoom.out': 'تصغير',
  }),
  'en-US': Object.freeze({ 'chart.label': 'Community launch chart' }),
  'sr-Latn': Object.freeze({
    'chart.label': 'Plan zajedničkog izdanja',
    'dependency.delete': 'Obriši zavisnost',
    'dependency.edit': 'Uredi zavisnost',
    'dependency.relationships': 'Zavisnosti',
    'properties.edit': 'Uredi',
    'properties.view': 'Pregledaj',
    'task.kind.milestone': 'Prekretnica',
    'task.kind.summary': 'Sažetak',
    'task.kind.task': 'Zadatak',
    'tree.collapse': 'Skupi {title}',
    'tree.expand': 'Proširi {title}',
    'zoom.fit': 'Uklopi projekat',
    'zoom.in': 'Uvećaj',
    'zoom.out': 'Umanji',
  }),
});

export function parseProjectPageOptions(search: string): ProjectPageOptions {
  const parameters = new URLSearchParams(search);
  const ownership = parameters.get('ownership');
  const locale = parameters.get('locale');
  return Object.freeze({
    cycle: parameters.get('cycle') === '1',
    direction: parameters.get('direction') === 'rtl' ? 'rtl' : 'ltr',
    locale: locale === 'ar' || locale === 'sr-Latn' ? locale : 'en-US',
    ownership: ownership === 'uncontrolled' || ownership === 'read-only' ? ownership : 'controlled',
  });
}

function projectHref(options: ProjectPageOptions): string {
  const parameters = new URLSearchParams({
    direction: options.direction,
    locale: options.locale,
    ownership: options.ownership,
  });
  if (options.cycle) parameters.set('cycle', '1');
  return `/project?${parameters}`;
}

interface ProjectChartProps {
  readonly document: GanttDocument;
  readonly direction: GanttDirection;
  readonly locale: ProjectPageOptions['locale'];
  readonly onDiagnostics: (diagnostics: readonly Diagnostic[]) => void;
  readonly onStatus: (status: string) => void;
  readonly ownership: ProjectOwnership;
  readonly view: GanttViewDefinition;
}

function ProjectChart({
  direction,
  document: initialDocument,
  locale,
  onDiagnostics,
  onStatus,
  ownership,
  view,
}: ProjectChartProps): ReactElement {
  const gantt = useRef<GanttHandle>(null);
  const [document, setDocument] = useState(initialDocument);
  const [range, setRange] = useState<TimeRange>(PROJECT_RANGE);
  const common = {
    appearanceVariants: PROJECT_APPEARANCE_VARIANTS,
    className: 'project-chart__gantt',
    direction,
    features: { contextMenu: true, properties: true, tooltip: true },
    interactionSnap: { anchor: PROJECT_RANGE.start, step: 24 * 60 * 60 * 1_000 },
    locale,
    messages: MESSAGES[locale],
    onCommandRejected: (event: { readonly diagnostics: readonly Diagnostic[] }) =>
      onStatus(`Rejected: ${event.diagnostics[0]?.code ?? 'unknown'}`),
    onDiagnostics,
    ref: gantt,
    timeScale: { kind: 'adaptive' as const, maxLevel: 'month' as const, minLevel: 'day' as const },
    timeZone: 'Europe/Belgrade',
    view,
  };
  const chart =
    ownership === 'controlled' ? (
      <Gantt
        {...common}
        document={document}
        onDocumentChange={(change: GanttDocumentChange) => {
          setDocument(change.document);
          onStatus(`Controlled candidate acknowledged: ${change.command.type}`);
        }}
        onRangeChange={(nextRange, event) => {
          setRange(nextRange);
          onStatus(`Controlled range acknowledged: ${event.reason}`);
        }}
        range={range}
      />
    ) : ownership === 'uncontrolled' ? (
      <Gantt
        {...common}
        defaultDocument={initialDocument}
        defaultRange={PROJECT_RANGE}
        onCommandCommitted={(event) =>
          onStatus(`Runtime committed: ${event.command?.type ?? event.operation}`)
        }
        onDocumentChange={() => undefined}
        onRangeChange={(_nextRange, event) => onStatus(`Runtime adopted range: ${event.reason}`)}
      />
    ) : (
      <Gantt {...common} defaultRange={PROJECT_RANGE} document={initialDocument} />
    );

  return (
    <div className="chart-frame chart-frame--project" data-theme="light">
      <div className="chart-frame__toolbar project-chart__toolbar">
        <div>
          <strong>{ownership === 'read-only' ? 'Read-only project' : 'Editable project'}</strong>
          <span>
            {ownership} document · {ownership === 'controlled' ? 'controlled' : 'runtime'} range
          </span>
        </div>
        <div aria-label="Project chart commands" className="chart-frame__actions">
          <button onClick={() => gantt.current?.fitToProject()} type="button">
            Fit
          </button>
          <button
            disabled={ownership === 'read-only'}
            onClick={() => {
              const task = gantt.current?.getDocument().tasks.find((item) => item.id === 'api');
              if (task === undefined) return;
              void gantt.current?.dispatch({
                changes: {
                  title: task.title === 'Public API' ? 'Public API acknowledged' : 'Public API',
                },
                id: task.id,
                type: 'task.update',
              });
            }}
            type="button"
          >
            Rename API
          </button>
          <button
            disabled={ownership === 'read-only'}
            onClick={() => void gantt.current?.undo()}
            type="button"
          >
            Undo
          </button>
          <button
            disabled={ownership === 'read-only'}
            onClick={() => void gantt.current?.redo()}
            type="button"
          >
            Redo
          </button>
        </div>
      </div>
      {chart}
    </div>
  );
}

export function ProjectPage({ search }: { readonly search: string }): ReactElement {
  const options = useMemo(() => parseProjectPageOptions(search), [search]);
  const document = useMemo(() => createProjectDocument(options.cycle), [options.cycle]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'canonical' | 'title'>('canonical');
  const [status, setStatus] = useState('Ready. Use the chart or keyboard controls.');
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const normalizedFilter = filter.trim().toLocaleLowerCase('en-US');
  const view = useMemo<GanttViewDefinition>(
    () => ({
      ...(normalizedFilter.length === 0
        ? {}
        : { filter: (task) => task.title.toLocaleLowerCase('en-US').includes(normalizedFilter) }),
      kind: 'project',
      ...(sort === 'title'
        ? { sort: (left, right) => left.title.localeCompare(right.title, 'en-US') }
        : {}),
    }),
    [normalizedFilter, sort],
  );
  const optionHref = (changes: Partial<ProjectPageOptions>) =>
    projectHref({ ...options, ...changes });

  return (
    <div className="page--project mx-auto w-[min(1480px,100%)] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[26px] flex items-end justify-between gap-8 max-[900px]:items-start max-[900px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            M5 public consumer
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            Project Gantt
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            One package-root consumer composes a deep task tree, summaries, milestones,
            dependencies, adaptive zoom, localization, RTL, and all three ownership modes.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-[#69717e] max-[561px]:flex-wrap">
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {document.tasks.length} items
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {document.dependencies.length} links
          </span>
          <span
            className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]"
            data-testid="project-diagnostics"
            title={diagnostics.map((diagnostic) => diagnostic.code).join(', ') || 'No diagnostics'}
          >
            {diagnostics.length} diagnostics
          </span>
        </div>
      </header>

      <section aria-label="Project example configuration" className="project-controls">
        <div aria-label="Ownership mode" className="project-controls__choices">
          {(['controlled', 'uncontrolled', 'read-only'] as const).map((ownership) => (
            <a
              aria-current={options.ownership === ownership ? 'page' : undefined}
              href={optionHref({ ownership })}
              key={ownership}
            >
              {ownership}
            </a>
          ))}
        </div>
        <label>
          <span>Locale</span>
          <select
            aria-label="Project locale"
            name="project-locale"
            onChange={(event) =>
              window.location.assign(
                optionHref({
                  locale: event.currentTarget.value as ProjectPageOptions['locale'],
                }),
              )
            }
            value={options.locale}
          >
            <option value="en-US">English</option>
            <option value="sr-Latn">Srpski (latinica)</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select
            aria-label="Project direction"
            name="project-direction"
            onChange={(event) =>
              window.location.assign(
                optionHref({ direction: event.currentTarget.value as GanttDirection }),
              )
            }
            value={options.direction}
          >
            <option value="ltr">LTR</option>
            <option value="rtl">RTL</option>
          </select>
        </label>
        <label>
          <span>Filter</span>
          <input
            aria-label="Filter project tasks"
            name="project-filter"
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Title contains…"
            type="search"
            value={filter}
          />
        </label>
        <label>
          <span>Sort siblings</span>
          <select
            aria-label="Sort project siblings"
            name="project-sort"
            onChange={(event) => setSort(event.currentTarget.value as typeof sort)}
            value={sort}
          >
            <option value="canonical">Canonical order</option>
            <option value="title">Title</option>
          </select>
        </label>
        <a className="project-controls__cycle" href={optionHref({ cycle: !options.cycle })}>
          {options.cycle ? 'Use valid graph' : 'Show cycle diagnostic'}
        </a>
      </section>

      <ProjectChart
        direction={options.direction}
        document={document}
        locale={options.locale}
        onDiagnostics={setDiagnostics}
        onStatus={setStatus}
        ownership={options.ownership}
        view={view}
      />

      <section aria-live="polite" className="project-status">
        <strong data-testid="project-consumer-status">{status}</strong>
        <span>
          {options.cycle
            ? 'The opt-in cycle remains visible and diagnostic; automatic scheduling is not performed.'
            : 'Dependencies are manual and diagnostic; dates never move automatically.'}
        </span>
      </section>
    </div>
  );
}
