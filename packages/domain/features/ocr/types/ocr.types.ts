export type OcrJobStatus = "pending" | "processing" | "completed" | "failed";

export type OcrSourceKind = "odometer" | "expense_receipt" | "pod_document";

export type OcrJobRow = {
  id: string;
  organization_id: string;
  document_fingerprint: string;
  source_kind: OcrSourceKind;
  source_subtype: string | null;
  trip_id: string | null;
  trip_document_id: string | null;
  pod_attachment_id: string | null;
  storage_path: string | null;
  status: OcrJobStatus;
  engine_name: string;
  engine_version: string;
  prompt_version: string;
  ocr_model: string | null;
  confidence_score: number | null;
  result_json: Record<string, unknown> | null;
  raw_model_json: Record<string, unknown> | null;
  error_message: string | null;
  is_duplicate: boolean;
  duplicate_of_job_id: string | null;
  force_rescan: boolean;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_duration_ms: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VehicleOdometerEventRow = {
  id: string;
  organization_id: string;
  vehicle_id: string | null;
  trip_id: string | null;
  driver_id: string | null;
  ocr_job_id: string | null;
  event_side: "start" | "end";
  odometer_km: number;
  confidence_score: number | null;
  reading_source: "ocr" | "manual";
  photo_storage_path: string | null;
  recorded_at: string;
  created_at: string;
};

export type OcrMetricsSummary = {
  jobs_today: number;
  jobs_this_month: number;
  jobs_in_window: number;
  avg_duration_ms: number | null;
  avg_confidence: number | null;
  failed_count: number;
  duplicate_count: number;
  quota_used: number;
  quota_limit: number | null;
  quota_remaining: number | null;
  quota_tier: string;
};

export type ExpenseOcrKind = "fuel" | "toll" | "other";

export type EnqueueOcrJobInput = {
  organizationId: string;
  localUri: string;
  sourceKind: OcrSourceKind;
  sourceSubtype?: string;
  tripId?: string | null;
  tripDocumentId?: string | null;
  podAttachmentId?: string | null;
  storagePath?: string | null;
  vehicleId?: string | null;
  driverId?: string | null;
  createdBy?: string | null;
  forceRescan?: boolean;
  userRequestedRescan?: boolean;
  expenseEntryId?: string | null;
  expenseKind?: ExpenseOcrKind | null;
};
