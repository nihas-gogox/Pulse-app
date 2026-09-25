/**
 * Driver Home (Radar) — single source for fleet invites.
 * Reads TanStack Query cache via DriverInviteModalProvider; never calls the RPC directly.
 */
import { useDriverInviteModal } from '../../../contexts/DriverInviteModalContext';

export function useDriverHomeInvites() {
  const {
    allInvites,
    pendingCount,
    pendingInvites,
    refreshInvites,
    presentPendingInvite,
    fleetConnectionRevision,
  } = useDriverInviteModal();

  return {
    invites: allInvites,
    pendingCount,
    pendingInvites,
    refreshInvites,
    presentPendingInvite,
    fleetConnectionRevision,
  };
}
