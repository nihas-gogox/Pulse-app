/**
 * Pure derivations for the Compliance table view (Dinesh sir's change set):
 * E-way Bill column, per-group Pending/Approved status, Verify gating and
 * decline state. No I/O — everything comes from the already-loaded summary.
 */
import {
  formatVaultDocDate,
  vaultDocDateToIso,
} from "@/features/trips/components/trip-detail/tripDocTypes";
import { parseEwayFieldEntries } from "@/features/trips/services/ewayBillFields.util";
import type {
  ComplianceDocumentRow,
  ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";
import {
  deriveComplianceDocumentRows,
  labelForDocType,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";

export type ComplianceEwayBillSummary = {
  number: string | null;
  validTillRaw: string | null;
  validTillIso: string | null;
  validTillLabel: string | null;
  expired: boolean;
  extraCount: number;
};

export type ComplianceGroupStatus = {
  status: "approved" | "pending";
  approved: number;
  total: number;
};

export type ComplianceVerifyEligibility = {
  allowed: boolean;
  reason: string | null;
};

/** Local-date `Date` for `YYYY-MM-DD`, or null when it is not a real calendar date. */
function localDateFromIso(iso: string): Date | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Same row Trip Detail shows (`useTripDetail`): newest `eway_bill` row whose
 * `document_number` parses to ≥1 entry. Values are shown as stored; an
 * unparseable validTill is shown raw and never treated as expired.
 */
export function deriveComplianceEwayBill(
  documents: ComplianceDocumentRow[],
  now: Date = new Date(),
): ComplianceEwayBillSummary {
  const empty: ComplianceEwayBillSummary = {
    number: null,
    validTillRaw: null,
    validTillIso: null,
    validTillLabel: null,
    expired: false,
    extraCount: 0,
  };
  let entries: ReturnType<typeof parseEwayFieldEntries> = [];
  // Trip Detail loads trip_documents with `order by uploaded_at desc` (Postgres:
  // nulls first); the compliance fetch is unordered, so mirror that here.
  const uploadedMs = (doc: ComplianceDocumentRow): number => {
    const ms = doc.uploaded_at ? Date.parse(doc.uploaded_at) : Number.NaN;
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  };
  const ewayDocs = documents
    .filter((doc) => doc.document_type === "eway_bill")
    .sort((a, b) => {
      const ta = uploadedMs(a);
      const tb = uploadedMs(b);
      return ta === tb ? 0 : tb > ta ? 1 : -1;
    });
  for (const doc of ewayDocs) {
    const parsed = parseEwayFieldEntries(doc.document_number);
    if (parsed.length > 0) {
      entries = parsed;
      break;
    }
  }
  const first = entries[0];
  if (!first) return empty;

  const number = first.ewayNo.trim() || null;
  const validTillRaw = first.validTill.trim() || null;
  let validTillIso: string | null = null;
  let expired = false;
  if (validTillRaw) {
    const iso = vaultDocDateToIso(validTillRaw);
    const endOfDay = iso ? localDateFromIso(iso) : null;
    if (iso && endOfDay) {
      validTillIso = iso;
      expired = endOfDay.getTime() < now.getTime();
    }
  }
  const validTillLabel = validTillRaw
    ? validTillIso
      ? formatVaultDocDate(validTillRaw) || validTillRaw
      : validTillRaw
    : null;

  return {
    number,
    validTillRaw,
    validTillIso,
    validTillLabel,
    expired,
    extraCount: Math.max(0, entries.length - 1),
  };
}

/** Approved iff the group has required rows and every one is `verified`. */
export function deriveComplianceGroupStatus(rows: ComplianceDocRow[]): ComplianceGroupStatus {
  const required = rows.filter((row) => row.required);
  const approved = required.filter((row) => row.status === "verified").length;
  const total = required.length;
  return {
    status: total > 0 && approved === total ? "approved" : "pending",
    approved,
    total,
  };
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Mirrors the `mark_trip_compliance_verified` server gate: required trip docs
 * (LR, E-way Bill, Invoice) verified. Vehicle/driver docs do not block (D2).
 */
export function canVerifyTrip(summary: ComplianceTripSummary): ComplianceVerifyEligibility {
  if (summary.complianceVerifiedAt) {
    return { allowed: false, reason: "Trip compliance already verified" };
  }
  const pending = deriveComplianceDocumentRows(summary.documents).filter(
    (row) => row.required && row.status !== "verified",
  );
  if (pending.length === 0) return { allowed: true, reason: null };
  return {
    allowed: false,
    reason: `Approve ${joinLabels(pending.map((row) => labelForDocType(row.type)))} first`,
  };
}

/** A decline is shown only while the trip is not yet compliance-verified. */
export function isComplianceDeclineActive(summary: ComplianceTripSummary): boolean {
  return Boolean(summary.complianceDeclinedAt) && !summary.complianceVerifiedAt;
}

/** Finance reject of a verified trip: stays verified, with a decline remark. */
export function isFinanceDeclinedTrip(summary: ComplianceTripSummary): boolean {
  return Boolean(summary.complianceVerifiedAt && summary.complianceDeclinedAt);
}
