/**
 * Single open trip thread for hub vs thread Realtime routing.
 * `TripChatProvider` passes `hubListOnly` into `processIncomingEvent` when this id
 * differs from the incoming `conversation_id` (see `ChatScreen` scope effect).
 *
 * Phase 3: conversation-scoped `trip_messages` INSERT subscriptions attach here
 * instead of org-wide fan-out.
 */

import { useSyncExternalStore } from "react";

let activeConversationId: string | null = null;
const listeners = new Set<() => void>();

function emitActiveConversationChange(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* non-fatal */
    }
  }
}

export function subscribeActiveTripMessageConversationId(
  onChange: () => void,
): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function setActiveTripMessageConversationId(id: string | null): void {
  const next = id && id.trim() ? id.trim() : null;
  if (next === activeConversationId) return;
  activeConversationId = next;
  emitActiveConversationChange();
}

export function getActiveTripMessageConversationId(): string | null {
  return activeConversationId;
}

export function useActiveTripMessageConversationId(): string | null {
  return useSyncExternalStore(
    subscribeActiveTripMessageConversationId,
    getActiveTripMessageConversationId,
    () => null,
  );
}
