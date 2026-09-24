/**
 * Phone normalization helpers used for invitee lookup.
 *
 * Important: this must match the normalization used by backend RPCs
 * (`get_invitee_by_phone` / `get_invitees_by_phones`) so lookups are consistent.
 */
/**
 * Reduce a raw phone string from the device address book (or anywhere
 * else) to the canonical last-10-digit form the backend RPCs expect.
 *
 * Handles the common Indian formats seen in mobile contacts:
 *   "+91 98765 43210"   → "9876543210"
 *   "(+91)-9876-543210" → "9876543210"
 *   "091 98765 43210"   → "9876543210"
 *   "00 91 98765 43210" → "9876543210"
 *   "98765 43210"       → "9876543210"
 *   "098765 43210"      → "9876543210"
 *
 * For non-Indian numbers we still return the last 10 digits, which
 * matches how the DB stores them; if the backend later supports +91
 * separately we'll branch here.
 */
export function normalizePhoneForInviteeLookup(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";

  // Strip "00" international dialing prefix (e.g. "00919876543210" → "919876543210").
  while (digits.startsWith("00") && digits.length > 10) {
    digits = digits.slice(2);
  }
  // "91…" Indian country code in front → drop it.
  if (digits.length >= 12 && digits.startsWith("91")) {
    digits = digits.slice(-10);
  }
  // Stray leading zero on Indian trunk dial (e.g. "09876543210" → "9876543210").
  while (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function uniqueNormalizedPhonesForLookup(
  phones: Array<string | null | undefined>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of phones) {
    const norm = normalizePhoneForInviteeLookup(String(p ?? ""));
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

/**
 * Format a phone for UI display (best-effort).
 * - Keeps existing +E.164 intact
 * - For 10-digit Indian numbers, prefixes +91
 * - For 12-digit numbers starting with 91, prefixes +
 */
export function formatPhoneForDisplay(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("+")) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return s;
}

