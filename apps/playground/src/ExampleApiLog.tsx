import type { ReactElement } from 'react';

import {
  EXAMPLE_API_LOG_LIMIT,
  type ExampleApiChange,
  type ExampleApiWrite,
} from './example-persistence';

interface ExampleApiLogProps {
  readonly entries: readonly ExampleApiWrite[];
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

function eventTone(change: ExampleApiChange): 'create' | 'delete' | 'update' {
  if (change.type.endsWith('.created')) {
    return 'create';
  }
  if (change.type.endsWith('.deleted')) {
    return 'delete';
  }
  return 'update';
}

function eventLabel(type: ExampleApiChange['type']): string {
  return type.replaceAll('.', ' ');
}

function entityLabel(change: ExampleApiChange): string {
  if (change.type === 'task.schedule.updated') {
    return change.task.title;
  }
  return change.entity.title ?? change.entity.id;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? DATE_FORMATTER.format(parsed) : undefined;
}

function scheduleRange(value: Readonly<Record<string, unknown>>): string | undefined {
  const start = isoDate(value.start ?? value.startDate);
  const end = isoDate(value.end ?? value.endDate);
  return start === undefined || end === undefined ? undefined : `${start} – ${end}`;
}

function eventDetail(change: ExampleApiChange): string {
  if (change.type === 'task.schedule.updated') {
    const before = scheduleRange(change.before);
    const after = scheduleRange(change.update);
    if (before !== undefined && after !== undefined) {
      return `${before} → ${after}`;
    }
  }
  if ('update' in change) {
    const fields = Object.keys(change.update);
    return fields.length === 0 ? 'Row updated' : `Updated ${fields.join(', ')}`;
  }
  return change.type.endsWith('.created') ? 'Row created' : 'Row deleted';
}

function changeCount(write: ExampleApiWrite): string {
  return `${write.changes.length} ${write.changes.length === 1 ? 'change' : 'changes'}`;
}

const entryBorderToneClasses: Readonly<Record<ReturnType<typeof eventTone>, string>> =
  Object.freeze({
    create: 'border-l-[#3d8a69]',
    delete: 'border-l-[#b7655f]',
    update: 'border-l-[#79918a]',
  });

const badgeToneClasses: Readonly<Record<ReturnType<typeof eventTone>, string>> = Object.freeze({
  create: 'bg-[#e7f4ec] text-[#2f6f53]',
  delete: 'bg-[#faece9] text-[#934841]',
  update: 'bg-[#edf4f0] text-[#3e6258]',
});

export function ExampleApiLog({ entries }: ExampleApiLogProps): ReactElement {
  const newestFirst = [...entries].reverse();
  return (
    <div
      aria-label="Recent API writes"
      className="overflow-hidden rounded-xl border border-ink/13 bg-[#fbfcfa]/88"
      role="region"
    >
      <div className="flex min-h-10 items-center justify-between gap-4 border-b border-ink/9 bg-[#f3f5f1]/88 px-[13px] text-[10px] text-[#364354]">
        <strong className="text-[11px]">Recent API writes</strong>
        <span className="text-[#7a828c] [font-variant-numeric:tabular-nums]">
          {entries.length} / {EXAMPLE_API_LOG_LIMIT} retained
        </span>
      </div>
      {newestFirst.length === 0 ? (
        <div className="flex min-h-[126px] items-center justify-center gap-[11px] p-[22px] text-[#596473]">
          <span
            aria-hidden="true"
            className="size-[9px] flex-none rounded-full border-2 border-[#9ba49e]"
          />
          <div>
            <strong className="text-[11px]">No writes yet</strong>
            <p className="mt-0.5 mb-0 text-[10px]">
              Move or edit an item to inspect its persistence request.
            </p>
          </div>
        </div>
      ) : (
        <ol
          aria-live="polite"
          className="m-0 max-h-[430px] list-none overflow-y-auto p-0 [overscroll-behavior:contain] [scrollbar-gutter:stable] [&>li+li]:border-t [&>li+li]:border-ink/8"
        >
          {newestFirst.map((write) => {
            const primary = write.changes[0]!;
            const additional = write.changes.length - 1;
            const tone = eventTone(primary);
            return (
              <li key={write.operationId}>
                <details
                  className={`group border-l-[3px] ${entryBorderToneClasses[tone]}`}
                  data-tone={tone}
                >
                  <summary className="grid min-h-[72px] cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-[13px] py-[11px] pr-[13px] pl-3 hover:bg-[#ecf2ee]/78 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/24 group-open:bg-[#ecf2ee]/78 max-[901px]:grid-cols-[minmax(0,1fr)_auto] max-[901px]:gap-x-3 max-[901px]:gap-y-2 [&::-webkit-details-marker]:hidden">
                    <span
                      className={`rounded-full border border-[#566f67]/18 px-[7px] py-[5px] text-[9px] leading-none font-[760] tracking-[0.02em] whitespace-nowrap uppercase max-[901px]:justify-self-start ${badgeToneClasses[tone]}`}
                    >
                      {eventLabel(primary.type)}
                    </span>
                    <span className="grid min-w-0 gap-[3px] max-[901px]:col-span-full max-[901px]:row-start-2">
                      <strong className="truncate text-[11px] text-[#273444]">
                        {entityLabel(primary)}
                        {additional > 0 ? (
                          <small className="ml-[7px] text-[9px] font-[650] text-[#727b85]">
                            +{additional} more
                          </small>
                        ) : null}
                      </strong>
                      <span className="truncate text-[10px] text-[#69727e]">
                        {eventDetail(primary)}
                      </span>
                    </span>
                    <span className="grid min-w-0 justify-items-end gap-[3px] text-[9px] text-[#7d858f] [font-variant-numeric:tabular-nums] max-[901px]:col-start-1 max-[901px]:row-start-3 max-[901px]:justify-items-start">
                      <code className="text-[9px] text-[#4f5c6c]" data-api-log-part="operation">
                        {write.operationId}
                      </code>
                      <small>{changeCount(write)}</small>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[19px] leading-none text-[#69766f] transition-transform duration-130 group-open:rotate-90 max-[901px]:col-start-2 max-[901px]:row-start-3"
                    >
                      ›
                    </span>
                  </summary>
                  <div className="grid gap-[13px] border-t border-ink/7 bg-[#f8faf7]/90 px-[13px] pb-3.5">
                    <dl className="mt-[13px] mb-0 grid grid-cols-3 gap-2 max-[901px]:grid-cols-1 [&>div]:min-w-0 [&>div]:rounded-[7px] [&>div]:border [&>div]:border-ink/8 [&>div]:bg-white/72 [&>div]:p-[9px]">
                      <div>
                        <dt className="text-[8px] font-[760] tracking-[0.05em] text-[#7a828d] uppercase">
                          Operation ID
                        </dt>
                        <dd className="mt-1 mb-0 truncate text-[10px] text-[#344253]">
                          <code>{write.operationId}</code>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[8px] font-[760] tracking-[0.05em] text-[#7a828d] uppercase">
                          Base revision
                        </dt>
                        <dd className="mt-1 mb-0 truncate text-[10px] text-[#344253]">
                          <code>{write.baseRevision ?? 'none'}</code>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[8px] font-[760] tracking-[0.05em] text-[#7a828d] uppercase">
                          Batch size
                        </dt>
                        <dd className="mt-1 mb-0 truncate text-[10px] text-[#344253]">
                          {changeCount(write)}
                        </dd>
                      </div>
                    </dl>
                    <div>
                      <strong className="text-[10px] text-[#4b5868]">Raw request</strong>
                      <pre
                        aria-label={`Raw JSON for ${write.operationId}`}
                        className="mt-1.5 mb-0 max-h-[260px] overflow-auto rounded-lg border border-ink/10 bg-[#f3f5f2] p-3 font-mono text-[9px] leading-[1.55] text-[#314052] [tab-size:2]"
                      >
                        <code>{JSON.stringify(write, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
