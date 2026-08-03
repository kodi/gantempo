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
  type GanttTaskTarget,
  type TimeRange,
} from '@gantempo/gantt';
import { useMemo, useReducer, useRef, type ReactElement } from 'react';
import { ExampleApiLog } from '../ExampleApiLog';
import { PLAYGROUND_APPEARANCE_VARIANTS } from '../appearance';
import {
  appendExampleApiWrite,
  createExampleApiWrite,
  type ExampleApiWrite,
} from '../example-persistence';

const DAY = 24 * 60 * 60 * 1000;
const RANGE_START = Date.UTC(2026, 6, 29);
const RANGE_END = Date.UTC(2026, 7, 27);
const LANE_IDS = ['discovery', 'design', 'delivery', 'release'] as const;

const API_DOCUMENT = {
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
  revision: 'example-server-r17',
  schemaVersion: 1,
  tasks: [
    {
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
      id: 'interactive-task-2',
      appearance: { variant: 'neutral' },
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

interface InteractiveState {
  readonly apiLog: readonly ExampleApiWrite[];
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly document: GanttDocument;
  readonly focusedTask?: GanttTaskTarget;
  readonly nextOperation: number;
  readonly nextSerial: number;
  readonly range: TimeRange;
  readonly status: string;
}

function loadApiDocument(): GanttDocument {
  const parsed = parseGanttDocument(API_DOCUMENT);
  if (parsed.document === undefined) {
    throw new Error(
      `The example API document was rejected: ${parsed.diagnostics[0]?.message ?? 'unknown error'}`,
    );
  }
  return parsed.document;
}

function InteractiveTaskContent({ pending, task }: GanttTaskContentProps): ReactElement {
  return (
    <span className="interactive-task-content">
      <i aria-hidden="true" />
      <span>{task.title}</span>
      {pending ? <small>saving</small> : null}
    </span>
  );
}

function InteractiveLaneHeader({ lane }: GanttLaneHeaderProps): ReactElement {
  return (
    <span className="interactive-lane-header">
      <i aria-hidden="true" />
      <span>{lane.title}</span>
    </span>
  );
}

type InteractiveAction =
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
  | { readonly status: string; readonly type: 'status' }
  | { readonly type: 'clear-log' };

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

function interactiveReducer(state: InteractiveState, action: InteractiveAction): InteractiveState {
  switch (action.type) {
    case 'runtime-change': {
      const operationId = `example-operation-${String(state.nextOperation).padStart(3, '0')}`;
      const addedTasks = action.change.patches.filter(
        (patch) => patch.target.collection === 'tasks' && patch.op === 'add',
      ).length;
      const request = createExampleApiWrite(action.change, operationId);
      return {
        ...state,
        apiLog: appendExampleApiWrite(state.apiLog, request),
        document: action.change.document,
        nextOperation: state.nextOperation + 1,
        nextSerial: state.nextSerial + addedTasks,
        status: 'The change was adopted locally and queued for persistence.',
      };
    }
    case 'committed':
      return {
        ...state,
        canRedo: action.canRedo,
        canUndo: action.canUndo,
        status: `${action.event.source.kind === 'history' ? 'History' : 'Command'} committed locally.`,
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
    case 'clear-log':
      return { ...state, apiLog: [] };
  }
}

function createInitialState(): InteractiveState {
  return {
    apiLog: [],
    canRedo: false,
    canUndo: false,
    document: loadApiDocument(),
    nextOperation: 1,
    nextSerial: 4,
    range: { start: RANGE_START, end: RANGE_END },
    status: 'The API-shaped document was parsed and the controlled store is ready.',
  };
}

export function InteractivePage(): ReactElement {
  const [state, dispatch] = useReducer(interactiveReducer, undefined, createInitialState);
  const ganttRef = useRef<GanttHandle>(null);
  const hasTasks = state.document.tasks.length > 0;
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
  };
  const recordRejected = (event: GanttCommandRejectedEvent) => {
    dispatch({
      canRedo: ganttRef.current?.canRedo() ?? false,
      canUndo: ganttRef.current?.canUndo() ?? false,
      event,
      type: 'rejected',
    });
  };

  return (
    <div className="page--interactive mx-auto w-full max-w-[1480px] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[26px] flex items-end justify-between gap-8 max-[900px]:items-start max-[900px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            Controlled consumer proof
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            Interactive
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            One application store adopts runtime candidates immediately while every toolbar,
            pointer, keyboard, menu, editor, and history action uses the chart command bus, and
            every accepted navigation proposal updates its controlled time range.
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

      <section aria-label="Interactive chart controls" className="interactive-controls">
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
            <strong>Interactive delivery plan</strong>
            <span>Parsed API input · Europe/Belgrade</span>
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
            editor: 'interactive-surface-editor',
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
          features={{ contextMenu: true, properties: true, tooltip: true }}
          interactionMappers={interactionMappers}
          interactionSnap={{ anchor: RANGE_START, step: DAY }}
          label="Interactive delivery plan chart"
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
          range={state.range}
          ref={ganttRef}
          slots={{ LaneHeader: InteractiveLaneHeader, TaskContent: InteractiveTaskContent }}
          tickAnchor={RANGE_START}
          tickInterval={7 * DAY}
          timeZone="Europe/Belgrade"
        />
      </div>

      <section aria-labelledby="api-log-title" className="api-log">
        <div className="api-log__header">
          <div>
            <h2 id="api-log-title">Persistence boundary</h2>
            <p>
              The newest ten accepted writes appear as concise row events. Expand any event for
              request metadata and raw JSON; internal proposals, pointer details, lifecycle phases,
              and patches stay out of this primary log.
            </p>
          </div>
          <button
            disabled={state.apiLog.length === 0}
            onClick={() => dispatch({ type: 'clear-log' })}
            type="button"
          >
            Clear log
          </button>
        </div>
        <ExampleApiLog entries={state.apiLog} />
      </section>

      <p className="mt-4 mr-0 mb-0 ml-0.5 text-xs text-[#626a76]">
        Activate a task or lane to inspect its standard properties. Drag task bodies, edges, or the
        progress marker; press P for 1-point progress changes, Shift for 10, and Home/End for
        boundaries. M moves, S/E resizes, N creates, Delete removes, and platform shortcuts
        undo/redo. Every accepted field, direct, keyboard, lane, and task edit appears as the same
        concise persistence request.
      </p>
    </div>
  );
}
