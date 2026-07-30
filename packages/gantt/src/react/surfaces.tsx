import { useState, type FormEvent, type ReactElement } from 'react';

import type {
  GanttContextMenuProps,
  GanttLaneHeaderProps,
  GanttTaskContentProps,
  GanttTaskEditorProps,
  GanttTooltipProps,
} from './types';

export function DefaultTaskContent({ task }: GanttTaskContentProps): ReactElement {
  return <span>{task.title}</span>;
}

export function DefaultLaneHeader({ lane }: GanttLaneHeaderProps): ReactElement {
  return (
    <>
      <span aria-hidden="true" className="gt-gantt__lane-marker">
        ·
      </span>
      <span title={lane.title}>{lane.title}</span>
    </>
  );
}

export function DefaultTooltip({ bindings, task }: GanttTooltipProps): ReactElement {
  return (
    <div {...bindings}>
      <strong>{task.title}</strong>
      <span>
        {new Date(task.start).toISOString()} – {new Date(task.end).toISOString()}
      </span>
    </div>
  );
}

export function DefaultContextMenu({
  bindings,
  items,
  onSelect,
}: GanttContextMenuProps): ReactElement {
  return (
    <div {...bindings}>
      {items.map((item) => (
        <button
          aria-label={
            item.disabledReason === undefined ? item.label : `${item.label}: ${item.disabledReason}`
          }
          disabled={item.disabledReason !== undefined}
          key={item.id}
          onClick={() => onSelect(item)}
          role="menuitem"
          title={item.disabledReason}
          type="button"
        >
          <span>{item.label}</span>
          {item.disabledReason === undefined ? null : <small>{item.disabledReason}</small>}
        </button>
      ))}
    </div>
  );
}

function editorDate(epoch: number): string {
  return new Date(epoch).toISOString();
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
          <div>
            <span>Task editor</span>
            <strong>{initialValue.title}</strong>
          </div>
          <button
            aria-label="Close task editor"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>
        <label>
          Title
          <input
            aria-describedby={error === undefined ? undefined : errorId}
            disabled={pending}
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
        </label>
        <label>
          Start (ISO 8601)
          <input
            aria-describedby={error === undefined ? undefined : errorId}
            disabled={pending}
            onChange={(event) => setStart(event.currentTarget.value)}
            spellCheck="false"
            value={start}
          />
        </label>
        <label>
          End (ISO 8601)
          <input
            aria-describedby={error === undefined ? undefined : errorId}
            disabled={pending}
            onChange={(event) => setEnd(event.currentTarget.value)}
            spellCheck="false"
            value={end}
          />
        </label>
        {error === undefined ? null : (
          <p id={errorId} role="alert">
            {error}
          </p>
        )}
        <div className="gt-gantt__editor-actions">
          <button disabled={pending} onClick={onCancel} type="button">
            Cancel
          </button>
          <button disabled={pending} type="submit">
            {pending ? 'Saving…' : 'Save task'}
          </button>
        </div>
      </form>
    </div>
  );
}
