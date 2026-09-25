// Types extracted from features/vehicles/utils/vehicleDocuments.util.ts (driver extraction, Phase 2, D19). Types only — no runtime code.

/** Vehicle document types — matches pulse-unified-base utils/documentExpiry.ts */
export interface DocumentWithExpiry {
  url: string;
  expiryDate: string;
  uploadedAt?: string;
}

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
