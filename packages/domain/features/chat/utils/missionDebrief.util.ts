/**
 * Trip-complete mission debrief prompt (in-chat rating).
 */
export const MISSION_DEBRIEF_SNIPPET = "rate this partner to close the mission debrief";

export function isMissionDebriefMessage(msg: {
  message_type?: string | null;
  content?: string | null;
  metadata?: unknown;
}): boolean {
  const mt = String(msg.message_type ?? "")
    .trim()
    .toLowerCase();
  if (mt === "feedback_request" || mt === "feedback") return true;

  const meta =
    msg.metadata && typeof msg.metadata === "object"
      ? (msg.metadata as Record<string, unknown>)
      : {};
  const eventType = String(meta.event_type ?? "")
    .trim()
    .toLowerCase();
  if (eventType === "feedback_request" || eventType === "feedback") return true;

  const body =
    (typeof meta.body === "string" ? meta.body : "") ||
    (typeof msg.content === "string" ? msg.content : "");
  return body.toLowerCase().includes(MISSION_DEBRIEF_SNIPPET);
}

export function isMissionDebriefPreviewText(text: string | null | undefined): boolean {
  return (text ?? "").toLowerCase().includes(MISSION_DEBRIEF_SNIPPET);
}

export function findLatestMissionDebriefMessage<
  T extends {
    message_type?: string | null;
    content?: string | null;
    metadata?: unknown;
  },
>(messages: T[] | null | undefined): T | null {
  if (!messages?.length) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isMissionDebriefMessage(messages[i])) return messages[i];
  }
  return null;
}
