import { supabase } from '@pulse/core/lib/supabase';

/** Same public bucket as OMS product images (`product-images/<org>/...`). */
const PRODUCT_IMAGE_BUCKET = 'org-assets';

/** Public URL for Commerce `products.image_path`. */
export function commerceProductImageUrl(path: string | null | undefined): string | null {
  const trimmed = (path ?? '').trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  try {
    return supabase().storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(trimmed).data.publicUrl
      || null;
  } catch {
    return null;
  }
}
