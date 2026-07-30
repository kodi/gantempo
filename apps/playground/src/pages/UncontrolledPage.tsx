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
      fields: { owner: 'application-mapper' },
      id: 'task-mapped',
      schedule: {
        end: '2026-08-04T00:00:00Z',
        mode: 'instant',
        start: '2026-07-30T00:00:00Z',
      },
      title: 'Mapped resource task',
    },
    {
      id: 'task-blocked',
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
    <div className="page page--interactive">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Uncontrolled consumer proof</p>
          <h1>Runtime-owned</h1>
          <p>
            A parsed default document and session stay inside one instance. The application still
            observes changes, intercepts commands, maps derived resource gestures, and uses the
            public handle.
          </p>
        </div>
        <div className="page-intro__meta">
          <span>{documentSnapshot.tasks.length} items</span>
          <span>resource view</span>
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

      <div className="chart-frame chart-frame--main chart-frame--interactive">
        <div className="chart-frame__toolbar">
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
          features={{ contextMenu: true, editor: true, tooltip: true }}
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
            setStatus('The imperative handle requested a new controlled time range.');
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
          view={{ kind: 'resource' }}
        />
      </div>

      <p className="page-note">
        The resource view is derived. Cross-resource movement is therefore rejected for the
        policy-locked task with an application diagnostic; the mapped task becomes one explicit
        move-plus-assignment transaction. The parsed all-day record remains in the canonical model
        but does not become an instant task occurrence in M4.
      </p>
    </div>
  );
}
