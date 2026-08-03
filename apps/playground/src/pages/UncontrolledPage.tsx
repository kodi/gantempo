import {
  Gantt,
  parseGanttDocument,
  type GanttCommand,
  type GanttCommandInterceptor,
  type GanttDocument,
  type GanttHandle,
  type GanttInteractionCommandMappers,
  type GanttLaneHeaderProps,
  type GanttTaskContentProps,
  type GanttTaskTarget,
  type JsonObject,
  type TimeRange,
} from '@gantempo/gantt';
import { useMemo, useRef, useState, type ReactElement } from 'react';
import { PLAYGROUND_APPEARANCE_VARIANTS } from '../appearance';
import {
  chartFrameBaseClasses,
  chartFrameElevatedClasses,
  chartFrameThemeClasses,
  chartFrameToolbarClasses,
} from '../chart-frame';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 6, 29);
const END = Date.UTC(2026, 7, 27);

const API_DOCUMENT = {
  assignments: [
    {
      id: 'assignment-mapped',
      resourceId: 'resource-product',
      taskId: 'task-mapped',
    },
    {
      id: 'assignment-blocked',
      resourceId: 'resource-engineering',
      taskId: 'task-blocked',
    },
    {
      id: 'assignment-all-day',
      resourceId: 'resource-product',
      taskId: 'task-all-day',
    },
  ],
  dependencies: [],
  lanes: [],
  placements: [],
  resources: [
    { id: 'resource-product', title: 'Product' },
    { id: 'resource-engineering', title: 'Engineering' },
  ],
  revision: 'example-server-r4',
  schemaVersion: 1,
  tasks: [
    {
      appearance: { variant: 'accent' },
      fields: { owner: 'application-mapper' },
      id: 'task-mapped',
      progress: 0.35,
      schedule: {
        end: '2026-08-04T00:00:00Z',
        mode: 'instant',
        start: '2026-07-30T00:00:00Z',
      },
      title: 'Mapped resource task',
    },
    {
      id: 'task-blocked',
      progress: 0.6,
      schedule: {
        end: '2026-08-10T00:00:00Z',
        mode: 'instant',
        start: '2026-08-05T00:00:00Z',
      },
      title: 'Policy-locked task',
    },
    {
      id: 'task-all-day',
      schedule: {
        endDate: '2026-08-13',
        mode: 'all-day',
        startDate: '2026-08-11',
      },
      title: 'All-day boundary example',
    },
  ],
} satisfies unknown;

function loadApiDocument(): GanttDocument {
  const parsed = parseGanttDocument(API_DOCUMENT);
  if (parsed.document === undefined) {
    throw new Error(
      `The uncontrolled API document was rejected: ${
        parsed.diagnostics[0]?.message ?? 'unknown error'
      }`,
    );
  }
  return parsed.document;
}

const INITIAL_DOCUMENT = loadApiDocument();
const DEFAULT_SESSION = {
  selection: [],
  viewport: { verticalStart: 0 },
} as const;

function UncontrolledTaskContent({ focused, pending, task }: GanttTaskContentProps): ReactElement {
  return (
    <span className="interactive-task-content">
      <i aria-hidden="true" />
      <span>{task.title}</span>
      {pending ? <small>checking</small> : focused ? <small>focused</small> : null}
    </span>
  );
}

function UncontrolledLaneHeader({ lane }: GanttLaneHeaderProps): ReactElement {
  return (
    <span className="interactive-lane-header">
      <i aria-hidden="true" />
      <span>{lane.title}</span>
    </span>
  );
}

function resourceAssignmentCommand(
  document: GanttDocument,
  target: GanttTaskTarget,
  resourceId: string,
): GanttCommand | undefined {
  const assignment = document.assignments.find((candidate) => candidate.id === target.assignmentId);
  if (assignment === undefined) {
    return undefined;
  }
  return {
    type: 'assignment.set',
    value: {
      ...(assignment.allocation === undefined ? {} : { allocation: assignment.allocation }),
      ...(assignment.effort === undefined ? {} : { effort: assignment.effort }),
      ...(assignment.fields === undefined ? {} : { fields: assignment.fields }),
      id: assignment.id,
      resourceId,
      ...(assignment.role === undefined ? {} : { role: assignment.role }),
      taskId: assignment.taskId,
    },
  };
}

export function UncontrolledPage(): ReactElement {
  const ganttRef = useRef<GanttHandle>(null);
  const [documentSnapshot, setDocumentSnapshot] = useState(INITIAL_DOCUMENT);
  const [focusedTask, setFocusedTask] = useState<GanttTaskTarget>();
  const [nextSerial, setNextSerial] = useState(1);
  const [range, setRange] = useState<TimeRange>({ start: START, end: END });
  const [status, setStatus] = useState(
    'The chart owns its parsed default document and default session.',
  );
  const [, renderHistoryCapabilities] = useState(0);
  const interceptors = useMemo<readonly GanttCommandInterceptor[]>(
    () => [
      async (proposal) => {
        await new Promise((resolve) => setTimeout(resolve, 140));
        if (
          proposal.command.type === 'task.update' &&
          proposal.command.changes.title === 'Reject this update'
        ) {
          return {
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'The asynchronous example policy rejected this title.',
              path: '/example/interceptor',
              severity: 'error',
            },
            kind: 'reject',
          };
        }
        if (
          proposal.command.type === 'task.update' &&
          proposal.command.changes.title === 'Replace this update'
        ) {
          return {
            command: {
              changes: { title: 'Replaced by async policy' },
              id: proposal.command.id,
              type: 'task.update',
            },
            kind: 'replace',
          };
        }
        return { kind: 'allow' };
      },
    ],
    [],
  );
  const interactionMappers = useMemo<GanttInteractionCommandMappers>(
    () => ({
      createTask(intent) {
        if (intent.destination.resourceId === undefined) {
          return {
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'Resource-view creation requires a destination resource.',
              path: '/example/create',
              severity: 'error',
            },
            status: 'rejected',
          };
        }
        const taskId = `uncontrolled-created-${nextSerial}`;
        return {
          command: {
            commands: [
              {
                type: 'task.add',
                value: {
                  id: taskId,
                  title: `Created work ${nextSerial}`,
                  schedule: { end: intent.end, mode: 'instant', start: intent.start },
                },
              },
              {
                type: 'assignment.set',
                value: {
                  id: `uncontrolled-assignment-${nextSerial}`,
                  resourceId: intent.destination.resourceId,
                  taskId,
                },
              },
            ],
            type: 'transaction',
          },
          status: 'mapped',
        };
      },
      moveOccurrence(intent) {
        if (intent.source.taskId === 'task-blocked') {
          return {
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'Application policy keeps the locked task on its current resource.',
              path: '/example/move-occurrence',
              severity: 'error',
            },
            status: 'rejected',
          };
        }
        if (intent.destination.resourceId === undefined) {
          return {
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'Resource reassignment requires a destination resource.',
              path: '/example/move-occurrence',
              severity: 'error',
            },
            status: 'rejected',
          };
        }
        const assignment = resourceAssignmentCommand(
          documentSnapshot,
          intent.source,
          intent.destination.resourceId,
        );
        if (assignment === undefined) {
          return {
            diagnostic: {
              code: 'command.missing-target',
              message: 'The application could not find the occurrence assignment.',
              path: '/example/move-occurrence',
              severity: 'error',
            },
            status: 'rejected',
          };
        }
        return {
          command: {
            commands: [
              { delta: intent.delta, id: intent.source.taskId, type: 'task.move' },
              assignment,
            ],
            type: 'transaction',
          },
          status: 'mapped',
        };
      },
    }),
    [documentSnapshot, nextSerial],
  );
  const dispatchCommand = (command: GanttCommand) => {
    void ganttRef.current?.dispatch(command, { source: { kind: 'toolbar' } });
  };
  const task = documentSnapshot.tasks.find((candidate) => candidate.id === 'task-mapped');
  const assignment = documentSnapshot.assignments.find(
    (candidate) => candidate.taskId === 'task-mapped',
  );
  const otherResource =
    assignment?.resourceId === 'resource-product' ? 'resource-engineering' : 'resource-product';
  const canUndo = ganttRef.current?.canUndo() ?? false;
  const canRedo = ganttRef.current?.canRedo() ?? false;

  return (
    <div className="page--interactive mx-auto w-full max-w-[1480px] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[26px] flex items-end justify-between gap-8 max-[900px]:items-start max-[900px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            Uncontrolled consumer proof
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            Runtime-owned
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            A parsed default document and session stay inside one instance. The application still
            observes changes, intercepts commands, maps derived resource gestures, and uses the
            public handle while acknowledging the required controlled time range.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-[#69717e] max-[561px]:flex-wrap">
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            {documentSnapshot.tasks.length} items
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            resource view
          </span>
        </div>
      </header>

      <section aria-label="Runtime-owned chart controls" className="interactive-controls">
        <div className="interactive-controls__buttons">
          <button
            onClick={() => {
              const taskId = `uncontrolled-created-${nextSerial}`;
              dispatchCommand({
                commands: [
                  {
                    type: 'task.add',
                    value: {
                      id: taskId,
                      title: `Created work ${nextSerial}`,
                      schedule: {
                        end: START + (8 + nextSerial) * DAY,
                        mode: 'instant',
                        start: START + (5 + nextSerial) * DAY,
                      },
                    },
                  },
                  {
                    type: 'assignment.set',
                    value: {
                      id: `uncontrolled-assignment-${nextSerial}`,
                      resourceId: 'resource-product',
                      taskId,
                    },
                  },
                ],
                type: 'transaction',
              });
            }}
            type="button"
          >
            Create
          </button>
          <button
            disabled={task === undefined}
            onClick={() => dispatchCommand({ delta: DAY, id: 'task-mapped', type: 'task.move' })}
            type="button"
          >
            Move
          </button>
          <button
            disabled={task?.schedule?.mode !== 'instant'}
            onClick={() => {
              if (task?.schedule?.mode === 'instant') {
                dispatchCommand({
                  edge: 'end',
                  id: task.id,
                  time: task.schedule.end + DAY,
                  type: 'task.resize',
                });
              }
            }}
            type="button"
          >
            Resize
          </button>
          <button
            disabled={assignment === undefined}
            onClick={() => {
              if (assignment !== undefined) {
                dispatchCommand({
                  commands: [
                    { delta: DAY, id: assignment.taskId, type: 'task.move' },
                    {
                      type: 'assignment.set',
                      value: {
                        id: assignment.id,
                        resourceId: otherResource,
                        taskId: assignment.taskId,
                      },
                    },
                  ],
                  type: 'transaction',
                });
              }
            }}
            type="button"
          >
            Reassign
          </button>
          <button
            onClick={() =>
              dispatchCommand({
                changes: { title: 'Edited from toolbar' },
                id: 'task-mapped',
                type: 'task.update',
              })
            }
            type="button"
          >
            Edit
          </button>
          <button
            onClick={() =>
              dispatchCommand({
                changes: { title: 'Allowed by async policy' },
                id: 'task-mapped',
                type: 'task.update',
              })
            }
            type="button"
          >
            Async allow
          </button>
          <button
            onClick={() =>
              dispatchCommand({
                changes: { title: 'Reject this update' },
                id: 'task-mapped',
                type: 'task.update',
              })
            }
            type="button"
          >
            Async reject
          </button>
          <button
            onClick={() =>
              dispatchCommand({
                changes: { title: 'Replace this update' },
                id: 'task-mapped',
                type: 'task.update',
              })
            }
            type="button"
          >
            Async replace
          </button>
          <button
            onClick={() =>
              dispatchCommand({ cascade: true, id: 'task-mapped', type: 'task.delete' })
            }
            type="button"
          >
            Delete
          </button>
          <span aria-hidden="true" className="interactive-controls__separator" />
          <button disabled={!canUndo} onClick={() => void ganttRef.current?.undo()} type="button">
            Undo
          </button>
          <button disabled={!canRedo} onClick={() => void ganttRef.current?.redo()} type="button">
            Redo
          </button>
          <button
            disabled={focusedTask === undefined}
            onClick={() => {
              if (focusedTask !== undefined) {
                ganttRef.current?.focusTask(focusedTask);
                ganttRef.current?.scrollToTask(focusedTask, { align: 'center' });
                setStatus('Imperatively focused and centered the last task target.');
              }
            }}
            type="button"
          >
            Focus + scroll
          </button>
          <button
            onClick={() => ganttRef.current?.scrollToTime(START + 14 * DAY, { align: 'center' })}
            type="button"
          >
            Scroll to time
          </button>
        </div>
        <output aria-live="polite" className="interactive-controls__status">
          {status}
        </output>
      </section>

      <div
        className={`${chartFrameBaseClasses} ${chartFrameElevatedClasses} ${chartFrameThemeClasses.light}`}
        data-theme="light"
      >
        <div className={`${chartFrameToolbarClasses} min-h-[70px]`}>
          <div>
            <strong>Runtime-owned resource plan</strong>
            <span>Async policy · app-mapped resource reassignment</span>
          </div>
          <div className="interactive-chart-count">
            <strong>{documentSnapshot.tasks.length}</strong>
            <span>observed</span>
          </div>
        </div>

        <Gantt
          appearanceVariants={PLAYGROUND_APPEARANCE_VARIANTS}
          classNames={{
            laneHeader: 'interactive-column-cell',
            task: ({ pending }) => (pending ? 'uncontrolled-task--pending' : undefined),
          }}
          columns={[
            { header: 'Resource', id: 'resource', width: 150 },
            {
              header: 'ID',
              id: 'id',
              renderCell: ({ lane }) => <code>{lane.target.resourceId ?? '—'}</code>,
              width: 148,
            },
          ]}
          contextMenuItems={(menuTask) => [
            {
              command: {
                changes: { fields: { reviewed: true } satisfies JsonObject },
                id: menuTask.target.taskId,
                type: 'task.update',
              },
              id: 'reviewed',
              label: 'Mark task reviewed',
            },
          ]}
          defaultDocument={INITIAL_DOCUMENT}
          defaultSession={DEFAULT_SESSION}
          density="touch"
          features={{ contextMenu: true, properties: true, tooltip: true }}
          interactionMappers={interactionMappers}
          interactionSnap={{ anchor: START, step: DAY }}
          interceptors={interceptors}
          label="Runtime-owned resource plan chart"
          onCommandCommitted={(event) => {
            renderHistoryCapabilities((version) => version + 1);
            setStatus(
              `${event.source.kind === 'history' ? 'History' : 'Command'} committed after async policy.`,
            );
          }}
          onCommandRejected={(event) => {
            renderHistoryCapabilities((version) => version + 1);
            setStatus(event.diagnostics[0]?.message ?? 'The command was rejected.');
          }}
          onDocumentChange={(change) => {
            setDocumentSnapshot(change.document);
            const created = change.patches.filter(
              (patch) => patch.op === 'add' && patch.target.collection === 'tasks',
            ).length;
            if (created > 0) {
              setNextSerial((serial) => serial + created);
            }
          }}
          onFocusChange={(focused) => {
            if (focused?.kind === 'task') {
              setFocusedTask(focused);
              setStatus(`Focused ${focused.taskId}.`);
            }
          }}
          onRangeChange={(nextRange) => {
            setRange(nextRange);
            setStatus('The consumer acknowledged a new controlled time range.');
          }}
          onSelectionChange={(selection) =>
            setStatus(
              `${selection.length} task occurrence${selection.length === 1 ? '' : 's'} selected.`,
            )
          }
          range={range}
          ref={ganttRef}
          slots={{ LaneHeader: UncontrolledLaneHeader, TaskContent: UncontrolledTaskContent }}
          tickAnchor={START}
          tickInterval={7 * DAY}
          timeZone="Europe/Belgrade"
          theme="light"
          view={{ kind: 'resource' }}
        />
      </div>

      <p className="mt-4 mr-0 mb-0 ml-0.5 text-xs text-[#626a76]">
        The resource view is derived. Cross-resource movement is therefore rejected for the
        policy-locked task with an application diagnostic; the mapped task becomes one explicit
        move-plus-assignment transaction. Activate either rendered task for runtime-owned
        properties; the derived lane is inspectable but cannot be persisted as a placement. Drag the
        progress marker or press P for keyboard progress through the same async policy and history.
        The parsed all-day record remains canonical but is not coerced into an instant occurrence.
      </p>
    </div>
  );
}
