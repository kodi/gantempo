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

  it('keeps ordered project identity stable across task-array permutations and filters', () => {
    const nodes = fc.array(fc.record({ parentSeed: fc.nat(), permutation: fc.integer() }), {
      maxLength: 80,
      minLength: 1,
    });

    fc.assert(
      fc.property(nodes, fc.integer({ max: 9, min: 2 }), (generated, divisor) => {
        const parentIds = new Set<string>();
        const logical = generated.map((node, index) => {
          const parentIndex = index === 0 ? index : node.parentSeed % (index + 1);
          const parentId = parentIndex === index ? undefined : `task-${parentIndex}`;
          if (parentId !== undefined) {
            parentIds.add(parentId);
          }
          return {
            id: `task-${index}`,
            kind: 'task' as const,
            order: index,
            ...(parentId === undefined ? {} : { parentId }),
            segments: [],
            title: `Task ${index}`,
          };
        });
        const tasks = logical.map((task) => ({
          ...task,
          kind: parentIds.has(task.id) ? ('summary' as const) : ('task' as const),
        }));
        const permuted = tasks
          .map((task, index) => ({ ...task, permutation: generated[index]!.permutation }))
          .sort(
            (left, right) =>
              left.permutation - right.permutation || left.id.localeCompare(right.id),
          )
          .map(({ permutation: _permutation, ...task }) => task);
        const document = (taskRecords: GanttDocument['tasks']): GanttDocument => ({
          assignments: [],
          dependencies: [],
          lanes: [],
          placements: [],
          resources: [],
          schemaVersion: 1,
          tasks: taskRecords,
        });
        const filter = (task: GanttDocument['tasks'][number]) =>
          task.kind === 'task' && Number(task.id.slice(5)) % divisor === 0;
        const query = { collapsedTaskIds: [...parentIds] };

        const first = resolveView(document(tasks), { filter, kind: 'project' }, { project: query });
        const second = resolveView(
          document(permuted),
          { filter, kind: 'project' },
          { project: query },
        );
        expect(first.status).toBe('resolved');
        expect(second.status).toBe('resolved');
        if (first.status !== 'resolved' || second.status !== 'resolved') {
          return;
        }
        expect(first.view.lanes.map((lane) => lane.source)).toEqual(
          second.view.lanes.map((lane) => lane.source),
        );
        expect(first.view.lanes.map((lane) => lane.project)).toEqual(
          second.view.lanes.map((lane) => lane.project),
        );
        expect(first.view.lanes.map((lane) => lane.key)).toEqual(
          second.view.lanes.map((lane) => lane.key),
        );
        expect(first.view.placements.map((placement) => placement.key)).toEqual(
          second.view.placements.map((placement) => placement.key),
        );
      }),
      { endOnFailure: true, numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });
});
