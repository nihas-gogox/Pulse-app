import {
  enqueueOcrJob,
  enqueueAndProcessOcrJob,
  processOcrJob,
  scheduleOcrJobProcessing,
  scheduleOcrRescan,
  type EnqueueOcrJobResult,
  type OcrProgressPhase,
} from "./ocrJobProcessor.service";
import { checkOcrScanQuota, assertOcrScanQuota } from "./ocrQuota.service";
import type { PulseScanType } from "../constants/pulseScanEngine.constants";
import { pulseScanToEnqueueFields } from "../constants/pulseScanEngine.constants";
import type { EnqueueOcrJobInput } from "../types/ocr.types";

export type PulseScanEnqueueInput = Omit<EnqueueOcrJobInput, "sourceKind" | "sourceSubtype"> & {
  scanType: PulseScanType;
  odometerSide?: "start" | "end";
};

function toEnqueueInput(input: PulseScanEnqueueInput): EnqueueOcrJobInput {
  const fields = pulseScanToEnqueueFields(input.scanType);
  return {
    ...input,
    sourceKind: fields.sourceKind,
    sourceSubtype:
      input.scanType === "odometer"
        ? input.odometerSide
        : fields.sourceSubtype,
  };
}

/** Pulse Scan Engine — single facade for all document OCR. */
export const PulseScanEngine = {
  enqueue: (input: PulseScanEnqueueInput) => enqueueOcrJob(toEnqueueInput(input)),
  process: (jobId: string, input: PulseScanEnqueueInput, options?: Parameters<typeof processOcrJob>[2]) =>
    processOcrJob(jobId, toEnqueueInput(input), options),
  schedule: (jobId: string, input: PulseScanEnqueueInput, options?: Parameters<typeof scheduleOcrJobProcessing>[2]) =>
    scheduleOcrJobProcessing(jobId, toEnqueueInput(input), options),
  enqueueAndProcess: (input: PulseScanEnqueueInput, options?: Parameters<typeof enqueueAndProcessOcrJob>[1]) =>
    enqueueAndProcessOcrJob(toEnqueueInput(input), options),
  scheduleRescan: (
    input: PulseScanEnqueueInput,
    existingJob: Parameters<typeof scheduleOcrRescan>[1],
    options?: Parameters<typeof scheduleOcrRescan>[2],
  ) => scheduleOcrRescan(toEnqueueInput(input), existingJob, options),
  checkQuota: checkOcrScanQuota,
  assertQuota: assertOcrScanQuota,
};

export type { EnqueueOcrJobResult, OcrProgressPhase };
