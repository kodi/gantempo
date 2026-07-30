import type { LaidOutPlacement } from '../layout/stack-lanes';
import type { TimeRange } from '../model/types';

interface IntervalIndexEntry {
  readonly placement: LaidOutPlacement;
  readonly sourceIndex: number;
}

interface IntervalIndexNode extends IntervalIndexEntry {
  readonly maxEnd: number;
  readonly left?: IntervalIndexNode;
  readonly right?: IntervalIndexNode;
}

export interface IntervalIndex {
  readonly root?: IntervalIndexNode;
}

export interface IntervalIndexQueryResult {
  readonly placements: readonly LaidOutPlacement[];
  readonly nodesVisited: number;
}

function compareEntries(left: IntervalIndexEntry, right: IntervalIndexEntry): number {
  return (
    left.placement.start - right.placement.start ||
    left.placement.end - right.placement.end ||
    left.placement.sourceOrder - right.placement.sourceOrder ||
    left.placement.key.localeCompare(right.placement.key)
  );
}

function buildNode(entries: readonly IntervalIndexEntry[]): IntervalIndexNode | undefined {
  if (entries.length === 0) {
    return undefined;
  }
  const middle = Math.floor(entries.length / 2);
  const entry = entries[middle]!;
  const left = buildNode(entries.slice(0, middle));
  const right = buildNode(entries.slice(middle + 1));
  return Object.freeze({
    ...entry,
    maxEnd: Math.max(entry.placement.end, left?.maxEnd ?? -Infinity, right?.maxEnd ?? -Infinity),
    ...(left === undefined ? {} : { left }),
    ...(right === undefined ? {} : { right }),
  });
}

export function createIntervalIndex(placements: readonly LaidOutPlacement[]): IntervalIndex {
  const entries = placements
    .map((placement, sourceIndex) => ({ placement, sourceIndex }))
    .sort(compareEntries);
  const root = buildNode(entries);
  return Object.freeze(root === undefined ? {} : { root });
}

/**
 * Prunes subtrees by maximum end and sorted starts while retaining every interval
 * that intersects the half-open query, including long intervals that start earlier.
 */
export function queryIntervalIndex(
  index: IntervalIndex,
  range: TimeRange,
): IntervalIndexQueryResult {
  const matches: IntervalIndexEntry[] = [];
  let nodesVisited = 0;

  function visit(node: IntervalIndexNode | undefined): void {
    if (!node) {
      return;
    }
    nodesVisited += 1;
    if (node.left && node.left.maxEnd > range.start) {
      visit(node.left);
    }
    if (node.placement.start < range.end && node.placement.end > range.start) {
      matches.push(node);
    }
    if (node.placement.start < range.end) {
      visit(node.right);
    }
  }

  visit(index.root);
  matches.sort((left, right) => left.sourceIndex - right.sourceIndex);
  return Object.freeze({
    placements: Object.freeze(matches.map((match) => match.placement)),
    nodesVisited,
  });
}
