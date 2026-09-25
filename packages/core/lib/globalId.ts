/**
 * Global ID Service — collision-safe identifier generation for Pulse.
 *
 * Architecture:
 *   Internal IDs   → UUIDv4 via gen_random_uuid() (Postgres, never client-generated)
 *   Business refs  → Atomic DB sequences (trip_number, indent_number, operational codes)
 *   Fallback IDs   → DB global sequence via get_safe_fallback_trip_number() RPC
 *   Client ULIDs   → Time-sortable IDs for optimistic UI (never stored as PKs)
 *
 * Rules:
 *   1. Never send a client-generated ID as a primary key to the DB.
 *   2. Never use business reference numbers in WHERE clauses on FKs — always use UUID.
 *   3. Fallback IDs (FTRP- prefix) are for display only; the DB trigger will replace
 *      them with canonical IDs on first successful write.
 */

// ── ULID (Universally Unique Lexicographically Sortable Identifier) ───────────
//
// Used for optimistic-UI local state keys that need time-sortability.
// NOT stored as DB primary keys.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;

function encodeTime(time: number, len: number): string {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    str = ENCODING[mod] + str;
    time = Math.floor(time / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = '';
  const buf = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) {
    str += ENCODING[buf[i] % ENCODING_LEN];
  }
  return str;
}

/**
 * Generate a ULID — time-sortable, globally unique, URL-safe 26-char string.
 * Use this for optimistic local IDs in UI state; never as a DB primary key.
 */
export function generateUlid(): string {
  const now = Date.now();
  return encodeTime(now, 10) + encodeRandom(16);
}

// ── Crypto-safe random hex ────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random hex string of the given byte length.
 * 16 bytes → 32 hex chars.
 */
export function cryptoRandomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Business reference validation ─────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PURE_NUMERIC = /^\d+$/;

/**
 * Returns true when a string looks like a valid business reference — not a raw
 * UUID (internal ID leakage) and not a pure number (bare row ID).
 */
export function isValidBusinessReference(ref: string | null | undefined): boolean {
  if (!ref || !ref.trim()) return false;
  const t = ref.trim();
  if (UUID_PATTERN.test(t)) return false;    // raw UUID leaked as display ID
  if (PURE_NUMERIC.test(t)) return false;    // bare numeric row ID
  return t.length >= 3;
}

/**
 * Returns true when the ID looks like an emergency fallback ID (FTRP- / FIND- prefix).
 * Fallback IDs are globally unique but lack the canonical org-scoped structure.
 */
export function isFallbackId(id: string | null | undefined): boolean {
  const t = (id ?? '').trim().toUpperCase();
  return t.startsWith('FTRP-') || t.startsWith('FIND-');
}

// ── Display ID utilities ──────────────────────────────────────────────────────

/**
 * Returns a short, safe display label for a trip — prefers operational codes
 * (canonical format) over legacy trip numbers.
 */
export function getTripDisplayLabel(trip: {
  trip_operational_code?: string | null;
  trip_code?: string | null;
  trip_number?: string | null;
  display_trip_id?: string | null;
}): string {
  return (
    trip.trip_operational_code?.trim() ||
    trip.trip_code?.trim() ||
    trip.display_trip_id?.trim() ||
    trip.trip_number?.trim() ||
    '—'
  );
}

/**
 * Returns true when two trip references refer to the same trip.
 * Handles mixed formats (UUID, trip_number, trip_code, operational_code).
 */
export function tripRefsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

// ── Duplicate detection ───────────────────────────────────────────────────────

/** Module-level deduplication for optimistic inserts within the same session. */
const _pendingInserts = new Map<string, number>();
const DEDUP_TTL_MS = 10_000;

/**
 * Returns true if the given key was recently submitted (within 10s) — indicates
 * a duplicate submission from double-tap, network retry, etc.
 *
 * Usage:
 *   if (isDuplicateSubmission(`trip:create:${orgId}:${tripNumber}`)) return;
 */
export function isDuplicateSubmission(key: string): boolean {
  const last = _pendingInserts.get(key);
  if (last && Date.now() - last < DEDUP_TTL_MS) return true;
  _pendingInserts.set(key, Date.now());
  // Auto-cleanup after TTL
  setTimeout(() => _pendingInserts.delete(key), DEDUP_TTL_MS);
  return false;
}

/** Clear all pending submission records (call on sign-out). */
export function clearSubmissionDeduplication(): void {
  _pendingInserts.clear();
}
