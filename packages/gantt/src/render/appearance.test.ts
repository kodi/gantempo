import { describe, expect, it } from 'vite-plus/test';

import {
  createAppearanceRegistry,
  resolveLaneAppearance,
  resolveTaskAppearance,
} from './appearance';

describe('semantic appearance resolution', () => {
  const registry = createAppearanceRegistry([
    {
      id: 'lane-blue',
      label: 'Lane blue',
      tokens: { 'lane.accent': '#2563eb', 'task.fill': '#dbeafe' },
    },
    {
      id: 'blocked',
      label: 'Blocked',
      tokens: { 'task.fill': '#991b1b', 'task.progressFill': '#450a0a' },
    },
  ]);

  it('applies default, lane, legacy fallback, and task precedence', () => {
    expect(resolveTaskAppearance(registry, {})).toMatchObject({
      resolution: 'default',
      source: 'default',
    });
    expect(resolveTaskAppearance(registry, { laneVariant: 'lane-blue' })).toMatchObject({
      resolution: 'resolved',
      source: 'lane',
      variant: 'lane-blue',
    });
    expect(
      resolveTaskAppearance(registry, {
        laneVariant: 'lane-blue',
        legacyTaskVariant: 'legacy-css-hook',
      }),
    ).toMatchObject({
      resolution: 'legacy',
      source: 'legacy-task',
      variant: 'legacy-css-hook',
    });
    expect(
      resolveTaskAppearance(registry, {
        laneVariant: 'lane-blue',
        legacyTaskVariant: 'legacy-css-hook',
        taskVariant: 'blocked',
      }),
    ).toMatchObject({
      resolution: 'resolved',
      source: 'task',
      variant: 'blocked',
    });
  });

  it('retains unknown canonical IDs with deterministic empty-token fallback', () => {
    expect(resolveLaneAppearance(registry, 'customer:unknown')).toEqual({
      resolution: 'unresolved',
      source: 'lane',
      tokens: {},
      variant: 'customer:unknown',
    });
    expect(Object.isFrozen(resolveLaneAppearance(registry, 'customer:unknown'))).toBe(true);
  });
});
