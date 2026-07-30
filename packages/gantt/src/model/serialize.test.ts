import { describe, expect, it } from 'vite-plus/test';

import { parseGanttDocument } from './codec';
import { serializeGanttDocument } from './serialize';
import type { GanttDocument } from './types';

function emptyDocument(): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: [],
  };
}

describe('serializeGanttDocument', () => {
  it('emits deterministic current-schema empty JSON in fixed root order', () => {
    expect(serializeGanttDocument(emptyDocument())).toBe(
      '{"schemaVersion":1,"tasks":[],"resources":[],"lanes":[],"assignments":[],"placements":[],"dependencies":[]}',
    );
  });

  it('keeps known record fields in contract order and omits absent values', () => {
    const document: GanttDocument = {
      ...emptyDocument(),
      revision: -1,
      tasks: [
        {
          appearance: { variant: 'customer:blocked' },
          description: 'Details',
          fields: { custom: true },
          id: 'task-a',
          kind: 'task',
          progress: 0,
          schedule: { end: 0, mode: 'instant', start: -1 },
          segments: [],
          title: 'Task A',
        },
      ],
    };

    expect(serializeGanttDocument(document)).toContain(
      '"revision":-1,"tasks":[{"id":"task-a","title":"Task A","description":"Details","kind":"task","appearance":{"variant":"customer:blocked"},"schedule":{"mode":"instant","start":-1,"end":0},"progress":0,"segments":[],"fields":{"custom":true}}]',
    );
    expect(serializeGanttDocument(document)).not.toContain('undefined');
  });

  it('defensively rejects non-canonical semantic appearance', () => {
    const document = {
      ...emptyDocument(),
      tasks: [
        {
          appearance: { variant: ' not-trimmed ' },
          id: 'task-a',
          kind: 'task',
          segments: [],
          title: 'Task A',
        },
      ],
    } as GanttDocument;

    expect(() => serializeGanttDocument(document)).toThrow(/semantic appearance variant/);
  });

  it('sorts nested extension keys lexically without changing array order', () => {
    const first = parseGanttDocument({
      schemaVersion: 1,
      metadata: {
        z: 1,
        '2': 'two',
        '10': 'ten',
        nested: { beta: true, alpha: false },
        values: [{ z: 2, a: 1 }, 'é', '日本語'],
      },
    }).document!;
    const second = parseGanttDocument({
      metadata: {
        values: [{ a: 1, z: 2 }, 'é', '日本語'],
        nested: { alpha: false, beta: true },
        '10': 'ten',
        '2': 'two',
        z: 1,
      },
      schemaVersion: 1,
    }).document!;

    const firstJson = serializeGanttDocument(first);
    const secondJson = serializeGanttDocument(second);

    expect(firstJson).toBe(secondJson);
    expect(firstJson).toContain(
      '"metadata":{"10":"ten","2":"two","nested":{"alpha":false,"beta":true},"values":[{"a":1,"z":2},"é","日本語"],"z":1}',
    );
  });

  it('preserves domain array order rather than sorting records', () => {
    const document: GanttDocument = {
      ...emptyDocument(),
      resources: [
        { id: 'resource-z', title: 'Z' },
        { id: 'resource-a', title: 'A' },
      ],
      tasks: [
        { id: 'task-z', kind: 'task', segments: [], title: 'Z' },
        { id: 'task-a', kind: 'task', segments: [], title: 'A' },
      ],
    };
    const serialized = serializeGanttDocument(document);

    expect(serialized.indexOf('"task-z"')).toBeLessThan(serialized.indexOf('"task-a"'));
    expect(serialized.indexOf('"resource-z"')).toBeLessThan(serialized.indexOf('"resource-a"'));
  });

  it.each([
    {
      name: 'non-finite number',
      value: { bad: Number.NaN },
    },
    {
      name: 'undefined',
      value: { bad: undefined },
    },
    {
      name: 'class instance',
      value: { bad: new Date(0) },
    },
  ])('defensively rejects unchecked extension $name values', ({ value }) => {
    const document = {
      ...emptyDocument(),
      metadata: value,
    } as unknown as GanttDocument;

    expect(() => serializeGanttDocument(document)).toThrow(TypeError);
  });

  it('rejects cycles and sparse arrays defensively', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const sparse = Array.from({ length: 2 });
    sparse[1] = 'second';

    expect(() =>
      serializeGanttDocument({
        ...emptyDocument(),
        metadata: cycle,
      } as unknown as GanttDocument),
    ).toThrow(/cyclic/);
    expect(() =>
      serializeGanttDocument({
        ...emptyDocument(),
        metadata: { sparse },
      } as unknown as GanttDocument),
    ).toThrow(/sparse/);
  });
});
