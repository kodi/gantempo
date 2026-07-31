import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import {
  cloneInteractionTarget,
  interactionTargetIdentity,
  normalizeSessionState,
  reconcileSessionDocument,
} from './session';

const dependency = Object.freeze({ dependencyId: 'a-b', kind: 'dependency' as const });
const document: GanttDocument = {
  assignments: [],
  dependencies: [{ fromTaskId: 'a', id: 'a-b', toTaskId: 'b', type: 'finish-to-start' }],
  lanes: [],
  placements: [],
  resources: [],
  schemaVersion: 1,
  tasks: [
    { id: 'a', kind: 'task', segments: [], title: 'A' },
    { id: 'b', kind: 'task', segments: [], title: 'B' },
  ],
};

describe('dependency session targets', () => {
  it('normalizes immutable occurrence-independent identity', () => {
    const target = cloneInteractionTarget(dependency);
    expect(target).toEqual(dependency);
    expect(Object.isFrozen(target)).toBe(true);
    expect(interactionTargetIdentity(target)).toBe('dependency\u0000a-b');
    expect(
      normalizeSessionState({ focused: dependency, selection: [dependency, dependency] }),
    ).toMatchObject({ focused: dependency, selection: [dependency] });
  });

  it('retains a valid dependency and removes it atomically after document deletion', () => {
    const session = normalizeSessionState({ focused: dependency, selection: [dependency] });
    expect(reconcileSessionDocument(session, document)).toBe(session);
    expect(reconcileSessionDocument(session, { ...document, dependencies: [] })).toEqual({
      selection: [],
      viewport: { verticalStart: 0 },
    });
  });

  it('rejects malformed dependency targets', () => {
    expect(() =>
      normalizeSessionState({
        selection: [{ dependencyId: '', kind: 'dependency' }],
      }),
    ).toThrow('dependencyId must be a non-empty string');
  });
});
