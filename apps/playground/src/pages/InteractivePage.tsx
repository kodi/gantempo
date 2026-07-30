import {
  Gantt,
  applyGanttCommand,
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
  type GanttCommand,
  type GanttDocument,
  type GanttHistoryState,
} from '@gantempo/gantt';
import { useMemo, useReducer, type ReactElement } from 'react';

const DAY = 24 * 60 * 60 * 1000;
const RANGE_START = Date.UTC(2026, 6, 29);
const RANGE_END = Date.UTC(2026, 7, 27);
const LANE_IDS = ['discovery', 'design', 'delivery', 'release'] as const;
const TASK_TONES = ['accent', 'success', 'warning', 'neutral'] as const;

const INITIAL_DOCUMENT: GanttDocument = {
  assignments: [],
  dependencies: [],
  lanes: [
    { id: 'discovery', title: 'Discovery' },
    { id: 'design', title: 'Design' },
    { id: 'delivery', title: 'Delivery' },
    { id: 'release', title: 'Release' },
  ],
  placements: [],
  resources: [],
  schemaVersion: 1,
  tasks: [],
};

interface InteractiveState {
  readonly history: GanttHistoryState;
  readonly nextSerial: number;
  readonly status: string;
}

type InteractiveAction =
  | { readonly count: number; readonly type: 'add' }
  | { readonly type: 'clear' }
  | { readonly type: 'redo' }
  | { readonly type: 'remove' }
  | { readonly type: 'undo' };

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

function commitCommand(
  state: InteractiveState,
  command: GanttCommand,
  status: string,
  nextSerial = state.nextSerial,
): InteractiveState {
  const outcome = applyGanttCommand(state.history.document, command);
  if (outcome.status === 'rejected') {
    return {
      ...state,
      status: outcome.diagnostics[0]?.message ?? 'The chart rejected that change.',
    };
  }

  const committed = commitGanttHistory(state.history, outcome);
  if (committed.status === 'rejected') {
    return {
      ...state,
      status: committed.diagnostics[0]?.message ?? 'The history rejected that change.',
    };
  }

  return {
    history: committed.history,
    nextSerial,
    status,
  };
}

function interactiveReducer(state: InteractiveState, action: InteractiveAction): InteractiveState {
  switch (action.type) {
    case 'add':
      return commitCommand(
        state,
        {
          commands: commandsForItems(state.nextSerial, action.count),
          type: 'transaction',
        },
        action.count === 1 ? 'Added one work item.' : `Added ${action.count} work items.`,
        state.nextSerial + action.count,
      );
    case 'remove': {
      const latestTask = state.history.document.tasks.at(-1);
      if (!latestTask) {
        return { ...state, status: 'There are no work items to remove.' };
      }
      return commitCommand(
        state,
        { cascade: true, id: latestTask.id, type: 'task.delete' },
        `Removed ${latestTask.title}.`,
      );
    }
    case 'clear': {
      const tasks = state.history.document.tasks;
      if (tasks.length === 0) {
        return { ...state, status: 'The canvas is already empty.' };
      }
      return commitCommand(
        state,
        {
          commands: tasks.map((task) => ({
            cascade: true,
            id: task.id,
            type: 'task.delete' as const,
          })),
          type: 'transaction',
        },
        `Cleared ${tasks.length} work ${tasks.length === 1 ? 'item' : 'items'}.`,
      );
    }
    case 'undo': {
      const result = undoGanttHistory(state.history);
      return result.status === 'applied'
        ? { ...state, history: result.history, status: 'Undid the latest change.' }
        : {
            ...state,
            status: result.diagnostics[0]?.message ?? 'Undo was rejected.',
          };
    }
    case 'redo': {
      const result = redoGanttHistory(state.history);
      return result.status === 'applied'
        ? { ...state, history: result.history, status: 'Redid the latest change.' }
        : {
            ...state,
            status: result.diagnostics[0]?.message ?? 'Redo was rejected.',
          };
    }
  }
}

function createInitialState(): InteractiveState {
  return {
    history: createGanttHistory(INITIAL_DOCUMENT, 50),
    nextSerial: 1,
    status: 'The canvas is ready. Add a work item to begin.',
  };
}

export function InteractivePage(): ReactElement {
  const [state, dispatch] = useReducer(interactiveReducer, undefined, createInitialState);
  const { document } = state.history;
  const taskVariants = useMemo(
    () =>
      Object.fromEntries(
        document.tasks.map((task, index) => [task.id, TASK_TONES[index % TASK_TONES.length]!]),
      ),
    [document.tasks],
  );
  const hasTasks = document.tasks.length > 0;

  return (
    <div className="page page--interactive">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Controlled consumer proof</p>
          <h1>Interactive</h1>
          <p>
            Build a plan dynamically with the public command and history APIs while the chart
            remains a read-only rendering surface.
          </p>
        </div>
        <div className="page-intro__meta">
          <span>{document.tasks.length} items</span>
          <span>{LANE_IDS.length} lanes</span>
        </div>
      </header>

      <section aria-label="Interactive chart controls" className="interactive-controls">
        <div className="interactive-controls__buttons">
          <button onClick={() => dispatch({ count: 1, type: 'add' })} type="button">
            Add item
          </button>
          <button onClick={() => dispatch({ count: 5, type: 'add' })} type="button">
            Add 5 items
          </button>
          <button disabled={!hasTasks} onClick={() => dispatch({ type: 'remove' })} type="button">
            Remove latest
          </button>
          <button disabled={!hasTasks} onClick={() => dispatch({ type: 'clear' })} type="button">
            Clear
          </button>
          <span aria-hidden="true" className="interactive-controls__separator" />
          <button
            disabled={state.history.past.length === 0}
            onClick={() => dispatch({ type: 'undo' })}
            type="button"
          >
            Undo
          </button>
          <button
            disabled={state.history.future.length === 0}
            onClick={() => dispatch({ type: 'redo' })}
            type="button"
          >
            Redo
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
            <span>29 Jul – 27 Aug · Europe/Belgrade</span>
          </div>
          <div className="interactive-chart-count">
            <strong>{document.tasks.length}</strong>
            <span>scheduled</span>
          </div>
        </div>

        <Gantt
          className="chart-frame__chart"
          document={document}
          label="Interactive delivery plan chart"
          range={{ start: RANGE_START, end: RANGE_END }}
          taskVariants={taskVariants}
          tickAnchor={RANGE_START}
          tickInterval={7 * DAY}
          timeZone="Europe/Belgrade"
        />
      </div>

      <p className="page-note">
        This page proves external controlled updates only. Direct chart manipulation, focus,
        selection, and keyboard interaction belong to the future M4 runtime.
      </p>
    </div>
  );
}
