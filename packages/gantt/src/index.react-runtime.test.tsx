import { createRef } from 'react';
import { describe, expect, it } from 'vite-plus/test';

import {
  Gantt,
  type GanttDocument,
  type GanttHandle,
  type GanttProps,
  type GanttSelectorSnapshot,
  type GanttSessionState,
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
    } satisfies GanttProps;
    const selector = (snapshot: GanttSelectorSnapshot) => snapshot.occurrences;
    const ref = createRef<GanttHandle>();
    const controlledElement = <Gantt {...controlled} ref={ref} />;
    const uncontrolledElement = <Gantt {...uncontrolled} />;

    expect(selector).toBeTypeOf('function');
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
