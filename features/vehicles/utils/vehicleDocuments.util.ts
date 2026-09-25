/** Vehicle document types — matches pulse-unified-base utils/documentExpiry.ts */
export interface DocumentWithExpiry {
  url: string;
  expiryDate: string;
  uploadedAt?: string;
  /** Set only when someone approves this file in Compliance. Upload alone does not set it. */
  verifiedAt?: string | null;
}

export type VehicleComplianceDocType = "rc" | "insurance" | "fitness" | "pollution";

/** Extra files attached from the trip vault (not RC / insurance / fitness / PUC). */
export interface VehicleExtraDocument extends DocumentWithExpiry {
  id: string;
  fileName?: string;
}

export interface VehicleDocuments {
  rc?: DocumentWithExpiry;
  insurance?: DocumentWithExpiry;
  fitness?: DocumentWithExpiry;
  pollution?: DocumentWithExpiry;
  extras?: VehicleExtraDocument[];
}

export const DOCUMENT_LABELS: Record<VehicleComplianceDocType, string> = {
  rc: 'Registration Certificate (RC)',
  insurance: 'Insurance Policy',
  fitness: 'Fitness Certificate',
  pollution: 'PUC Certificate',
};

export const DOCUMENT_SHORT_LABELS: Record<VehicleComplianceDocType, string> = {
  rc: 'RC',
  insurance: 'Insurance',
  fitness: 'Fitness',
  pollution: 'PUC',
};

export const DOCUMENT_EXPIRY_ORDER: VehicleComplianceDocType[] = [
  'insurance',
  'rc',
  'fitness',
  'pollution',
];

/** Upload picker order — RC and Fitness first so they are easy to tell apart. */
export const VEHICLE_UPLOAD_CHOOSER_ORDER: VehicleComplianceDocType[] = [
  'rc',
  'fitness',
  'insurance',
  'pollution',
];

export const VEHICLE_COMPLIANCE_TYPE_HINT = VEHICLE_UPLOAD_CHOOSER_ORDER.map(
  (docType) => DOCUMENT_SHORT_LABELS[docType],
).join(' · ');

export function vehicleComplianceOnFileSummary(
  docs: VehicleDocuments | null | undefined,
): string {
  return VEHICLE_UPLOAD_CHOOSER_ORDER.filter((docType) => !!docs?.[docType]?.url)
    .map((docType) => DOCUMENT_SHORT_LABELS[docType])
    .join(' · ');
}
