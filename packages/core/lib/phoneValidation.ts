/**
 * Shared phone number validation for forms (clients, suppliers, drivers, auth).
 * Accepts: (1) exactly 10 digits, or (2) +91 followed by 10 digits (e.g. +919876543210 or +91 98765 43210).
 * Rejects common placeholder numbers.
 */

const REQUIRED_DIGITS = 10;
const INDIA_COUNTRY_CODE = '91';

/** Reject obviously fake/placeholder numbers. */
const PLACEHOLDER_PHONES = /^(123-?456-?7890|1234567890|000+)$/i;

/**
 * Extracts the 10-digit Indian mobile (national) from user input.
 * Accepts: 10 digits, or 12 digits starting with 91 (e.g. +919876543210).
 */
export function extractIndianMobileTenDigits(phone: string): string | null {
  const trimmed = (phone ?? '').trim();
  if (trimmed.length === 0) return null;
  const normalized = trimmed.replace(/[\s\-()]/g, '');
  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length === REQUIRED_DIGITS) return digitsOnly;
  if (digitsOnly.length === 12 && digitsOnly.startsWith(INDIA_COUNTRY_CODE)) {
    return digitsOnly.slice(2);
  }
  return null;
}

/**
 * Canonical value for `profiles.phone` and auth `user_metadata.phone` (India): +91 plus 10 digits, no spaces.
 * Returns null if not a valid Indian mobile or if placeholder.
 */
export function normalizeIndianPhoneForMetadata(phone: string): string | null {
  const tenDigits = extractIndianMobileTenDigits(phone);
  if (tenDigits === null) return null;
  if (PLACEHOLDER_PHONES.test(tenDigits)) return null;
  return `+${INDIA_COUNTRY_CODE}${tenDigits}`;
}

/**
 * Validates a phone number string.
 * @param phone - Raw input: 10 digits or +91 followed by 10 digits (spaces/dashes allowed).
 * @returns Error message if invalid, or null if valid.
 */
export function validatePhone(phone: string): string | null {
  const tenDigits = extractIndianMobileTenDigits(phone);
  if (tenDigits === null) {
    return 'Enter a 10-digit number or +91 followed by 10 digits (e.g. +91 98765 43210).';
  }
  if (PLACEHOLDER_PHONES.test(tenDigits)) {
    return 'Enter a valid phone number.';
  }
  return null;
}

/**
 * Returns true if the phone string is valid (or empty). Use for optional phone fields.
 */
export function isPhoneValid(phone: string): boolean {
  const trimmed = (phone ?? '').trim();
  if (trimmed.length === 0) return true;
  return validatePhone(phone) === null;
}
