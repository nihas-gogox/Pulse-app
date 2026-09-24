import { DriverInviteModal } from '../components/driver/DriverInviteModal';
import { ThemedConfirmModal } from '@pulse/ui/components/ThemedConfirmModal';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import type { DriverInviteRow } from '@pulse/domain/features/drivers/services/drivers.service';
import * as driversService from '@pulse/domain/features/drivers/services/drivers.service';
import {
  driverInvitesReceivedQueryKey,
  useDriverInvitesQuery,
} from '@pulse/domain/lib/queries/useDriverInvitesQuery';
import { subscribeSharedPostgresChanges } from '@pulse/core/lib/realtimeRegistry';
import { subscribeSignificantAppResume } from '@pulse/core/lib/significantAppResume';
import { syncAndInvalidateLinkedDrivers } from '@pulse/domain/lib/syncLinkedDriversForDriverHome';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { showAppAlert } from '@pulse/core/lib/appAlert';

type DriverInviteModalContextValue = {
  allInvites: DriverInviteRow[];
  pendingCount: number;
  pendingInvites: DriverInviteRow[];
  refreshInvites: () => Promise<void>;
  presentPendingInvite: () => void;
  fleetConnectionRevision: number;
};

const DriverInviteModalContext = createContext<DriverInviteModalContextValue | null>(null);

export function useOptionalDriverInviteModal(): DriverInviteModalContextValue | null {
  return useContext(DriverInviteModalContext);
}

export function useDriverInviteModal(): DriverInviteModalContextValue {
  const ctx = useContext(DriverInviteModalContext);
  if (!ctx) {
    throw new Error('useDriverInviteModal must be used within DriverInviteModalProvider');
  }
  return ctx;
}

export function DriverInviteModalProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const queryClient = useQueryClient();

  const {
    allInvites,
    pendingInvites,
    pendingCount,
    refreshInvites,
    isError,
    error,
  } = useDriverInvitesQuery(uid);

  const [sessionSnoozedIds, setSessionSnoozedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<DriverInviteRow | null>(null);
  const [fleetConnectionRevision, setFleetConnectionRevision] = useState(0);

  const bumpFleetConnectionRevision = useCallback(() => {
    setFleetConnectionRevision((n) => n + 1);
  }, []);

  const invalidateInvites = useCallback(() => {
    if (!uid) return;
    void queryClient.invalidateQueries({
      queryKey: driverInvitesReceivedQueryKey(uid),
    });
  }, [queryClient, uid]);

  const clearSessionSnooze = useCallback(() => {
    setSessionSnoozedIds(new Set());
  }, []);

  useEffect(() => {
    if (!isError || !__DEV__ || !error) return;
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[DriverInviteModal] invites query:', msg);
  }, [isError, error]);

  /** Significant resume only — brief inactive→active must not clear Later snooze. */
  useEffect(() => {
    if (!uid) return;

    const unsubResume = subscribeSignificantAppResume(() => {
      invalidateInvites();
    });
    return () => {
      unsubResume();
    };
  }, [uid, invalidateInvites]);

  /** Event-driven refresh when fleet sends or updates an invitation. */
  useEffect(() => {
    if (!uid) return;

    return subscribeSharedPostgresChanges(
      `driver-invites-received-${uid}`,
      [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_invites',
          filter: `to_user_id=eq.${uid}`,
        },
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_invites',
          filter: `to_user_id=eq.${uid}`,
        },
      ],
      (payload) => {
        const row = payload.new as { status?: string } | null;
        const isPending =
          row != null && String(row.status ?? '').toLowerCase() === 'pending';
        invalidateInvites();
        if (isPending) clearSessionSnooze();
      },
    );
  }, [uid, invalidateInvites, clearSessionSnooze]);

  const visiblePendingInvites = useMemo(
    () => pendingInvites.filter((i) => !sessionSnoozedIds.has(i.id)),
    [pendingInvites, sessionSnoozedIds],
  );

  const activeInvite = visiblePendingInvites[0] ?? null;
  const showModal = !!activeInvite && !declineTarget;

  const presentPendingInvite = useCallback(() => {
    clearSessionSnooze();
    if (pendingCount === 0) void refreshInvites();
  }, [pendingCount, refreshInvites, clearSessionSnooze]);

  const handleLater = useCallback(() => {
    // Snooze every currently visible pending invite so Later is one tap.
    setSessionSnoozedIds((prev) => {
      const next = new Set(prev);
      for (const invite of visiblePendingInvites) next.add(invite.id);
      return next;
    });
  }, [visiblePendingInvites]);

  const handleAccept = useCallback(async () => {
    if (!activeInvite) return;
    setBusyId(activeInvite.id);
    const { error: acceptError } = await driversService.acceptDriverInvite(activeInvite.id);
    setBusyId(null);
    if (acceptError) {
      // Alert.alert from react-native is a NO-OP on react-native-web, so on
      // gx-pulse.netlify.app this error was raised, returned, and then shown to
      // nobody — the Accept button looked dead. That silence is what led the
      // driver to tap Decline instead, permanently burning the invite.
      // showAppAlert routes to the themed modal, falling back to window.alert.
      showAppAlert(
        'Accept failed',
        acceptError.message ?? 'Could not accept invite. Try again.',
      );
      return;
    }
    setSessionSnoozedIds((prev) => {
      const next = new Set(prev);
      next.delete(activeInvite.id);
      return next;
    });
    invalidateInvites();
    bumpFleetConnectionRevision();
    // Phase 2: sync linked driver rows after invite accept (not inside drivers queryFn).
    if (uid) void syncAndInvalidateLinkedDrivers(queryClient, uid);
  }, [
    activeInvite,
    invalidateInvites,
    bumpFleetConnectionRevision,
    uid,
    queryClient,
  ]);

  const runDecline = useCallback(
    async (invite: DriverInviteRow) => {
      setBusyId(invite.id);
      const { error: declineError } = await driversService.rejectDriverInvite(invite.id);
      setBusyId(null);
      setDeclineTarget(null);
      if (declineError) {
        // Same react-native-web no-op as the accept path above.
        showAppAlert(
          'Decline failed',
          declineError.message ?? 'Could not decline invite. Try again.',
        );
        return;
      }
      setSessionSnoozedIds((prev) => {
        const next = new Set(prev);
        next.delete(invite.id);
        return next;
      });
      invalidateInvites();
      bumpFleetConnectionRevision();
    },
    [invalidateInvites, bumpFleetConnectionRevision],
  );

  const handleDeclinePress = useCallback(() => {
    if (!activeInvite) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(
        'Decline invitation?\n\nYou will reject this fleet connection invitation.',
      );
      if (ok) void runDecline(activeInvite);
      return;
    }
    setDeclineTarget(activeInvite);
  }, [activeInvite, runDecline]);

  const value = useMemo(
    (): DriverInviteModalContextValue => ({
      allInvites,
      pendingCount,
      pendingInvites,
      refreshInvites,
      presentPendingInvite,
      fleetConnectionRevision,
    }),
    [
      allInvites,
      pendingCount,
      pendingInvites,
      refreshInvites,
      presentPendingInvite,
      fleetConnectionRevision,
    ],
  );

  return (
    <DriverInviteModalContext.Provider value={value}>
      {children}

      {uid && activeInvite ? (
        <DriverInviteModal
          visible={showModal}
          invite={activeInvite}
          queueIndex={
            pendingInvites.findIndex((i) => i.id === activeInvite.id) + 1 || 1
          }
          queueTotal={pendingInvites.length}
          busy={busyId === activeInvite.id}
          onAccept={() => void handleAccept()}
          onDecline={handleDeclinePress}
          onLater={handleLater}
        />
      ) : null}

      <ThemedConfirmModal
        visible={!!declineTarget}
        title="Decline invitation?"
        message="You will reject this fleet connection invitation."
        cancelText="Cancel"
        confirmText="Decline"
        variant="warning"
        confirmVariant="destructive"
        onCancel={() => setDeclineTarget(null)}
        onConfirm={() => {
          if (declineTarget) void runDecline(declineTarget);
        }}
        onRequestClose={() => setDeclineTarget(null)}
      />
    </DriverInviteModalContext.Provider>
  );
}
