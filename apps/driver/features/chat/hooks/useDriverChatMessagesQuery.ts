/**
 * Driver thread: bootstrapped message history via TanStack Query infinite pages.
 * Screen → this hook → chat.service.getMessagesByConversation → Supabase RPC.
 */
import * as chatService from '@pulse/domain/features/chat/services/chat.service';
import { TRIP_CHAT_HISTORY_PAGE } from '@pulse/domain/features/chat/services/chat.service';
import {
  driverChatNextPageParam,
  flattenDriverChatMessages,
  type DriverChatMessagesPage,
} from '../utils/driverChatMessageCache.util';
import { driverChatMessagesQueryKey } from '../utils/driverChatMessageCache.util';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const STALE_MS = 30_000;
// 30 min GC: thread stays cached across tab switches so back-navigation is instant.
const GC_MS = 30 * 60_000;

export { driverChatMessagesQueryKey } from '../utils/driverChatMessageCache.util';

export function useDriverChatMessagesQuery(conversationId: string | null) {
  const cid = conversationId ?? '';

  const query = useInfiniteQuery({
    queryKey: driverChatMessagesQueryKey(cid),
    enabled: !!cid,
    initialPageParam: undefined as string | undefined,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    networkMode: 'offlineFirst',
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      const rows = await chatService.getMessagesByConversation(cid, {
        before: pageParam,
        limit: TRIP_CHAT_HISTORY_PAGE,
        partyType: null,
      });
      return { rows } satisfies DriverChatMessagesPage;
    },
    getNextPageParam: (lastPage) =>
      driverChatNextPageParam(lastPage, TRIP_CHAT_HISTORY_PAGE),
  });

  const messages = useMemo(
    () => flattenDriverChatMessages(query.data),
    [query.data],
  );

  const hasMessages = messages.length > 0;

  const loadOlder = useCallback(async () => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    await query.fetchNextPage();
  }, [query]);

  return {
    messages,
    /** True only when bootstrap has no cached pages yet (re-open uses cache instantly). */
    isLoading: query.isPending && !hasMessages,
    isFetching: query.isFetching,
    isFetchingOlder: query.isFetchingNextPage,
    hasOlder: query.hasNextPage ?? false,
    loadOlder,
    refetch: query.refetch,
  };
}

export function useInvalidateDriverChatMessages() {
  const qc = useQueryClient();
  return (conversationId: string) => {
    void qc.invalidateQueries({
      queryKey: driverChatMessagesQueryKey(conversationId),
    });
  };
}
