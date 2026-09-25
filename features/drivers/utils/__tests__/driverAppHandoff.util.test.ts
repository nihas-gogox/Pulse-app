import fs from 'fs';
import path from 'path';
import { driverRootSegments } from '../../../../scripts/driver-web-redirects';
import {
  DRIVER_APP_ROOT_SEGMENTS,
  MAIN_APP_SHARED_SEGMENTS,
  driverAppPathFor,
  isDriverOnlyLegacyPath,
  isDriverNativeHandoffEnabled,
  shouldHandOffToDriverApp,
} from '../driverAppHandoff.util';

describe('driver web hand-off (Phase 4A, permanent since 4D)', () => {
  it('native hand-off stays off', () => {
    expect(isDriverNativeHandoffEnabled()).toBe(false);
  });

  it('maps old in-app driver URLs to /driver/*', () => {
    expect(driverAppPathFor('/')).toBe('/driver');
    expect(driverAppPathFor('/wallet')).toBe('/driver/wallet');
    expect(driverAppPathFor('/(driver)/passbook/history')).toBe('/driver/passbook/history');
    expect(driverAppPathFor('/driver-sign-in', '?ref=x')).toBe('/driver/sign-in?ref=x');
    expect(driverAppPathFor('/driver-signup')).toBe('/driver/sign-up');
    expect(driverAppPathFor('/onboarding/driver')).toBe('/driver/onboarding');
    expect(driverAppPathFor('/driver-trip/t1')).toBe('/driver/trip/t1');
    expect(driverAppPathFor('/trip/t1/operations/fuel', 'entryId=e1')).toBe('/driver/trip/t1/operations/fuel?entryId=e1');
    // dispatcher-only pages have no driver equivalent → driver home
    expect(driverAppPathFor('/finance')).toBe('/driver');
    expect(driverAppPathFor('/fleet-driver/abc')).toBe('/driver');
  });

  it('hands off signed-in drivers and the old entry pages, nobody else', () => {
    const base = { enabled: true, pathname: '/wallet', sessionAttached: true, isDriver: true };
    expect(shouldHandOffToDriverApp(base)).toBe(true);
    expect(shouldHandOffToDriverApp({ ...base, isDriver: false })).toBe(false);
    expect(shouldHandOffToDriverApp({ ...base, sessionAttached: false })).toBe(false);
    expect(shouldHandOffToDriverApp({ ...base, sessionAttached: false, isDriver: false, pathname: '/driver-sign-in' })).toBe(true);
    expect(shouldHandOffToDriverApp({ ...base, isDriver: false, pathname: '/onboarding/driver' })).toBe(true);
    expect(shouldHandOffToDriverApp({ ...base, enabled: false })).toBe(false);
  });

  it('never redirects from a path the main app serves under /driver (loop guard)', () => {
    const base = { enabled: true, sessionAttached: true, isDriver: true };
    expect(shouldHandOffToDriverApp({ ...base, pathname: '/driver' })).toBe(false);
    expect(shouldHandOffToDriverApp({ ...base, pathname: '/driver/abc' })).toBe(false);
    expect(shouldHandOffToDriverApp({ ...base, pathname: '/driver-trip/t1' })).toBe(true);
  });

  it('hands off confirmed signed-out visitors on driver-only legacy URLs (Phase 4B)', () => {
    const out = { enabled: true, sessionAttached: false, isDriver: false, signedOut: true };
    for (const p of ['/wallet', '/control', '/passbook/history', '/salary-request/x1', '/my-fleet/add', '/(driver)/wallet', '/driver-trip/t1']) {
      expect(shouldHandOffToDriverApp({ ...out, pathname: p })).toBe(true);
    }
    // paths the main app also serves stay in the main app when signed out
    for (const p of ['/', '/chat', '/notifications', '/profile', '/trip/t1', '/language-settings', '/sign-in', '/finance', '/fleet-driver/abc']) {
      expect(shouldHandOffToDriverApp({ ...out, pathname: p })).toBe(false);
    }
    // still restoring (not yet known to be signed out) → no hand-off
    expect(shouldHandOffToDriverApp({ ...out, signedOut: false, pathname: '/wallet' })).toBe(false);
    // signed-in non-driver keeps the main app's behavior
    expect(shouldHandOffToDriverApp({ ...out, sessionAttached: true, signedOut: false, pathname: '/wallet' })).toBe(false);
    // flag off / loop guard still win
    expect(shouldHandOffToDriverApp({ ...out, enabled: false, pathname: '/wallet' })).toBe(false);
    expect(shouldHandOffToDriverApp({ ...out, pathname: '/driver/wallet' })).toBe(false);
  });

  it('driver-only vs shared segments match the main app route tree', () => {
    const appDir = path.join(__dirname, '../../../../app');
    const mainServes = (seg: string) =>
      fs.readdirSync(appDir, { withFileTypes: true }).some((e) => {
        if (e.name === '(driver)') return false; // the 4A rollback group itself
        if (e.isDirectory() && /^\(.*\)$/.test(e.name)) {
          return fs.readdirSync(path.join(appDir, e.name)).some((f) => f === seg || f.replace(/(\.(web|native))?\.tsx?$/, '') === seg);
        }
        return e.name === seg || e.name.replace(/(\.(web|native))?\.tsx?$/, '') === seg;
      });
    for (const seg of DRIVER_APP_ROOT_SEGMENTS) {
      expect([seg, mainServes(seg)]).toEqual([seg, MAIN_APP_SHARED_SEGMENTS.has(seg)]);
      expect(isDriverOnlyLegacyPath(`/${seg}`)).toBe(!MAIN_APP_SHARED_SEGMENTS.has(seg));
    }
  });

  it('knows exactly the driver app root routes (in sync with apps/driver/app)', () => {
    const PUBLIC_OR_LEGACY = new Set(['sign-in', 'sign-up', 'onboarding', 'driver-sign-in', 'driver-signup', 'driver-trip', 'terminal-website']);
    const appSegments = [...driverRootSegments().keys()].filter((s) => !PUBLIC_OR_LEGACY.has(s)).sort();
    expect([...DRIVER_APP_ROOT_SEGMENTS].sort()).toEqual(appSegments);
  });
});
