import type { ConversationPartyType } from "../types/chat.types";
import { isBlankOrPlaceholderPartyName } from "../../../lib/partyAvatarDisplay";

const GENERIC_CHAT_PARTY = new Set([
  "client",
  "supplier",
  "driver",
  "unassigned",
  "not assigned",
  "not_assigned",
  "not assigned.",
  "no driver",
  "nodriver",
  "n/a",
  "na",
  "none",
  "party",
  "misc / unlinked",
]);

/** True when chat should not show a party name line (placeholders, unassigned, etc.). */
export function shouldHideChatPartyName(name: string | null | undefined): boolean {
  const t = String(name ?? "").trim();
  if (!t) return true;
  if (isBlankOrPlaceholderPartyName(t)) return true;
  const lower = t.toLowerCase();
  if (GENERIC_CHAT_PARTY.has(lower)) return true;
  if (lower.startsWith("unassigned")) return true;
  if (lower.includes("not assigned")) return true;
  return false;
}

/**
 * Title-case party name for payment / ledger cards (not all-caps).
 */
export function formatElegantPartyName(name: string | null | undefined): string | null {
  if (shouldHideChatPartyName(name)) return null;
  return String(name)
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Uppercase party line for chat (transaction-style casing), or `null` when the row should be omitted.
 */
export function formatChatPartyName(name: string | null | undefined): string | null {
  if (shouldHideChatPartyName(name)) return null;
  return String(name).trim().toUpperCase();
}

/** Uppercase lane label: CLIENT, SUPPLIER, or DRIVER. */
export function formatChatPartyTypeLabel(
  type: ConversationPartyType | "client" | "supplier" | null | undefined,
): string | null {
  if (!type) return null;
  if (type === "client") return "CLIENT";
  if (type === "supplier") return "SUPPLIER";
  return "DRIVER";
}

/** Slack-style @mention from party display name (first token, lowercase). */
export function formatChatPartyHandle(name: string | null | undefined): string | null {
  if (shouldHideChatPartyName(name)) return null;
  const token = String(name).trim().split(/\s+/)[0] ?? "";
  const handle = token.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
  return handle ? `@${handle}` : null;
}

/** Inbox / thread kicker: `DRIVER · @ahmed` when a real name exists. */
export function formatChatPartyInboxLine(
  type: ConversationPartyType | "client" | "supplier" | null | undefined,
  name: string | null | undefined,
): string | null {
  const role = formatChatPartyTypeLabel(type);
  if (!role) return null;
  const handle = formatChatPartyHandle(name);
  if (handle) return `${role} · ${handle}`;
  return role;
}

export type ChatComposeTripPartyNames = {
  driver_display_name?: string | null;
  client_name?: string | null;
  supplier_name?: string | null;
};

export function resolveChatPartyDisplayName(
  partyType: ConversationPartyType,
  partyName: string | null | undefined,
  composeTrip?: ChatComposeTripPartyNames | null,
): string | null {
  if (partyType === "driver") {
    return (composeTrip?.driver_display_name ?? partyName ?? "").trim() || null;
  }
  if (partyType === "client") {
    return (composeTrip?.client_name ?? partyName ?? "").trim() || null;
  }
  return (composeTrip?.supplier_name ?? partyName ?? "").trim() || null;
}

/** People strip under Integrated / On trip: `@aiman` (individual party, not paired). */
export function formatChatPartyStripLabel(
  type: ConversationPartyType,
  name: string | null | undefined,
): string {
  return (
    formatChatPartyHandle(name) ??
    formatChatPartyTypeLabel(type) ??
    "PARTY"
  );
}
