import { createRef } from 'react';
import { describe, expect, it } from 'vite-plus/test';

import packageMetadata from '../package.json' with { type: 'json' };
import {
  Gantt,
  type GanttClassNames,
  type GanttContextMenuItem,
  type GanttDocument,
  type GanttHandle,
  type GanttInteractionAction,
  type GanttInteractionCommandMappers,
  type GanttInteractionState,
  type GanttLaneColumn,
  type GanttOverlayContainer,
  type GanttProps,
  type GanttSelectorSnapshot,
  type GanttSessionState,
  type GanttSlots,
  type GanttTaskEditRequest,
} from './index';

const document: GanttDocument = {
  assignments: [],
  dependencies: [],
  lanes: [],
  placements: [],
  resources: [],
  schemaVersion: 1,
  tasks: [],
};
const common = {
  range: { end: 1, start: 0 },
  tickAnchor: 0,
  tickInterval: 1,
  timeZone: 'UTC',
} as const;

describe('public React runtime facade', () => {
  it('declares every external React runtime import as a compatible peer', () => {
    expect(packageMetadata.peerDependencies).toEqual({
      react: '^18.3.0 || ^19.0.0',
      'react-dom': '^18.3.0 || ^19.0.0',
    });
  });

  it('exposes controlled and uncontrolled ownership with the narrow handle and selector types', () => {
    const session: GanttSessionState = {
      selection: [],
      viewport: { verticalStart: 0 },
    };
    const controlled = {
      ...common,
      document,
      session,
    } satisfies GanttProps;
    const uncontrolled = {
      ...common,
      defaultDocument: document,
      defaultSession: session,
      interactionMappers: {
        createTask() {
          return {
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'Creation is disabled.',
              severity: 'error',
            },
            status: 'rejected',
          };
        },
      } satisfies GanttInteractionCommandMappers,
      interactionSnap: { anchor: 0, step: 1 },
    } satisfies GanttProps;
    const selector = (snapshot: GanttSelectorSnapshot) => snapshot.occurrences;
    const interaction: GanttInteractionState = { status: 'idle' };
    const action: GanttInteractionAction = 'move';
    const classNames = {
      task: ({ selected }) => (selected ? 'selected' : 'task'),
    } satisfies GanttClassNames;
    const columns = [
      {
        header: 'Lane',
        id: 'lane',
        renderCell: ({ lane }) => lane.title,
      },
    ] satisfies readonly GanttLaneColumn[];
    const items = [
      {
        command: { changes: { title: 'Renamed' }, id: 'task-a', type: 'task.update' },
        id: 'rename',
        label: 'Rename',
      },
    ] satisfies readonly GanttContextMenuItem[];
    const slots = {
      TaskContent: ({ task }) => <span>{task.title}</span>,
    } satisfies GanttSlots;
    const overlayContainer = (() => null) satisfies GanttOverlayContainer;
    const editRequest = {
      source: 'context-menu',
      target: {
        kind: 'task',
        laneViewKey: 'lane-a',
        taskId: 'task-a',
        viewKey: 'task-a',
      },
    } satisfies GanttTaskEditRequest;
    const keyboardInteraction: GanttInteractionState = {
      action,
      announcement: 'Move mode.',
      mode: 'move',
      preview: {
        description: 'Move the task.',
        destination: { kind: 'lane', viewKey: 'lane-a' },
        end: 1,
        height: 1,
        kind: 'move',
        source: {
          kind: 'task',
          laneViewKey: 'lane-a',
          taskId: 'task-a',
          viewKey: 'task-a',
        },
        start: 0,
        width: 1,
        x: 0,
        y: 0,
      },
      status: 'keyboard',
      target: {
        kind: 'task',
        laneViewKey: 'lane-a',
        taskId: 'task-a',
        viewKey: 'task-a',
      },
    };
    const ref = createRef<GanttHandle>();
    const controlledElement = <Gantt {...controlled} ref={ref} />;
    const uncontrolledElement = <Gantt {...uncontrolled} />;

    expect(selector).toBeTypeOf('function');
    expect(interaction.status).toBe('idle');
    expect(keyboardInteraction.status).toBe('keyboard');
    expect(classNames.task).toBeTypeOf('function');
    expect(columns[0]?.id).toBe('lane');
    expect(items[0]?.id).toBe('rename');
    expect(slots.TaskContent).toBeTypeOf('function');
    expect(overlayContainer()).toBeNull();
    expect(editRequest.source).toBe('context-menu');
    expect(controlledElement.type).toBe(Gantt);
    expect(uncontrolledElement.type).toBe(Gantt);
  });

  it('rejects ambiguous or missing document ownership at compile time', () => {
    // @ts-expect-error A chart cannot be controlled and uncontrolled simultaneously.
    const ambiguous: GanttProps = { ...common, defaultDocument: document, document };
    // @ts-expect-error A chart must have exactly one document owner.
    const missing: GanttProps = { ...common };

    expect(ambiguous).toBeDefined();
    expect(missing).toBeDefined();
  });
});
