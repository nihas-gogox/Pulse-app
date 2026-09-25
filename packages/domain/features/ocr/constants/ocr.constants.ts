/** Pulse Scan product engine identifier stored on ocr_jobs.engine_name. */
export const OCR_ENGINE_NAME = "pulse-scan-engine";

/** Bump when prompts / parsers change — triggers allowed re-scan for stale jobs. */
export const OCR_ENGINE_VERSION = {
  odometer: "odometer-v1",
  expenseReceipt: "expense-receipt-v1",
  podDocument: "pod-document-v1",
} as const;

/** Prompt revision per extractor — stored on ocr_jobs.prompt_version. */
export const OCR_PROMPT_VERSION = {
  odometer: "odometer-prompt-v1",
  expenseReceipt: "expense-receipt-prompt-v1",
  podDocument: "pod-document-prompt-v1",
} as const;

/** Legacy rescan threshold — prefer ocrReviewActionForConfidence. */
export const OCR_CONFIDENCE_THRESHOLD = 0.55;

export const OCR_MIN_APPLY_CONFIDENCE_ODOMETER = 0.2;
export const OCR_MIN_CONFIRM_CONFIDENCE_ODOMETER = 0.12;

export {
  OCR_CONFIDENCE_AUTO_ACCEPT,
  OCR_CONFIDENCE_SUGGEST_MIN,
} from "../utils/ocrConfidenceReview.util";

export function engineVersionForSource(
  sourceKind: keyof typeof OCR_ENGINE_VERSION | "odometer" | "expense_receipt" | "pod_document",
): string {
  switch (sourceKind) {
    case "odometer":
      return OCR_ENGINE_VERSION.odometer;
    case "expense_receipt":
      return OCR_ENGINE_VERSION.expenseReceipt;
    case "pod_document":
      return OCR_ENGINE_VERSION.podDocument;
    default:
      return OCR_ENGINE_VERSION.odometer;
  }
}

export function promptVersionForSource(
  sourceKind: keyof typeof OCR_PROMPT_VERSION | "odometer" | "expense_receipt" | "pod_document",
): string {
  switch (sourceKind) {
    case "odometer":
      return OCR_PROMPT_VERSION.odometer;
    case "expense_receipt":
      return OCR_PROMPT_VERSION.expenseReceipt;
    case "pod_document":
      return OCR_PROMPT_VERSION.podDocument;
    default:
      return OCR_PROMPT_VERSION.odometer;
  }
}
