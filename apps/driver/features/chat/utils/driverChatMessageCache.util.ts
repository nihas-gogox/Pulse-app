import type { InfiniteData } from '@tanstack/react-query';
import type { TripMessageRow } from '@pulse/domain/features/chat/types/chat.types';
import { queryKeys } from '@pulse/domain/lib/queryKeys';

export function driverChatMessagesQueryKey(conversationId: string) {
  return queryKeys.tripConversations.driverMessages(conversationId);
}

export type DriverChatMessagesPage = {
  rows: TripMessageRow[];
};

/**
 * Single source of truth for the thread's cursor. Both the live infinite query
 * and the navigation prefetch must pass this — a prefetch that omits it seeds a
 * query whose observer then calls an undefined getNextPageParam (GX-PULSE-1H).
 */
export function driverChatNextPageParam(
  lastPage: DriverChatMessagesPage,
  pageSize: number,
): string | undefined {
  if (lastPage.rows.length < pageSize) return undefined;
  return lastPage.rows[0]?.created_at;
}

export function flattenDriverChatMessages(
  data: InfiniteData<DriverChatMessagesPage> | undefined,
): TripMessageRow[] {
  if (!data?.pages.length) return [];
  return data.pages
    .slice()
    .reverse()
    .flatMap((p) => p.rows);
}

function messageExists(pages: DriverChatMessagesPage[], row: TripMessageRow): boolean {
  return pages.some((p) => p.rows.some((m) => m.id === row.id));
}

/** Append to the latest (most recent) page; dedupe by id. */
export function appendDriverChatMessageToCache(
  old: InfiniteData<DriverChatMessagesPage> | undefined,
  row: TripMessageRow,
): InfiniteData<DriverChatMessagesPage> | undefined {
  if (!old?.pages.length) {
    return {
      pages: [{ rows: [row] }],
      pageParams: [undefined],
    };
  }
  if (messageExists(old.pages, row)) return old;
  const pages = [...old.pages];
  const lastIdx = 0;
  const last = pages[lastIdx];
  pages[lastIdx] = { rows: [...last.rows, row] };
  return { ...old, pages };
}

export function replaceDriverChatMessageInCache(
  old: InfiniteData<DriverChatMessagesPage> | undefined,
  tempId: string,
  persisted: TripMessageRow,
): InfiniteData<DriverChatMessagesPage> | undefined {
  if (!old?.pages.length) return old;
  const pages = old.pages.map((p) => ({
    rows: p.rows.map((m) => (m.id === tempId ? persisted : m)),
  }));
  return { ...old, pages };
}

export function removeDriverChatMessageFromCache(
  old: InfiniteData<DriverChatMessagesPage> | undefined,
  tempId: string,
): InfiniteData<DriverChatMessagesPage> | undefined {
  if (!old?.pages.length) return old;
  const pages = old.pages.map((p) => ({
    rows: p.rows.filter((m) => m.id !== tempId),
  }));
  return { ...old, pages };
}

export function patchDriverChatMessageInCache(
  old: InfiniteData<DriverChatMessagesPage> | undefined,
  patch: Partial<TripMessageRow> & { id: string },
): InfiniteData<DriverChatMessagesPage> | undefined {
  if (!old?.pages.length) return old;
  const pages = old.pages.map((p) => ({
    rows: p.rows.map((m) => {
      if (m.id !== patch.id) return m;
      return {
        ...m,
        is_delivered: patch.is_delivered ?? m.is_delivered,
        delivered_at: patch.delivered_at ?? m.delivered_at,
        is_read: patch.is_read ?? m.is_read,
        read_at: patch.read_at ?? m.read_at,
        metadata: patch.metadata != null ? patch.metadata : m.metadata,
      };
    }),
  }));
  return { ...old, pages };
}
