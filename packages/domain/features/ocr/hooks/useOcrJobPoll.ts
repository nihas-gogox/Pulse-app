import { useEffect, useRef } from "react";

import { getOcrJobById } from "../services/ocrJob.service";
import type { OcrJobRow } from "../types/ocr.types";

const POLL_START_MS = 2000;
const POLL_MAX_MS = 10000;
const POLL_BACKOFF = 1.5;

type Options = {
  jobId: string | null | undefined;
  enabled?: boolean;
  onUpdate?: (job: OcrJobRow) => void;
  onTerminal?: (job: OcrJobRow) => void;
};

/** Poll persisted ocr_jobs — read-only, never invokes Gemini. */
export function useOcrJobPoll({ jobId, enabled = true, onUpdate, onTerminal }: Options) {
  const onUpdateRef = useRef(onUpdate);
  const onTerminalRef = useRef(onTerminal);
  onUpdateRef.current = onUpdate;
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    if (!enabled || !jobId) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = POLL_START_MS;

    // Progressive backoff: keep the fast 2s first checks for immediate feedback,
    // then grow toward a 10s cap so a long-running/stuck job stops hammering the
    // DB. Terminal detection and callbacks are unchanged.
    const scheduleNext = () => {
      timer = setTimeout(() => void poll(), delay);
      delay = Math.min(Math.round(delay * POLL_BACKOFF), POLL_MAX_MS);
    };

    const poll = async () => {
      try {
        const job = await getOcrJobById(jobId);
        if (!job || cancelled) return;
        onUpdateRef.current?.(job);
        if (job.status === "completed" || job.status === "failed") {
          onTerminalRef.current?.(job);
          return; // terminal — stop polling
        }
      } catch {
        /* transient network */
      }
      if (!cancelled) scheduleNext();
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, jobId]);
}
