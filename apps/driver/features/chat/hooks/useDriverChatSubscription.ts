/**
 * Per-thread Supabase realtime → patches TanStack message cache (no full refetch).
 * Primitive deps only: conversationId, organizationId, selfUid.
 */
import { subscribeSharedPostgresChanges } from '@pulse/core/lib/realtimeRegistry';
import type { TripMessageRow } from '@pulse/domain/features/chat/types/chat.types';
import {
  appendDriverChatMessageToCache,
  driverChatMessagesQueryKey,
  patchDriverChatMessageInCache,
} from '../utils/driverChatMessageCache.util';
import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { DriverChatMessagesPage } from '../utils/driverChatMessageCache.util';

const FLUSH_MS = 100;

export function useDriverChatSubscription(
  conversationId: string | null,
  organizationId: string | null,
  selfUid: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const queueRef = useRef<Partial<TripMessageRow>[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cid = conversationId ?? '';
    const orgId = organizationId ?? '';
    const uid = selfUid ?? '';
    if (!enabled || !cid || !orgId || !uid) return;

    const flushQueue = () => {
      const incoming = queueRef.current.splice(0);
      if (incoming.length === 0) return;
      queryClient.setQueryData<InfiniteData<DriverChatMessagesPage>>(
        driverChatMessagesQueryKey(cid),
        (old) => {
          let next = old;
          for (const partial of incoming) {
            if (!partial.id || !partial.conversation_id) continue;
            next = appendDriverChatMessageToCache(
              next,
              partial as TripMessageRow,
            );
          }
          return next;
        },
      );
    };

    const scheduleFlush = () => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushQueue();
      }, FLUSH_MS);
    };

    const filter = `conversation_id=eq.${cid}`;
    const unsub = subscribeSharedPostgresChanges(
      `trip_messages:driver-conv:${orgId}:${cid}`,
      [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter,
        },
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trip_messages',
          filter,
        },
      ],
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Partial<TripMessageRow> | null;
          if (!row?.conversation_id || row.conversation_id !== cid) return;
          if (row.sender_user_id && row.sender_user_id === uid) return;
          queueRef.current.push(row);
          scheduleFlush();
          return;
        }
        if (payload.eventType === 'UPDATE') {
          const row = payload.new as Partial<TripMessageRow> | null;
          if (!row?.id || row.conversation_id !== cid) return;
          queryClient.setQueryData<InfiniteData<DriverChatMessagesPage>>(
            driverChatMessagesQueryKey(cid),
            (old) =>
              patchDriverChatMessageInCache(old, {
                id: row.id!,
                is_delivered: row.is_delivered,
                delivered_at: row.delivered_at,
                is_read: row.is_read,
                read_at: row.read_at,
                metadata: row.metadata,
              }),
          );
        }
      },
    );

    return () => {
      unsub();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      queueRef.current = [];
    };
  }, [conversationId, organizationId, selfUid, enabled, queryClient]);
}
