export const DELIVERY_PLACE_CODES = [
  'handed_to_recipient',
  'left_at_door',
  'left_with_security',
  'left_at_reception',
] as const;

export const PICKUP_PLACE_CODES = [
  'collected_from_warehouse',
  'collected_from_seller',
  'loaded_on_vehicle',
] as const;

export type DeliveryPlaceCode = (typeof DELIVERY_PLACE_CODES)[number] | 'other';
export type PickupPlaceCode = (typeof PICKUP_PLACE_CODES)[number] | 'other';
export type StopProofPlaceCode = DeliveryPlaceCode | PickupPlaceCode;
export type StopProofKind = 'pickup' | 'delivery';

export const MAX_STOP_PROOF_PHOTOS = 4;

export type DeliveryProofDraft = {
  place: StopProofPlaceCode | null;
  placeNote: string;
  photoUris: string[];
};

export function emptyDeliveryProof(): DeliveryProofDraft {
  return { place: null, placeNote: '', photoUris: [] };
}

export function deliveryPlaceLabel(code: DeliveryPlaceCode): string {
  switch (code) {
    case 'handed_to_recipient':
      return 'Handed to recipient';
    case 'left_at_door':
      return 'Left at door';
    case 'left_with_security':
      return 'Left with security';
    case 'left_at_reception':
      return 'Left at reception';
    default:
      return 'Other';
  }
}

export function pickupPlaceLabel(code: PickupPlaceCode): string {
  switch (code) {
    case 'collected_from_warehouse':
      return 'Collected from warehouse';
    case 'collected_from_seller':
      return 'Collected from seller';
    case 'loaded_on_vehicle':
      return 'Loaded on vehicle';
    default:
      return 'Other';
  }
}

export function stopProofPlaceLabel(kind: StopProofKind, code: StopProofPlaceCode): string {
  if (kind === 'pickup') return pickupPlaceLabel(code as PickupPlaceCode);
  return deliveryPlaceLabel(code as DeliveryPlaceCode);
}

export function encodeDeliveryPlace(place: StopProofPlaceCode | null, note: string): string | null {
  if (!place) return null;
  if (place === 'other') {
    const trimmed = note.trim();
    return trimmed ? `other:${trimmed.slice(0, 160)}` : 'other';
  }
  return place;
}

const PLACE_CODE_SET = new Set<string>([
  ...DELIVERY_PLACE_CODES,
  ...PICKUP_PLACE_CODES,
  'other',
]);

const PLACE_FILE_RE = /^(delivery|pickup)-place\.txt$/i;

function decodePlaceCode(raw: string | null | undefined): StopProofPlaceCode | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.startsWith('other:')) return 'other';
  if (PLACE_CODE_SET.has(value)) return value as StopProofPlaceCode;
  return null;
}

export type StopProofDocumentSummary = {
  kind: StopProofKind;
  code: StopProofPlaceCode;
  label: string;
};

/**
 * Place-only stop proof is stored as a tiny text/plain trip_documents row
 * whose body is the place code (e.g. left_with_security). Compliance must
 * not treat that file as a PDF/image preview.
 */
export function describeStopProofDocument(input: {
  fileName?: string | null;
  mimeType?: string | null;
  documentNumber?: string | null;
  storagePath?: string | null;
}): StopProofDocumentSummary | null {
  const fileName = (input.fileName ?? '').trim();
  const storagePath = (input.storagePath ?? '').trim();
  const mime = (input.mimeType ?? '').toLowerCase();
  const fileMatch = fileName.match(PLACE_FILE_RE);
  const pathIsPlaceTxt = /(?:^|\/)(?:delivery|pickup)-place\.txt$/i.test(storagePath);
  const codeFromNumber = decodePlaceCode(input.documentNumber);
  const kind: StopProofKind =
    fileMatch?.[1]?.toLowerCase() === 'pickup' || /pickup-place\.txt$/i.test(storagePath)
      ? 'pickup'
      : 'delivery';

  if (fileMatch || pathIsPlaceTxt) {
    return {
      kind,
      code: codeFromNumber ?? 'other',
      label: codeFromNumber
        ? stopProofPlaceLabel(kind, codeFromNumber)
        : kind === 'pickup'
          ? 'Pickup place recorded'
          : 'Delivery place recorded',
    };
  }

  const pickupCode =
    codeFromNumber && (PICKUP_PLACE_CODES as readonly string[]).includes(codeFromNumber);
  if (mime.startsWith('text/plain') && codeFromNumber) {
    const inferredKind: StopProofKind = pickupCode ? 'pickup' : 'delivery';
    return {
      kind: inferredKind,
      code: codeFromNumber,
      label: stopProofPlaceLabel(inferredKind, codeFromNumber),
    };
  }

  return null;
}

export function canSubmitDeliveryProof(draft: DeliveryProofDraft): boolean {
  if (draft.photoUris.length > 0) return true;
  if (draft.place === 'other') return draft.placeNote.trim().length > 0;
  return draft.place != null;
}
