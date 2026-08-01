import { CalendarClock, CircleAlert, LoaderCircle, Save, SquarePen, X } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';

import { useGanttLocalization } from '../localization-context';
import type { GanttTaskEditorProps } from '../types';

function editorDate(epoch: number): string {
  const date = new Date(epoch);
  const localEpoch = epoch - date.getTimezoneOffset() * 60_000;
  const localDate = new Date(localEpoch).toISOString();
  return epoch % 60_000 === 0 ? localDate.slice(0, 16) : localDate.slice(0, 23);
}

export function DefaultTaskEditor({
  bindings,
  error,
  errorId,
  initialValue,
  onCancel,
  onSubmit,
  pending,
}: GanttTaskEditorProps): ReactElement {
  const localization = useGanttLocalization();
  const [title, setTitle] = useState(initialValue.title);
  const [start, setStart] = useState(() => editorDate(initialValue.start));
  const [end, setEnd] = useState(() => editorDate(initialValue.end));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      end: Date.parse(end),
      start: Date.parse(start),
      title,
    });
  };

  return (
    <div {...bindings}>
      <form noValidate onSubmit={submit}>
        <div className="gt-gantt__editor-header">
          <div className="gt-gantt__editor-heading">
            <span aria-hidden="true" className="gt-gantt__editor-heading-icon">
              <SquarePen focusable="false" strokeWidth={1.8} />
            </span>
            <div>
              <strong>{localization.message('properties.edit')} task</strong>
              <span>Update the task details and schedule.</span>
            </div>
          </div>
          <button
            aria-label="Close task editor"
            className="gt-gantt__editor-close"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" focusable="false" strokeWidth={2} />
          </button>
        </div>
        <div className="gt-gantt__editor-content">
          <label>
            <span className="gt-gantt__editor-label">
              <span>{localization.message('field.title')}</span>
              <small>Required</small>
            </span>
            <input
              aria-describedby={error === undefined ? undefined : errorId}
              aria-label="Title"
              autoComplete="off"
              disabled={pending}
              name="title"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Task title"
              value={title}
            />
          </label>
          <div className="gt-gantt__editor-schedule">
            <label>
              <span className="gt-gantt__editor-label">
                <span>{localization.message('field.start')}</span>
                <small>Local time</small>
              </span>
              <span className="gt-gantt__editor-input-shell">
                <CalendarClock aria-hidden="true" focusable="false" strokeWidth={1.8} />
                <input
                  aria-describedby={error === undefined ? undefined : errorId}
                  aria-label="Start (ISO 8601)"
                  disabled={pending}
                  name="start"
                  onChange={(event) => setStart(event.currentTarget.value)}
                  spellCheck="false"
                  step={initialValue.start % 60_000 === 0 ? 60 : 0.001}
                  type="datetime-local"
                  value={start}
                />
              </span>
            </label>
            <label>
              <span className="gt-gantt__editor-label">
                <span>{localization.message('field.end')}</span>
                <small>Local time</small>
              </span>
              <span className="gt-gantt__editor-input-shell">
                <CalendarClock aria-hidden="true" focusable="false" strokeWidth={1.8} />
                <input
                  aria-describedby={error === undefined ? undefined : errorId}
                  aria-label="End (ISO 8601)"
                  disabled={pending}
                  name="end"
                  onChange={(event) => setEnd(event.currentTarget.value)}
                  spellCheck="false"
                  step={initialValue.end % 60_000 === 0 ? 60 : 0.001}
                  type="datetime-local"
                  value={end}
                />
              </span>
            </label>
          </div>
          {error === undefined ? null : (
            <p id={errorId} role="alert">
              <CircleAlert aria-hidden="true" focusable="false" strokeWidth={2} />
              <span>{error}</span>
            </p>
          )}
        </div>
        <div className="gt-gantt__editor-actions">
          <button
            className="gt-gantt__editor-button gt-gantt__editor-button--secondary"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {localization.message('common.cancel')}
          </button>
          <button
            className="gt-gantt__editor-button gt-gantt__editor-button--primary"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircle
                aria-hidden="true"
                className="gt-gantt__editor-spinner"
                focusable="false"
                strokeWidth={2}
              />
            ) : (
              <Save aria-hidden="true" focusable="false" strokeWidth={2} />
            )}
            {pending ? 'Saving…' : localization.message('common.save', { kind: 'task' })}
          </button>
        </div>
      </form>
    </div>
  );
}
