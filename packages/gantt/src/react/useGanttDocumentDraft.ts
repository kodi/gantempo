import { useCallback, useEffect, useMemo, useState } from 'react';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import type { GanttDocumentChange } from '../runtime/types';

export interface UseGanttDocumentDraftOptions {
  readonly document: GanttDocument | undefined;
}

export interface GanttDocumentDraftBinding {
  readonly document: GanttDocument;
  readonly onDocumentChange: (change: GanttDocumentChange) => void;
}

export interface UseGanttDocumentDraftResult {
  readonly dirty: boolean;
  readonly document?: GanttDocument;
  readonly ganttProps?: GanttDocumentDraftBinding;
  readonly hasRemoteUpdate: boolean;
  readonly markSaved: (document: GanttDocument) => void;
  readonly reset: () => void;
}

interface DraftState {
  readonly baselineSignature: string | undefined;
  readonly dirty: boolean;
  readonly document: GanttDocument | undefined;
  readonly remoteDocument: GanttDocument | undefined;
  readonly remoteSignature: string | undefined;
  readonly sourceDocument: GanttDocument | undefined;
  readonly sourceSignature: string | undefined;
}

function signature(document: GanttDocument | undefined): string | undefined {
  return document === undefined ? undefined : serializeGanttDocument(document);
}

function cleanState(document: GanttDocument | undefined): DraftState {
  const documentSignature = signature(document);
  return {
    baselineSignature: documentSignature,
    dirty: false,
    document,
    remoteDocument: undefined,
    remoteSignature: undefined,
    sourceDocument: document,
    sourceSignature: documentSignature,
  };
}

export function useGanttDocumentDraft(
  options: UseGanttDocumentDraftOptions,
): UseGanttDocumentDraftResult {
  const sourceSignature = signature(options.document);
  const [state, setState] = useState<DraftState>(() => cleanState(options.document));

  useEffect(() => {
    setState((current) => {
      if (current.sourceSignature === sourceSignature) return current;
      if (options.document === undefined) {
        return current.dirty
          ? {
              ...current,
              remoteDocument: undefined,
              remoteSignature: undefined,
              sourceDocument: undefined,
              sourceSignature: undefined,
            }
          : cleanState(undefined);
      }
      if (current.document === undefined || !current.dirty) {
        return cleanState(options.document);
      }
      if (sourceSignature === current.baselineSignature) {
        return {
          ...current,
          remoteDocument: undefined,
          remoteSignature: undefined,
          sourceDocument: options.document,
          sourceSignature,
        };
      }
      return {
        ...current,
        remoteDocument: options.document,
        remoteSignature: sourceSignature,
        sourceDocument: options.document,
        sourceSignature,
      };
    });
  }, [options.document, sourceSignature]);

  const onDocumentChange = useCallback((change: GanttDocumentChange) => {
    setState((current) => {
      const nextSignature = signature(change.document);
      const dirty = nextSignature !== current.baselineSignature;
      if (!dirty && current.remoteDocument !== undefined) {
        return cleanState(current.remoteDocument);
      }
      return { ...current, dirty, document: change.document };
    });
  }, []);

  const markSaved = useCallback((savedDocument: GanttDocument) => {
    const savedSignature = signature(savedDocument);
    setState((current) => {
      const unchanged = signature(current.document) === savedSignature;
      return {
        baselineSignature: savedSignature,
        dirty: !unchanged,
        document: current.document ?? savedDocument,
        remoteDocument: undefined,
        remoteSignature: undefined,
        sourceDocument: savedDocument,
        sourceSignature: savedSignature,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((current) => {
      const target = current.remoteDocument ?? current.sourceDocument;
      return target === undefined ? current : cleanState(target);
    });
  }, []);

  const ganttProps = useMemo<GanttDocumentDraftBinding | undefined>(
    () =>
      state.document === undefined
        ? undefined
        : Object.freeze({ document: state.document, onDocumentChange }),
    [onDocumentChange, state.document],
  );

  return {
    dirty: state.dirty,
    ...(state.document === undefined ? {} : { document: state.document }),
    ...(ganttProps === undefined ? {} : { ganttProps }),
    hasRemoteUpdate: state.remoteDocument !== undefined,
    markSaved,
    reset,
  };
}
