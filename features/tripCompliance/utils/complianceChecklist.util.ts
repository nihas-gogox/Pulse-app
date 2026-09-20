import {
  COMPLIANCE_DRIVER_DOCUMENT_TYPES,
  COMPLIANCE_VEHICLE_DOCUMENT_TYPES,
  REQUIRED_COMPLIANCE_DOCUMENT_TYPES,
  type ComplianceChecklist,
  type ComplianceChecklistGroup,
  type ComplianceChecklistTone,
  type ComplianceDocumentRow,
} from "@/features/tripCompliance/tripCompliance.types";

export function checklistTone(verified: number, total: number): ComplianceChecklistTone {
  if (total > 0 && verified >= total) return "success";
  if (verified === 0) return "danger";
  return "warning";
}

export function isEntityDocumentSlotVerified(
  doc: { status: string; expiry_date?: string | null; storage_path?: string | null } | undefined,
  now = new Date(),
): boolean {
  if (!doc) return false;
  if (doc.status === "expired" || doc.status === "rejected" || doc.status === "replaced") {
    return false;
  }
  if (doc.expiry_date) {
    const expiry = new Date(`${doc.expiry_date}T00:00:00Z`);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
      return false;
    }
  }
  if (doc.storage_path) return true;
  return doc.status === "verified" || doc.status === "active";
}

export function isTripVaultDocumentOnFile(doc: ComplianceDocumentRow): boolean {
  if (!doc.document_type || doc.status === "rejected") return false;
  return Boolean(doc.storage_path) || doc.status === "verified";
}

function buildGroup(
  key: ComplianceChecklistGroup["key"],
  label: ComplianceChecklistGroup["label"],
  types: readonly string[],
  verifiedTypes: Set<string>,
): ComplianceChecklistGroup {
  const slots = types.map((type) => ({ type, verified: verifiedTypes.has(type) }));
  const verified = slots.filter((slot) => slot.verified).length;
  return {
    key,
    label,
    slots,
    verified,
    total: slots.length,
    tone: checklistTone(verified, slots.length),
  };
}

export function buildComplianceChecklist(input: {
  tripDocuments: ComplianceDocumentRow[];
  vehicleDocuments: Array<{ doc_type: string; status: string; expiry_date?: string | null; storage_path?: string | null }>;
  driverDocuments: Array<{ doc_type: string; status: string; expiry_date?: string | null; storage_path?: string | null }>;
  now?: Date;
}): ComplianceChecklist {
  const now = input.now ?? new Date();
  const tripVerified = new Set(
    input.tripDocuments.filter((doc) => isTripVaultDocumentOnFile(doc)).map((doc) => doc.document_type as string),
  );
  const vehicleVerified = new Set(
    input.vehicleDocuments.filter((doc) => isEntityDocumentSlotVerified(doc, now)).map((doc) => doc.doc_type),
  );
  const driverVerified = new Set(
    input.driverDocuments.filter((doc) => isEntityDocumentSlotVerified(doc, now)).map((doc) => doc.doc_type),
  );

  const groups: ComplianceChecklist["groups"] = [
    buildGroup("trip", "Trip", REQUIRED_COMPLIANCE_DOCUMENT_TYPES, tripVerified),
    buildGroup("vehicle", "Vehicle", COMPLIANCE_VEHICLE_DOCUMENT_TYPES, vehicleVerified),
    buildGroup("driver", "Driver", COMPLIANCE_DRIVER_DOCUMENT_TYPES, driverVerified),
  ];

  const verified = groups.reduce((sum, group) => sum + group.verified, 0);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return { groups, verified, total, tone: checklistTone(verified, total) };
}

export function emptyComplianceChecklist(): ComplianceChecklist {
  return buildComplianceChecklist({ tripDocuments: [], vehicleDocuments: [], driverDocuments: [] });
}

/**
 * Persisted cache can still hold the old 15-slot mock checklist. Rebuild when
 * group slot counts no longer match LR/e-way/invoice, vehicle, and driver.
 */
export function isCurrentComplianceChecklist(checklist: ComplianceChecklist | null | undefined): boolean {
  if (!checklist?.groups || checklist.groups.length !== 3 || !checklist.tone) return false;
  return (
    checklist.groups[0]?.slots.length === REQUIRED_COMPLIANCE_DOCUMENT_TYPES.length &&
    checklist.groups[1]?.slots.length === COMPLIANCE_VEHICLE_DOCUMENT_TYPES.length &&
    checklist.groups[2]?.slots.length === COMPLIANCE_DRIVER_DOCUMENT_TYPES.length
  );
}

export function ensureComplianceChecklist(
  summary:
    | {
        checklist?: ComplianceChecklist | null;
        documents?: ComplianceDocumentRow[];
        vehicleDocuments?: Array<{ doc_type: string; status: string; expiry_date?: string | null; storage_path?: string | null }>;
        driverDocuments?: Array<{ doc_type: string; status: string; expiry_date?: string | null; storage_path?: string | null }>;
      }
    | null
    | undefined,
): ComplianceChecklist {
  return buildComplianceChecklist({
    tripDocuments: summary?.documents ?? [],
    vehicleDocuments: summary?.vehicleDocuments ?? [],
    driverDocuments: summary?.driverDocuments ?? [],
  });
}
