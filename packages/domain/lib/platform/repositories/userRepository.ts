import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';

/** Ensures public.users row exists for indent FK (auth/profile id). */
export async function ensurePublicUserRecord(userId: string): Promise<void> {
  const id = userId.trim();
  if (!id) return;

  const { error } = await requirePlatformDb()
    .from('users')
    .upsert({ id, name: 'User' }, { onConflict: 'id' });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('relation') || msg.includes('permission denied') || msg.includes('policy')) {
      return;
    }
    throw new Error(error.message);
  }
}
