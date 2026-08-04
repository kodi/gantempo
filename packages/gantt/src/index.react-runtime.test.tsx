import { createRef } from 'react';
import { describe, expect, it } from 'vite-plus/test';

import packageMetadata from '../package.json' with { type: 'json' };
import {
  defineGanttTheme,
  Gantt,
  GANTT_BUILT_IN_THEMES,
  type GanttBuiltInTheme,
  type GanttClassNames,
  type GanttContextMenuItem,
  type GanttDocument,
  type GanttDirection,
  type GanttDensity,
  type GanttFormatContext,
  type GanttFormatters,
  type GanttHandle,
  type GanttInteractionAction,
  type GanttInteractionCommandMappers,
  type GanttInteractionState,
  type GanttLaneColumn,
  type GanttMessageDescriptor,
  type GanttMessageKey,
  type GanttMessages,
  type GanttOverlayContainer,
  type GanttProps,
  type GanttSelectorSnapshot,
  type GanttSessionState,
  type GanttSlots,
  type GanttTaskEditRequest,
  type GanttThemeDefinition,
  type GanttThemeToken,
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
      '@tanstack/react-query': '^5.0.0',
      react: '^18.3.0 || ^19.0.0',
      'react-dom': '^18.3.0 || ^19.0.0',
    });
    expect(packageMetadata.peerDependenciesMeta).toEqual({
      '@tanstack/react-query': { optional: true },
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
    const adaptive = {
      defaultDocument: document,
      defaultRange: { end: 14, start: 0 },
      timeScale: { kind: 'adaptive', maxLevel: 'month', minLevel: 'hour' },
      timeZone: 'UTC',
    } satisfies GanttProps;
    const direction: GanttDirection = 'rtl';
    const messageKey: GanttMessageKey = 'dependency.type.finish-to-start';
    const messages = {
      'chart.label': 'Plan projekta',
      [messageKey]: 'Kraj na početak',
    } satisfies GanttMessages;
    const formatContext: GanttFormatContext = {
      direction,
      locale: 'sr-Latn-RS',
      timeZone: 'Europe/Belgrade',
      use: 'tick-major',
    };
    const formatters = {
      dateTime: (value, context) => `${context.use}:${value}`,
      message: (descriptor: GanttMessageDescriptor) => descriptor.defaultMessage,
      number: (value, context) => `${context.direction}:${value}`,
    } satisfies GanttFormatters;
    const localized = {
      ...common,
      defaultDocument: document,
      direction,
      formatters,
      locale: formatContext.locale,
      messages,
      timeZone: formatContext.timeZone,
    } satisfies GanttProps;
    const builtInTheme: GanttBuiltInTheme = 'dark';
    const density: GanttDensity = 'touch';
    const token: GanttThemeToken = 'color.surface';
    const theme = defineGanttTheme({
      id: 'consumer-theme',
      mode: builtInTheme,
      tokens: { [token]: '#101714' },
    }) satisfies GanttThemeDefinition;
    const themed = {
      ...common,
      defaultDocument: document,
      density,
      theme,
      themeRevision: 'host-dark',
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
    const adaptiveElement = <Gantt {...adaptive} />;
    const localizedElement = <Gantt {...localized} />;
    const themedElement = <Gantt {...themed} />;

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
    expect(adaptiveElement.type).toBe(Gantt);
    expect(localizedElement.type).toBe(Gantt);
    expect(themedElement.type).toBe(Gantt);
    expect(GANTT_BUILT_IN_THEMES.dark.mode).toBe('dark');
  });

  it('rejects ambiguous or missing document ownership at compile time', () => {
    // @ts-expect-error A chart cannot be controlled and uncontrolled simultaneously.
    const ambiguous: GanttProps = { ...common, defaultDocument: document, document };
    // @ts-expect-error A chart must have exactly one document owner.
    const missing: GanttProps = { ...common };
    // @ts-expect-error A chart cannot have controlled and uncontrolled ranges simultaneously.
    const ambiguousRange: GanttProps = {
      ...common,
      defaultDocument: document,
      defaultRange: common.range,
    };
    // @ts-expect-error Legacy fixed tick props and a timeScale are exclusive.
    const ambiguousScale: GanttProps = {
      ...common,
      defaultDocument: document,
      timeScale: { kind: 'adaptive' },
    };
    const invalidDirection: GanttProps = {
      ...common,
      defaultDocument: document,
      // @ts-expect-error Direction is explicit and does not accept host-dependent auto mode.
      direction: 'auto',
    };
    const invalidTheme: GanttProps = {
      ...common,
      defaultDocument: document,
      // @ts-expect-error Built-in theme names are a closed union.
      theme: 'sepia',
    };
    const invalidDensity: GanttProps = {
      ...common,
      defaultDocument: document,
      // @ts-expect-error Density names are a closed union.
      density: 'roomy',
    };
    const invalidMessages = {
      // @ts-expect-error The built-in message catalog is a closed key union.
      'consumer.private-message': 'Private',
    } satisfies GanttMessages;

    expect(ambiguous).toBeDefined();
    expect(missing).toBeDefined();
    expect(ambiguousRange).toBeDefined();
    expect(ambiguousScale).toBeDefined();
    expect(invalidDirection).toBeDefined();
    expect(invalidTheme).toBeDefined();
    expect(invalidDensity).toBeDefined();
    expect(invalidMessages).toBeDefined();
  });
});
