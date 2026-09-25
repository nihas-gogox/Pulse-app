import { commerceProductImageUrl } from '../commerceProductImageUrl';

const mockGetPublicUrl = jest.fn();

jest.mock('@pulse/core/lib/supabase', () => ({
  supabase: () => ({
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => mockGetPublicUrl(bucket, path),
      }),
    },
  }),
}));

describe('commerceProductImageUrl', () => {
  beforeEach(() => {
    mockGetPublicUrl.mockReset();
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/org-assets/p.jpg' } });
  });

  it('returns null when inventory has no image', () => {
    expect(commerceProductImageUrl(null)).toBeNull();
    expect(commerceProductImageUrl('  ')).toBeNull();
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it('passes through http URLs', () => {
    expect(commerceProductImageUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it('builds a public org-assets URL from image_path', () => {
    expect(commerceProductImageUrl('product-images/org/p.jpg')).toBe(
      'https://cdn.test/org-assets/p.jpg',
    );
    expect(mockGetPublicUrl).toHaveBeenCalledWith('org-assets', 'product-images/org/p.jpg');
  });
});
