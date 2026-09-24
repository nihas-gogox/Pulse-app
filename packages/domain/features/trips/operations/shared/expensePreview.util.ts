import type { TripCostEvent } from "../../../finance/domain/tripCostEvent";
import { getTripFuelEntryById } from "../fuel/fuel.service";
import { getTripOtherExpenseById } from "../other/otherExpense.service";
import { formatOtherExpenseCategoryLabel } from "./tripOtherExpenseCategories";
import { normalizeTripOtherExpenseCategory } from "./driverExpenseCategoryNav.util";
import { getTripTollEntryById } from "../toll/toll.service";
import { canEditTripCostEvent } from "./expenseEntryEdit.util";
import { isDriverSubmittedOperationalExpense } from "./driverReimbursementEvents.util";

export type ExpensePreviewKind = "fuel" | "toll" | "other";

export type ExpensePreviewDetail = {
  costEventId: string;
  kind: ExpensePreviewKind;
  sourceId: string;
  categoryLabel: string;
  amountInr: number;
  enteredAt: string;
  notes: string | null;
  receiptStoragePath: string | null;
  detailLines: { label: string; value: string }[];
  canEdit: boolean;
};

function parseCostEventId(costEventId: string): {
  kind: ExpensePreviewKind | null;
  sourceId: string | null;
} {
  const [kindRaw, sourceId] = costEventId.split(":");
  if (!sourceId?.trim()) return { kind: null, sourceId: null };
  if (kindRaw === "fuel" || kindRaw === "toll" || kindRaw === "other") {
    return { kind: kindRaw, sourceId: sourceId.trim() };
  }
  return { kind: null, sourceId: null };
}

function paymentOwnerLabel(owner: string | null | undefined): string {
  const v = String(owner ?? "").toLowerCase();
  if (v === "driver") return "Paid by you (driver)";
  if (v === "organization") return "Fleet / organization";
  if (v === "fastag") return "FASTag";
  return owner?.replaceAll("_", " ") ?? "—";
}

export async function loadExpensePreviewDetail(
  costEventId: string,
  event?: TripCostEvent | null,
): Promise<{ error: Error | null; detail: ExpensePreviewDetail | null }> {
  const { kind, sourceId } = parseCostEventId(costEventId);
  if (!kind || !sourceId) {
    return { error: new Error("Invalid expense reference"), detail: null };
  }

  if (kind === "fuel") {
    const res = await getTripFuelEntryById(sourceId);
    if (res.error || !res.entry) {
      return { error: res.error ?? new Error("Fuel entry not found"), detail: null };
    }
    const entry = res.entry;
    const isDriverPaid = isDriverSubmittedOperationalExpense(entry);
    const syntheticEvent: TripCostEvent =
      event ??
      ({
        id: costEventId,
        tripId: entry.trip_id,
        category: "fuel",
        amount: Number(entry.amount_inr ?? 0),
        approvalState: "pending",
        postingState: "unposted",
        settlementState: "unpaid",
        reimbursable: isDriverPaid,
        incurredBy: isDriverPaid ? "driver" : "organization",
        payer: isDriverPaid ? "driver" : "organization",
      } as TripCostEvent);
    return {
      error: null,
      detail: {
        costEventId,
        kind,
        sourceId,
        categoryLabel: "Fuel",
        amountInr: Number(entry.amount_inr ?? 0),
        enteredAt: entry.entered_at,
        notes: entry.notes,
        receiptStoragePath: entry.bill_storage_path,
        canEdit: canEditTripCostEvent(syntheticEvent),
        detailLines: [
          ...(entry.station_name
            ? [{ label: "Station", value: entry.station_name }]
            : []),
          ...(entry.liters != null
            ? [{ label: "Liters", value: `${entry.liters} L` }]
            : []),
          ...(entry.fuel_type
            ? [{ label: "Fuel type", value: String(entry.fuel_type) }]
            : []),
          { label: "Paid by", value: paymentOwnerLabel(entry.payment_owner) },
        ],
      },
    };
  }

  if (kind === "toll") {
    const res = await getTripTollEntryById(sourceId);
    if (res.error || !res.entry) {
      return { error: res.error ?? new Error("Toll entry not found"), detail: null };
    }
    const entry = res.entry;
    const isDriverPaid = isDriverSubmittedOperationalExpense(entry);
    const syntheticEvent: TripCostEvent =
      event ??
      ({
        id: costEventId,
        tripId: entry.trip_id,
        category: "toll",
        amount: Number(entry.amount_inr ?? 0),
        approvalState: "pending",
        postingState: "unposted",
        settlementState: "unpaid",
        reimbursable: isDriverPaid,
        incurredBy: isDriverPaid ? "driver" : "organization",
        payer: isDriverPaid ? "driver" : "organization",
      } as TripCostEvent);
    return {
      error: null,
      detail: {
        costEventId,
        kind,
        sourceId,
        categoryLabel: "Toll",
        amountInr: Number(entry.amount_inr ?? 0),
        enteredAt: entry.entered_at,
        notes: entry.notes,
        receiptStoragePath: entry.receipt_storage_path,
        canEdit: canEditTripCostEvent(syntheticEvent),
        detailLines: [
          ...(entry.plaza_name
            ? [{ label: "Plaza", value: entry.plaza_name }]
            : []),
          { label: "Paid by", value: paymentOwnerLabel(entry.payment_owner) },
        ],
      },
    };
  }

  const res = await getTripOtherExpenseById(sourceId);
  if (res.error || !res.entry) {
    return { error: res.error ?? new Error("Expense not found"), detail: null };
  }
  const entry = res.entry;
  const isDriverPaid = isDriverSubmittedOperationalExpense(entry);
  const syntheticEvent: TripCostEvent =
    event ??
    ({
      id: costEventId,
      tripId: entry.trip_id,
      // "misc" is the valid TripCostCategory literal; category is not read by
      // canEditTripCostEvent (the only consumer of this synthetic event).
      category: "misc",
      amount: Number(entry.amount_inr ?? 0),
      approvalState: "pending",
      postingState: "unposted",
      settlementState: "unpaid",
      reimbursable: isDriverPaid,
      incurredBy: isDriverPaid ? "driver" : "organization",
      payer: isDriverPaid ? "driver" : "organization",
    } as TripCostEvent);
  return {
    error: null,
    detail: {
      costEventId,
      kind,
      sourceId,
      categoryLabel: formatOtherExpenseCategoryLabel(
        normalizeTripOtherExpenseCategory(entry.expense_category),
      ),
      amountInr: Number(entry.amount_inr ?? 0),
      enteredAt: entry.entered_at,
      notes: entry.notes,
      receiptStoragePath: entry.receipt_storage_path,
      canEdit: canEditTripCostEvent(syntheticEvent),
      detailLines: [
        ...(entry.location_name
          ? [{ label: "Location", value: entry.location_name }]
          : []),
        ...(entry.description
          ? [{ label: "Description", value: entry.description }]
          : []),
        { label: "Paid by", value: paymentOwnerLabel(entry.payment_owner) },
      ],
    },
  };
}
