import { bench, describe } from 'vite-plus/test';

import { parseGanttDocument } from './codec';

const GENERATOR_VERSION = 'codec-v1';
const BENCHMARK_SEED = 20_260_730;

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createFixture(taskCount: number, laneCount: number, malformed: boolean): unknown {
  const random = createRandom(BENCHMARK_SEED);
  const tasks = Array.from({ length: taskCount }, (_, index) => {
    const start = Math.floor(random() * 365 * 86_400_000);
    return {
      id: `task-${index}`,
      title: `Task ${index}`,
      schedule: { mode: 'instant', start, end: start + 86_400_000 },
      progress: (index % 101) / 100,
      fields: { priority: index % 5, source: 'codec-benchmark' },
      ...(malformed && index % 997 === 0 ? { progress: 2 } : {}),
    };
  });
  const lanes = Array.from({ length: laneCount }, (_, index) => ({
    id: `lane-${index}`,
    title: `Lane ${index}`,
    ...(index % 11 === 0 ? { height: 64 } : {}),
  }));
  const placements = tasks.map((task, index) => ({
    id: `placement-${index}`,
    taskId: task.id,
    laneId: lanes[index % laneCount]!.id,
  }));
  return {
    schemaVersion: 1,
    revision: 'codec-v1',
    tasks,
    lanes,
    placements,
    metadata: { generator: GENERATOR_VERSION, seed: BENCHMARK_SEED },
  };
}

const cases = [
  ['ordinary-valid', createFixture(50, 10, false)],
  ['medium-valid', createFixture(2_000, 400, false)],
  ['large-valid', createFixture(10_000, 2_000, false)],
  ['large-bounded-malformed', createFixture(10_000, 2_000, true)],
] as const;

for (const [name, fixture] of cases) {
  const bytes = JSON.stringify(fixture).length;
  const result = parseGanttDocument(fixture);
  if (result.document === undefined) {
    throw new Error(`Codec benchmark fixture "${name}" was document-fatal.`);
  }

  describe(`${GENERATOR_VERSION} seed=${BENCHMARK_SEED} case=${name} bytes=${bytes} diagnostics=${result.diagnostics.length}`, () => {
    bench(name, () => {
      parseGanttDocument(fixture);
    });
  });
}
