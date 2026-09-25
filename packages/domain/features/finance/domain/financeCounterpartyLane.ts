/**
 * Finance party-lane classification.
 *
 * Internal ledger identity stays `transactions.contact_type`
 * (`client` | `supplier` | `driver` | `dco`). Presentation maps DCO onto the
 * Supplier finance lane with a DCO tag — not Finance → Drivers.
 *
 * Do not infer this from driver_id, driver name, or missing supplier_id.
 */

export type FinancePartyLane = "customers" | "suppliers" | "drivers" | "vehicle" | "other";

export type SupplierPartyKindFilter = "all" | "supplier" | "dco";

export const SUPPLIER_PARTY_KIND_OPTIONS: {
  id: SupplierPartyKindFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "supplier", label: "Supplier" },
  { id: "dco", label: "DCO" },
];

export function normalizeLedgerContactType(
  contactType: string | null | undefined,
): string {
  return String(contactType ?? "").trim().toLowerCase();
}

export function isDcoLedgerContactType(
  contactType: string | null | undefined,
): boolean {
  return normalizeLedgerContactType(contactType) === "dco";
}

export function isDriverLedgerContactType(
  contactType: string | null | undefined,
): boolean {
  return normalizeLedgerContactType(contactType) === "driver";
}

/** Cash / kanban / aggregation: DCO is an external transport counterparty. */
export function isSupplierFinanceLaneContactType(
  contactType: string | null | undefined,
): boolean {
  const ct = normalizeLedgerContactType(contactType);
  return ct === "supplier" || ct === "dco";
}

export function financePartyLaneForContactType(
  contactType: string | null | undefined,
): FinancePartyLane {
  const ct = normalizeLedgerContactType(contactType);
  if (ct === "client") return "customers";
  if (ct === "supplier" || ct === "dco") return "suppliers";
  if (ct === "driver") return "drivers";
  if (!ct) return "vehicle";
  return "other";
}

/**
 * Employee Driver payable detection. `driver_name` is operational metadata and
 * must never reclassify an explicit `contact_type` of `dco` / `supplier` / `client`.
 */
export function isEmployeeDriverLedgerPayment(row: {
  contact_type?: string | null;
  driver_name?: string | null;
}): boolean {
  const ct = normalizeLedgerContactType(row.contact_type);
  if (ct === "dco" || ct === "supplier" || ct === "client") return false;
  if (ct === "driver") return true;
  return (row.driver_name ?? "").trim() !== "";
}
