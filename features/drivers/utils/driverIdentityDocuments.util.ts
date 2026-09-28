/**
 * Driver identity docs shown on Trip Asset Vault (License + Aadhaar).
 * Persisted on entity_documents (same store Compliance uses for driver slots).
 */

export type DriverIdentityDocType = "license" | "aadhaar";

export const DRIVER_IDENTITY_LABELS: Record<DriverIdentityDocType, string> = {
  license: "Driver License",
  aadhaar: "Driver Aadhaar Card",
};

export const DRIVER_IDENTITY_SHORT_LABELS: Record<DriverIdentityDocType, string> = {
  license: "License",
  aadhaar: "Aadhaar",
};

export const DRIVER_IDENTITY_UPLOAD_ORDER: readonly DriverIdentityDocType[] = [
  "license",
  "aadhaar",
];

export const DRIVER_IDENTITY_TYPE_HINT = DRIVER_IDENTITY_UPLOAD_ORDER.map(
  (docType) => DRIVER_IDENTITY_SHORT_LABELS[docType].toUpperCase(),
).join(" · ");

export type DriverIdentityDocuments = Partial<
  Record<
    DriverIdentityDocType,
    {
      id: string;
      url: string;
      expiryDate?: string | null;
      fileName?: string | null;
    }
  >
>;

export function driverIdentityOnFileSummary(
  docs: DriverIdentityDocuments | null | undefined,
): string {
  return DRIVER_IDENTITY_UPLOAD_ORDER.filter((docType) => !!docs?.[docType]?.url)
    .map((docType) => DRIVER_IDENTITY_SHORT_LABELS[docType])
    .join(" · ");
}

export function isDriverIdentityDocType(value: string): value is DriverIdentityDocType {
  return value === "license" || value === "aadhaar";
}
