import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { deriveComplianceDocumentRows, labelForDocType } from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import {
  evaluateCompliancePaymentGuard,
  type ComplianceLedgerCategory,
} from "@/features/tripCompliance/utils/compliancePaymentGuard.util";

export type PaymentReadinessStatus = "ready" | "blocked" | "posted";

export type CompliancePaymentLane = {
  category: ComplianceLedgerCategory;
  status: PaymentReadinessStatus;
  reason: string | null;
};

export type RequiredTripDocumentSummary = {
  total: number;
  verified: number;
  pending: number;
  missing: number;
  rejected: number;
  missingLabels: string[];
  pendingLabels: string[];
  rejectedLabels: string[];
  nextAction: string;
  markVerifiedReady: boolean;
};

/** Required trip types only (LR / E-way Bill / Invoice). On-file pending is not verified. */
export function summarizeRequiredTripDocuments(
  documents: ComplianceTripSummary["documents"],
): RequiredTripDocumentSummary {
  const requiredRows = deriveComplianceDocumentRows(documents).filter((row) => row.required);
  const missingLabels = requiredRows.filter((row) => row.status === "missing").map((row) => labelForDocType(row.type));
  const pendingLabels = requiredRows.filter((row) => row.status === "pending").map((row) => labelForDocType(row.type));
  const rejectedLabels = requiredRows.filter((row) => row.status === "rejected").map((row) => labelForDocType(row.type));
  const verified = requiredRows.filter((row) => row.status === "verified").length;
  const markVerifiedReady = requiredRows.length > 0 && verified === requiredRows.length;
  let nextAction = "Upload required documents";
  if (missingLabels[0]) nextAction = `Upload ${missingLabels[0]}`;
  else if (rejectedLabels[0]) nextAction = `Replace ${rejectedLabels[0]}`;
  else if (pendingLabels[0]) nextAction = `Review ${pendingLabels[0]}`;
  else if (markVerifiedReady) nextAction = "Mark Compliance Verified";
  return {
    total: requiredRows.length,
    verified,
    pending: pendingLabels.length,
    missing: missingLabels.length,
    rejected: rejectedLabels.length,
    missingLabels,
    pendingLabels,
    rejectedLabels,
    nextAction,
    markVerifiedReady,
  };
}

export type ComplianceQueueReadiness = {
  requiredDocs: RequiredTripDocumentSummary;
  missingRequired: string[];
  rejected: string[];
  pendingVerification: string[];
  complianceVerificationIncomplete: boolean;
  requiredDocsVerified: boolean;
  advance: CompliancePaymentLane;
  balance: CompliancePaymentLane;
  paymentReady: boolean;
  readyCategory: ComplianceLedgerCategory | null;
  blockerLines: string[];
  nextAction: string;
};

function lane(
  category: ComplianceLedgerCategory,
  status: PaymentReadinessStatus,
  reason: string | null,
): CompliancePaymentLane {
  return { category, status, reason };
}

/**
 * Queue/review payment readiness from the already-built summary.
 * Ledger duplicate/order uses the same guard as `checkCompliancePaymentAllowed`.
 * Advance also requires `compliance_verified_at` (same gate as Trip Detail).
 * Balance also requires hard-copy POD received (same gate as Trip Detail).
 */
export function deriveComplianceQueueReadiness(summary: ComplianceTripSummary): ComplianceQueueReadiness {
  const requiredDocs = summarizeRequiredTripDocuments(summary.documents);
  const missingRequired = requiredDocs.missingLabels;
  const rejected = requiredDocs.rejectedLabels;
  const pendingVerification = requiredDocs.pendingLabels;
  const requiredDocsVerified = requiredDocs.markVerifiedReady;
  const complianceVerificationIncomplete = !summary.complianceVerifiedAt;

  const bucket = {
    advance: summary.advance ? [summary.advance] : [],
    balance: summary.balance ? [summary.balance] : [],
  };
  const advanceGuard = evaluateCompliancePaymentGuard("compliance_advance", bucket);
  const balanceGuard = evaluateCompliancePaymentGuard("compliance_balance", bucket);

  let advance: CompliancePaymentLane;
  if (summary.advance) {
    advance = lane("compliance_advance", "posted", `Advance posted ₹${summary.advance.amount.toLocaleString("en-IN")}`);
  } else if (!advanceGuard.ok) {
    advance = lane("compliance_advance", "blocked", advanceGuard.reason ?? "Advance is blocked.");
  } else if (complianceVerificationIncomplete) {
    advance = lane("compliance_advance", "blocked", "Compliance verification not completed.");
  } else {
    advance = lane("compliance_advance", "ready", null);
  }

  let balance: CompliancePaymentLane;
  if (summary.balance) {
    balance = lane("compliance_balance", "posted", `Balance posted ₹${summary.balance.amount.toLocaleString("en-IN")}`);
  } else if (!balanceGuard.ok) {
    balance = lane("compliance_balance", "blocked", balanceGuard.reason ?? "Balance is blocked.");
  } else if (!summary.hardCopyPod.received) {
    balance = lane("compliance_balance", "blocked", "Hard-copy POD has not been marked received.");
  } else {
    balance = lane("compliance_balance", "ready", null);
  }

  const readyCategory: ComplianceLedgerCategory | null =
    advance.status === "ready" ? "compliance_advance" : balance.status === "ready" ? "compliance_balance" : null;

  const blockerLines: string[] = [];
  if (missingRequired.length) blockerLines.push(`Missing: ${missingRequired.join(", ")}`);
  if (rejected.length) blockerLines.push(`Rejected: ${rejected.join(", ")}`);
  if (pendingVerification.length) blockerLines.push(`Pending verification: ${pendingVerification.join(", ")}`);
  if (complianceVerificationIncomplete) blockerLines.push("Compliance verification not completed");
  if (advance.status === "blocked" && advance.reason) blockerLines.push(advance.reason);
  if (balance.status === "blocked" && balance.reason) blockerLines.push(balance.reason);
  if (advance.status === "posted" && advance.reason) blockerLines.push(advance.reason);
  if (balance.status === "posted" && balance.reason) blockerLines.push(balance.reason);

  // Normalize trailing punctuation so "…not completed" / "…not completed." collapse.
  const uniqueLines = [
    ...new Map(
      blockerLines.map((line) => {
        const normalized = line.replace(/\.+$/, "").trim();
        return [normalized.toLowerCase(), normalized] as const;
      }),
    ).values(),
  ];
  let nextAction = requiredDocs.nextAction;
  if (requiredDocs.markVerifiedReady && complianceVerificationIncomplete) {
    nextAction = "Mark Compliance Verified";
  } else if (readyCategory === "compliance_advance") {
    nextAction = "Post advance payment";
  } else if (readyCategory === "compliance_balance") {
    nextAction = "Post balance payment";
  } else if (!requiredDocs.markVerifiedReady) {
    nextAction = requiredDocs.nextAction;
  } else if (advance.status === "blocked" && advance.reason) {
    nextAction = advance.reason;
  } else if (balance.status === "blocked" && balance.reason) {
    nextAction = balance.reason;
  }

  return {
    requiredDocs,
    missingRequired,
    rejected,
    pendingVerification,
    complianceVerificationIncomplete,
    requiredDocsVerified,
    advance,
    balance,
    paymentReady: readyCategory != null,
    readyCategory,
    blockerLines: uniqueLines,
    nextAction,
  };
}

export function paymentReadinessLabel(readiness: ComplianceQueueReadiness): { label: string; detail: string } {
  if (readiness.readyCategory === "compliance_advance") {
    return { label: "Payment ready", detail: "Advance can be posted." };
  }
  if (readiness.readyCategory === "compliance_balance") {
    return { label: "Payment ready", detail: "Balance can be posted." };
  }
  if (readiness.advance.status === "posted" && readiness.balance.status === "posted") {
    return { label: "Settled", detail: "Advance and balance are posted." };
  }
  return {
    label: "Payment blocked",
    detail: readiness.blockerLines[0] ?? "This trip is not ready for payment.",
  };
}
