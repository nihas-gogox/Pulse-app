/**
 * Shared email validation for forms (sign-up, driver sign-up, Add Driver, etc.).
 * Format: max length 255.
 */

const MAX_EMAIL_LENGTH = 255;

/** Basic format: something @ something . something (no spaces, has @ and dot in domain). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address string.
 * @param email - Raw input (trimmed internally).
 * @returns Error message if invalid, or null if valid.
 */
/**
 * Email required (sign-in, account recovery). Empty / whitespace-only fails.
 */
export function validateEmailRequired(email: string): string | null {
  const trimmed = (email ?? '').trim();
  if (trimmed.length === 0) {
    return 'Enter your email address.';
  }
  return validateEmail(trimmed);
}

export function validateEmail(email: string): string | null {
  const trimmed = (email ?? '').trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return `Email must be at most ${MAX_EMAIL_LENGTH} characters.`;
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Enter a valid email address (e.g. name@example.com).';
  }
  return null;
}

/**
 * Returns true if the email string is valid (or empty). Use for optional email fields.
 */
export function isEmailValid(email: string): boolean {
  const trimmed = (email ?? '').trim();
  if (trimmed.length === 0) return true;
  return validateEmail(email) === null;
}
