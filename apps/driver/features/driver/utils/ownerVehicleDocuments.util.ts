/**
 * Owner vehicle document types, expiry status, vault summary.
 * Expiry thresholds: Valid | Expiring Soon (≤30d) | Expired.
 */

export const OWNER_VEHICLE_DOC_TYPES = [
  'rc',
  'insurance',
  'fitness',
  'permit',
  'puc',
  'tax',
  'other',
] as const;

export type OwnerVehicleDocType = (typeof OWNER_VEHICLE_DOC_TYPES)[number];

export const OWNER_VEHICLE_DOC_LABELS: Record<OwnerVehicleDocType, string> = {
  rc: 'Registration Certificate (RC)',
  insurance: 'Insurance',
  fitness: 'Fitness Certificate',
  permit: 'Permit',
  puc: 'PUC',
  tax: 'Tax',
  other: 'Other documents',
};

/** Short labels for list chips. */
export const OWNER_VEHICLE_DOC_SHORT: Record<OwnerVehicleDocType, string> = {
  rc: 'RC',
  insurance: 'Insurance',
  fitness: 'Fitness',
  permit: 'Permit',
  puc: 'PUC',
  tax: 'Tax',
  other: 'Other',
};

export type OwnerDocExpiryState = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

export const OWNER_DOC_EXPIRING_SOON_DAYS = 30;

export function ownerDocExpiryState(
  expiresAt: string | null | undefined,
): OwnerDocExpiryState {
  if (!expiresAt) return 'unknown';
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return 'unknown';
  exp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (exp < today) return 'expired';
  const soon = new Date(today);
  soon.setDate(soon.getDate() + OWNER_DOC_EXPIRING_SOON_DAYS);
  if (exp <= soon) return 'expiring_soon';
  return 'valid';
}

export function daysUntilOwnerDocExpiry(
  expiresAt: string | null | undefined,
): number | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return null;
  exp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - today.getTime()) / 86_400_000);
}

export function formatOwnerDocExpiryLabel(
  expiresAt: string | null | undefined,
): string {
  const state = ownerDocExpiryState(expiresAt);
  const days = daysUntilOwnerDocExpiry(expiresAt);
  if (state === 'expired') {
    const n = days == null ? null : Math.abs(days);
    return n == null ? 'Expired' : n === 0 ? 'Expired today' : `Expired ${n}d ago`;
  }
  if (state === 'expiring_soon' && days != null) {
    return days === 0 ? 'Expires today' : `Expires in ${days}d`;
  }
  if (state === 'valid' && expiresAt) {
    try {
      return `Valid · ${new Date(expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    } catch {
      return 'Valid';
    }
  }
  return 'No expiry set';
}

export type OwnerVehicleDocSummary = {
  totalTypes: number;
  uploaded: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  unknownExpiry: number;
  headline: string;
};

export function summarizeOwnerVehicleDocuments(
  docs: { document_type: string; expires_at: string | null }[],
): OwnerVehicleDocSummary {
  const byType = new Map(docs.map((d) => [d.document_type, d]));
  let valid = 0;
  let expiringSoon = 0;
  let expired = 0;
  let unknownExpiry = 0;
  for (const t of OWNER_VEHICLE_DOC_TYPES) {
    const row = byType.get(t);
    if (!row) continue;
    const s = ownerDocExpiryState(row.expires_at);
    if (s === 'valid') valid += 1;
    else if (s === 'expiring_soon') expiringSoon += 1;
    else if (s === 'expired') expired += 1;
    else unknownExpiry += 1;
  }
  const uploaded = docs.length;
  const totalTypes = OWNER_VEHICLE_DOC_TYPES.length;
  const attention = expired + expiringSoon;
  let headline = `Documents: ${uploaded}/${totalTypes} uploaded`;
  if (uploaded === 0) {
    headline = 'Documents: none uploaded';
  } else if (attention === 0 && unknownExpiry === 0) {
    headline = `Documents: ${valid}/${totalTypes} valid`;
  } else if (expiringSoon > 0 && expired === 0) {
    headline = `Documents: ${valid + unknownExpiry}/${totalTypes} ok · ${expiringSoon} expiring soon`;
  } else if (expired > 0) {
    headline = `Documents: ${expired} expired${expiringSoon > 0 ? ` · ${expiringSoon} expiring` : ''}`;
  }
  return {
    totalTypes,
    uploaded,
    valid,
    expiringSoon,
    expired,
    unknownExpiry,
    headline,
  };
}
