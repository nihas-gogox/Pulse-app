import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsOnline } from "@pulse/core/contexts/NetworkContext";
import { flushVerificationOutbox } from "../offline/sync";

/**
 * Keeps verification outbox opportunistically synced when connection returns.
 * Non-blocking and safe to mount on driver/business trip surfaces.
 */
export function useTripVerificationSync(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled !== false;
  const isOnline = useIsOnline();
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !isOnline) return;
    void flushVerificationOutbox().then((result) => {
      if (result.processed > 0) {
        qc.invalidateQueries({ queryKey: ["q", "trips", "verification"] });
        qc.invalidateQueries({ queryKey: ["q", "trips", "detail"] });
      }
    });
  }, [enabled, isOnline, qc]);
}
