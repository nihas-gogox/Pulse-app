import type { RatingRow } from "@/features/ratings/types";
import type { FeedbackRequestMetadata, TripMessageRow } from "../types/chat.types";
import { parseFeedbackRequestMetadata } from "./feedbackRequestMeta";

const COMMENT_TAG_PREFIX = "[[tags:";
const COMMENT_TAG_SUFFIX = "]]";

/** Tags from trip page `buildCommentPayload` or chat `JSON.stringify({ source, tags })`. */
export function extractTagsFromRatingComment(comment: string | null | undefined): string[] {
  const raw = (comment ?? "").trim();
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && Array.isArray((j as { tags?: unknown }).tags)) {
      return ((j as { tags: unknown[] }).tags ?? []).filter((t): t is string => typeof t === "string");
    }
  } catch {
    // not JSON
  }
  if (!raw.startsWith(COMMENT_TAG_PREFIX)) return [];
  const suffixIndex = raw.indexOf(COMMENT_TAG_SUFFIX);
  if (suffixIndex === -1) return [];
  const encodedTags = raw.slice(COMMENT_TAG_PREFIX.length, suffixIndex);
  return encodedTags
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function findTripRatingMatchingFeedbackMeta(
  ratings: RatingRow[],
  tripId: string,
  meta: FeedbackRequestMetadata,
): RatingRow | null {
  const matches = ratings.filter(
    (r) =>
      String(r.trip_id) === String(tripId) &&
      r.rated_type === meta.rated_party_type &&
      String(r.rated_id) === String(meta.rated_id),
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() -
      new Date(a.updated_at ?? a.created_at).getTime(),
  );
  return matches[0] ?? null;
}

/**
 * Multiple `feedback_request` rows can exist for the same rated party (e.g. per-lane inserts).
 * Keep a single bubble: newest row wins for each `(rated_party_type, rated_id)`.
 */
export function dedupeFeedbackRequestMessages(messages: TripMessageRow[]): TripMessageRow[] {
  const keepLastByKey = new Map<string, TripMessageRow>();
  for (const m of messages) {
    if (m.message_type !== "feedback_request" && m.message_type !== "feedback") continue;
    const meta = parseFeedbackRequestMetadata(m);
    const key = meta ? `${meta.rated_party_type}:${meta.rated_id}` : `id:${m.id}`;
    keepLastByKey.set(key, m);
  }
  return messages.filter((m) => {
    if (m.message_type !== "feedback_request" && m.message_type !== "feedback") return true;
    const meta = parseFeedbackRequestMetadata(m);
    const key = meta ? `${meta.rated_party_type}:${meta.rated_id}` : `id:${m.id}`;
    return keepLastByKey.get(key)?.id === m.id;
  });
}

/**
 * When a rating was saved from the trip page (or elsewhere), merge it into in-memory
 * `feedback_request` rows so the chat debrief shows submitted state.
 */
export function mergeTripChatMessagesWithFeedbackRatings(
  tripId: string,
  messages: TripMessageRow[],
  ratings: RatingRow[],
): TripMessageRow[] {
  if (!ratings.length) return messages;
  return messages.map((m) => {
    if (m.message_type !== "feedback_request") return m;
    const meta = parseFeedbackRequestMetadata(m);
    if (!meta?.rated_id || meta.submitted_at) return m;
    const match = findTripRatingMatchingFeedbackMeta(ratings, tripId, meta);
    if (!match) return m;
    const base =
      m.metadata != null && typeof m.metadata === "object"
        ? { ...(m.metadata as Record<string, unknown>) }
        : {};
    const nextMeta: Record<string, unknown> = {
      ...base,
      submitted_at: match.updated_at ?? match.created_at,
      submitted_score: match.score,
      submitted_tags: extractTagsFromRatingComment(match.comment),
    };
    return { ...m, metadata: nextMeta };
  });
}
