import { CalendarClock, CircleAlert, LoaderCircle, Save, SquarePen, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';

import type { GanttAppearanceVariantOption } from '../../render/appearance';
import { useGanttLocalization } from '../localization-context';
import type { GanttItemPropertiesProps, GanttItemPropertiesValue } from '../types';

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

function editorDate(epoch: number): string {
  const date = new Date(epoch);
  const localEpoch = epoch - date.getTimezoneOffset() * 60_000;
  const localDate = new Date(localEpoch).toISOString();
  return epoch % 60_000 === 0 ? localDate.slice(0, 16) : localDate.slice(0, 23);
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
