/**
 * Preset reject reasons for verified Compliance trips (decision-bar Reject).
 * Multiple presets can be selected; free-text "Other" is allowed. The composed
 * reason is stored on trips.compliance_decline_reason via reject_trip_compliance.
 */
export const COMPLIANCE_REJECT_REASON_OPTIONS = [
  { id: "memo_missing", label: "Memo missing" },
  { id: "truck_no_mismatch", label: "Truck No mismatch" },
  { id: "vendor_mismatch", label: "Vendor mismatch" },
  { id: "client_date_mismatch", label: "Client date mismatch" },
  { id: "vendor_rate_mismatch", label: "Vendor rate mismatch" },
  { id: "other", label: "Other" },
] as const;

export type ComplianceRejectReasonOptionId =
  (typeof COMPLIANCE_REJECT_REASON_OPTIONS)[number]["id"];

const OPTION_ORDER = COMPLIANCE_REJECT_REASON_OPTIONS.map((item) => item.id);

/** Builds the stored reason string from one or more presets (+ Other text). */
export function composeComplianceRejectReason(
  optionIds: readonly ComplianceRejectReasonOptionId[],
  otherText: string,
): string | null {
  if (!optionIds.length) return null;
  const selected = new Set(optionIds);
  const parts: string[] = [];
  for (const id of OPTION_ORDER) {
    if (!selected.has(id)) continue;
    if (id === "other") {
      const trimmed = otherText.trim();
      if (!trimmed) return null;
      parts.push(trimmed);
      continue;
    }
    const option = COMPLIANCE_REJECT_REASON_OPTIONS.find((item) => item.id === id);
    if (option) parts.push(option.label);
  }
  if (!parts.length) return null;
  return parts.join("; ");
}
