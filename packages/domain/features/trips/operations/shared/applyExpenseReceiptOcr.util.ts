import { resolveOcrAmount, resolveOcrCity, type ExpenseReceiptOcrResult, type OcrScalarField } from "./expenseReceiptOcr.service";
import { formatOtherExpenseCategoryLabel } from "./tripOtherExpenseCategories";
import type { BillPendingFieldUpdate, BillScanState } from "./expenseBillScan.types";
import type { FuelType, OperationalPaymentMode, TripOtherExpenseCategory } from "../types";

const HIGH_CONFIDENCE = 0.85;
const MIN_CONFIDENCE = 0.55;

/** Amount always fills an empty field; only overwrite existing amount at high confidence. */
function applyOcrAmount(
  result: ExpenseReceiptOcrResult,
  currentAmount: number,
  setAmountInr: (value: number) => void,
): boolean {
  const amount = resolveOcrAmount(result);
  if (!amount || amount <= 0) return false;
  if (currentAmount > 0) {
    const confidence = result.amountInr?.confidence ?? 0.75;
    if (confidence < HIGH_CONFIDENCE) return false;
  }
  setAmountInr(Math.round(amount));
  return true;
}

function shouldApplyNumber(
  field: OcrScalarField<number> | null | undefined,
  current: number,
): field is OcrScalarField<number> {
  if (!field || field.value <= 0 || field.confidence < MIN_CONFIDENCE) return false;
  if (current > 0) return field.confidence >= HIGH_CONFIDENCE;
  return true;
}

function shouldApplyString(
  field: OcrScalarField<string> | null | undefined,
  current: string,
): field is OcrScalarField<string> {
  if (!field || !field.value.trim() || field.confidence < MIN_CONFIDENCE) return false;
  if (current.trim()) return field.confidence >= HIGH_CONFIDENCE;
  return true;
}

function shouldApplyEnum<T extends string>(
  field: OcrScalarField<T> | null | undefined,
  current: T,
  defaultValue: T,
): field is OcrScalarField<T> {
  if (!field || field.confidence < MIN_CONFIDENCE) return false;
  if (current !== defaultValue) return field.confidence >= HIGH_CONFIDENCE;
  return true;
}

/** Combine place name + city for location/station/plaza fields. */
export function buildPlaceWithCity(
  place: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const placeTrimmed = place?.trim() ?? "";
  const cityTrimmed = city?.trim() ?? "";

  if (placeTrimmed && cityTrimmed) {
    if (placeTrimmed.toLowerCase().includes(cityTrimmed.toLowerCase())) return placeTrimmed;
    return `${placeTrimmed}, ${cityTrimmed}`;
  }
  return cityTrimmed || placeTrimmed || null;
}

function applyOcrPlaceWithCity(
  result: ExpenseReceiptOcrResult,
  current: string,
  setValue: (value: string) => void,
  appliedLabel: string,
): string | null {
  const city = resolveOcrCity(result);
  const place =
    result.vendorName?.value?.trim() ||
    result.location?.value?.trim() ||
    null;

  const combined = buildPlaceWithCity(place, city);
  if (!combined) return null;

  const syntheticField: OcrScalarField<string> = {
    value: combined,
    confidence: Math.max(result.city?.confidence ?? 0, result.location?.confidence ?? 0, result.vendorName?.confidence ?? 0),
  };

  if (!shouldApplyString(syntheticField, current)) return null;
  setValue(combined);
  return city ? "city" : appliedLabel;
}

export function formatExpenseOcrHint(
  result: ExpenseReceiptOcrResult,
  applied: string[] = [],
): string {
  return buildBillScanCompleteState(result, applied).message;
}

function humanizeAppliedField(field: string): string {
  return field
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Fuel pump / HPCL / IOCL receipts should not auto-set other-expense category (e.g. parking). */
export function isFuelBillOcrResult(result: ExpenseReceiptOcrResult): boolean {
  if (result.detectedBillKind?.value === "fuel") return true;
  if (result.liters?.value != null && result.liters.value > 0) return true;

  const haystack = [
    result.summary,
    result.vendorName?.value,
    result.notes?.value,
    result.description?.value,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /hpcl|iocl|bpcl|petroleum|fuel\s*pump|petrol|diesel|volume|litre|liter|nozzle|fp\s*id/.test(
    haystack,
  );
}

/** OCR field update with apply callback — stored in hook until driver confirms. */
export type BillFieldUpdateAction = BillPendingFieldUpdate & {
  apply: () => void;
};

function formatInrDisplay(amount: number): string {
  if (!amount || amount <= 0) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatStringDisplay(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}

function formatLitersDisplay(value: number | null): string {
  if (value == null || value <= 0) return "—";
  return `${value} L`;
}

function formatFuelTypeDisplay(value: FuelType): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPaymentModeDisplay(value: OperationalPaymentMode): string {
  if (value === "unknown") return "—";
  return value.replace(/_/g, " ");
}

function previewOcrAmount(
  result: ExpenseReceiptOcrResult,
  currentAmount: number,
  setAmountInr: (value: number) => void,
): BillFieldUpdateAction | null {
  const amount = resolveOcrAmount(result);
  if (!amount || amount <= 0) return null;
  if (currentAmount > 0) {
    const confidence = result.amountInr?.confidence ?? 0.75;
    if (confidence < HIGH_CONFIDENCE) return null;
  }
  const next = Math.round(amount);
  if (currentAmount === next) return null;
  return {
    id: "amount",
    label: "Amount",
    fromDisplay: formatInrDisplay(currentAmount),
    toDisplay: formatInrDisplay(next),
    apply: () => setAmountInr(next),
  };
}

function previewOcrNumberField(
  id: string,
  label: string,
  field: OcrScalarField<number> | null | undefined,
  current: number,
  setValue: (value: number) => void,
  formatDisplay: (value: number) => string,
): BillFieldUpdateAction | null {
  if (!shouldApplyNumber(field, current)) return null;
  if (current === field.value) return null;
  return {
    id,
    label,
    fromDisplay: formatDisplay(current),
    toDisplay: formatDisplay(field.value),
    apply: () => setValue(field.value),
  };
}

function previewOcrStringField(
  id: string,
  label: string,
  field: OcrScalarField<string> | null | undefined,
  current: string,
  setValue: (value: string) => void,
): BillFieldUpdateAction | null {
  if (!shouldApplyString(field, current)) return null;
  if (current.trim() === field.value.trim()) return null;
  return {
    id,
    label,
    fromDisplay: formatStringDisplay(current),
    toDisplay: formatStringDisplay(field.value),
    apply: () => setValue(field.value),
  };
}

function previewOcrEnumField<T extends string>(
  id: string,
  label: string,
  field: OcrScalarField<T> | null | undefined,
  current: T,
  defaultValue: T,
  setValue: (value: T) => void,
  formatDisplay: (value: T) => string,
): BillFieldUpdateAction | null {
  if (!shouldApplyEnum(field, current, defaultValue)) return null;
  if (current === field.value) return null;
  return {
    id,
    label,
    fromDisplay: formatDisplay(current),
    toDisplay: formatDisplay(field.value),
    apply: () => setValue(field.value),
  };
}

function previewOcrPlaceWithCity(
  result: ExpenseReceiptOcrResult,
  current: string,
  setValue: (value: string) => void,
  appliedLabel: string,
): BillFieldUpdateAction | null {
  const city = resolveOcrCity(result);
  const place =
    result.vendorName?.value?.trim() ||
    result.location?.value?.trim() ||
    null;

  const combined = buildPlaceWithCity(place, city);
  if (!combined) return null;

  const syntheticField: OcrScalarField<string> = {
    value: combined,
    confidence: Math.max(
      result.city?.confidence ?? 0,
      result.location?.confidence ?? 0,
      result.vendorName?.confidence ?? 0,
    ),
  };

  if (!shouldApplyString(syntheticField, current)) return null;
  if (current.trim() === combined.trim()) return null;

  const label = city ? "City" : humanizeAppliedField(appliedLabel);
  return {
    id: appliedLabel.replace(/\s+/g, "-"),
    label,
    fromDisplay: formatStringDisplay(current),
    toDisplay: formatStringDisplay(combined),
    apply: () => setValue(combined),
  };
}

export function buildBillScanConfirmState(
  result: ExpenseReceiptOcrResult,
  updates: BillPendingFieldUpdate[],
): BillScanState {
  const summaryParts: string[] = [];
  const amount = resolveOcrAmount(result);
  if (amount) summaryParts.push(formatInrDisplay(Math.round(amount)));
  if (result.vendorName?.value) summaryParts.push(result.vendorName.value.trim());

  return {
    phase: "confirm",
    message:
      updates.length === 1
        ? `Apply ${updates[0].label.toLowerCase()} from bill?`
        : summaryParts.length > 0
          ? `${summaryParts.join(" · ")} · confirm updates below`
          : `Confirm ${updates.length} field updates from bill`,
    appliedFields: [],
    pendingUpdates: updates,
    processingSec: result.processingTimeSec,
    stepIndex: 3,
  };
}

export function buildBillScanAppliedState(
  updates: BillPendingFieldUpdate[],
  processingSec?: number,
): BillScanState {
  return {
    phase: "complete",
    message:
      updates.length === 1
        ? `${updates[0].label} applied · review and save`
        : `${updates.length} OCR fields applied · review and save`,
    appliedFields: updates.map((update) => update.label),
    pendingUpdates: undefined,
    appliedOcrUpdates: updates,
    processingSec,
    stepIndex: 3,
  };
}

export function buildBillScanDismissedState(processingSec?: number): BillScanState {
  return {
    phase: "complete",
    message: "Bill attached · enter details manually",
    appliedFields: [],
    pendingUpdates: undefined,
    processingSec,
    stepIndex: 3,
  };
}

export function buildBillScanCompleteState(
  result: ExpenseReceiptOcrResult,
  applied: string[] = [],
): BillScanState {
  const amount = resolveOcrAmount(result);
  const parts: string[] = [];

  if (amount) {
    parts.push(`₹${Math.round(amount).toLocaleString("en-IN")}`);
  }
  if (result.vendorName?.value) {
    parts.push(result.vendorName.value);
  }
  const city = resolveOcrCity(result);
  if (city) {
    parts.push(city);
  }
  if (result.expenseCategory?.value) {
    parts.push(formatOtherExpenseCategoryLabel(result.expenseCategory.value));
  }

  const appliedLabels = applied.map(humanizeAppliedField);
  const processingSec = result.processingTimeSec;

  if (parts.length > 0) {
    const appliedAmount = applied.includes("amount");
    if (amount && appliedAmount && appliedLabels.length > 0) {
      return {
        phase: "complete",
        message: `${parts.join(" · ")} · review and save`,
        appliedFields: appliedLabels,
        processingSec,
      };
    }
    if (amount && !appliedAmount) {
      return {
        phase: "complete",
        message: `${parts.join(" · ")} · confirm amount below`,
        appliedFields: appliedLabels,
        processingSec,
      };
    }
    return {
      phase: "complete",
      message: `${parts.join(" · ")} · review details below`,
      appliedFields: appliedLabels,
      processingSec,
    };
  }

  if (result.summary) {
    return {
      phase: "complete",
      message: result.summary,
      appliedFields: appliedLabels,
      processingSec,
    };
  }

  return {
    phase: "complete",
    message: "Bill attached · enter amount manually",
    appliedFields: appliedLabels,
    processingSec,
  };
}

export function applyFuelReceiptOcr(
  result: ExpenseReceiptOcrResult,
  current: {
    amountInr: number;
    liters: number | null;
    fuelType: FuelType;
    stationName: string;
    notes: string;
    paymentMode: OperationalPaymentMode;
  },
  setters: {
    setAmountInr: (value: number) => void;
    setLiters: (value: number | null) => void;
    setFuelType: (value: FuelType) => void;
    setStationName: (value: string) => void;
    setNotes: (value: string) => void;
    setPaymentMode: (value: OperationalPaymentMode) => void;
  },
): string[] {
  const applied: string[] = [];

  if (applyOcrAmount(result, current.amountInr, setters.setAmountInr)) {
    applied.push("amount");
  }
  if (shouldApplyNumber(result.liters, current.liters ?? 0)) {
    setters.setLiters(result.liters.value);
    applied.push("liters");
  }
  if (shouldApplyEnum(result.fuelType, current.fuelType, "diesel")) {
    setters.setFuelType(result.fuelType.value);
    applied.push("fuel type");
  }
  const appliedStation = applyOcrPlaceWithCity(
    result,
    current.stationName,
    setters.setStationName,
    "station",
  );
  if (appliedStation) applied.push(appliedStation);
  if (shouldApplyString(result.notes, current.notes)) {
    setters.setNotes(result.notes.value);
    applied.push("notes");
  } else if (shouldApplyString(result.description, current.notes)) {
    setters.setNotes(result.description.value);
    applied.push("notes");
  }
  if (shouldApplyEnum(result.paymentMode, current.paymentMode, "unknown")) {
    setters.setPaymentMode(result.paymentMode.value);
    applied.push("payment mode");
  }

  return applied;
}

export function previewFuelReceiptOcr(
  result: ExpenseReceiptOcrResult,
  current: {
    amountInr: number;
    liters: number | null;
    fuelType: FuelType;
    stationName: string;
    notes: string;
    paymentMode: OperationalPaymentMode;
  },
  setters: {
    setAmountInr: (value: number) => void;
    setLiters: (value: number | null) => void;
    setFuelType: (value: FuelType) => void;
    setStationName: (value: string) => void;
    setNotes: (value: string) => void;
    setPaymentMode: (value: OperationalPaymentMode) => void;
  },
): BillFieldUpdateAction[] {
  const updates: BillFieldUpdateAction[] = [];

  const amountUpdate = previewOcrAmount(result, current.amountInr, setters.setAmountInr);
  if (amountUpdate) updates.push(amountUpdate);

  const litersUpdate = previewOcrNumberField(
    "liters",
    "Liters",
    result.liters,
    current.liters ?? 0,
    (value) => setters.setLiters(value),
    (value) => formatLitersDisplay(value),
  );
  if (litersUpdate) updates.push(litersUpdate);

  const fuelTypeUpdate = previewOcrEnumField(
    "fuel-type",
    "Fuel type",
    result.fuelType,
    current.fuelType,
    "diesel",
    setters.setFuelType,
    formatFuelTypeDisplay,
  );
  if (fuelTypeUpdate) updates.push(fuelTypeUpdate);

  const stationUpdate = previewOcrPlaceWithCity(
    result,
    current.stationName,
    setters.setStationName,
    "station",
  );
  if (stationUpdate) updates.push(stationUpdate);

  const notesUpdate =
    previewOcrStringField("notes", "Notes", result.notes, current.notes, setters.setNotes) ??
    previewOcrStringField(
      "notes",
      "Notes",
      result.description,
      current.notes,
      setters.setNotes,
    );
  if (notesUpdate) updates.push(notesUpdate);

  const paymentUpdate = previewOcrEnumField(
    "payment-mode",
    "Payment mode",
    result.paymentMode,
    current.paymentMode,
    "unknown",
    setters.setPaymentMode,
    formatPaymentModeDisplay,
  );
  if (paymentUpdate) updates.push(paymentUpdate);

  return updates;
}

export function applyTollReceiptOcr(
  result: ExpenseReceiptOcrResult,
  current: {
    amountInr: number;
    plazaName: string;
    notes: string;
    paymentMode: OperationalPaymentMode;
  },
  setters: {
    setAmountInr: (value: number) => void;
    setPlazaName: (value: string) => void;
    setNotes: (value: string) => void;
    setPaymentMode: (value: OperationalPaymentMode) => void;
    setIsEstimated?: (value: boolean) => void;
  },
): string[] {
  const applied: string[] = [];

  if (applyOcrAmount(result, current.amountInr, setters.setAmountInr)) {
    applied.push("amount");
    setters.setIsEstimated?.(false);
  }
  const appliedPlaza = applyOcrPlaceWithCity(
    result,
    current.plazaName,
    setters.setPlazaName,
    "plaza",
  );
  if (appliedPlaza) applied.push(appliedPlaza);
  if (shouldApplyString(result.notes, current.notes)) {
    setters.setNotes(result.notes.value);
    applied.push("notes");
  } else if (shouldApplyString(result.description, current.notes)) {
    setters.setNotes(result.description.value);
    applied.push("notes");
  }
  if (shouldApplyEnum(result.paymentMode, current.paymentMode, "unknown")) {
    setters.setPaymentMode(result.paymentMode.value);
    applied.push("payment mode");
  }

  return applied;
}

export function previewTollReceiptOcr(
  result: ExpenseReceiptOcrResult,
  current: {
    amountInr: number;
    plazaName: string;
    notes: string;
    paymentMode: OperationalPaymentMode;
  },
  setters: {
    setAmountInr: (value: number) => void;
    setPlazaName: (value: string) => void;
    setNotes: (value: string) => void;
    setPaymentMode: (value: OperationalPaymentMode) => void;
    setIsEstimated?: (value: boolean) => void;
  },
): BillFieldUpdateAction[] {
  const updates: BillFieldUpdateAction[] = [];

  const amount = resolveOcrAmount(result);
  if (amount && amount > 0) {
    const amountUpdate = previewOcrAmount(result, current.amountInr, (value) => {
      setters.setAmountInr(value);
      setters.setIsEstimated?.(false);
    });
    if (amountUpdate) updates.push(amountUpdate);
  }

  const plazaUpdate = previewOcrPlaceWithCity(
    result,
    current.plazaName,
    setters.setPlazaName,
    "plaza",
  );
  if (plazaUpdate) updates.push(plazaUpdate);

  const notesUpdate =
    previewOcrStringField("notes", "Notes", result.notes, current.notes, setters.setNotes) ??
    previewOcrStringField(
      "notes",
      "Notes",
      result.description,
      current.notes,
      setters.setNotes,
    );
  if (notesUpdate) updates.push(notesUpdate);

  const paymentUpdate = previewOcrEnumField(
    "payment-mode",
    "Payment mode",
    result.paymentMode,
    current.paymentMode,
    "unknown",
    setters.setPaymentMode,
    formatPaymentModeDisplay,
  );
  if (paymentUpdate) updates.push(paymentUpdate);

  return updates;
}

export function applyOtherReceiptOcr(
  result: ExpenseReceiptOcrResult,
  current: {
    amountInr: number;
    expenseCategory: TripOtherExpenseCategory;
    description: string;
    locationName: string;
    notes: string;
    paymentMode: OperationalPaymentMode;
  },
  setters: {
    setAmountInr: (value: number) => void;
    setExpenseCategory: (value: TripOtherExpenseCategory) => void;
    setDescription: (value: string) => void;
    setLocationName: (value: string) => void;
    setNotes: (value: string) => void;
    setPaymentMode: (value: OperationalPaymentMode) => void;
  },
): string[] {
  const applied: string[] = [];

  if (applyOcrAmount(result, current.amountInr, setters.setAmountInr)) {
    applied.push("amount");
  }
  if (shouldApplyEnum(result.expenseCategory, current.expenseCategory, "parking") && !isFuelBillOcrResult(result)) {
    setters.setExpenseCategory(result.expenseCategory.value);
    applied.push("category");
  }
  if (shouldApplyString(result.description, current.description)) {
    setters.setDescription(result.description.value);
    applied.push("description");
  } else if (shouldApplyString(result.vendorName, current.description)) {
    setters.setDescription(result.vendorName.value);
    applied.push("description");
  }
  const appliedLocation = applyOcrPlaceWithCity(
    result,
    current.locationName,
    setters.setLocationName,
    "location",
  );
  if (appliedLocation) applied.push(appliedLocation);
  if (shouldApplyString(result.notes, current.notes)) {
    setters.setNotes(result.notes.value);
    applied.push("notes");
  }
  if (shouldApplyEnum(result.paymentMode, current.paymentMode, "unknown")) {
    setters.setPaymentMode(result.paymentMode.value);
    applied.push("payment mode");
  }

  return applied;
}

export function previewOtherReceiptOcr(
  result: ExpenseReceiptOcrResult,
  current: {
    amountInr: number;
    expenseCategory: TripOtherExpenseCategory;
    description: string;
    locationName: string;
    notes: string;
    paymentMode: OperationalPaymentMode;
  },
  setters: {
    setAmountInr: (value: number) => void;
    setExpenseCategory: (value: TripOtherExpenseCategory) => void;
    setDescription: (value: string) => void;
    setLocationName: (value: string) => void;
    setNotes: (value: string) => void;
    setPaymentMode: (value: OperationalPaymentMode) => void;
  },
): BillFieldUpdateAction[] {
  const updates: BillFieldUpdateAction[] = [];

  const amountUpdate = previewOcrAmount(result, current.amountInr, setters.setAmountInr);
  if (amountUpdate) updates.push(amountUpdate);

  const categoryUpdate = previewOcrEnumField(
    "category",
    "Category",
    result.expenseCategory,
    current.expenseCategory,
    "parking",
    setters.setExpenseCategory,
    (value) => formatOtherExpenseCategoryLabel(value),
  );
  if (categoryUpdate && !isFuelBillOcrResult(result)) updates.push(categoryUpdate);

  const descriptionUpdate =
    previewOcrStringField(
      "description",
      "Description",
      result.description,
      current.description,
      setters.setDescription,
    ) ??
    previewOcrStringField(
      "description",
      "Description",
      result.vendorName,
      current.description,
      setters.setDescription,
    );
  if (descriptionUpdate) updates.push(descriptionUpdate);

  const locationUpdate = previewOcrPlaceWithCity(
    result,
    current.locationName,
    setters.setLocationName,
    "location",
  );
  if (locationUpdate) updates.push(locationUpdate);

  const notesUpdate = previewOcrStringField(
    "notes",
    "Notes",
    result.notes,
    current.notes,
    setters.setNotes,
  );
  if (notesUpdate) updates.push(notesUpdate);

  const paymentUpdate = previewOcrEnumField(
    "payment-mode",
    "Payment mode",
    result.paymentMode,
    current.paymentMode,
    "unknown",
    setters.setPaymentMode,
    formatPaymentModeDisplay,
  );
  if (paymentUpdate) updates.push(paymentUpdate);

  return updates;
}
