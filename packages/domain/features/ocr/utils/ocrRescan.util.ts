import type { OcrJobRow } from "../types/ocr.types";
import { OCR_CONFIDENCE_THRESHOLD } from "../constants/ocr.constants";

type RescanOptions = {
  userRequested: boolean;
  currentEngineVersion: string;
};

/**
 * Manual rescan is allowed when confidence is low, user explicitly requests,
 * engine version changed, or the prior job failed.
 */
export function canRequestOcrRescan(
  job: OcrJobRow | null | undefined,
  { userRequested, currentEngineVersion }: RescanOptions,
): boolean {
  if (userRequested) return true;
  if (!job) return true;
  if (job.status === "failed") return true;
  if (job.engine_version !== currentEngineVersion) return true;
  if (job.status === "completed") {
    const confidence = job.confidence_score ?? 0;
    if (confidence < OCR_CONFIDENCE_THRESHOLD) return true;
  }
  return false;
}

export function isOcrJobTerminal(job: OcrJobRow | null | undefined): boolean {
  return job?.status === "completed" || job?.status === "failed";
}
