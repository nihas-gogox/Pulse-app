import {
  canSubmitDeliveryProof,
  describeStopProofDocument,
  encodeDeliveryPlace,
  emptyDeliveryProof,
} from '@/features/driver/job-card/deliveryProof';

describe('deliveryProof', () => {
  it('requires a place or a photo', () => {
    expect(canSubmitDeliveryProof(emptyDeliveryProof())).toBe(false);
    expect(canSubmitDeliveryProof({ ...emptyDeliveryProof(), place: 'left_at_door' })).toBe(true);
    expect(
      canSubmitDeliveryProof({ ...emptyDeliveryProof(), place: 'collected_from_warehouse' }),
    ).toBe(true);
    expect(
      canSubmitDeliveryProof({ ...emptyDeliveryProof(), photoUris: ['file://pod.jpg'] }),
    ).toBe(true);
    expect(canSubmitDeliveryProof({ ...emptyDeliveryProof(), place: 'other' })).toBe(false);
    expect(
      canSubmitDeliveryProof({ ...emptyDeliveryProof(), place: 'other', placeNote: 'with guard' }),
    ).toBe(true);
  });

  it('encodes place for trip_documents.document_number', () => {
    expect(encodeDeliveryPlace(null, '')).toBeNull();
    expect(encodeDeliveryPlace('collected_from_warehouse', '')).toBe('collected_from_warehouse');
    expect(encodeDeliveryPlace('other', '  lobby desk  ')).toBe('other:lobby desk');
  });

  it('labels place-only POD text files instead of treating them as previews', () => {
    expect(
      describeStopProofDocument({
        fileName: 'delivery-place.txt',
        mimeType: 'text/plain',
        documentNumber: 'left_with_security',
        storagePath: 'trip-1/pod/abc.txt',
      }),
    ).toEqual({
      kind: 'delivery',
      code: 'left_with_security',
      label: 'Left with security',
    });
    expect(
      describeStopProofDocument({
        fileName: 'pickup-place.txt',
        documentNumber: 'collected_from_warehouse',
        storagePath: 'trip-1/pod/pickup-place.txt',
      })?.label,
    ).toBe('Collected from warehouse');
    expect(
      describeStopProofDocument({
        fileName: 'pod-abc.txt',
        mimeType: 'text/plain',
        documentNumber: 'left_with_security',
        storagePath: 'trip-1/pod/abc.txt',
      })?.label,
    ).toBe('Left with security');
    expect(
      describeStopProofDocument({
        fileName: 'lr.pdf',
        mimeType: 'application/pdf',
        storagePath: 'trip-1/lr/abc.pdf',
      }),
    ).toBeNull();
  });
});
