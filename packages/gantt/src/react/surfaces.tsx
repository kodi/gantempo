import {
  CalendarClock,
  CircleAlert,
  CircleDot,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';

import type {
  GanttContextMenuItem,
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
  task,
}: GanttContextMenuProps): ReactElement {
  return (
    <div {...bindings}>
      <div aria-hidden="true" className="gt-gantt__context-menu-header">
        <span>Task actions</span>
        <strong>{task.title}</strong>
      </div>
      <div className="gt-gantt__context-menu-items">
        {items.map((item) => (
          <button
            aria-label={
              item.disabledReason === undefined
                ? item.label
                : `${item.label}: ${item.disabledReason}`
            }
            className="gt-gantt__context-menu-item"
            data-destructive={item.action === 'delete' ? 'true' : undefined}
            disabled={item.disabledReason !== undefined}
            key={item.id}
            onClick={() => onSelect(item)}
            role="menuitem"
            title={item.disabledReason}
            type="button"
          >
            <span aria-hidden="true" className="gt-gantt__context-menu-icon">
              <MenuItemIcon item={item} />
            </span>
            <span className="gt-gantt__context-menu-copy">
              <span>{item.label}</span>
              {item.disabledReason === undefined ? null : <small>{item.disabledReason}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuItemIcon({ item }: { readonly item: GanttContextMenuItem }): ReactElement {
  const Icon =
    item.action === 'create'
      ? Plus
      : item.action === 'edit'
        ? Pencil
        : item.action === 'delete'
          ? Trash2
          : CircleDot;
  return <Icon focusable="false" strokeWidth={1.9} />;
}

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
              <strong>Edit task</strong>
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
              <span>Title</span>
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
                <span>Start</span>
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
                <span>End</span>
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
            Cancel
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
            {pending ? 'Saving…' : 'Save task'}
          </button>
        </div>
      </form>
    </div>
  );
}
