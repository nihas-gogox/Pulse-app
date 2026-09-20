import Theme from "@/constants/Theme";
import type {
  ComplianceChecklistTone,
  ComplianceStage,
  ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";

export type ComplianceTone = {
  fg: string;
  bg: string;
};

export const COMPLIANCE_STAGE_TONE: Record<ComplianceStage, ComplianceTone> = {
  pending_for_docs: { fg: Theme.complianceStageDocsFg, bg: Theme.complianceStageDocsBg },
  compliance_pending: { fg: Theme.complianceStagePendingFg, bg: Theme.complianceStagePendingBg },
  compliance_verified: { fg: Theme.complianceStageSuccessFg, bg: Theme.complianceStageSuccessBg },
  advance_payment_processed: { fg: Theme.complianceStageSuccessFg, bg: Theme.complianceStageSuccessBg },
  hard_copy_pod_received: { fg: Theme.complianceStagePendingFg, bg: Theme.complianceStagePendingBg },
  balance_pending: { fg: Theme.complianceStageBalanceFg, bg: Theme.complianceStageBalanceBg },
  payment_settled: { fg: Theme.complianceStageSuccessFg, bg: Theme.complianceStageSuccessBg },
};

export const COMPLIANCE_FILTER_COUNT_TONE: Record<ComplianceStage | "all", string> = {
  all: Theme.textPrimaryDark,
  pending_for_docs: Theme.complianceStageDocsFg,
  compliance_pending: Theme.complianceStagePendingFg,
  compliance_verified: Theme.complianceStageSuccessFg,
  advance_payment_processed: Theme.textMuted,
  hard_copy_pod_received: Theme.complianceStageInfoFg,
  balance_pending: Theme.complianceStageBalanceFg,
  payment_settled: Theme.textMuted,
};

export const COMPLIANCE_GROUP_TONE: Record<ComplianceChecklistTone, { bg: string; fg: string; dot: string; emptyDot: string }> = {
  success: {
    bg: Theme.complianceGroupSuccessBg,
    fg: Theme.complianceGroupSuccessFg,
    dot: Theme.complianceGroupSuccessFg,
    emptyDot: Theme.complianceGroupSuccessDot,
  },
  warning: {
    bg: Theme.complianceGroupWarningBg,
    fg: Theme.complianceGroupWarningFg,
    dot: Theme.complianceGroupWarningFg,
    emptyDot: Theme.complianceGroupWarningDot,
  },
  danger: {
    bg: Theme.complianceGroupDangerBg,
    fg: Theme.complianceGroupDangerFg,
    dot: Theme.complianceGroupDangerFg,
    emptyDot: Theme.complianceGroupDangerDot,
  },
};

export function groupToneVisual(tone: ComplianceChecklistTone | null | undefined) {
  return COMPLIANCE_GROUP_TONE[tone ?? "warning"] ?? COMPLIANCE_GROUP_TONE.warning;
}

export function stageToneVisual(stage: ComplianceStage | null | undefined) {
  return (stage && COMPLIANCE_STAGE_TONE[stage]) ?? COMPLIANCE_STAGE_TONE.compliance_pending;
}

export type CompliancePaymentStatusVisual = {
  label: string;
  tone: ComplianceTone;
};

export function paymentStatusVisual(summary: ComplianceTripSummary): CompliancePaymentStatusVisual {
  if (summary.balance || summary.stage === "payment_settled") {
    return { label: "Settled", tone: COMPLIANCE_STAGE_TONE.payment_settled };
  }
  if (summary.stage === "balance_pending") {
    return { label: "Balance Pending", tone: COMPLIANCE_STAGE_TONE.balance_pending };
  }
  if (summary.advance || summary.stage === "advance_payment_processed") {
    return { label: "Advance Processed", tone: COMPLIANCE_STAGE_TONE.advance_payment_processed };
  }
  return {
    label: "Pending",
    tone: COMPLIANCE_STAGE_TONE.pending_for_docs,
  };
}

export function splitPlace(value: string | null | undefined): { city: string; region: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { city: "—", region: "" };
  const comma = raw.indexOf(",");
  if (comma === -1) return { city: raw, region: "" };
  return {
    city: raw.slice(0, comma).trim() || raw,
    region: raw.slice(comma + 1).trim(),
  };
}

export function pendingDocumentsCopy(pendingCount: number, verified: number, total: number): string {
  if (total === 0) return "No documents uploaded yet";
  if (pendingCount === 0) return "All documents verified";
  if (verified === 0) {
    return `${pendingCount} document${pendingCount === 1 ? "" : "s"} need verification`;
  }
  return `${pendingCount} document${pendingCount === 1 ? "" : "s"} pending`;
}

export function matchesComplianceTripSearch(summary: ComplianceTripSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const compact = needle.replace(/[\s-]/g, "");
  const trip = summary.trip;
  const haystacks = [
    complianceTripDisplayId(trip),
    trip.display_trip_id,
    trip.trip_number,
    trip.booking_ref,
    trip.client_name,
    trip.vehicle_display_number,
    trip.driver_display_name,
    trip.pickup_area,
    trip.drop_location,
    trip.id,
  ];
  return haystacks.some((value) => {
    const raw = (value ?? "").toLowerCase();
    if (!raw) return false;
    return raw.includes(needle) || raw.replace(/[\s-]/g, "").includes(compact);
  });
}

export function complianceTripDisplayId(trip: {
  display_trip_id?: string | null;
  trip_number?: string | null;
  booking_ref?: string | null;
  id: string;
}): string {
  return trip.display_trip_id?.trim() || trip.trip_number?.trim() || trip.booking_ref?.trim() || trip.id.slice(0, 8);
}

export function formatComplianceTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = date.getDate();
  const month = months[date.getMonth()];
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month}, ${String(hours).padStart(2, "0")}:${minutes} ${suffix}`;
}

export function complianceEventAt(trip: {
  pickup_date?: string | null;
  started_at?: string | null;
  created_at?: string | null;
}): string | null {
  return trip.pickup_date || trip.started_at || trip.created_at || null;
}
