/**
 * Warm driver chat before navigation — conversations inbox + thread messages.
 * Bootstrap model: one RPC prefetch per surface; reopen uses TanStack cache (30s stale).
 */
import * as chatService from '@pulse/domain/features/chat/services/chat.service';
import { TRIP_CHAT_HISTORY_PAGE } from '@pulse/domain/features/chat/services/chat.service';
import { driverChatConversationsQueryKey } from '../features/chat/hooks/useDriverChatConversationsQuery';
import {
  driverChatMessagesQueryKey,
  driverChatNextPageParam,
  type DriverChatMessagesPage,
} from '../features/chat/utils/driverChatMessageCache.util';
import type { QueryClient } from '@tanstack/react-query';

const CONV_STALE_MS = 30_000;
const THREAD_STALE_MS = 30_000;

/** Finger-down / navigation warmup only — DriverChatProvider already mounts the inbox query. */
export function preloadDriverChatConversations(
  queryClient: QueryClient,
  driverIds: string[],
): void {
  const safe = Array.isArray(driverIds) ? driverIds.filter(Boolean) : [];
  if (safe.length === 0) return;
  const driverIdsKey = [...safe].sort().join(',');
  void queryClient.prefetchQuery({
    queryKey: driverChatConversationsQueryKey(driverIdsKey),
    queryFn: () => chatService.getConversationsByDriverIds(safe),
    staleTime: CONV_STALE_MS,
  });
}

export function preloadDriverChatThread(
  queryClient: QueryClient,
  conversationId: string,
): void {
  const cid = String(conversationId ?? '').trim();
  if (!cid) return;
  void queryClient.prefetchInfiniteQuery({
    queryKey: driverChatMessagesQueryKey(cid),
    initialPageParam: undefined as string | undefined,
    staleTime: THREAD_STALE_MS,
    queryFn: async ({ pageParam }) => {
      const rows = await chatService.getMessagesByConversation(cid, {
        before: pageParam,
        limit: TRIP_CHAT_HISTORY_PAGE,
        partyType: null,
      });
      return { rows } satisfies DriverChatMessagesPage;
    },
    getNextPageParam: (lastPage: DriverChatMessagesPage) =>
      driverChatNextPageParam(lastPage, TRIP_CHAT_HISTORY_PAGE),
  });
}

/** Finger-down on trip chat: inbox + matching thread when conversation id is known. */
export function preloadDriverChatTrip(
  queryClient: QueryClient,
  tripId: string,
  driverIds: string[],
  conversationId?: string | null,
): void {
  preloadDriverChatConversations(queryClient, driverIds);
  const tid = String(tripId ?? '').trim();
  if (!tid) return;

  if (conversationId) {
    preloadDriverChatThread(queryClient, conversationId);
    return;
  }

  const driverIdsKey = [...driverIds].sort().join(',');
  if (!driverIdsKey) return;
  const cached = queryClient.getQueryData<
    Awaited<ReturnType<typeof chatService.getConversationsByDriverIds>>
  >(driverChatConversationsQueryKey(driverIdsKey));
  const conv = cached?.find((c) => String(c.trip_id) === tid);
  if (conv?.id) {
    preloadDriverChatThread(queryClient, conv.id);
  }
}
