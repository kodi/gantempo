import { bench, describe } from 'vite-plus/test';

import { resolvePlacementIntervals } from '../layout/resolve-placement-intervals';
import { stackLanes } from '../layout/stack-lanes';
import type { GanttDocument } from '../model/types';
import { resolveView } from '../view/resolve-view';
import type { GanttViewDefinition } from '../view/types';
import { createViewportKernel, type ViewportKernel } from './create-viewport-kernel';
import { queryViewport, queryViewportWithWork } from './query-viewport';
import { queryViewportBruteForce } from './test-oracle';
import type { ViewportQuery } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const GENERATOR_VERSION = 'm3-v1';
const BENCHMARK_SEED = 20_260_738;
const TASK_COUNT = 10_000;
const LANE_COUNT = 2_000;

interface BenchmarkFixture {
  readonly document: GanttDocument;
  readonly distribution: 'dense' | 'sparse';
}

/**
 * A small fixed integer generator keeps benchmark data reproducible without coupling
 * the performance fixture to property-testing internals.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createBenchmarkFixture(distribution: 'dense' | 'sparse'): BenchmarkFixture {
  const random = createRandom(BENCHMARK_SEED);
  const resources = Array.from({ length: LANE_COUNT }, (_, index) => ({
    id: `resource-${index}`,
    title: `Resource ${index}`,
  }));
  const lanes = Array.from({ length: LANE_COUNT }, (_, index) => ({
    id: `lane-${index}`,
    title: `Lane ${index}`,
    ...(index % 11 === 0 ? { height: 64 } : {}),
  }));
  const tasks = Array.from({ length: TASK_COUNT }, (_, index) => {
    const laneIndex = index % LANE_COUNT;
    const start =
      distribution === 'dense'
        ? (laneIndex % 30) * DAY
        : Math.floor(random() * 365) * DAY + Math.floor(random() * DAY);
    const duration = distribution === 'dense' ? 10 * DAY : (1 + Math.floor(random() * 5)) * DAY;
    return {
      id: `task-${index}`,
      title: `Task ${index}`,
      kind: 'task' as const,
      schedule: { mode: 'instant' as const, start, end: start + duration },
      segments: [],
    };
  });
  const assignments = tasks.map((task, index) => ({
    id: `assignment-${index}`,
    taskId: task.id,
    resourceId: resources[index % LANE_COUNT]!.id,
  }));
  const placements = tasks.map((task, index) => ({
    id: `placement-${index}`,
    taskId: task.id,
    laneId: lanes[index % LANE_COUNT]!.id,
    assignmentId: assignments[index]!.id,
  }));
  return Object.freeze({
    distribution,
    document: Object.freeze({
      schemaVersion: 1,
      tasks: Object.freeze(tasks),
      resources: Object.freeze(resources),
      lanes: Object.freeze(lanes),
      assignments: Object.freeze(assignments),
      placements: Object.freeze(placements),
      dependencies: Object.freeze([]),
    }),
  });
}

/**
 * Exercises the complete cold pure-kernel path and fails loudly if the generated
 * canonical fixture cannot resolve under the accepted M3 contract.
 */
function buildBenchmarkKernel(
  fixture: BenchmarkFixture,
  definition: GanttViewDefinition,
): ViewportKernel {
  const topology = resolveView(fixture.document, definition);
  if (topology.status !== 'resolved') {
    throw new Error(`Benchmark view rejected: ${JSON.stringify(topology.diagnostics)}`);
  }
  const intervals = resolvePlacementIntervals(fixture.document, topology.view.placements);
  if (intervals.diagnostics.length > 0) {
    throw new Error(`Benchmark intervals rejected: ${JSON.stringify(intervals.diagnostics)}`);
  }
  return createViewportKernel(stackLanes(topology.view.lanes, intervals.placements));
}

function verticalWindow(kernel: ViewportKernel, startIndex: number, count: number) {
  const first = kernel.lanes[startIndex]!;
  const last = kernel.lanes[Math.min(kernel.lanes.length - 1, startIndex + count - 1)]!;
  return {
    verticalStart: first.y,
    verticalExtent: last.y + last.height - first.y,
  };
}

function assertOracleParity(kernel: ViewportKernel, query: ViewportQuery): void {
  const indexed = queryViewport(kernel, query);
  const bruteForce = queryViewportBruteForce(kernel, query);
  if (JSON.stringify(indexed) !== JSON.stringify(bruteForce)) {
    throw new Error('Indexed viewport benchmark result does not match brute-force output.');
  }
}

const sparseFixture = createBenchmarkFixture('sparse');
const denseFixture = createBenchmarkFixture('dense');
const sparseDocumentKernel = buildBenchmarkKernel(sparseFixture, { kind: 'document' });
const denseResourceKernel = buildBenchmarkKernel(denseFixture, { kind: 'resource' });

const horizontalSparseQuery: ViewportQuery = {
  timeRange: { start: 180 * DAY, end: 190 * DAY },
  verticalStart: 0,
  verticalExtent: sparseDocumentKernel.contentBounds.height,
};
const verticalSparseQuery: ViewportQuery = {
  timeRange: { start: 0, end: 400 * DAY },
  ...verticalWindow(sparseDocumentKernel, 1_000, 8),
};
const diagonalDenseQuery: ViewportQuery = {
  timeRange: { start: 10 * DAY, end: 15 * DAY },
  ...verticalWindow(denseResourceKernel, 1_000, 8),
};

assertOracleParity(sparseDocumentKernel, horizontalSparseQuery);
assertOracleParity(sparseDocumentKernel, verticalSparseQuery);
assertOracleParity(denseResourceKernel, diagonalDenseQuery);

const horizontalObservation = queryViewportWithWork(sparseDocumentKernel, horizontalSparseQuery);
const verticalObservation = queryViewportWithWork(sparseDocumentKernel, verticalSparseQuery);
const diagonalObservation = queryViewportWithWork(denseResourceKernel, diagonalDenseQuery);

describe(`${GENERATOR_VERSION} seed=${BENCHMARK_SEED} tasks=${TASK_COUNT} lanes=${LANE_COUNT}`, () => {
  bench('cold document sparse view-layout-index', () => {
    buildBenchmarkKernel(sparseFixture, { kind: 'document' });
  });

  bench('cold resource sparse view-layout-index', () => {
    buildBenchmarkKernel(sparseFixture, { kind: 'resource' });
  });

  bench('cold document dense view-layout-index', () => {
    buildBenchmarkKernel(denseFixture, { kind: 'document' });
  });

  bench(`warm horizontal sparse visible=${horizontalObservation.result.placements.length} laneWork=${horizontalObservation.work.laneCandidates} intervalWork=${horizontalObservation.work.intervalNodesVisited}`, () => {
    queryViewport(sparseDocumentKernel, horizontalSparseQuery);
  });

  bench(`warm vertical sparse visible=${verticalObservation.result.placements.length} laneWork=${verticalObservation.work.laneCandidates} intervalWork=${verticalObservation.work.intervalNodesVisited}`, () => {
    queryViewport(sparseDocumentKernel, verticalSparseQuery);
  });

  bench(`warm diagonal dense visible=${diagonalObservation.result.placements.length} laneWork=${diagonalObservation.work.laneCandidates} intervalWork=${diagonalObservation.work.intervalNodesVisited}`, () => {
    queryViewport(denseResourceKernel, diagonalDenseQuery);
  });
});
