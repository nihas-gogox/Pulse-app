import type { OdometerScanState } from "./odometerScan.types";

/** Normalize keypad / DB / OCR strings to a comparable KM token. */
export function normalizeOdometerRaw(raw: string): string {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return "";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return trimmed;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export function odometerReadingsEquivalent(a: string, b: string): boolean {
  const na = normalizeOdometerRaw(a);
  const nb = normalizeOdometerRaw(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function buildOdometerScanCompleteState(
  formattedKm: string,
  applied: boolean,
  processingSec?: number,
): OdometerScanState {
  if (applied) {
    return {
      phase: "complete",
      message: `${formattedKm} KM applied · review and save`,
      appliedFields: ["KM reading"],
      detectedKm: formattedKm,
      processingSec,
      stepIndex: 3,
      pendingKm: null,
    };
  }
  return {
    phase: "complete",
    message: `${formattedKm} KM detected · confirm reading below`,
    appliedFields: [],
    detectedKm: formattedKm,
    processingSec,
    stepIndex: 3,
    pendingKm: formattedKm,
  };
}

export function buildOdometerScanConfirmState(
  formattedKm: string,
  currentKm: string,
  processingSec?: number,
  opts?: { lowConfidence?: boolean },
): OdometerScanState {
  const prefix = opts?.lowConfidence ? "Low confidence · " : "";
  return {
    phase: "confirm",
    message: `${prefix}Detected ${formattedKm} KM · current ${currentKm} KM`,
    pendingKm: formattedKm,
    detectedKm: formattedKm,
    appliedFields: [],
    processingSec,
    stepIndex: 3,
  };
}

/** Re-show Apply when keypad reading drifts from last OCR detect; hide when they match again. */
export function reconcileOdometerScanWithReading(
  prev: OdometerScanState,
  detectedKm: string,
  currentRaw: string,
): OdometerScanState {
  if (
    prev.phase === "idle" ||
    prev.phase === "preparing" ||
    prev.phase === "analyzing" ||
    prev.phase === "error"
  ) {
    return prev;
  }

  const detectedNorm = normalizeOdometerRaw(detectedKm);
  if (!detectedNorm) return prev;

  const currentNorm = normalizeOdometerRaw(currentRaw);
  if (odometerReadingsEquivalent(currentNorm, detectedNorm)) {
    return {
      phase: "complete",
      message: `Reading confirmed · ${detectedNorm} KM`,
      appliedFields: ["KM reading"],
      detectedKm: detectedNorm,
      pendingKm: null,
      processingSec: prev.processingSec,
      stepIndex: 3,
    };
  }

  const currentDisplay = currentNorm || currentRaw.trim() || "—";
  return {
    phase: "confirm",
    message: `Detected ${detectedNorm} KM · current ${currentDisplay} KM`,
    pendingKm: detectedNorm,
    detectedKm: detectedNorm,
    appliedFields: [],
    processingSec: prev.processingSec,
    stepIndex: 3,
  };
}
