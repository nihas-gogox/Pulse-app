import type { VehicleDocuments } from '@pulse/domain/features/vehicles/types/vehicleDocuments.types';
export type { DocumentWithExpiry, VehicleExtraDocument, VehicleDocuments } from '@pulse/domain/features/vehicles/types/vehicleDocuments.types';


export type VehicleComplianceDocType = "rc" | "insurance" | "fitness" | "pollution";

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
