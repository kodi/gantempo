import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { parseGanttDocument } from './model/codec';
import type { GanttDocument } from './model/types';
import {
  useGanttDocumentDraft,
  type UseGanttDocumentDraftResult,
} from './react/useGanttDocumentDraft';

export interface UseGanttDocumentQueryOptions<
  TQueryKey extends QueryKey = QueryKey,
  TMutationData = unknown,
> {
  readonly mutation?: Omit<UseMutationOptions<TMutationData, Error, GanttDocument>, 'mutationFn'>;
  readonly mutationFn?: (document: GanttDocument) => Promise<TMutationData>;
  readonly query?: Omit<
    UseQueryOptions<GanttDocument, Error, GanttDocument, TQueryKey>,
    'queryFn' | 'queryKey'
  >;
  readonly queryFn: (context: QueryFunctionContext<TQueryKey>) => Promise<unknown>;
  readonly queryKey: TQueryKey;
}

export type UseGanttDocumentQueryResult<TMutationData = unknown> = UseGanttDocumentDraftResult & {
  readonly canSave: boolean;
  readonly mutation: UseMutationResult<TMutationData, Error, GanttDocument>;
  readonly query: UseQueryResult<GanttDocument, Error>;
  readonly save: () => Promise<boolean>;
};

function parseLoadedDocument(value: unknown): GanttDocument {
  const result = parseGanttDocument(value);
  if (result.document !== undefined) return result.document;
  throw new Error(
    `GanTempo could not load the document: ${
      result.diagnostics[0]?.message ?? 'unknown validation error'
    }`,
  );
}

export function useGanttDocumentQuery<TQueryKey extends QueryKey, TMutationData = unknown>(
  options: UseGanttDocumentQueryOptions<TQueryKey, TMutationData>,
): UseGanttDocumentQueryResult<TMutationData> {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...options.query,
    queryFn: async (context) => parseLoadedDocument(await options.queryFn(context)),
    queryKey: options.queryKey,
  });
  const mutation = useMutation({
    ...options.mutation,
    mutationFn: async (document: GanttDocument) => {
      if (options.mutationFn === undefined) {
        throw new Error('No GanTempo document mutation function was configured.');
      }
      return options.mutationFn(document);
    },
  });
  const draft = useGanttDocumentDraft({ document: query.data });
  const mutateAsync = mutation.mutateAsync;

  const save = useCallback(async (): Promise<boolean> => {
    const document = draft.document;
    if (
      document === undefined ||
      options.mutationFn === undefined ||
      !draft.dirty ||
      mutation.isPending
    ) {
      return false;
    }
    try {
      await mutateAsync(document);
      queryClient.setQueryData<GanttDocument>(options.queryKey, document);
      draft.markSaved(document);
      return true;
    } catch {
      return false;
    }
  }, [
    draft.dirty,
    draft.document,
    draft.markSaved,
    mutateAsync,
    mutation.isPending,
    options.mutationFn,
    options.queryKey,
    queryClient,
  ]);

  return {
    ...draft,
    canSave: draft.dirty && options.mutationFn !== undefined && !mutation.isPending,
    mutation,
    query,
    save,
  };
}
