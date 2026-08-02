import { describe, expect, it } from 'vite-plus/test';

import {
  createAppearanceRegistry,
  GANTT_DEFAULT_APPEARANCE_VARIANTS,
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

  it('registers portable defaults and merges same-ID application overrides', () => {
    const defaults = createAppearanceRegistry(undefined);
    expect([...defaults.byId.keys()]).toEqual(['accent', 'neutral', 'success', 'warning']);
    expect(GANTT_DEFAULT_APPEARANCE_VARIANTS).toHaveLength(4);
    expect(resolveTaskAppearance(defaults, { taskVariant: 'warning' })).toMatchObject({
      resolution: 'resolved',
      tokens: {
        'task.fill': 'var(--gt-task-warning, #f0d7a5)',
        'task.text': 'var(--gt-task-muted-text, #18352f)',
      },
      variant: 'warning',
    });

    const overridden = createAppearanceRegistry([
      { id: 'warning', label: 'Needs attention', tokens: { 'task.fill': '#fb7185' } },
      { id: 'customer:review', label: 'Customer review', tokens: { 'task.fill': '#60a5fa' } },
    ]);
    expect(overridden.byId.get('warning')).toEqual({
      id: 'warning',
      label: 'Needs attention',
      tokens: {
        ...defaults.byId.get('warning')?.tokens,
        'task.fill': '#fb7185',
      },
    });
    expect(overridden.byId.get('customer:review')?.label).toBe('Customer review');
  });
});
