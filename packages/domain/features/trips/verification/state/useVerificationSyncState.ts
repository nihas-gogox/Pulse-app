import { useCallback, useEffect, useState } from "react";
import { listVerificationOutbox } from "../offline/outbox";

export interface VerificationSyncState {
  pendingCount: number;
  failedCount: number;
}

export function useVerificationSyncState() {
  const [state, setState] = useState<VerificationSyncState>({
    pendingCount: 0,
    failedCount: 0,
  });

  const refresh = useCallback(async () => {
    const items = await listVerificationOutbox();
    setState({
      pendingCount: items.filter((item) => item.status !== "failed").length,
      failedCount: items.filter((item) => item.status === "failed").length,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, []);

  return { ...state, refresh };
}
