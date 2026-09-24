/**
 * Unified driver chat: bootstrap latest messages once (TanStack infinite query),
 * then patch cache from per-thread realtime (no table refetch loop).
 * All subscription deps are primitive strings.
 */
import { useDriverChatMessagesQuery } from '../../../chat/hooks/useDriverChatMessagesQuery';
import { useDriverChatSubscription } from '../../../chat/hooks/useDriverChatSubscription';

export type UseDriverChatSystemArgs = {
  conversationId: string | null;
  organizationId: string | null;
  selfUid: string | null;
  /** When false, query + subscription are fully disabled. */
  enabled?: boolean;
};

export function useDriverChatSystem({
  conversationId,
  organizationId,
  selfUid,
  enabled = true,
}: UseDriverChatSystemArgs) {
  const cid = conversationId ?? '';
  const orgId = organizationId ?? '';
  const uid = selfUid ?? '';
  const active = enabled && !!cid && !!orgId && !!uid;

  const {
    messages,
    isLoading,
    isFetchingOlder,
    hasOlder,
    loadOlder,
    refetch,
  } = useDriverChatMessagesQuery(active ? cid : null);

  useDriverChatSubscription(
    active ? cid : null,
    active ? orgId : null,
    active ? uid : null,
    active,
  );

  return {
    messages,
    isLoading,
    isFetchingOlder,
    hasOlder,
    loadOlder,
    refetch,
    conversationId: cid,
    organizationId: orgId,
  };
}
