/** Slack-style consecutive message grouping (same sender, within time window). */

import { isMissionDebriefMessage } from "./missionDebrief.util";

export type SlackMessageGroupPosition = "standalone" | "first" | "middle" | "last";

export type SlackMessageGroupMeta = {
  position: SlackMessageGroupPosition;
  /** Show sender name + timestamp row */
  showHeader: boolean;
  /** Show avatar (false → spacer for alignment) */
  showAvatar: boolean;
  isContinuation: boolean;
  /** Extra top spacing before a new sender block (not the first row in the thread). */
  partyBreak: boolean;
};

const DEFAULT_MAX_GAP_MS = 15 * 60 * 1000;

function finalizeGroup(
  ids: string[],
  map: Map<string, SlackMessageGroupMeta>,
  firstGroupInThread: boolean,
) {
  if (ids.length === 0) return;
  const partyBreak = !firstGroupInThread;
  if (ids.length === 1) {
    map.set(ids[0], {
      position: "standalone",
      showHeader: true,
      showAvatar: true,
      isContinuation: false,
      partyBreak,
    });
    return;
  }
  ids.forEach((id, index) => {
    const isFirst = index === 0;
    const isLast = index === ids.length - 1;
    map.set(id, {
      position: isFirst ? "first" : isLast ? "last" : "middle",
      showHeader: isFirst,
      showAvatar: isFirst,
      isContinuation: !isFirst,
      partyBreak: isFirst && partyBreak,
    });
  });
}

export function buildSlackMessageGroupMap<T extends { id: string }>(
  messages: readonly T[],
  options: {
    isGroupable: (message: T) => boolean;
    senderKey: (message: T) => string;
    createdAt: (message: T) => string;
    maxGapMs?: number;
  },
): Map<string, SlackMessageGroupMeta> {
  const map = new Map<string, SlackMessageGroupMeta>();
  const maxGap = options.maxGapMs ?? DEFAULT_MAX_GAP_MS;
  let groupIds: string[] = [];
  let prevGroupable: T | null = null;
  let firstGroupInThread = true;

  const flush = () => {
    if (groupIds.length === 0) return;
    finalizeGroup(groupIds, map, firstGroupInThread);
    firstGroupInThread = false;
    groupIds = [];
    prevGroupable = null;
  };

  for (const message of messages) {
    if (!options.isGroupable(message)) {
      flush();
      continue;
    }

    const ts = Date.parse(options.createdAt(message));
    const canContinue =
      prevGroupable != null &&
      options.senderKey(message) === options.senderKey(prevGroupable) &&
      Number.isFinite(ts) &&
      Number.isFinite(Date.parse(options.createdAt(prevGroupable))) &&
      ts - Date.parse(options.createdAt(prevGroupable)) <= maxGap;

    if (canContinue) {
      groupIds.push(message.id);
    } else {
      flush();
      groupIds = [message.id];
    }
    prevGroupable = message;
  }
  flush();
  return map;
}

const NON_GROUPABLE_TRIP_TYPES = new Set([
  "tracking",
  "status_change",
  "image",
  "assignment_update",
  "system",
  "update",
  "system_log",
  "location_log",
  "ledger_event",
  "ledger",
  "payment",
  "ledger_update",
  "document_share",
  "feedback_request",
  "feedback",
]);

export function isSlackGroupableTripMessage(message: {
  message_type?: string | null;
  content?: string | null;
  metadata?: unknown;
}): boolean {
  if (isMissionDebriefMessage(message)) return false;
  const type = message.message_type ?? "text";
  return !NON_GROUPABLE_TRIP_TYPES.has(type);
}
