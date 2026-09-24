import { persistStopDeliveryProof } from '../persistStopDeliveryProof';

const mockUpload = jest.fn();

jest.mock('@pulse/domain/features/trips/services/tripDocuments.service', () => ({
  uploadTripDocument: (...args: unknown[]) => mockUpload(...args),
}));

jest.mock('../../../../lib/media/compressLocalImage.util', () => ({
  compressLocalImageForUpload: async () => ({
    arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
    mimeType: 'image/jpeg',
  }),
}));

describe('persistStopDeliveryProof', () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ doc: { id: 'd1' }, error: null });
  });

  it('uploads a place note when there is no photo', async () => {
    const result = await persistStopDeliveryProof({
      tripId: 't1',
      stopId: 's1',
      uploadedBy: 'u1',
      draft: { place: 'left_at_door', placeNote: '', photoUris: [] },
    });
    expect(result).toEqual({ ok: true });
    expect(mockUpload).toHaveBeenCalledWith(
      't1',
      'u1',
      expect.objectContaining({ fileName: 'delivery-place.txt', mimeType: 'text/plain' }),
      'pod',
      'left_at_door',
      { stopId: 's1' },
    );
  });

  it('uploads photos with the place code', async () => {
    const result = await persistStopDeliveryProof({
      tripId: 't1',
      stopId: 's1',
      uploadedBy: 'u1',
      draft: { place: 'handed_to_recipient', placeNote: '', photoUris: ['file://a.jpg'] },
    });
    expect(result).toEqual({ ok: true });
    expect(mockUpload).toHaveBeenCalledWith(
      't1',
      'u1',
      expect.objectContaining({ mimeType: 'image/jpeg' }),
      'pod',
      'handed_to_recipient',
      { stopId: 's1' },
    );
  });

  it('uploads pickup place notes separately from delivery', async () => {
    const result = await persistStopDeliveryProof({
      tripId: 't1',
      stopId: 's1',
      uploadedBy: 'u1',
      kind: 'pickup',
      draft: { place: 'collected_from_warehouse', placeNote: '', photoUris: [] },
    });
    expect(result).toEqual({ ok: true });
    expect(mockUpload).toHaveBeenCalledWith(
      't1',
      'u1',
      expect.objectContaining({ fileName: 'pickup-place.txt', mimeType: 'text/plain' }),
      'pod',
      'collected_from_warehouse',
      { stopId: 's1' },
    );
  });
});
