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

export function ExampleApiLog({ entries }: ExampleApiLogProps): ReactElement {
  const newestFirst = [...entries].reverse();
  return (
    <div aria-label="Recent API writes" className="api-log-stream" role="region">
      <div className="api-log-stream__heading">
        <strong>Recent API writes</strong>
        <span>
          {entries.length} / {EXAMPLE_API_LOG_LIMIT} retained
        </span>
      </div>
      {newestFirst.length === 0 ? (
        <div className="api-log-stream__empty">
          <span aria-hidden="true" />
          <div>
            <strong>No writes yet</strong>
            <p>Move or edit an item to inspect its persistence request.</p>
          </div>
        </div>
      ) : (
        <ol aria-live="polite" className="api-log-stream__list">
          {newestFirst.map((write) => {
            const primary = write.changes[0]!;
            const additional = write.changes.length - 1;
            return (
              <li key={write.operationId}>
                <details className="api-log-entry" data-tone={eventTone(primary)}>
                  <summary>
                    <span className="api-log-entry__badge">{eventLabel(primary.type)}</span>
                    <span className="api-log-entry__summary">
                      <strong>
                        {entityLabel(primary)}
                        {additional > 0 ? <small>+{additional} more</small> : null}
                      </strong>
                      <span>{eventDetail(primary)}</span>
                    </span>
                    <span className="api-log-entry__meta">
                      <code className="api-log-entry__operation">{write.operationId}</code>
                      <small>{changeCount(write)}</small>
                    </span>
                    <span aria-hidden="true" className="api-log-entry__chevron">
                      ›
                    </span>
                  </summary>
                  <div className="api-log-entry__details">
                    <dl>
                      <div>
                        <dt>Operation ID</dt>
                        <dd>
                          <code>{write.operationId}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Base revision</dt>
                        <dd>
                          <code>{write.baseRevision ?? 'none'}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Batch size</dt>
                        <dd>{changeCount(write)}</dd>
                      </div>
                    </dl>
                    <div className="api-log-entry__raw">
                      <strong>Raw request</strong>
                      <pre aria-label={`Raw JSON for ${write.operationId}`}>
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
