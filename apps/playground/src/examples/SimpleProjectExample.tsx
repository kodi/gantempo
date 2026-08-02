import {
  Gantt,
  type GanttAppearanceVariantOption,
  type GanttDocument,
  type GanttDocumentChange,
  type GanttHandle,
} from '@gantempo/gantt';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { loadProjectPlan, saveProjectPlan } from './simple-project-api';
import './simple-project-example.css';

const DAY = 24 * 60 * 60 * 1_000;
const INITIAL_RANGE = Object.freeze({
  start: Date.UTC(2026, 6, 1),
  end: Date.UTC(2026, 8, 8),
});
const FEATURES = Object.freeze({ contextMenu: true, properties: true, tooltip: true });
const INTERACTION_SNAP = Object.freeze({ anchor: INITIAL_RANGE.start, step: DAY });
const TIME_SCALE = Object.freeze({
  kind: 'adaptive' as const,
  maxLevel: 'month' as const,
  minLevel: 'day' as const,
});
const PROJECT_VIEW = Object.freeze({ kind: 'project' as const });

const APPEARANCE_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'planning',
    label: 'Planning',
    tokens: Object.freeze({
      'lane.accent': '#7c3aed',
      'task.fill': '#8b5cf6',
      'task.progressFill': '#5b21b6',
      'task.text': '#ffffff',
    }),
  }),
  Object.freeze({
    id: 'delivery',
    label: 'Delivery',
    tokens: Object.freeze({
      'lane.accent': '#0f766e',
      'task.fill': '#14b8a6',
      'task.progressFill': '#115e59',
      'task.text': '#042f2e',
    }),
  }),
  Object.freeze({
    id: 'risk',
    label: 'At risk',
    tokens: Object.freeze({
      'lane.accent': '#b45309',
      'task.fill': '#f59e0b',
      'task.progressFill': '#92400e',
      'task.text': '#111827',
    }),
  }),
  Object.freeze({
    id: 'checkpoint',
    label: 'Checkpoint',
    tokens: Object.freeze({
      'lane.accent': '#047857',
      'task.fill': '#34d399',
      'task.progressFill': '#047857',
      'task.text': '#1f2937',
    }),
  }),
]) satisfies readonly GanttAppearanceVariantOption[];

type LoadState =
  | { readonly status: 'loading' }
  | { readonly message: string; readonly status: 'error' }
  | { readonly status: 'ready' };

type SaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'saving' }
  | { readonly message: string; readonly status: 'error' }
  | { readonly bytes: number; readonly savedAt: string; readonly status: 'saved' };

function saveStatusMessage(state: SaveState, dirty: boolean): string {
  if (state.status === 'saving') return 'Saving the current document…';
  if (state.status === 'error') return `Save failed: ${state.message}`;
  if (dirty) return 'Unsaved local changes';
  if (state.status === 'saved') {
    return `Saved ${state.bytes.toLocaleString('en-US')} bytes to the in-memory API mock.`;
  }
  return 'Loaded from the static API fixture';
}

export function SimpleProjectExample(): ReactElement {
  const gantt = useRef<GanttHandle>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [document, setDocument] = useState<GanttDocument>();
  const [dirty, setDirty] = useState(false);
  const editVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: 'loading' });

    void loadProjectPlan(controller.signal).then(
      (loadedDocument) => {
        setDocument(loadedDocument);
        setDirty(false);
        setSaveState({ status: 'idle' });
        editVersion.current = 0;
        setLoadState({ status: 'ready' });
      },
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadState({
          message: error instanceof Error ? error.message : 'Unknown loading error',
          status: 'error',
        });
      },
    );

    return () => controller.abort();
  }, [loadAttempt]);

  function acceptChange(change: GanttDocumentChange): void {
    editVersion.current += 1;
    setDocument(change.document);
    setDirty(true);
    setSaveState({ status: 'idle' });
  }

  async function saveDraft(): Promise<void> {
    if (document === undefined || !dirty || saveState.status === 'saving') return;
    const savedVersion = editVersion.current;
    setSaveState({ status: 'saving' });

    try {
      const receipt = await saveProjectPlan(document);
      if (editVersion.current === savedVersion) setDirty(false);
      setSaveState({ ...receipt, status: 'saved' });
    } catch (error) {
      setSaveState({
        message: error instanceof Error ? error.message : 'Unknown saving error',
        status: 'error',
      });
    }
  }

  function advanceApiStep(): void {
    const task = document?.tasks.find((candidate) => candidate.id === 'api-integration');
    if (task === undefined) return;
    void gantt.current?.dispatch(
      {
        changes: { progress: Math.min(1, (task.progress ?? 0) + 0.1) },
        id: task.id,
        type: 'task.update',
      },
      { source: { kind: 'toolbar' } },
    );
  }

  if (loadState.status === 'loading') {
    return (
      <section
        aria-busy="true"
        aria-label="Simple project example"
        className="simple-project-example"
      >
        <div className="simple-project-example__state">
          <div>
            <span aria-hidden="true" className="simple-project-example__loader" />
            <h3>Loading the project API</h3>
            <p>Fetching and validating a schema-version-1 planning document.</p>
          </div>
        </div>
      </section>
    );
  }

  if (loadState.status === 'error' || document === undefined) {
    return (
      <section aria-label="Simple project example" className="simple-project-example">
        <div className="simple-project-example__state" role="alert">
          <div>
            <h3>Could not load the project</h3>
            <p>{loadState.status === 'error' ? loadState.message : 'No document was returned.'}</p>
            <button onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Simple project example" className="simple-project-example">
      <div className="simple-project-example__toolbar">
        <div>
          <strong>Launch Gantempo integration</strong>
          <span>Controlled document · runtime-owned range · explicit Save</span>
        </div>
        <div className="simple-project-example__actions">
          <output aria-live="polite" className="simple-project-example__status">
            {saveStatusMessage(saveState, dirty)}
          </output>
          <button onClick={advanceApiStep} type="button">
            Advance API step
          </button>
          <button
            disabled={!dirty || saveState.status === 'saving'}
            onClick={() => void saveDraft()}
            type="button"
          >
            {saveState.status === 'saving' ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>

      <Gantt
        appearanceVariants={APPEARANCE_VARIANTS}
        className="simple-project-example__chart"
        defaultRange={INITIAL_RANGE}
        document={document}
        features={FEATURES}
        interactionSnap={INTERACTION_SNAP}
        label="API-loaded launch project"
        onDocumentChange={acceptChange}
        ref={gantt}
        timeScale={TIME_SCALE}
        timeZone="UTC"
        view={PROJECT_VIEW}
      />
    </section>
  );
}
