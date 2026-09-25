import { useCallback, useEffect, useState } from "react";
import { listOperationsOutbox } from "../offline/outbox";

export function useOperationsSyncState() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const refresh = useCallback(async () => {
    const items = await listOperationsOutbox();
    setPendingCount(items.filter((item) => item.status !== "failed").length);
    setFailedCount(items.filter((item) => item.status === "failed").length);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pendingCount, failedCount, refresh };
}
