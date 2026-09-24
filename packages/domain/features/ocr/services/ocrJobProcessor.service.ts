import { engineVersionForSource, OCR_ENGINE_NAME, promptVersionForSource } from "../constants/ocr.constants";
import {
  claimOcrJob,
  completeOcrJob,
  createDuplicateOcrJob,
  createOcrJobRow,
  failOcrJob,
  getCompletedOcrJobByFingerprint,
  getOcrJobById,
  linkExpenseEntryOcrJob,
  linkTripDocumentOcrJob,
} from "./ocrJob.service";
import { assertOcrScanQuota, OcrQuotaExceededError } from "./ocrQuota.service";
import { persistVehicleOdometerEventFromJob } from "./vehicleOdometerEvent.service";
import type { EnqueueOcrJobInput, OcrJobRow } from "../types/ocr.types";
import { canRequestOcrRescan } from "../utils/ocrRescan.util";
import { notifyOcrJobComplete } from "../utils/ocrNotification.util";
import {
  ocrReviewActionForConfidence,
  shouldAutoApplyField,
} from "../utils/ocrConfidenceReview.util";
import { extractExpenseReceiptOcr } from "../../trips/operations/shared/expenseReceiptOcr.service";
import type { ExpenseBillKind } from "../../trips/operations/shared/expenseReceiptOcr.service";
import {
  extractOdometerPhotoOcr,
  type OdometerPhotoOcrResult,
} from "../../trips/verification/odometerPhotoOcr.service";
import { runOCR } from "../../../lib/pod/ocr";
import { sha256File } from "@pulse/core/lib/crypto/sha256File.util";

import type { PODExtraction } from "@/types/pod";

export type OcrProgressPhase = "preparing" | "analyzing";

export type EnqueueOcrJobResult = {
  job: OcrJobRow;
  /** False when fingerprint cache hit — no Gemini run needed. */
  needsProcessing: boolean;
};

type ProcessOptions = {
  onProgress?: (phase: OcrProgressPhase) => void;
  onComplete?: (job: OcrJobRow) => void;
  onError?: (error: Error, job: OcrJobRow | null) => void;
  notify?: boolean;
};

const inFlight = new Set<string>();

async function runOcrExtractor(
  input: EnqueueOcrJobInput,
  onProgress?: (phase: OcrProgressPhase) => void,
): Promise<{
  result_json: Record<string, unknown>;
  raw_model_json?: Record<string, unknown> | null;
  confidence_score: number | null;
  ocr_model: string | null;
  processing_duration_ms: number;
}> {
  const started = Date.now();

  if (input.sourceKind === "odometer") {
    onProgress?.("preparing");
    onProgress?.("analyzing");
    const result: OdometerPhotoOcrResult = await extractOdometerPhotoOcr(input.localUri);
    return {
      result_json: {
        kind: "odometer",
        odometerKm: result.odometerKm,
        summary: result.summary,
        reviewAction: ocrReviewActionForConfidence(result.odometerKm?.confidence ?? null),
      },
      confidence_score: result.odometerKm?.confidence ?? null,
      ocr_model: result.model,
      processing_duration_ms: Math.round(
        result.processingTimeSec * 1000 || Date.now() - started,
      ),
    };
  }

  if (input.sourceKind === "expense_receipt") {
    const kind = (input.sourceSubtype ?? "other") as ExpenseBillKind;
    const result = await extractExpenseReceiptOcr(input.localUri, kind, onProgress);
    const amountConf = result.amountInr?.confidence ?? null;
    return {
      result_json: {
        kind: "expense_receipt",
        billKind: kind,
        ...result,
        reviewAction: ocrReviewActionForConfidence(amountConf),
      },
      confidence_score: amountConf ?? result.detectedBillKind?.confidence ?? null,
      ocr_model: result.model,
      processing_duration_ms: Math.round(result.processingTimeSec * 1000),
    };
  }

  onProgress?.("preparing");
  const response = await fetch(input.localUri);
  const blob = await response.blob();
  onProgress?.("analyzing");
  const podResult = (await runOCR(
    blob,
    input.storagePath?.split("/").pop() ?? "document.jpg",
    () => undefined,
  )) as unknown as PODExtraction;
  return {
    result_json: { kind: "pod_document", extraction: podResult },
    raw_model_json: podResult as unknown as Record<string, unknown>,
    confidence_score: 0.75,
    ocr_model: "gemini-2.5-flash",
    processing_duration_ms: Date.now() - started,
  };
}

/**
 * Upload path step 1: fingerprint, quota, dedup, persist pending (or return cached).
 * Does NOT call Gemini.
 */
export async function enqueueOcrJob(input: EnqueueOcrJobInput): Promise<EnqueueOcrJobResult> {
  const engineVersion = engineVersionForSource(input.sourceKind);
  const promptVersion = promptVersionForSource(input.sourceKind);
  const fingerprint = await sha256File(input.localUri);

  if (!input.forceRescan && !input.userRequestedRescan) {
    const existing = await getCompletedOcrJobByFingerprint(fingerprint, engineVersion);
    if (existing) {
      if (
        input.tripDocumentId &&
        existing.trip_document_id &&
        existing.trip_document_id !== input.tripDocumentId
      ) {
        const dup = await createDuplicateOcrJob(existing, {
          organization_id: input.organizationId,
          document_fingerprint: fingerprint,
          source_kind: input.sourceKind,
          source_subtype: input.sourceSubtype ?? null,
          trip_id: input.tripId ?? null,
          trip_document_id: input.tripDocumentId,
          storage_path: input.storagePath ?? null,
          created_by: input.createdBy ?? null,
        });
        if (input.tripDocumentId) {
          await linkTripDocumentOcrJob(input.tripDocumentId, dup.id);
        }
        return { job: dup, needsProcessing: false };
      }
      if (input.tripDocumentId) {
        await linkTripDocumentOcrJob(input.tripDocumentId, existing.id);
      }
      return { job: existing, needsProcessing: false };
    }
  }

  await assertOcrScanQuota(input.organizationId);

  const pending = await createOcrJobRow({
    organization_id: input.organizationId,
    document_fingerprint: fingerprint,
    source_kind: input.sourceKind,
    source_subtype: input.sourceSubtype ?? null,
    trip_id: input.tripId ?? null,
    trip_document_id: input.tripDocumentId ?? null,
    pod_attachment_id: input.podAttachmentId ?? null,
    storage_path: input.storagePath ?? null,
    status: "pending",
    engine_name: OCR_ENGINE_NAME,
    engine_version: engineVersion,
    prompt_version: promptVersion,
    ocr_model: null,
    confidence_score: null,
    result_json: null,
    raw_model_json: null,
    error_message: null,
    is_duplicate: false,
    duplicate_of_job_id: null,
    force_rescan: Boolean(input.forceRescan || input.userRequestedRescan),
    processing_started_at: null,
    processing_completed_at: null,
    processing_duration_ms: null,
    created_by: input.createdBy ?? null,
  });

  return { job: pending, needsProcessing: true };
}

/**
 * Upload path step 2: Gemini + save result. Only entry point that calls extractors.
 */
export async function processOcrJob(
  jobId: string,
  input: EnqueueOcrJobInput,
  options?: ProcessOptions,
): Promise<OcrJobRow> {
  const existing = await getOcrJobById(jobId);
  if (existing?.status === "completed") return existing;
  if (existing?.status === "processing") {
    throw new Error("OCR job is already being processed");
  }

  const claimed = await claimOcrJob(jobId);
  if (!claimed) {
    const latest = await getOcrJobById(jobId);
    if (latest?.status === "completed") return latest;
    throw new Error("OCR job is already being processed");
  }

  try {
    const extracted = await runOcrExtractor(input, options?.onProgress);
    const completed = await completeOcrJob(claimed.id, extracted);

    if (input.tripDocumentId) {
      await linkTripDocumentOcrJob(input.tripDocumentId, completed.id);
    }

    if (input.expenseEntryId && input.expenseKind) {
      await linkExpenseEntryOcrJob(input.expenseKind, input.expenseEntryId, completed.id);
    }

    if (input.sourceKind === "odometer" && input.sourceSubtype) {
      await persistVehicleOdometerEventFromJob({
        job: completed,
        eventSide: input.sourceSubtype as "start" | "end",
        tripId: input.tripId ?? null,
        vehicleId: input.vehicleId ?? null,
        driverId: input.driverId ?? null,
        photoStoragePath: input.storagePath ?? null,
      });
    }

    if (options?.notify !== false) {
      void notifyOcrJobComplete(completed);
    }
    options?.onComplete?.(completed);
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR failed";
    const failed = await failOcrJob(claimed.id, message);
    const err = error instanceof Error ? error : new Error(message);
    if (options?.notify !== false) {
      void notifyOcrJobComplete(failed);
    }
    options?.onError?.(err, failed);
    throw err;
  } finally {
    inFlight.delete(jobId);
  }
}

/**
 * Non-blocking: enqueue → return → process in background.
 * Driver expense/odometer saves must not await this.
 */
export function scheduleOcrJobProcessing(
  jobId: string,
  input: EnqueueOcrJobInput,
  options?: ProcessOptions,
): void {
  if (inFlight.has(jobId)) return;
  inFlight.add(jobId);
  void processOcrJob(jobId, input, options).catch(() => {
    /* onError / notification already handled */
  });
}

/** Sync path (e.g. explicit POD scan) — prefer scheduleOcrJobProcessing for driver flows. */
export async function enqueueAndProcessOcrJob(
  input: EnqueueOcrJobInput,
  options?: ProcessOptions,
): Promise<OcrJobRow> {
  const { job, needsProcessing } = await enqueueOcrJob(input);
  if (!needsProcessing) return job;
  return processOcrJob(job.id, input, { ...options, notify: false });
}

export async function loadPersistedOcrJob(
  tripDocumentId: string,
): Promise<OcrJobRow | null> {
  const { getOcrJobForTripDocument } = await import("./ocrJob.service");
  return getOcrJobForTripDocument(tripDocumentId);
}

export async function loadPersistedOcrJobById(
  ocrJobId: string,
): Promise<OcrJobRow | null> {
  return getOcrJobById(ocrJobId);
}

export async function requestOcrRescan(
  input: EnqueueOcrJobInput,
  existingJob: OcrJobRow | null,
  options?: ProcessOptions,
): Promise<OcrJobRow> {
  const engineVersion = engineVersionForSource(input.sourceKind);
  if (!canRequestOcrRescan(existingJob, { userRequested: true, currentEngineVersion: engineVersion })) {
    throw new Error("Rescan not allowed for this document");
  }
  const { job, needsProcessing } = await enqueueOcrJob({
    ...input,
    forceRescan: true,
    userRequestedRescan: true,
  });
  if (!needsProcessing) return job;
  return processOcrJob(job.id, { ...input, forceRescan: true, userRequestedRescan: true }, options);
}

export function scheduleOcrRescan(
  input: EnqueueOcrJobInput,
  existingJob: OcrJobRow | null,
  options?: ProcessOptions,
): void {
  const engineVersion = engineVersionForSource(input.sourceKind);
  if (!canRequestOcrRescan(existingJob, { userRequested: true, currentEngineVersion: engineVersion })) {
    return;
  }
  void enqueueOcrJob({ ...input, forceRescan: true, userRequestedRescan: true }).then(
    ({ job, needsProcessing }) => {
      if (!needsProcessing) {
        options?.onComplete?.(job);
        return;
      }
      scheduleOcrJobProcessing(
        job.id,
        { ...input, forceRescan: true, userRequestedRescan: true },
        options,
      );
    },
  );
}

export function odometerResultFromJob(job: OcrJobRow): OdometerPhotoOcrResult | null {
  if (!job.result_json || job.status !== "completed") return null;
  const odometerKm = job.result_json.odometerKm as OdometerPhotoOcrResult["odometerKm"];
  return {
    odometerKm: odometerKm ?? null,
    summary: typeof job.result_json.summary === "string" ? job.result_json.summary : null,
    model: job.ocr_model ?? "persisted",
    processingTimeSec: (job.processing_duration_ms ?? 0) / 1000,
  };
}

export function expenseResultFromJob(
  job: OcrJobRow,
): import("../../trips/operations/shared/expenseReceiptOcr.service").ExpenseReceiptOcrResult | null {
  if (!job.result_json || job.status !== "completed") return null;
  return job.result_json as import("../../trips/operations/shared/expenseReceiptOcr.service").ExpenseReceiptOcrResult;
}

export { OcrQuotaExceededError, shouldAutoApplyField };
