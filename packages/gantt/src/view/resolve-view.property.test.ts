import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { resolveView } from './resolve-view';
import type { GanttViewDefinition } from './types';

const PROPERTY_SEED = 20_260_734;
const PROPERTY_RUNS = 150;

describe('view resolution properties', () => {
  it('is deterministic, immutable, and emits only valid resolved lane references', () => {
    const titles = fc.array(fc.string({ maxLength: 20 }), { maxLength: 20 });

    fc.assert(
      fc.property(
        titles,
        fc.constantFrom<GanttViewDefinition['kind']>('document', 'project', 'resource', 'custom'),
        (generatedTitles, kind) => {
          const tasks = generatedTitles.map((title, index) => ({
            id: `task-${index}`,
            title,
            kind: 'task' as const,
            segments: [],
          }));
          const resources = generatedTitles.map((title, index) => ({
            id: `resource-${index}`,
            title,
          }));
          const lanes = generatedTitles.map((title, index) => ({
            id: `lane-${index}`,
            title,
          }));
          const assignments = generatedTitles.map((_, index) => ({
            id: `assignment-${index}`,
            taskId: `task-${index}`,
            resourceId: `resource-${index}`,
          }));
          const placements = generatedTitles.map((_, index) => ({
            id: `placement-${index}`,
            taskId: `task-${index}`,
            laneId: `lane-${index}`,
          }));
          const document: GanttDocument = {
            schemaVersion: 1,
            tasks,
            resources,
            lanes,
            assignments,
            placements,
            dependencies: [],
          };
          const definition: GanttViewDefinition =
            kind === 'custom'
              ? {
                  kind,
                  id: 'generated',
                  lanes: lanes.map((lane) => ({ key: lane.id, title: lane.title })),
                  placements: placements.map((placement) => ({
                    key: placement.id,
                    laneKey: placement.laneId,
                    taskId: placement.taskId,
                  })),
                }
              : { kind };
          const documentSnapshot = structuredClone(document);
          const definitionSnapshot = structuredClone(definition);

          const first = resolveView(document, definition);
          const second = resolveView(document, definition);

          expect(first).toEqual(second);
          expect(document).toEqual(documentSnapshot);
          expect(definition).toEqual(definitionSnapshot);
          expect(first.status).toBe('resolved');
          if (first.status !== 'resolved') {
            return;
          }
          const resolvedLaneKeys = new Set(first.view.lanes.map((lane) => lane.key));
          expect(
            first.view.placements.every((placement) => resolvedLaneKeys.has(placement.laneKey)),
          ).toBe(true);
          expect(Object.isFrozen(first.view.lanes)).toBe(true);
          expect(Object.isFrozen(first.view.placements)).toBe(true);
        },
      ),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});
