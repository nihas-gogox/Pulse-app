/**
 * UUIDv7 — RFC 9562 compliant, time-sortable, globally unique.
 *
 * Format (128 bits):
 *   0-47   : Unix timestamp in milliseconds (48 bits)
 *   48-51  : Version = 7 (4 bits)
 *   52-63  : rand_a — 12 random bits (monotonic counter within same ms)
 *   64-65  : Variant = 0b10 (2 bits)
 *   66-127 : rand_b — 62 random bits
 *
 * Properties:
 *   ✓ Time-sortable (chronological order = lexicographic order)
 *   ✓ Globally unique without coordination
 *   ✓ B-tree index friendly (monotonically increasing per millisecond)
 *   ✓ Analytics friendly (timestamp extractable from the ID itself)
 *   ✓ Kafka/event-streaming friendly (partition key = timestamp prefix)
 */

// Monotonic state — ensures strict lexicographic ordering even within same ms
let _wallMs    = 0;   // last observed wall clock ms
let _logicalMs = 0;   // logical timestamp used in UUID (advances on seq overflow)
let _seq       = 0;   // 12-bit monotonic counter within the same logical ms

/** Generate a UUIDv7 string. */
export function uuidv7(): string {
  const wallMs = Date.now();

  if (wallMs > _wallMs) {
    // New real millisecond: reset sequence, advance logical clock
    _wallMs    = wallMs;
    _logicalMs = wallMs;
    _seq       = _secureRand12();
  } else {
    // Same (or rarely backward) ms: increment sequence
    _seq++;
    if (_seq > 0xfff) {
      // Seq overflow: advance logical timestamp by 1ms to preserve strict order
      _logicalMs++;
      _seq = 0;
    }
  }

  const nowMs = _logicalMs;
  const tsHex = nowMs.toString(16).padStart(12, '0');   // 48-bit timestamp
  const randAHex = _seq.toString(16).padStart(3, '0'); // 12-bit rand_a
  const randBHex = _secureRand62hex();                  // 62-bit rand_b (variant applied inside)

  // Assemble 32-char hex
  const hex =
    tsHex +                // 48 bits
    '7' +                  // version nibble
    randAHex +             // 12 bits
    randBHex;              // 16 chars = 64 bits (variant 10 baked into first char)

  // Format as UUID: 8-4-4-4-12
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Extract the creation timestamp from a UUIDv7. Returns null for non-v7 UUIDs. */
export function uuidv7Timestamp(id: string): Date | null {
  if (!id || id.length !== 36) return null;
  const version = id[14];
  if (version !== '7') return null;
  const tsPart = id.replace(/-/g, '').slice(0, 12);
  const ms = parseInt(tsPart, 16);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

/** Returns true if the UUID is v7. */
export function isUUIDv7(id: string): boolean {
  return typeof id === 'string' && id.length === 36 && id[14] === '7';
}

/** Returns true if the UUID is v4. */
export function isUUIDv4(id: string): boolean {
  return typeof id === 'string' && id.length === 36 && id[14] === '4';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _secureRand12(): number {
  const buf = new Uint16Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    buf[0] = Math.floor(Math.random() * 65536);
  }
  return buf[0] & 0xfff;
}

function _secureRand62hex(): string {
  // 64 bits of random, then apply variant bits (10xxxxxx) to first byte
  const buf = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 8; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  // Apply variant bits: first byte = 10xxxxxx (high 2 bits = 10)
  buf[0] = (buf[0] & 0x3f) | 0x80;
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
