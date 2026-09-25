import type { SupabaseClient } from '@supabase/supabase-js';

let dbFactory: (() => SupabaseClient | null) | null = null;

/** Register the Supabase client factory (Core: `supabase()`, Commerce: `getIdentityDb()`). */
export function configurePlatformDb(factory: () => SupabaseClient | null): void {
  dbFactory = factory;
}

export function getPlatformDb(): SupabaseClient | null {
  return dbFactory?.() ?? null;
}

export function requirePlatformDb(): SupabaseClient {
  const db = getPlatformDb();
  if (!db) {
    throw new Error('Platform DB is not configured. Call configurePlatformDb() at app startup.');
  }
  return db;
}
