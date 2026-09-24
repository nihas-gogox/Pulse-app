export type OdometerScanPhase =
  | "idle"
  | "preparing"
  | "analyzing"
  | "complete"
  | "confirm"
  | "error";

export type OdometerScanState = {
  phase: OdometerScanPhase;
  message: string;
  /** Scanned KM waiting for user confirmation before overwrite. */
  pendingKm?: string | null;
  /** Last KM value read from OCR — shown after scan for validation / re-apply. */
  detectedKm?: string | null;
  appliedFields?: string[];
  stepIndex?: number;
  processingSec?: number;
  error?: string;
};

export const ODOMETER_SCAN_IDLE: OdometerScanState = {
  phase: "idle",
  message: "",
  appliedFields: [],
};

export const ODOMETER_SCAN_MESSAGES = [
  "Optimizing dashboard photo…",
  "Reading odometer digits…",
  "Detecting total KM…",
  "Validating reading…",
] as const;
