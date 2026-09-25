export {
  getOcrMetrics,
  getOcrJobForPodAttachment,
  linkExpenseEntryOcrJob,
} from "./services/ocrJob.service";
export {
  enqueueOcrJob,
  enqueueAndProcessOcrJob,
  processOcrJob,
  scheduleOcrJobProcessing,
  scheduleOcrRescan,
  loadPersistedOcrJob,
  loadPersistedOcrJobById,
  requestOcrRescan,
  odometerResultFromJob,
  expenseResultFromJob,
  OcrQuotaExceededError,
  shouldAutoApplyField,
  type EnqueueOcrJobResult,
  type OcrProgressPhase,
} from "./services/ocrJobProcessor.service";
export { PulseScanEngine } from "./services/pulseScanEngine.service";
export { checkOcrScanQuota, assertOcrScanQuota } from "./services/ocrQuota.service";
export {
  persistVehicleOdometerEventFromJob,
  listVehicleOdometerEventsForTrip,
} from "./services/vehicleOdometerEvent.service";
export type {
  OcrJobRow,
  OcrJobStatus,
  OcrMetricsSummary,
  EnqueueOcrJobInput,
  ExpenseOcrKind,
  VehicleOdometerEventRow,
} from "./types/ocr.types";
export {
  OCR_ENGINE_VERSION,
  OCR_ENGINE_NAME,
  OCR_PROMPT_VERSION,
  OCR_CONFIDENCE_THRESHOLD,
  OCR_CONFIDENCE_AUTO_ACCEPT,
  OCR_CONFIDENCE_SUGGEST_MIN,
  engineVersionForSource,
  promptVersionForSource,
} from "./constants/ocr.constants";
export {
  PULSE_SCAN_TYPES,
  PULSE_SCAN_ENGINE_VERSION,
  type PulseScanType,
} from "./constants/pulseScanEngine.constants";
export { canRequestOcrRescan } from "./utils/ocrRescan.util";
export {
  ocrReviewActionForConfidence,
  ocrReviewDecision,
  type OcrReviewAction,
} from "./utils/ocrConfidenceReview.util";
