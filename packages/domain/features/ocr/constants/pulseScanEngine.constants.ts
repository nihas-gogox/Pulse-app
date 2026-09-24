import { OCR_ENGINE_VERSION } from "./ocr.constants";
import type { OcrSourceKind } from "../types/ocr.types";

/**
 * Pulse Scan Engine — unified document scan catalog.
 * All products enqueue through the same ocr_jobs pipeline; types map to extractors.
 */
export type PulseScanType =
  | "expense_receipt"
  | "fuel_bill"
  | "toll_receipt"
  | "other_expense"
  | "odometer"
  | "pod_document"
  | "invoice"
  | "vehicle_document"
  | "vehicle_rc"
  | "vehicle_insurance"
  | "driver_licence"
  | "aadhaar"
  | "pan";

export type PulseScanTypeConfig = {
  id: PulseScanType;
  label: string;
  sourceKind: OcrSourceKind;
  sourceSubtype?: string;
  engineVersion: string;
  /** Implemented extractors only; others queue + fail gracefully until prompts ship. */
  implemented: boolean;
};

export const PULSE_SCAN_ENGINE_VERSION = "pulse-scan-engine-v1";

export const PULSE_SCAN_TYPES: Record<PulseScanType, PulseScanTypeConfig> = {
  expense_receipt: {
    id: "expense_receipt",
    label: "Expense receipt",
    sourceKind: "expense_receipt",
    sourceSubtype: "other",
    engineVersion: OCR_ENGINE_VERSION.expenseReceipt,
    implemented: true,
  },
  fuel_bill: {
    id: "fuel_bill",
    label: "Fuel bill",
    sourceKind: "expense_receipt",
    sourceSubtype: "fuel",
    engineVersion: OCR_ENGINE_VERSION.expenseReceipt,
    implemented: true,
  },
  toll_receipt: {
    id: "toll_receipt",
    label: "Toll receipt",
    sourceKind: "expense_receipt",
    sourceSubtype: "toll",
    engineVersion: OCR_ENGINE_VERSION.expenseReceipt,
    implemented: true,
  },
  other_expense: {
    id: "other_expense",
    label: "Other expense",
    sourceKind: "expense_receipt",
    sourceSubtype: "other",
    engineVersion: OCR_ENGINE_VERSION.expenseReceipt,
    implemented: true,
  },
  odometer: {
    id: "odometer",
    label: "Odometer",
    sourceKind: "odometer",
    engineVersion: OCR_ENGINE_VERSION.odometer,
    implemented: true,
  },
  pod_document: {
    id: "pod_document",
    label: "POD document",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: true,
  },
  invoice: {
    id: "invoice",
    label: "Invoice",
    sourceKind: "expense_receipt",
    sourceSubtype: "other",
    engineVersion: OCR_ENGINE_VERSION.expenseReceipt,
    implemented: false,
  },
  vehicle_document: {
    id: "vehicle_document",
    label: "Vehicle document",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: false,
  },
  vehicle_rc: {
    id: "vehicle_rc",
    label: "Vehicle RC",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: false,
  },
  vehicle_insurance: {
    id: "vehicle_insurance",
    label: "Vehicle insurance",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: false,
  },
  driver_licence: {
    id: "driver_licence",
    label: "Driver licence",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: false,
  },
  aadhaar: {
    id: "aadhaar",
    label: "Aadhaar",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: false,
  },
  pan: {
    id: "pan",
    label: "PAN",
    sourceKind: "pod_document",
    engineVersion: OCR_ENGINE_VERSION.podDocument,
    implemented: false,
  },
};

export function pulseScanToEnqueueFields(scanType: PulseScanType): {
  sourceKind: OcrSourceKind;
  sourceSubtype?: string;
  engineVersion: string;
} {
  const cfg = PULSE_SCAN_TYPES[scanType];
  return {
    sourceKind: cfg.sourceKind,
    sourceSubtype: cfg.sourceSubtype,
    engineVersion: cfg.engineVersion,
  };
}
