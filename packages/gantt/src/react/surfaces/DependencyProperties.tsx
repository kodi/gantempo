import { CircleAlert, CircleDot, Save, Trash2, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { useGanttLocalization } from '../localization-context';
import type { GanttDependencyPropertiesProps } from '../types';

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
