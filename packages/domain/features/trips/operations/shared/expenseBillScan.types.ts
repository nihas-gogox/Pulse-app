export type BillScanPhase =
  | "idle"
  | "preparing"
  | "analyzing"
  | "confirm"
  | "complete"
  | "error";

/** One field change proposed by OCR — shown before the driver confirms. */
export type BillPendingFieldUpdate = {
  id: string;
  label: string;
  fromDisplay: string;
  toDisplay: string;
};

export type BillScanState = {
  phase: BillScanPhase;
  /** Primary status line shown in the scan banner. */
  message: string;
  /** Human-readable fields auto-filled from OCR (e.g. "Amount", "City"). */
  appliedFields: string[];
  /** Proposed updates awaiting driver confirmation. */
  pendingUpdates?: BillPendingFieldUpdate[];
  /** Fields applied from OCR — shown for fleet validation after confirm. */
  appliedOcrUpdates?: BillPendingFieldUpdate[];
  /** 0–3 pipeline step index while scanning. */
  stepIndex?: number;
  processingSec?: number;
  error?: string;
};

export const BILL_SCAN_IDLE: BillScanState = {
  phase: "idle",
  message: "",
  appliedFields: [],
};
