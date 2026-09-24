/**
 * D22 regression: expo-router@6.0.24 stripped the web base URL as a plain prefix, so with
 * baseUrl '/driver' an in-app push to '/driver-signup' became '/-signup'.
 * Fixed by patches/expo-router+6.0.23.patch (segment-boundary match). Runs against the
 * real patched module; NODE_ENV is 'test', so the non-development branch is exercised.
 */
// getPathFromState-forks imports these ESM packages at module load; appendBaseUrl uses neither.
jest.mock('@react-navigation/native', () => ({}));
jest.mock('query-string', () => ({}));

import { stripBaseUrl } from 'expo-router/build/fork/getStateFromPath-forks';
import { appendBaseUrl } from 'expo-router/build/fork/getPathFromState-forks';

const BASE = '/driver';

describe('expo-router base URL under /driver (patched)', () => {
  it('runs the production branch', () => {
    expect(process.env.NODE_ENV).not.toBe('development');
  });

  it('/driver-sign-in does not become /-sign-in', () => {
    expect(stripBaseUrl('/driver-sign-in', BASE)).toBe('/driver-sign-in');
    expect(stripBaseUrl('/driver-sign-in?ref=x', BASE)).toBe('/driver-sign-in?ref=x');
  });

  it('/driver-signup does not become /-signup', () => {
    expect(stripBaseUrl('/driver-signup', BASE)).toBe('/driver-signup');
  });

  it('driver trip detail keeps the /driver base both ways', () => {
    // in-app push (legacy name and contract URL) is not mangled…
    expect(stripBaseUrl('/driver-trip/abc-123', BASE)).toBe('/driver-trip/abc-123');
    expect(stripBaseUrl('/trip/abc-123', BASE)).toBe('/trip/abc-123');
    // …the browser URL gets the base once…
    expect(appendBaseUrl('/trip/abc-123', BASE)).toBe('/driver/trip/abc-123');
    expect(appendBaseUrl('/driver-trip/abc-123', BASE)).toBe('/driver/driver-trip/abc-123');
    // …and a hard refresh on it strips exactly the base.
    expect(stripBaseUrl('/driver/trip/abc-123', BASE)).toBe('/trip/abc-123');
    expect(stripBaseUrl('/driver/driver-trip/abc-123', BASE)).toBe('/driver-trip/abc-123');
  });

  it('still strips the base itself', () => {
    expect(stripBaseUrl('/driver', BASE)).toBe('');
    expect(stripBaseUrl('/driver/', BASE)).toBe('/');
    expect(stripBaseUrl('/driver/wallet', BASE)).toBe('/wallet');
    expect(stripBaseUrl('/driver?x=1', BASE)).toBe('?x=1');
    expect(stripBaseUrl('//driver/sign-in', BASE)).toBe('/sign-in');
  });

  it('is a no-op without a base URL (main app)', () => {
    expect(stripBaseUrl('/driver-signup', '')).toBe('/driver-signup');
    expect(stripBaseUrl('/driver/abc', undefined)).toBe('/driver/abc');
  });
});
