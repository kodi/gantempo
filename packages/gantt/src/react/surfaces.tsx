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

import type { GanttAppearanceVariantOption } from '../render/appearance';
import type {
  GanttItemPropertiesProps,
  GanttItemPropertiesValue,
  GanttContextMenuItem,
  GanttContextMenuProps,
  GanttLaneHeaderProps,
  GanttTaskContentProps,
  GanttTaskEditorProps,
  GanttTooltipProps,
} from './types';

interface DefaultItemPropertiesProps extends GanttItemPropertiesProps {
  readonly appearanceVariants: readonly GanttAppearanceVariantOption[];
  readonly duration?: string;
  readonly laneMoveDisabledReason?: string;
  readonly lanes: readonly {
    readonly id: string;
    readonly title: string;
  }[];
  readonly parentTasks: readonly {
    readonly id: string;
    readonly title: string;
  }[];
  readonly readOnly: boolean;
  readonly resourceId?: string;
}

const TOOLTIP_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const TOOLTIP_FULL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});
const TOOLTIP_DURATION_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function formatTooltipDateRange(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    startDate.getUTCDate() === endDate.getUTCDate()
  ) {
    return TOOLTIP_FULL_DATE_FORMATTER.format(startDate);
  }
  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return `${TOOLTIP_MONTH_DAY_FORMATTER.format(startDate)} – ${TOOLTIP_MONTH_DAY_FORMATTER.format(endDate)}, ${endDate.getUTCFullYear()}`;
  }
  return `${TOOLTIP_FULL_DATE_FORMATTER.format(startDate)} – ${TOOLTIP_FULL_DATE_FORMATTER.format(endDate)}`;
}

function formatTooltipDuration(start: number, end: number): string {
  const duration = Math.max(0, end - start);
  if (duration === 0) {
    return 'Instant';
  }
  if (duration < MINUTE) {
    return '< 1 min';
  }
  const [value, unit] =
    duration >= DAY
      ? ([duration / DAY, 'day'] as const)
      : duration >= HOUR
        ? ([duration / HOUR, 'hr'] as const)
        : ([duration / MINUTE, 'min'] as const);
  const formatted = TOOLTIP_DURATION_FORMATTER.format(value);
  return `${formatted} ${unit}${unit === 'day' && formatted !== '1' ? 's' : ''}`;
}

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
      <span data-gt-part="tooltip-kind">
        {task.kind === 'task'
          ? 'Task'
          : task.kind === 'summary'
            ? `Summary${
                task.descendantCount === undefined ? '' : ` · ${task.descendantCount} descendants`
              }`
            : 'Milestone'}
      </span>
      <div className="gt-gantt__tooltip-schedule" data-gt-part="tooltip-schedule">
        <CalendarClock aria-hidden="true" />
        <span data-gt-part="tooltip-range">{formatTooltipDateRange(task.start, task.end)}</span>
        <span className="gt-gantt__tooltip-duration" data-gt-part="tooltip-duration">
          {formatTooltipDuration(task.start, task.end)}
        </span>
      </div>
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

export function DefaultItemProperties({
  appearanceVariants,
  bindings,
  duration,
  error,
  errorId,
  initialValue,
  laneMoveDisabledReason,
  lanes,
  onCancel,
  onDelete,
  onSubmit,
  parentTasks,
  pending,
  readOnly,
  resourceId,
}: DefaultItemPropertiesProps): ReactElement {
  const taskValue = initialValue.kind === 'task' ? initialValue : undefined;
  const [title, setTitle] = useState(initialValue.title);
  const [description, setDescription] = useState(taskValue?.description ?? '');
  const [start, setStart] = useState(() =>
    taskValue?.start === undefined ? '' : editorDate(taskValue.start),
  );
  const [end, setEnd] = useState(() =>
    taskValue?.end === undefined ? '' : editorDate(taskValue.end),
  );
  const [progress, setProgress] = useState(() =>
    taskValue?.progress === undefined ? '' : String(Math.round(taskValue.progress * 100)),
  );
  const [appearance, setAppearance] = useState(initialValue.appearance?.variant ?? '');
  const [laneId, setLaneId] = useState(taskValue?.laneId ?? '');
  const [taskKind, setTaskKind] = useState(taskValue?.taskKind ?? 'task');
  const [parentId, setParentId] = useState(taskValue?.parentId ?? '');
  const [order, setOrder] = useState(taskValue?.order === undefined ? '' : String(taskValue.order));
  const unavailableAppearance =
    appearance !== '' && !appearanceVariants.some((option) => option.id === appearance);
  const disabled = pending || readOnly;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const appearanceReference = appearance === '' ? undefined : { variant: appearance };
    if (initialValue.kind === 'lane') {
      onSubmit({
        ...(appearanceReference === undefined ? {} : { appearance: appearanceReference }),
        kind: 'lane',
        laneId: initialValue.laneId,
        title,
      });
      return;
    }
    const next: GanttItemPropertiesValue = {
      ...(appearanceReference === undefined ? {} : { appearance: appearanceReference }),
      ...(description === '' ? {} : { description }),
      ...(end === ''
        ? {}
        : { end: taskKind === 'milestone' ? Date.parse(start) : Date.parse(end) }),
      kind: 'task',
      ...(laneId === '' ? {} : { laneId }),
      ...(order === '' ? {} : { order: Number(order) }),
      ...(parentId === '' ? {} : { parentId }),
      ...(initialValue.placementId === undefined ? {} : { placementId: initialValue.placementId }),
      ...(progress === '' ? {} : { progress: Number(progress) / 100 }),
      ...(start === '' ? {} : { start: Date.parse(start) }),
      taskId: initialValue.taskId,
      taskKind,
      title,
    };
    onSubmit(next);
  };
  const itemId = initialValue.kind === 'task' ? initialValue.taskId : initialValue.laneId;

  return (
    <div {...bindings}>
      <form noValidate onSubmit={submit}>
        <div className="gt-gantt__editor-header">
          <div className="gt-gantt__editor-heading">
            <span aria-hidden="true" className="gt-gantt__editor-heading-icon">
              <SquarePen focusable="false" strokeWidth={1.8} />
            </span>
            <div>
              <strong>
                {readOnly ? 'View' : 'Edit'} {initialValue.kind} properties
              </strong>
              <span>
                {readOnly
                  ? 'Inspect canonical item details.'
                  : 'Update canonical item details through one Save.'}
              </span>
            </div>
          </div>
          <button
            aria-label={`Close ${initialValue.kind} properties`}
            className="gt-gantt__editor-close"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" focusable="false" strokeWidth={2} />
          </button>
        </div>

        <div className="gt-gantt__editor-content">
          <dl className="gt-gantt__properties-meta">
            <div>
              <dt>ID</dt>
              <dd>{itemId}</dd>
            </div>
            {initialValue.kind === 'task' ? (
              <div>
                <dt>Kind</dt>
                <dd>{taskKind}</dd>
              </div>
            ) : null}
            {duration === undefined ? null : (
              <div>
                <dt>Elapsed duration</dt>
                <dd>{duration}</dd>
              </div>
            )}
            {resourceId === undefined ? null : (
              <div>
                <dt>Linked resource</dt>
                <dd>{resourceId}</dd>
              </div>
            )}
          </dl>

          <label>
            <span className="gt-gantt__editor-label">
              <span>Title</span>
              <small>Required</small>
            </span>
            <input
              aria-describedby={error === undefined ? undefined : errorId}
              aria-label="Title"
              autoComplete="off"
              disabled={disabled}
              name="title"
              onChange={(event) => setTitle(event.currentTarget.value)}
              value={title}
            />
          </label>

          {initialValue.kind === 'task' ? (
            <label>
              <span className="gt-gantt__editor-label">
                <span>Description</span>
                <small>Optional</small>
              </span>
              <textarea
                aria-describedby={error === undefined ? undefined : errorId}
                aria-label="Description"
                disabled={disabled}
                name="description"
                onChange={(event) => setDescription(event.currentTarget.value)}
                rows={3}
                value={description}
              />
            </label>
          ) : null}

          {initialValue.kind === 'task' ? (
            <div className="gt-gantt__editor-schedule">
              <label>
                <span className="gt-gantt__editor-label">
                  <span>Kind</span>
                  <small>Canonical task type</small>
                </span>
                <select
                  aria-label="Kind"
                  disabled={disabled}
                  name="kind"
                  onChange={(event) => setTaskKind(event.currentTarget.value as typeof taskKind)}
                  value={taskKind}
                >
                  <option value="task">Task</option>
                  <option value="summary">Summary</option>
                  <option value="milestone">Milestone</option>
                </select>
              </label>
              <label>
                <span className="gt-gantt__editor-label">
                  <span>Parent</span>
                  <small>Summary task</small>
                </span>
                <select
                  aria-label="Parent"
                  disabled={disabled}
                  name="parent"
                  onChange={(event) => setParentId(event.currentTarget.value)}
                  value={parentId}
                >
                  <option value="">No parent</option>
                  {parentTasks
                    .filter((parent) => parent.id !== initialValue.taskId)
                    .map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="gt-gantt__editor-label">
                  <span>Order</span>
                  <small>Sibling order</small>
                </span>
                <input
                  aria-label="Order"
                  disabled={disabled}
                  name="order"
                  onChange={(event) => setOrder(event.currentTarget.value)}
                  type="number"
                  value={order}
                />
              </label>
            </div>
          ) : null}

          {initialValue.kind === 'task' &&
          initialValue.start !== undefined &&
          taskKind !== 'summary' ? (
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
                    disabled={disabled}
                    name="start"
                    onChange={(event) => setStart(event.currentTarget.value)}
                    step={initialValue.start % 60_000 === 0 ? 60 : 0.001}
                    type="datetime-local"
                    value={start}
                  />
                </span>
              </label>
              {taskKind === 'milestone' ? null : (
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
                      disabled={disabled}
                      name="end"
                      onChange={(event) => setEnd(event.currentTarget.value)}
                      step={(initialValue.end ?? 0) % 60_000 === 0 ? 60 : 0.001}
                      type="datetime-local"
                      value={end}
                    />
                  </span>
                </label>
              )}
            </div>
          ) : null}

          {initialValue.kind === 'task' && taskKind === 'task' ? (
            <label>
              <span className="gt-gantt__editor-label">
                <span>Progress</span>
                <small>0–100%</small>
              </span>
              <input
                aria-describedby={error === undefined ? undefined : errorId}
                aria-label="Progress (percent)"
                disabled={disabled}
                inputMode="numeric"
                max={100}
                min={0}
                name="progress"
                onChange={(event) => setProgress(event.currentTarget.value)}
                step={1}
                type="number"
                value={progress}
              />
            </label>
          ) : null}

          <label>
            <span className="gt-gantt__editor-label">
              <span>Appearance</span>
              <small>{initialValue.kind === 'task' ? 'Inherit lane' : 'Theme default'}</small>
            </span>
            <select
              aria-describedby={error === undefined ? undefined : errorId}
              aria-label="Appearance"
              disabled={disabled}
              name="appearance"
              onChange={(event) => setAppearance(event.currentTarget.value)}
              value={appearance}
            >
              <option value="">
                {initialValue.kind === 'task' ? 'Inherit lane' : 'Theme default'}
              </option>
              {unavailableAppearance ? (
                <option value={appearance}>{appearance} (unavailable)</option>
              ) : null}
              {appearanceVariants.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {initialValue.kind === 'task' && initialValue.placementId !== undefined ? (
            <label>
              <span className="gt-gantt__editor-label">
                <span>Current lane</span>
                <small>{laneMoveDisabledReason ?? 'Persisted placement'}</small>
              </span>
              <select
                aria-describedby={error === undefined ? undefined : errorId}
                aria-label="Current lane"
                disabled={disabled || laneMoveDisabledReason !== undefined}
                name="lane"
                onChange={(event) => setLaneId(event.currentTarget.value)}
                value={laneId}
              >
                {lanes.map((lane) => (
                  <option key={lane.id} value={lane.id}>
                    {lane.title}
                  </option>
                ))}
              </select>
            </label>
          ) : initialValue.kind === 'task' ? (
            <p className="gt-gantt__properties-note">
              Lane movement is unavailable for this derived occurrence.
            </p>
          ) : null}

          {error === undefined ? null : (
            <p id={errorId} role="alert">
              <CircleAlert aria-hidden="true" focusable="false" strokeWidth={2} />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="gt-gantt__editor-actions">
          {initialValue.kind === 'task' ? (
            <button
              className="gt-gantt__editor-button gt-gantt__editor-button--danger"
              disabled={disabled}
              onClick={onDelete}
              type="button"
            >
              <Trash2 aria-hidden="true" focusable="false" strokeWidth={2} />
              Delete task
            </button>
          ) : null}
          <button
            className="gt-gantt__editor-button gt-gantt__editor-button--secondary"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {readOnly ? null : (
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
              {pending ? 'Saving…' : `Save ${initialValue.kind}`}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
