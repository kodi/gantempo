import {
  Gantt,
  parseGanttDocument,
  type GanttCommand,
  type GanttCommandCommittedEvent,
  type GanttCommandRejectedEvent,
  type GanttDocument,
  type GanttDocumentChange,
  type GanttHandle,
  type GanttInteractionCommandMappers,
  type GanttLaneHeaderProps,
  type GanttTaskContentProps,
  type GanttTaskEditRequest,
  type GanttTaskTarget,
  type PlacementRecord,
  type TaskRecord,
  type TimeRange,
} from '@gantempo/gantt';
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';

import { PLAYGROUND_APPEARANCE_VARIANTS } from '../appearance';

const DAY = 24 * 60 * 60 * 1000;
const RANGE_START = Date.UTC(2026, 6, 29);
const RANGE_END = Date.UTC(2026, 7, 27);
const LANE_IDS = ['discovery', 'design', 'delivery', 'release'] as const;

const CUSTOM_DOCUMENT = {
  assignments: [],
  dependencies: [],
  lanes: [
    { appearance: { variant: 'accent' }, id: 'discovery', title: 'Discovery' },
    { appearance: { variant: 'success' }, id: 'design', title: 'Design' },
    { appearance: { variant: 'accent' }, id: 'delivery', title: 'Delivery' },
    { appearance: { variant: 'warning' }, id: 'release', title: 'Release' },
  ],
  placements: [
    { id: 'interactive-placement-1', laneId: 'discovery', taskId: 'interactive-task-1' },
    { id: 'interactive-placement-2', laneId: 'design', taskId: 'interactive-task-2' },
    { id: 'interactive-placement-3', laneId: 'delivery', taskId: 'interactive-task-3' },
  ],
  resources: [],
  revision: 'custom-consumer-r1',
  schemaVersion: 1,
  tasks: [
    {
      description: 'Confirm the application-owned details and editing workflow.',
      id: 'interactive-task-1',
      progress: 0.8,
      schedule: {
        end: '2026-08-02T00:00:00+00:00',
        mode: 'instant',
        start: '2026-07-29T00:00:00+00:00',
      },
      title: 'Work item 1',
    },
    {
      appearance: { variant: 'neutral' },
      description: 'Keep package interaction and site-owned presentation independent.',
      id: 'interactive-task-2',
      progress: 0.45,
      schedule: {
        end: '2026-08-07T00:00:00+00:00',
        mode: 'instant',
        start: '2026-08-01T00:00:00+00:00',
      },
      title: 'Work item 2',
    },
    {
      id: 'interactive-task-3',
      progress: 0.2,
      schedule: {
        end: '2026-08-12T00:00:00+00:00',
        mode: 'instant',
        start: '2026-08-05T00:00:00+00:00',
      },
      title: 'Work item 3',
    },
  ],
} satisfies unknown;

interface InteractiveCustomState {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly document: GanttDocument;
  readonly focusedTask?: GanttTaskTarget;
  readonly nextSerial: number;
  readonly range: TimeRange;
  readonly status: string;
}

type CustomDetailsState =
  | { readonly status: 'closed' }
  | {
      readonly mode: 'display' | 'edit';
      readonly status: 'open';
      readonly target: GanttTaskTarget;
      readonly taskId: string;
    };

interface CustomFormValues {
  readonly appearance: string;
  readonly description: string;
  readonly end: string;
  readonly laneId: string;
  readonly progress: string;
  readonly start: string;
  readonly title: string;
}

type CustomFormField = 'end' | 'progress' | 'start' | 'title';

interface CustomFormState {
  readonly error?: string;
  readonly errors: Readonly<Partial<Record<CustomFormField, string>>>;
  readonly pending: boolean;
  readonly values: CustomFormValues;
}

interface NormalizedCustomForm {
  readonly appearance?: string;
  readonly description?: string;
  readonly end: number;
  readonly laneId: string;
  readonly progress?: number;
  readonly start: number;
  readonly title: string;
}

type InteractiveCustomAction =
  | {
      readonly canRedo: boolean;
      readonly canUndo: boolean;
      readonly event: GanttCommandCommittedEvent;
      readonly type: 'committed';
    }
  | {
      readonly canRedo: boolean;
      readonly canUndo: boolean;
      readonly event: GanttCommandRejectedEvent;
      readonly type: 'rejected';
    }
  | { readonly change: GanttDocumentChange; readonly type: 'runtime-change' }
  | { readonly focusedTask?: GanttTaskTarget; readonly type: 'focus' }
  | { readonly range: TimeRange; readonly type: 'range' }
  | { readonly status: string; readonly type: 'status' };

function loadCustomDocument(): GanttDocument {
  const parsed = parseGanttDocument(CUSTOM_DOCUMENT);
  if (parsed.document === undefined) {
    throw new Error(
      `The custom consumer document was rejected: ${
        parsed.diagnostics[0]?.message ?? 'unknown error'
      }`,
    );
  }
  return parsed.document;
}

function InteractiveCustomTaskContent({ pending, task }: GanttTaskContentProps): ReactElement {
  return (
    <span className="interactive-task-content">
      <i aria-hidden="true" />
      <span>{task.title}</span>
      {pending ? <small>saving</small> : null}
    </span>
  );
}

function InteractiveCustomLaneHeader({ lane }: GanttLaneHeaderProps): ReactElement {
  return (
    <span className="interactive-lane-header">
      <i aria-hidden="true" />
      <span>{lane.title}</span>
    </span>
  );
}

function commandsForItems(firstSerial: number, count: number): readonly GanttCommand[] {
  return Array.from({ length: count }, (_, index): readonly GanttCommand[] => {
    const serial = firstSerial + index;
    const laneId = LANE_IDS[(serial - 1) % LANE_IDS.length]!;
    const startOffset = ((serial - 1) * 3) % 22;
    const duration = 4 + ((serial - 1) % 4);
    const taskId = `interactive-task-${serial}`;

    return [
      {
        type: 'task.add',
        value: {
          id: taskId,
          title: `Work item ${serial}`,
          schedule: {
            end: RANGE_START + (startOffset + duration) * DAY,
            mode: 'instant',
            start: RANGE_START + startOffset * DAY,
          },
        },
      },
      {
        type: 'placement.add',
        value: {
          id: `interactive-placement-${serial}`,
          laneId,
          taskId,
        },
      },
    ];
  }).flat();
}

function interactiveCustomReducer(
  state: InteractiveCustomState,
  action: InteractiveCustomAction,
): InteractiveCustomState {
  switch (action.type) {
    case 'runtime-change': {
      const addedTasks = action.change.patches.filter(
        (patch) => patch.target.collection === 'tasks' && patch.op === 'add',
      ).length;
      return {
        ...state,
        document: action.change.document,
        nextSerial: state.nextSerial + addedTasks,
        status: 'The controlled application store acknowledged the document change.',
      };
    }
    case 'committed':
      return {
        ...state,
        canRedo: action.canRedo,
        canUndo: action.canUndo,
        status: `${
          action.event.source.kind === 'history' ? 'History' : 'Command'
        } committed locally.`,
      };
    case 'rejected':
      return {
        ...state,
        canRedo: action.canRedo,
        canUndo: action.canUndo,
        status: action.event.diagnostics[0]?.message ?? 'The chart interaction was rejected.',
      };
    case 'focus':
      return {
        ...state,
        ...(action.focusedTask === undefined ? {} : { focusedTask: action.focusedTask }),
      };
    case 'range':
      return { ...state, range: action.range, status: 'The controlled range was updated.' };
    case 'status':
      return { ...state, status: action.status };
  }
}

function createInitialState(): InteractiveCustomState {
  return {
    canRedo: false,
    canUndo: false,
    document: loadCustomDocument(),
    nextSerial: 4,
    range: { start: RANGE_START, end: RANGE_END },
    status: 'The controlled document is ready for application-owned task details.',
  };
}

function utcDateTimeValue(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 16);
}

function parseUtcDateTime(value: string): number {
  return Date.parse(`${value}Z`);
}

function createFormState(
  task: TaskRecord,
  placement: PlacementRecord | undefined,
): CustomFormState {
  const schedule = task.schedule;
  if (task.kind !== 'task' || schedule?.mode !== 'instant') {
    throw new Error('Only ordinary instant tasks can be edited by this custom surface.');
  }
  return {
    errors: {},
    pending: false,
    values: {
      appearance: task.appearance?.variant ?? '',
      description: task.description ?? '',
      end: utcDateTimeValue(schedule.end),
      laneId: placement?.laneId ?? '',
      progress: task.progress === undefined ? '' : String(Math.round(task.progress * 100)),
      start: utcDateTimeValue(schedule.start),
      title: task.title,
    },
  };
}

function validateForm(
  values: CustomFormValues,
):
  | { readonly errors: Readonly<Partial<Record<CustomFormField, string>>>; readonly valid: false }
  | { readonly normalized: NormalizedCustomForm; readonly valid: true } {
  const errors: Partial<Record<CustomFormField, string>> = {};
  const title = values.title.trim();
  const start = parseUtcDateTime(values.start);
  const end = parseUtcDateTime(values.end);
  const progressText = values.progress.trim();
  const progressPercent = progressText === '' ? undefined : Number(progressText);

  if (title === '') {
    errors.title = 'Title is required.';
  }
  if (!Number.isFinite(start)) {
    errors.start = 'Enter a valid UTC start.';
  }
  if (!Number.isFinite(end)) {
    errors.end = 'Enter a valid UTC end.';
  } else if (Number.isFinite(start) && end <= start) {
    errors.end = 'End must be after start.';
  }
  if (
    progressPercent !== undefined &&
    (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100)
  ) {
    errors.progress = 'Progress must be a whole number from 0 to 100.';
  }
  if (Object.keys(errors).length > 0) {
    return { errors, valid: false };
  }

  return {
    normalized: {
      ...(values.appearance === '' ? {} : { appearance: values.appearance }),
      ...(values.description.trim() === '' ? {} : { description: values.description }),
      end,
      laneId: values.laneId,
      ...(progressPercent === undefined ? {} : { progress: progressPercent / 100 }),
      start,
      title,
    },
    valid: true,
  };
}

function resolvePlacement(
  document: GanttDocument,
  target: GanttTaskTarget,
): PlacementRecord | undefined {
  return target.placementId === undefined
    ? undefined
    : document.placements.find(
        (placement) => placement.id === target.placementId && placement.taskId === target.taskId,
      );
}

function appearanceLabel(variant: string | undefined): string {
  if (variant === undefined) {
    return 'Default';
  }
  return (
    PLAYGROUND_APPEARANCE_VARIANTS.find((option) => option.id === variant)?.label ??
    `${variant} (unavailable)`
  );
}

const detailDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Belgrade',
});

export function InteractiveCustomPage(): ReactElement {
  const [state, dispatch] = useReducer(interactiveCustomReducer, undefined, createInitialState);
  const [details, setDetails] = useState<CustomDetailsState>({ status: 'closed' });
  const [form, setForm] = useState<CustomFormState | undefined>();
  const ganttRef = useRef<GanttHandle>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const savePendingRef = useRef(false);
  const hasTasks = state.document.tasks.length > 0;
  const openTask =
    details.status === 'open'
      ? state.document.tasks.find((task) => task.id === details.taskId)
      : undefined;
  const openPlacement =
    details.status === 'open' ? resolvePlacement(state.document, details.target) : undefined;
  const openLane =
    openPlacement === undefined
      ? undefined
      : state.document.lanes.find((lane) => lane.id === openPlacement.laneId);
  const detailsMode = details.status === 'open' ? details.mode : undefined;
  const detailsTaskId = details.status === 'open' ? details.taskId : undefined;

  useEffect(() => {
    if (details.status !== 'open' || openTask !== undefined) {
      return;
    }
    savePendingRef.current = false;
    setDetails({ status: 'closed' });
    setForm(undefined);
    dispatch({
      status: 'The application-owned panel closed because its canonical task was deleted.',
      type: 'status',
    });
  }, [details, openTask]);

  useEffect(() => {
    if (detailsMode === 'edit') {
      titleInputRef.current?.focus();
    } else if (detailsMode === 'display') {
      panelRef.current?.focus();
    }
  }, [detailsMode, detailsTaskId]);

  const interactionMappers = useMemo<GanttInteractionCommandMappers>(
    () => ({
      createTask(intent) {
        const serial = state.nextSerial;
        const taskId = `interactive-task-${serial}`;
        if (intent.destination.laneId === undefined) {
          return {
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'The controlled example creates tasks only in persisted lanes.',
              path: '/interaction',
              severity: 'error',
            },
            status: 'rejected',
          };
        }
        return {
          command: {
            commands: [
              {
                type: 'task.add',
                value: {
                  id: taskId,
                  title: `Work item ${serial}`,
                  schedule: {
                    end: intent.end,
                    mode: 'instant',
                    start: intent.start,
                  },
                },
              },
              {
                type: 'placement.add',
                value: {
                  id: `interactive-placement-${serial}`,
                  laneId: intent.destination.laneId,
                  taskId,
                },
              },
            ],
            type: 'transaction',
          },
          status: 'mapped',
        };
      },
    }),
    [state.nextSerial],
  );

  const dispatchToolbar = (command: GanttCommand) => {
    void ganttRef.current?.dispatch(command, { source: { kind: 'toolbar' } });
  };

  const recordCommitted = (event: GanttCommandCommittedEvent) => {
    dispatch({
      canRedo: ganttRef.current?.canRedo() ?? false,
      canUndo: ganttRef.current?.canUndo() ?? false,
      event,
      type: 'committed',
    });
    if (event.source.kind === 'editor' && savePendingRef.current) {
      savePendingRef.current = false;
      setForm(undefined);
      setDetails((current) =>
        current.status === 'open' ? { ...current, mode: 'display' } : current,
      );
      dispatch({ status: 'The custom properties were acknowledged and saved.', type: 'status' });
    }
  };

  const recordRejected = (event: GanttCommandRejectedEvent) => {
    dispatch({
      canRedo: ganttRef.current?.canRedo() ?? false,
      canUndo: ganttRef.current?.canUndo() ?? false,
      event,
      type: 'rejected',
    });
    if (event.source.kind === 'editor' && savePendingRef.current) {
      savePendingRef.current = false;
      setForm((current) =>
        current === undefined
          ? current
          : {
              ...current,
              error: event.diagnostics[0]?.message ?? 'The custom edit was rejected.',
              pending: false,
            },
      );
    }
  };

  const openDisplay = (target: GanttTaskTarget) => {
    setForm(undefined);
    setDetails({ mode: 'display', status: 'open', target, taskId: target.taskId });
    dispatch({ status: 'The application-owned task details are open.', type: 'status' });
  };

  const openEdit = (request: GanttTaskEditRequest) => {
    const task = state.document.tasks.find((candidate) => candidate.id === request.target.taskId);
    const placement = resolvePlacement(state.document, request.target);
    if (task === undefined) {
      setDetails({ status: 'closed' });
      setForm(undefined);
      dispatch({ status: 'The requested task no longer exists.', type: 'status' });
      return;
    }
    if (task.kind !== 'task' || task.schedule?.mode !== 'instant') {
      openDisplay(request.target);
      dispatch({
        status: 'This custom form edits only ordinary tasks with instant schedules.',
        type: 'status',
      });
      return;
    }
    setDetails({
      mode: 'edit',
      status: 'open',
      target: request.target,
      taskId: request.target.taskId,
    });
    setForm(createFormState(task, placement));
    dispatch({ status: 'The application-owned task form is ready.', type: 'status' });
  };

  const updateFormValue = (field: keyof CustomFormValues, value: string) => {
    setForm((current) => {
      if (current === undefined) {
        return current;
      }
      const { error: _error, ...next } = current;
      return {
        ...next,
        errors: {},
        values: { ...current.values, [field]: value },
      };
    });
  };

  const saveForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      details.status !== 'open' ||
      details.mode !== 'edit' ||
      openTask === undefined ||
      form === undefined ||
      form.pending
    ) {
      return;
    }
    const validation = validateForm(form.values);
    if (!validation.valid) {
      setForm({ ...form, errors: validation.errors });
      return;
    }
    if (openTask.kind !== 'task' || openTask.schedule?.mode !== 'instant') {
      setForm({ ...form, error: 'The canonical task is no longer editable.' });
      return;
    }

    const normalized = validation.normalized;
    const changes: {
      appearance?: { readonly variant: string } | null;
      description?: string | null;
      progress?: number | null;
      schedule?: {
        readonly end: number;
        readonly mode: 'instant';
        readonly start: number;
      };
      title?: string;
    } = {};
    if (normalized.title !== openTask.title) {
      changes.title = normalized.title;
    }
    if (normalized.description !== openTask.description) {
      changes.description = normalized.description ?? null;
    }
    if (normalized.appearance !== openTask.appearance?.variant) {
      changes.appearance =
        normalized.appearance === undefined ? null : { variant: normalized.appearance };
    }
    if (normalized.progress !== openTask.progress) {
      changes.progress = normalized.progress ?? null;
    }
    if (normalized.start !== openTask.schedule.start || normalized.end !== openTask.schedule.end) {
      changes.schedule = {
        end: normalized.end,
        mode: 'instant',
        start: normalized.start,
      };
    }

    const commands: GanttCommand[] = [];
    if (Object.keys(changes).length > 0) {
      commands.push({
        changes,
        id: openTask.id,
        type: 'task.update',
      });
    }
    if (
      openPlacement !== undefined &&
      normalized.laneId !== '' &&
      normalized.laneId !== openPlacement.laneId
    ) {
      commands.push({
        id: openPlacement.id,
        laneId: normalized.laneId,
        type: 'placement.move',
      });
    }
    if (commands.length === 0) {
      setForm(undefined);
      setDetails({ ...details, mode: 'display' });
      dispatch({
        status: 'No properties changed, so no history entry was created.',
        type: 'status',
      });
      return;
    }

    savePendingRef.current = true;
    setForm({ ...form, errors: {}, pending: true });
    const command: GanttCommand =
      commands.length === 1 ? commands[0]! : { commands, type: 'transaction' };
    void ganttRef.current
      ?.dispatch(command, {
        source: { kind: 'editor' },
        target: details.target,
      })
      .then((result) => {
        if (result.status !== 'rejected' || !savePendingRef.current) {
          return;
        }
        savePendingRef.current = false;
        setForm((current) =>
          current === undefined
            ? current
            : {
                ...current,
                error: result.diagnostics[0]?.message ?? 'The custom edit was rejected.',
                pending: false,
              },
        );
      });
  };

  const cancelEdit = () => {
    savePendingRef.current = false;
    setForm(undefined);
    setDetails((current) =>
      current.status === 'open' ? { ...current, mode: 'display' } : current,
    );
    dispatch({
      status: 'The custom edit was cancelled without a document change.',
      type: 'status',
    });
  };

  return (
    <div className="page--interactive page--interactive-custom mx-auto w-full max-w-[1480px] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[26px] flex items-end justify-between gap-8 max-[900px]:items-start max-[900px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            Application-owned integration proof
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            Interactive Custom
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            Gantt keeps timeline interaction, commands, history, and controlled acknowledgement.
            This page owns the task details and editing panel rendered below the chart.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-[#69717e] max-[561px]:flex-wrap">
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {state.document.tasks.length} items
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {LANE_IDS.length} lanes
          </span>
        </div>
      </header>

      <section aria-label="Interactive Custom chart controls" className="interactive-controls">
        <div className="interactive-controls__buttons">
          <button
            onClick={() =>
              dispatchToolbar({
                commands: commandsForItems(state.nextSerial, 1),
                type: 'transaction',
              })
            }
            type="button"
          >
            Add item
          </button>
          <button
            onClick={() =>
              dispatchToolbar({
                commands: commandsForItems(state.nextSerial, 5),
                type: 'transaction',
              })
            }
            type="button"
          >
            Add 5 items
          </button>
          <button
            disabled={!hasTasks}
            onClick={() => {
              const latest = state.document.tasks.at(-1);
              if (latest !== undefined) {
                dispatchToolbar({ cascade: true, id: latest.id, type: 'task.delete' });
              }
            }}
            type="button"
          >
            Remove latest
          </button>
          <button
            disabled={!hasTasks}
            onClick={() =>
              dispatchToolbar({
                commands: state.document.tasks.map((task) => ({
                  cascade: true,
                  id: task.id,
                  type: 'task.delete' as const,
                })),
                type: 'transaction',
              })
            }
            type="button"
          >
            Clear
          </button>
          <span aria-hidden="true" className="interactive-controls__separator" />
          <button
            disabled={!state.canUndo}
            onClick={() => void ganttRef.current?.undo()}
            type="button"
          >
            Undo
          </button>
          <button
            disabled={!state.canRedo}
            onClick={() => void ganttRef.current?.redo()}
            type="button"
          >
            Redo
          </button>
          <button
            disabled={state.focusedTask === undefined}
            onClick={() => {
              const target = state.focusedTask;
              if (target !== undefined) {
                ganttRef.current?.focusTask(target);
                ganttRef.current?.scrollToTask(target, { align: 'center' });
                dispatch({
                  status: 'Imperatively focused and scrolled to the last task.',
                  type: 'status',
                });
              }
            }}
            type="button"
          >
            Focus last task
          </button>
        </div>
        <output aria-live="polite" className="interactive-controls__status">
          {state.status}
        </output>
      </section>

      <div className="chart-frame chart-frame--main chart-frame--interactive">
        <div className="chart-frame__toolbar">
          <div>
            <strong>Custom integration plan</strong>
            <span>Controlled document · Europe/Belgrade</span>
          </div>
          <div className="interactive-chart-count">
            <strong>{state.document.tasks.length}</strong>
            <span>scheduled</span>
          </div>
        </div>

        <Gantt
          appearanceVariants={PLAYGROUND_APPEARANCE_VARIANTS}
          className="chart-frame__chart"
          classNames={{
            contextMenu: 'interactive-surface-menu',
            laneHeader: 'interactive-column-cell',
            taskContent: 'interactive-task-slot',
            tooltip: 'interactive-surface-tooltip',
          }}
          columns={[
            { header: 'Phase', id: 'phase', width: 132 },
            {
              header: 'Code',
              id: 'code',
              renderCell: ({ lane }) => (
                <code>{lane.target.laneId?.slice(0, 3).toUpperCase() ?? '—'}</code>
              ),
              width: 66,
            },
          ]}
          contextMenuItems={(task) => [
            {
              command: {
                changes: { title: `Focus: ${task.title.replace(/^Focus: /, '')}` },
                id: task.target.taskId,
                type: 'task.update',
              },
              id: 'focus-title',
              label: 'Mark as focus',
            },
          ]}
          document={state.document}
          features={{ contextMenu: true, tooltip: true }}
          interactionMappers={interactionMappers}
          interactionSnap={{ anchor: RANGE_START, step: DAY }}
          label="Interactive Custom delivery plan chart"
          onCommandCommitted={recordCommitted}
          onCommandRejected={recordRejected}
          onDocumentChange={(change) => dispatch({ change, type: 'runtime-change' })}
          onFocusChange={(focused) =>
            dispatch({
              ...(focused?.kind === 'task' ? { focusedTask: focused } : {}),
              type: 'focus',
            })
          }
          onRangeChange={(range) => dispatch({ range, type: 'range' })}
          onTaskActivate={openDisplay}
          onTaskEditRequest={openEdit}
          range={state.range}
          ref={ganttRef}
          slots={{
            LaneHeader: InteractiveCustomLaneHeader,
            TaskContent: InteractiveCustomTaskContent,
          }}
          tickAnchor={RANGE_START}
          tickInterval={7 * DAY}
          timeZone="Europe/Belgrade"
        />
      </div>

      {details.status === 'open' && openTask !== undefined ? (
        <section
          aria-labelledby="interactive-custom-details-title"
          className="custom-details"
          ref={panelRef}
          tabIndex={-1}
        >
          <div className="custom-details__header">
            <div>
              <p>{details.mode === 'edit' ? 'Edit mode' : 'Display mode'}</p>
              <h2 id="interactive-custom-details-title">{openTask.title} details</h2>
            </div>
            <span>{openTask.id}</span>
          </div>

          {details.mode === 'edit' && form !== undefined ? (
            <form aria-label={`Edit ${openTask.title} properties`} noValidate onSubmit={saveForm}>
              <fieldset disabled={form.pending}>
                <div className="custom-details__form-grid">
                  <label>
                    <span>Title</span>
                    <input
                      aria-describedby={form.errors.title ? 'custom-title-error' : undefined}
                      aria-invalid={form.errors.title ? 'true' : undefined}
                      name="title"
                      onChange={(event) => updateFormValue('title', event.currentTarget.value)}
                      ref={titleInputRef}
                      type="text"
                      value={form.values.title}
                    />
                    {form.errors.title ? (
                      <small id="custom-title-error">{form.errors.title}</small>
                    ) : null}
                  </label>
                  <label className="custom-details__wide-field">
                    <span>Description</span>
                    <textarea
                      name="description"
                      onChange={(event) =>
                        updateFormValue('description', event.currentTarget.value)
                      }
                      rows={3}
                      value={form.values.description}
                    />
                  </label>
                  <label>
                    <span>Start (UTC)</span>
                    <input
                      aria-describedby={form.errors.start ? 'custom-start-error' : undefined}
                      aria-invalid={form.errors.start ? 'true' : undefined}
                      name="start"
                      onChange={(event) => updateFormValue('start', event.currentTarget.value)}
                      type="datetime-local"
                      value={form.values.start}
                    />
                    {form.errors.start ? (
                      <small id="custom-start-error">{form.errors.start}</small>
                    ) : null}
                  </label>
                  <label>
                    <span>End (UTC)</span>
                    <input
                      aria-describedby={form.errors.end ? 'custom-end-error' : undefined}
                      aria-invalid={form.errors.end ? 'true' : undefined}
                      name="end"
                      onChange={(event) => updateFormValue('end', event.currentTarget.value)}
                      type="datetime-local"
                      value={form.values.end}
                    />
                    {form.errors.end ? (
                      <small id="custom-end-error">{form.errors.end}</small>
                    ) : null}
                  </label>
                  <label>
                    <span>Progress (percent)</span>
                    <input
                      aria-describedby={form.errors.progress ? 'custom-progress-error' : undefined}
                      aria-invalid={form.errors.progress ? 'true' : undefined}
                      max="100"
                      min="0"
                      name="progress"
                      onChange={(event) => updateFormValue('progress', event.currentTarget.value)}
                      step="1"
                      type="number"
                      value={form.values.progress}
                    />
                    {form.errors.progress ? (
                      <small id="custom-progress-error">{form.errors.progress}</small>
                    ) : null}
                  </label>
                  <label>
                    <span>Appearance</span>
                    <select
                      name="appearance"
                      onChange={(event) => updateFormValue('appearance', event.currentTarget.value)}
                      value={form.values.appearance}
                    >
                      <option value="">Default</option>
                      {PLAYGROUND_APPEARANCE_VARIANTS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Current lane</span>
                    <select
                      disabled={openPlacement === undefined}
                      name="laneId"
                      onChange={(event) => updateFormValue('laneId', event.currentTarget.value)}
                      value={form.values.laneId}
                    >
                      {state.document.lanes.map((lane) => (
                        <option key={lane.id} value={lane.id}>
                          {lane.title}
                        </option>
                      ))}
                    </select>
                    {openPlacement === undefined ? (
                      <small>Lane movement requires one persisted placement.</small>
                    ) : null}
                  </label>
                </div>
                {form.error ? (
                  <p className="custom-details__error" role="alert">
                    {form.error}
                  </p>
                ) : null}
                <div className="custom-details__actions">
                  <button type="submit">{form.pending ? 'Saving…' : 'Save changes'}</button>
                  <button onClick={cancelEdit} type="button">
                    Cancel
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            <div className="custom-details__display">
              <p className="custom-details__description">
                {openTask.description ?? 'No description provided.'}
              </p>
              <dl>
                <div>
                  <dt>Start</dt>
                  <dd>
                    {openTask.schedule?.mode === 'instant'
                      ? detailDateFormatter.format(openTask.schedule.start)
                      : 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt>End</dt>
                  <dd>
                    {openTask.schedule?.mode === 'instant'
                      ? detailDateFormatter.format(openTask.schedule.end)
                      : 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>
                    {openTask.progress === undefined
                      ? 'Not set'
                      : `${Math.round(openTask.progress * 100)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Appearance</dt>
                  <dd>{appearanceLabel(openTask.appearance?.variant)}</dd>
                </div>
                <div>
                  <dt>Lane</dt>
                  <dd>{openLane?.title ?? 'No persisted placement'}</dd>
                </div>
                <div>
                  <dt>Kind</dt>
                  <dd>{openTask.kind}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      ) : null}

      <p className="mt-4 mr-0 mb-0 ml-0.5 text-xs text-[#626a76]">
        Activate a task for display mode. Open its task menu by pointer, Context Menu, or Shift+F10
        and choose Edit properties for the application-owned form. Saves, direct manipulation,
        keyboard editing, Undo, and Redo still use the same controlled command path; this page
        intentionally has no persistence debug log.
      </p>
    </div>
  );
}
