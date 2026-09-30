/** Reasons stored on `indents.cancel_reason` when a shipper cancels a load. */
export const INDENT_CANCEL_REASONS = [
  { id: "client_cancelled", label: "Client cancelled" },
  { id: "indent_expired", label: "Indent expired" },
  { id: "cost_does_not_match", label: "Cost doesn't match" },
] as const;

export type IndentCancelReason = (typeof INDENT_CANCEL_REASONS)[number]["id"];

const LABEL_BY_ID: Record<IndentCancelReason, string> = {
  client_cancelled: "Client cancelled",
  indent_expired: "Indent expired",
  cost_does_not_match: "Cost doesn't match",
};

export function isIndentCancelReason(
  value: string | null | undefined,
): value is IndentCancelReason {
  return value != null && value in LABEL_BY_ID;
}

export function indentCancelReasonLabel(
  reason: string | null | undefined,
): string | null {
  if (!isIndentCancelReason(reason)) return null;
  return LABEL_BY_ID[reason];
}

/** Failed-filter bucket. A stored reason wins; a bare expired status is Indent expired. */
export function indentFailedCategory(indent: {
  status?: string | null;
  cancel_reason?: string | null;
}): IndentCancelReason | null {
  if (isIndentCancelReason(indent.cancel_reason)) return indent.cancel_reason;
  const status = String(indent.status ?? "").trim().toLowerCase();
  if (status === "expired") return "indent_expired";
  return null;
}

const INACTIVE_INDENT_STATUSES = new Set(["cancelled", "closed", "expired"]);

/**
 * Award is only valid on an active indent. A cancelled, closed, or expired
 * load has to be reactivated before a bid can be accepted.
 */
export function indentAwardBlockedBecauseInactive(
  status: string | null | undefined,
): string | null {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (!INACTIVE_INDENT_STATUSES.has(normalized)) return null;
  return "This indent is cancelled. Reactivate it before awarding a bid.";
}
