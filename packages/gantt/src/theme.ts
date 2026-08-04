import type { ChartLayoutMetrics } from './render/primitives';

export type GanttBuiltInTheme = 'dark' | 'high-contrast' | 'light';
export type GanttDensity = 'compact' | 'comfortable' | 'touch';

export type GanttThemeToken =
  | 'color.accent'
  | 'color.border'
  | 'color.empty'
  | 'color.focus'
  | 'color.grid'
  | 'color.onAccent'
  | 'color.surface'
  | 'color.surfaceMuted'
  | 'color.text'
  | 'color.textMuted'
  | 'font.family'
  | 'overlay.zIndex'
  | 'task.border'
  | 'task.fill'
  | 'task.progressFill'
  | 'task.text'
  | 'variant.mutedText'
  | 'variant.neutral'
  | 'variant.success'
  | 'variant.warning';

export interface GanttThemeDefinition {
  readonly id: string;
  readonly mode?: GanttBuiltInTheme;
  readonly tokens: Readonly<Partial<Record<GanttThemeToken, number | string>>>;
}

export type GanttTheme = GanttBuiltInTheme | GanttThemeDefinition;

export type GanttThemeCssProperty =
  | '--gt-color-border'
  | '--gt-color-empty'
  | '--gt-color-focus'
  | '--gt-color-grid'
  | '--gt-color-surface'
  | '--gt-color-surface-muted'
  | '--gt-color-task'
  | '--gt-color-task-text'
  | '--gt-color-text'
  | '--gt-color-text-muted'
  | '--gt-font-family'
  | '--gt-task-border'
  | '--gt-task-fill'
  | '--gt-task-muted-text'
  | '--gt-task-neutral'
  | '--gt-task-progress-fill'
  | '--gt-task-success'
  | '--gt-task-text'
  | '--gt-task-warning'
  | '--gt-z-overlay';

const THEME_TOKEN_PROPERTIES: Readonly<Record<GanttThemeToken, GanttThemeCssProperty>> =
  Object.freeze({
    'color.accent': '--gt-color-task',
    'color.border': '--gt-color-border',
    'color.empty': '--gt-color-empty',
    'color.focus': '--gt-color-focus',
    'color.grid': '--gt-color-grid',
    'color.onAccent': '--gt-color-task-text',
    'color.surface': '--gt-color-surface',
    'color.surfaceMuted': '--gt-color-surface-muted',
    'color.text': '--gt-color-text',
    'color.textMuted': '--gt-color-text-muted',
    'font.family': '--gt-font-family',
    'overlay.zIndex': '--gt-z-overlay',
    'task.border': '--gt-task-border',
    'task.fill': '--gt-task-fill',
    'task.progressFill': '--gt-task-progress-fill',
    'task.text': '--gt-task-text',
    'variant.mutedText': '--gt-task-muted-text',
    'variant.neutral': '--gt-task-neutral',
    'variant.success': '--gt-task-success',
    'variant.warning': '--gt-task-warning',
  });

export type GanttThemeStyle = Readonly<Partial<Record<GanttThemeCssProperty, number | string>>>;

const BUILT_IN_THEME_NAMES = new Set<GanttBuiltInTheme>(['dark', 'high-contrast', 'light']);

function normalizedThemeDefinition(definition: GanttThemeDefinition): GanttThemeDefinition {
  const id = definition.id.trim();
  if (id === '') {
    throw new TypeError('Gantt theme id must be a non-empty string.');
  }
  if (definition.mode !== undefined && !BUILT_IN_THEME_NAMES.has(definition.mode)) {
    throw new TypeError(`Unsupported Gantt theme mode "${String(definition.mode)}".`);
  }

  const tokens: Partial<Record<GanttThemeToken, number | string>> = {};
  for (const [token, value] of Object.entries(definition.tokens)) {
    if (!(token in THEME_TOKEN_PROPERTIES)) {
      throw new TypeError(`Unsupported Gantt theme token "${token}".`);
    }
    if (
      (typeof value === 'string' && value.trim() !== '') ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      tokens[token as GanttThemeToken] = value;
      continue;
    }
    throw new TypeError(
      `Gantt theme token "${token}" must be a non-empty string or finite number.`,
    );
  }

  return Object.freeze({
    id,
    ...(definition.mode === undefined ? {} : { mode: definition.mode }),
    tokens: Object.freeze(tokens),
  });
}

export function defineGanttTheme(definition: GanttThemeDefinition): GanttThemeDefinition {
  return normalizedThemeDefinition(definition);
}

const LIGHT_THEME = defineGanttTheme({
  id: 'light',
  mode: 'light',
  tokens: {
    'color.accent': '#27806a',
    'color.border': '#dfe4df',
    'color.empty': '#778078',
    'color.focus': '#005fcc',
    'color.grid': '#e9ede9',
    'color.onAccent': '#fff',
    'color.surface': '#fbfcfa',
    'color.surfaceMuted': '#f5f7f4',
    'color.text': '#26352f',
    'color.textMuted': '#69736c',
    'font.family': 'inherit',
    'overlay.zIndex': 1000,
    'task.border': 'color-mix(in srgb, var(--gt-color-task) 82%, black)',
    'task.fill': 'var(--gt-color-task)',
    'task.progressFill': 'color-mix(in srgb, var(--gt-color-task) 72%, black)',
    'task.text': 'var(--gt-color-task-text)',
    'variant.mutedText': '#18352f',
    'variant.neutral': '#dde3e4',
    'variant.success': '#bfe6c4',
    'variant.warning': '#f0d7a5',
  },
});

const DARK_THEME = defineGanttTheme({
  id: 'dark',
  mode: 'dark',
  tokens: {
    ...LIGHT_THEME.tokens,
    'color.accent': '#79cdb5',
    'color.border': '#34423e',
    'color.empty': '#99a7a2',
    'color.focus': '#8bbcff',
    'color.grid': '#2a3733',
    'color.onAccent': '#11251f',
    'color.surface': '#18211f',
    'color.surfaceMuted': '#18211f',
    'color.text': '#edf3f0',
    'color.textMuted': '#99a7a2',
    'variant.mutedText': '#edf3f0',
    'variant.neutral': '#465451',
    'variant.success': '#346d50',
    'variant.warning': '#735e35',
  },
});

const HIGH_CONTRAST_THEME = defineGanttTheme({
  id: 'high-contrast',
  mode: 'high-contrast',
  tokens: {
    ...LIGHT_THEME.tokens,
    'color.accent': '#005fcc',
    'color.border': '#111',
    'color.empty': '#111',
    'color.grid': '#444',
    'color.onAccent': '#fff',
    'color.surface': '#fff',
    'color.surfaceMuted': '#fff',
    'color.text': '#000',
    'color.textMuted': '#111',
    'variant.mutedText': '#000',
    'variant.neutral': '#ddd',
    'variant.success': '#48a867',
    'variant.warning': '#ffe100',
  },
});

export const GANTT_BUILT_IN_THEMES: Readonly<Record<GanttBuiltInTheme, GanttThemeDefinition>> =
  Object.freeze({
    dark: DARK_THEME,
    'high-contrast': HIGH_CONTRAST_THEME,
    light: LIGHT_THEME,
  });

export const GANTT_DENSITY_METRICS: Readonly<Record<GanttDensity, ChartLayoutMetrics>> =
  Object.freeze({
    compact: Object.freeze({
      barHeight: 20,
      headerHeight: 34,
      labelPadding: 6,
      laneColumnWidth: 160,
      lanePaddingBottom: 9,
      lanePaddingTop: 9,
      rowHeight: 38,
      stackGap: 4,
    }),
    comfortable: Object.freeze({
      barHeight: 24,
      headerHeight: 40,
      labelPadding: 8,
      laneColumnWidth: 160,
      lanePaddingBottom: 17,
      lanePaddingTop: 17,
      rowHeight: 58,
      stackGap: 6,
    }),
    touch: Object.freeze({
      barHeight: 32,
      headerHeight: 48,
      labelPadding: 10,
      laneColumnWidth: 160,
      lanePaddingBottom: 21,
      lanePaddingTop: 21,
      rowHeight: 74,
      stackGap: 8,
    }),
  });

export interface ResolvedGanttTheme {
  readonly id: string;
  readonly mode: GanttBuiltInTheme;
  readonly signature: string;
  readonly style: GanttThemeStyle;
}

export function resolveGanttDensity(density: GanttDensity | undefined): GanttDensity {
  return density ?? 'comfortable';
}

export function resolveGanttTheme(theme: GanttTheme | undefined): ResolvedGanttTheme {
  const custom = typeof theme === 'object';
  const definition = custom
    ? normalizedThemeDefinition(theme)
    : GANTT_BUILT_IN_THEMES[theme ?? 'light'];
  const mode = definition.mode ?? 'light';
  const style: Partial<Record<GanttThemeCssProperty, number | string>> = {};
  if (custom) {
    for (const [token, value] of Object.entries(definition.tokens)) {
      style[THEME_TOKEN_PROPERTIES[token as GanttThemeToken]] = value;
    }
  }
  return Object.freeze({
    id: definition.id,
    mode,
    signature: JSON.stringify([definition.id, mode, definition.tokens]),
    style: Object.freeze(style),
  });
}
