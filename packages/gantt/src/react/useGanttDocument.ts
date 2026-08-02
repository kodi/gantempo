import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { parseGanttDocument } from '../model/codec';
import type { GanttDocument } from '../model/types';
import type { GanttDocumentChange } from '../runtime/types';

export type GanttDocumentStatus =
  | 'load-error'
  | 'loading'
  | 'ready'
  | 'save-error'
  | 'saved'
  | 'saving';

export interface UseGanttDocumentOptions {
  readonly load: (signal: AbortSignal) => Promise<unknown>;
  readonly save?: (document: GanttDocument) => Promise<unknown>;
}

export interface GanttDocumentBinding {
  readonly document: GanttDocument;
  readonly onDocumentChange: (change: GanttDocumentChange) => void;
}

export interface UseGanttDocumentResult {
  readonly canSave: boolean;
  readonly dirty: boolean;
  readonly error?: Error;
  readonly ganttProps?: GanttDocumentBinding;
  readonly reload: () => void;
  readonly save: () => Promise<boolean>;
  readonly status: GanttDocumentStatus;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown GanTempo document error.');
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === 'AbortError';
}

function parseLoadedDocument(value: unknown): GanttDocument {
  const result = parseGanttDocument(value);
  if (result.document !== undefined) return result.document;
  throw new Error(
    `GanTempo could not load the document: ${
      result.diagnostics[0]?.message ?? 'unknown validation error'
    }`,
  );
}

export function useGanttDocument(options: UseGanttDocumentOptions): UseGanttDocumentResult {
  const loadRef = useRef(options.load);
  const saveRef = useRef(options.save);
  const editVersion = useRef(0);
  const lifecycleVersion = useRef(0);
  const mounted = useRef(false);
  const saving = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [document, setDocument] = useState<GanttDocument>();
  const [error, setError] = useState<Error>();
  const [status, setStatus] = useState<GanttDocumentStatus>('loading');

  loadRef.current = options.load;
  saveRef.current = options.save;

  useEffect(() => {
    const controller = new AbortController();
    const version = lifecycleVersion.current;
    mounted.current = true;
    setStatus('loading');
    setError(undefined);

    void loadRef.current(controller.signal).then(
      (value) => {
        if (controller.signal.aborted || lifecycleVersion.current !== version) return;
        try {
          setDocument(parseLoadedDocument(value));
          setDirty(false);
          setError(undefined);
          setStatus('ready');
          editVersion.current = 0;
        } catch (loadError) {
          setDocument(undefined);
          setError(asError(loadError));
          setStatus('load-error');
        }
      },
      (loadError: unknown) => {
        if (controller.signal.aborted || isAbortError(loadError)) return;
        setDocument(undefined);
        setError(asError(loadError));
        setStatus('load-error');
      },
    );

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [attempt]);

  const onDocumentChange = useCallback((change: GanttDocumentChange) => {
    editVersion.current += 1;
    setDocument(change.document);
    setDirty(true);
    setError(undefined);
    setStatus('ready');
  }, []);

  const reload = useCallback(() => {
    lifecycleVersion.current += 1;
    saving.current = false;
    setDocument(undefined);
    setDirty(false);
    setError(undefined);
    setStatus('loading');
    setAttempt((value) => value + 1);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const saveDocument = saveRef.current;
    if (document === undefined || saveDocument === undefined || !dirty || saving.current) {
      return false;
    }

    const savedEditVersion = editVersion.current;
    const savedLifecycleVersion = lifecycleVersion.current;
    saving.current = true;
    setError(undefined);
    setStatus('saving');

    try {
      await saveDocument(document);
      if (!mounted.current || lifecycleVersion.current !== savedLifecycleVersion) return false;
      const unchanged = editVersion.current === savedEditVersion;
      if (unchanged) setDirty(false);
      setStatus(unchanged ? 'saved' : 'ready');
      return true;
    } catch (saveError) {
      if (!mounted.current || lifecycleVersion.current !== savedLifecycleVersion) return false;
      setError(asError(saveError));
      setStatus('save-error');
      return false;
    } finally {
      saving.current = false;
    }
  }, [dirty, document]);

  const ganttProps = useMemo<GanttDocumentBinding | undefined>(
    () => (document === undefined ? undefined : Object.freeze({ document, onDocumentChange })),
    [document, onDocumentChange],
  );

  return {
    canSave: document !== undefined && options.save !== undefined && dirty && status !== 'saving',
    dirty,
    ...(error === undefined ? {} : { error }),
    ...(ganttProps === undefined ? {} : { ganttProps }),
    reload,
    save,
    status,
  };
}
