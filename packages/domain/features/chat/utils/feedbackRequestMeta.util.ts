import type { FeedbackRequestMetadata } from "../types/chat.types";

/** Bootstrap / Realtime: debrief is complete when metadata carries a score or stamp. */
export function isFeedbackRequestAlreadyRatedMeta(
  meta: FeedbackRequestMetadata | null | undefined,
): boolean {
  if (!meta) return false;
  if (meta.submitted_at || meta.rating_status === "rated") return true;
  if (
    typeof meta.submitted_score === "number" &&
    meta.submitted_score >= 1 &&
    meta.submitted_score <= 5
  ) {
    return true;
  }
  if (typeof meta.rating === "number" && meta.rating >= 1 && meta.rating <= 5) return true;
  return false;
}
