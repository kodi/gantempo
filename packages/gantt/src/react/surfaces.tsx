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
  GanttDependencyPropertiesProps,
  GanttLaneHeaderProps,
  GanttTaskContentProps,
  GanttTaskEditorProps,
  GanttTooltipProps,
} from './types';
import { useGanttLocalization } from './localization-context';

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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function localDateString(epoch: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(epoch);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatTooltipDateRange(
  start: number,
  end: number,
  localization: ReturnType<typeof useGanttLocalization>,
): string {
  if (localization.customDate) {
    const first = localization.date(localDateString(start, localization.timeZone), 'task-start');
    const last = localization.date(localDateString(end, localization.timeZone), 'task-end');
    return first === last ? first : `${first} – ${last}`;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  const monthDay = new Intl.DateTimeFormat(localization.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: localization.timeZone,
  });
  const fullDate = new Intl.DateTimeFormat(localization.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: localization.timeZone,
    year: 'numeric',
  });
  const startKey = localDateString(start, localization.timeZone);
  const endKey = localDateString(end, localization.timeZone);
  if (startKey === endKey) return fullDate.format(startDate);
  if (startKey.slice(0, 4) === endKey.slice(0, 4)) {
    return `${monthDay.format(startDate)} – ${monthDay.format(endDate)}, ${endKey.slice(0, 4)}`;
  }
  return `${fullDate.format(startDate)} – ${fullDate.format(endDate)}`;
}

function formatTooltipDuration(
  start: number,
  end: number,
  localization: ReturnType<typeof useGanttLocalization>,
): string {
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
  const formatted = localization.number(Math.round(value * 10) / 10, 'dependency-lag');
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
  const localization = useGanttLocalization();
  return (
    <div {...bindings}>
      <strong>{task.title}</strong>
      <span data-gt-part="tooltip-kind">
        {task.kind === 'summary'
          ? `${localization.message('task.kind.summary')}${
              task.descendantCount === undefined ? '' : ` · ${task.descendantCount} descendants`
            }`
          : localization.message(`task.kind.${task.kind}`)}
      </span>
      <div className="gt-gantt__tooltip-schedule" data-gt-part="tooltip-schedule">
        <CalendarClock aria-hidden="true" />
        <span data-gt-part="tooltip-range">
          {formatTooltipDateRange(task.start, task.end, localization)}
        </span>
        <span className="gt-gantt__tooltip-duration" data-gt-part="tooltip-duration">
          {formatTooltipDuration(task.start, task.end, localization)}
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
  const localization = useGanttLocalization();
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
                {localization.message(readOnly ? 'properties.view' : 'properties.edit')}{' '}
                {localization.message(
                  `task.kind.${initialValue.kind === 'lane' ? 'task' : initialValue.taskKind}`,
                )}
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
              <span>{localization.message('field.title')}</span>
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
                <span>{localization.message('field.description')}</span>
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
                  <span>{localization.message('field.kind')}</span>
                  <small>Canonical task type</small>
                </span>
                <select
                  aria-label="Kind"
                  disabled={disabled}
                  name="kind"
                  onChange={(event) => setTaskKind(event.currentTarget.value as typeof taskKind)}
                  value={taskKind}
                >
                  <option value="task">{localization.message('task.kind.task')}</option>
                  <option value="summary">{localization.message('task.kind.summary')}</option>
                  <option value="milestone">{localization.message('task.kind.milestone')}</option>
                </select>
              </label>
              <label>
                <span className="gt-gantt__editor-label">
                  <span>{localization.message('field.parent')}</span>
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
                  <span>{localization.message('field.order')}</span>
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
                  <span>{localization.message('field.start')}</span>
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
                    <span>{localization.message('field.end')}</span>
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
                <span>{localization.message('field.progress')}</span>
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
              <span>{localization.message('field.appearance')}</span>
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
                <span>{localization.message('field.lane')}</span>
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
              {localization.message('common.delete', { kind: 'task' })}
            </button>
          ) : null}
          <button
            className="gt-gantt__editor-button gt-gantt__editor-button--secondary"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {readOnly ? 'Close' : localization.message('common.cancel')}
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
              {pending
                ? 'Saving…'
                : localization.message('common.save', { kind: initialValue.kind })}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function DefaultDependencyProperties({
  bindings,
  error,
  errorId,
  initialValue,
  onCancel,
  onDelete,
  onSubmit,
  pending,
  readOnly,
}: GanttDependencyPropertiesProps): ReactElement {
  const localization = useGanttLocalization();
  const [type, setType] = useState(initialValue.type);
  const [lagValue, setLagValue] = useState(
    initialValue.lag === undefined ? '' : String(initialValue.lag.value),
  );
  const [lagUnit, setLagUnit] = useState(initialValue.lag?.unit ?? 'day');
  const disabled = pending || readOnly;
  return (
    <div {...bindings}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            dependencyId: initialValue.dependencyId,
            fromTitle: initialValue.fromTitle,
            ...(lagValue === ''
              ? {}
              : {
                  lag: {
                    mode: 'elapsed',
                    unit: lagUnit,
                    value: Number(lagValue),
                  },
                }),
            toTitle: initialValue.toTitle,
            type,
          });
        }}
      >
        <div className="gt-gantt__editor-header">
          <div className="gt-gantt__editor-heading">
            <span aria-hidden="true" className="gt-gantt__editor-heading-icon">
              <CircleDot focusable="false" strokeWidth={1.8} />
            </span>
            <div>
              <strong>
                {localization.message(
                  readOnly ? 'properties.view' : 'dependency.edit',
                  undefined,
                  readOnly ? 'View dependency' : 'Edit dependency',
                )}
              </strong>
              <span>
                {initialValue.fromTitle} to {initialValue.toTitle}
              </span>
            </div>
          </div>
          <button
            aria-label={localization.message(
              'common.cancel',
              undefined,
              'Close dependency properties',
            )}
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
              <dd>{initialValue.dependencyId}</dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd>
                {initialValue.fromTitle} → {initialValue.toTitle}
              </dd>
            </div>
          </dl>
          <label>
            <span className="gt-gantt__editor-label">{localization.message('field.kind')}</span>
            <select
              aria-label="Dependency type"
              disabled={disabled}
              onChange={(event) => setType(event.currentTarget.value as typeof type)}
              value={type}
            >
              <option value="finish-to-start">
                {localization.message('dependency.type.finish-to-start')}
              </option>
              <option value="start-to-start">
                {localization.message('dependency.type.start-to-start')}
              </option>
              <option value="finish-to-finish">
                {localization.message('dependency.type.finish-to-finish')}
              </option>
              <option value="start-to-finish">
                {localization.message('dependency.type.start-to-finish')}
              </option>
            </select>
          </label>
          <div className="gt-gantt__editor-schedule">
            <label>
              <span className="gt-gantt__editor-label">{localization.message('field.lag')}</span>
              <input
                aria-label="Lag value"
                disabled={disabled}
                onChange={(event) => setLagValue(event.currentTarget.value)}
                type="number"
                value={lagValue}
              />
            </label>
            <label>
              <span className="gt-gantt__editor-label">Lag unit</span>
              <select
                aria-label="Lag unit"
                disabled={disabled}
                onChange={(event) => setLagUnit(event.currentTarget.value as typeof lagUnit)}
                value={lagUnit}
              >
                <option value="millisecond">Milliseconds</option>
                <option value="minute">Minutes</option>
                <option value="hour">Hours</option>
                <option value="day">Days</option>
              </select>
            </label>
          </div>
          {initialValue.lag?.mode === 'working' ? (
            <p>Saving converts the preserved working lag to elapsed lag.</p>
          ) : null}
          {error === undefined ? null : (
            <p id={errorId} role="alert">
              <CircleAlert aria-hidden="true" focusable="false" strokeWidth={2} />
              <span>{error}</span>
            </p>
          )}
        </div>
        <div className="gt-gantt__editor-actions">
          <button
            className="gt-gantt__editor-button gt-gantt__editor-button--danger"
            disabled={disabled}
            onClick={onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" focusable="false" strokeWidth={2} />
            {localization.message('dependency.delete')}
          </button>
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
            disabled={disabled}
            type="submit"
          >
            <Save aria-hidden="true" focusable="false" strokeWidth={2} />
            {pending ? 'Saving…' : localization.message('common.save', { kind: 'dependency' })}
          </button>
        </div>
      </form>
    </div>
  );
}
