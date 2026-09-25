/**
 * Structured ledger semantics (Who / Why / How) mapped to the current `transactions` row shape:
 * contact_id + contact_type + trip_id + description (category + "| Mode:" + "| UTR:" + optional notes).
 *
 * Optional DB columns `ledger_entity_type`, `ledger_flow_type`, `ledger_category` mirror this model;
 * when null, use helpers below for UI and reports.
 */

export type LedgerEntityType = "client" | "supplier" | "driver" | "vehicle";

export type LedgerFlowType = "receivable" | "payable" | "expense";

export interface LedgerRowStructuredView {
  entity_type: LedgerEntityType | null;
  entity_id: string | null;
  trip_id: string | null;
  transaction_type: LedgerFlowType | null;
  category: string | null;
  payment_mode: string | null;
  reference_number: string | null;
}

/** Map stored row fields to the unified mental model (no extra DB columns required). */
export function interpretLedgerRowStructured(row: {
  contact_id?: string | null;
  contact_type?: string | null;
  trip_id?: string | null;
  description?: string | null;
  amount_in?: number;
  amount_out?: number;
  vehicle_number?: string | null;
}): LedgerRowStructuredView {
  const amountIn = Number(row.amount_in ?? 0);
  const amountOut = Number(row.amount_out ?? 0);
  const ct = (row.contact_type ?? "").trim().toLowerCase();
  let entity_type: LedgerEntityType | null = null;
  if (ct === "client") entity_type = "client";
  else if (ct === "supplier") entity_type = "supplier";
  else if (ct === "driver") entity_type = "driver";
  else if ((row.vehicle_number ?? "").trim()) entity_type = "vehicle";

  let transaction_type: LedgerFlowType | null = null;
  if (amountIn > 0) transaction_type = "receivable";
  else if (amountOut > 0) {
    transaction_type = entity_type === "vehicle" || !entity_type ? "expense" : "payable";
  }

  const desc = String(row.description ?? "");
  const category = desc.split("|")[0]?.trim() || null;
  const modeMatch = desc.match(/(?:^|\|)\s*Mode:\s*([^|]+)/i);
  const utrMatch = desc.match(/(?:^|\|)\s*UTR:\s*([^|]+)/i);

  return {
    entity_type,
    entity_id: (row.contact_id ?? "").trim() || null,
    trip_id: row.trip_id ?? null,
    transaction_type,
    category,
    payment_mode: modeMatch?.[1]?.trim() ?? null,
    reference_number: utrMatch?.[1]?.trim() ?? null,
  };
}

export interface BuildLedgerSyncDescriptionInput {
  /** Primary line: category / payment kind (e.g. Trip Payment, Settlement). */
  categoryOrKind: string;
  /** Display label for payment mode (e.g. "Cash", "UPI"). */
  paymentModeLabel?: string | null;
  /** Raw mode id — when CASH, reference is never appended. */
  paymentModeId?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
}

/**
 * Single description string for `transactions.description`, compatible with
 * `parsePaymentMode` / `parsePaymentReference` in finance.service.ts.
 */
export function buildLedgerSyncDescriptionLine(
  input: BuildLedgerSyncDescriptionInput,
): string {
  const parts: string[] = [(input.categoryOrKind ?? "").trim() || "ENTRY"];
  const modeLabel = (input.paymentModeLabel ?? "").trim();
  if (modeLabel) parts.push(`Mode: ${modeLabel}`);
  const isCash = (input.paymentModeId ?? "").toUpperCase() === "CASH";
  const ref = (input.paymentReference ?? "").trim();
  if (!isCash && ref) parts.push(`UTR: ${ref}`);
  const notes = (input.notes ?? "").trim();
  if (notes) parts.push(`Notes: ${notes}`);
  return parts.join(" | ");
}
