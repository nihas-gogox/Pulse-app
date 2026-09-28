import type {
  SupplierKycDocType,
  SupplierKycDocument,
} from "@/features/suppliers/types/supplierManagement.types";
import { formatTripTableDate } from "@/lib/format";

export type SupplierVaultKycDoc = {
  id: string;
  docType: SupplierKycDocType;
  documentType: string;
  status: "Verified" | "Pending";
  dateLabel: string;
  storagePath: string | null;
  fileName: string | null;
};

export type SupplierVerificationVaultSlot = {
  slotId: string;
  docType: SupplierKycDocType;
  documentType: string;
};

/** GST / PAN / bank proof cards shown on the partner Verification Vault. */
export const SUPPLIER_VERIFICATION_VAULT_SLOTS: readonly SupplierVerificationVaultSlot[] = [
  { slotId: "gst", docType: "gstin", documentType: "GST REGISTRATION" },
  { slotId: "pan", docType: "pan", documentType: "PAN IDENTITY" },
  { slotId: "bank", docType: "cancelled_cheque", documentType: "BANK PROOF" },
];

const SUPPLIER_KYC_TYPES = new Set<string>(
  SUPPLIER_VERIFICATION_VAULT_SLOTS.map((s) => s.docType).concat([
    "cin",
    "partnership_deed",
    "certificate_of_incorporation",
    "board_resolution",
    "aadhaar_front",
    "aadhaar_back",
    "msme",
    "udyam",
    "gumasta",
    "bank_statement",
    "bank_proof_other",
    "physical_verification",
    "signed_agreement",
    "other",
  ]),
);

export function isSupplierKycDocType(value: string): value is SupplierKycDocType {
  return SUPPLIER_KYC_TYPES.has(value);
}

export function resolveSupplierVaultDocType(
  doc: { docType?: string | null; documentType?: string | null },
): SupplierKycDocType | null {
  const typed = (doc.docType ?? "").trim();
  if (typed && isSupplierKycDocType(typed)) return typed;
  const label = (doc.documentType ?? "").toUpperCase();
  if (label.includes("GST")) return "gstin";
  if (label.includes("PAN")) return "pan";
  if (label.includes("BANK")) return "cancelled_cheque";
  return null;
}

function latestForType(
  docs: SupplierKycDocument[],
  docType: SupplierKycDocType,
): SupplierKycDocument | undefined {
  return docs
    .filter((d) => d.doc_type === docType)
    .sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0))[0];
}

export function mapSupplierVerificationVaultDocs(
  docs: SupplierKycDocument[],
): SupplierVaultKycDoc[] {
  return SUPPLIER_VERIFICATION_VAULT_SLOTS.map((slot) => {
    const match = latestForType(docs, slot.docType);
    const uploadedAt = match?.updated_at || match?.created_at || match?.verified_at;
    return {
      id: match?.id ?? slot.slotId,
      docType: slot.docType,
      documentType: slot.documentType,
      status: match?.status === "verified" ? "Verified" : "Pending",
      dateLabel: uploadedAt ? formatTripTableDate(uploadedAt) : "—",
      storagePath: match?.storage_path ?? null,
      fileName: match?.file_name ?? null,
    };
  });
}
