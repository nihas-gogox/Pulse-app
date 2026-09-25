import { supabase } from "@pulse/core/lib/supabase";

export type OcrQuotaStatus = {
  allowed: boolean;
  used: number;
  limit: number | null;
  tier: string;
  reason?: string | null;
};

export class OcrQuotaExceededError extends Error {
  readonly quota: OcrQuotaStatus;

  constructor(quota: OcrQuotaStatus) {
    super(
      quota.limit != null
        ? `Monthly scan limit reached (${quota.used}/${quota.limit}). Upgrade for more Pulse Scans.`
        : "Monthly scan limit reached.",
    );
    this.name = "OcrQuotaExceededError";
    this.quota = quota;
  }
}

export async function checkOcrScanQuota(organizationId: string): Promise<OcrQuotaStatus> {
  const { data, error } = await supabase().rpc("check_ocr_scan_quota", {
    p_org_id: organizationId,
  });
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown> | null;
  return {
    allowed: Boolean(row?.allowed),
    used: Number(row?.used ?? 0),
    limit: row?.limit != null ? Number(row.limit) : null,
    tier: String(row?.tier ?? "pulse_core"),
    reason: row?.reason != null ? String(row.reason) : null,
  };
}

export async function assertOcrScanQuota(organizationId: string): Promise<OcrQuotaStatus> {
  const quota = await checkOcrScanQuota(organizationId);
  if (!quota.allowed) {
    throw new OcrQuotaExceededError(quota);
  }
  return quota;
}
