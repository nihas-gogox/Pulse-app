import { useEffect } from "react";
import { useIsOnline } from "@pulse/core/contexts/NetworkContext";
import {
  useSaveTripVerification,
  useTripVerification,
  useTripVerificationPhotos,
} from "../queries/useTripVerification";
import { flushVerificationOutbox } from "../offline/sync";
import { useVerificationSyncState } from "../state/useVerificationSyncState";

export function useTripVerificationFlow(tripId: string | null) {
  const verification = useTripVerification(tripId);
  const photos = useTripVerificationPhotos(tripId);
  const save = useSaveTripVerification();
  const sync = useVerificationSyncState();
  const isOnline = useIsOnline();

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    void flushVerificationOutbox().then(() => {
      if (!cancelled) void sync.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [isOnline, sync.refresh]);

  return { verification, photos, save, sync, isOnline };
}
