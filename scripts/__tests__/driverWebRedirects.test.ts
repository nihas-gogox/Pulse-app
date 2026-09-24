/**
 * Phase 4A: the generated Netlify rules must send every driver-app path to the driver
 * SPA and every legacy dispatcher /driver/<id> link to /fleet-driver — never the reverse.
 * Evaluated with Netlify's first-match semantics (`:name` = one segment, `*` = rest).
 */
import fs from 'fs';
import path from 'path';
import { ROUTES } from '@pulse/core/lib/routes';
import { driverHeaders, driverRedirects } from '../driver-web-redirects';

type Rule = { from: string; to: string; status: number };
const rules: Rule[] = driverRedirects()
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => { const [from, to, status] = l.trim().split(/\s+/); return { from, to, status: Number(status) }; });

function netlify(url: string): { to: string; status: number } | null {
  const segs = url.split('?')[0].replace(/\/+$/, '').split('/');
  for (const r of rules) {
    const pat = r.from.split('/');
    const splat = pat[pat.length - 1] === '*';
    const fixed = splat ? pat.slice(0, -1) : pat;
    // `/a/*` matches `/a` and anything below it; otherwise segment counts must match.
    if (splat ? segs.length < fixed.length : segs.length !== fixed.length) continue;
    const params: Record<string, string> = {};
    if (!fixed.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = segs[i]), segs[i] !== '') : p === segs[i]))) continue;
    return { to: r.to.replace(/:(\w+)/g, (_, k) => params[k]), status: r.status };
  }
  return null;
}

const SPA = { to: '/driver/index.html', status: 200 };
const UUID = '5b0c1c7e-9f3a-4d2b-8c1e-2f6a7b8c9d0e';

describe('Pulse Driver Netlify rules', () => {
  it.each([
    '/driver', '/driver/', '/driver/sign-in', '/driver/sign-up', '/driver/onboarding', '/driver/wallet',
    '/driver/profile', '/driver/settings', '/driver/notifications', '/driver/chat', '/driver/passbook/history',
    '/driver/passbook/org-1', '/driver/salary-request/r1', '/driver/my-fleet/add', '/driver/available-loads/i1',
    '/driver/commerce-mission/t1', '/driver/trip/t1', '/driver/trip/t1/verification', '/driver/trip/t1/operations/fuel',
    '/driver/language-settings', '/driver/driver-sign-in', '/driver/driver-signup', '/driver/onboarding/driver',
    '/driver/driver-trip/t1', '/driver/terminal-website',
  ])('%s → driver app', (url) => {
    expect(netlify(url)).toEqual(SPA);
  });

  it('every route file in apps/driver/app resolves to the driver app', () => {
    const appDir = path.join(__dirname, '../../apps/driver/app');
    const walk = (d: string, parts: string[]): string[][] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name), [...parts, e.name]) : /\.tsx?$/.test(e.name) ? [[...parts, e.name.replace(/\.tsx?$/, '')]] : []);
    for (const f of walk(appDir, [])) {
      if (/^(_layout|\+not-found|loading)$/.test(f[f.length - 1])) continue;
      const url = `/driver/${f.filter((s) => !/^\(.*\)$/.test(s) && s !== 'index').map((s) => (/^\[.*\]$/.test(s) ? 'x1' : s)).join('/')}`.replace(/\/$/, '');
      expect([url, netlify(url)]).toEqual([url, SPA]);
    }
  });

  it('legacy dispatcher driver-detail links go to /fleet-driver, never the driver app', () => {
    expect(netlify(`/driver/${UUID}`)).toEqual({ to: `/fleet-driver/${UUID}`, status: 301 });
    expect(netlify(`/driver/${UUID}?tab=ledger`)).toEqual({ to: `/fleet-driver/${UUID}`, status: 301 });
    expect(netlify(`/driver/${UUID}/analytics`)).toEqual({ to: `/fleet-driver/${UUID}/analytics`, status: 301 });
    expect(netlify(`/driver/${UUID}/profile`)).toEqual({ to: `/fleet-driver/${UUID}/profile`, status: 301 });
  });

  it('dispatcher links now build /fleet-driver URLs the driver rules never capture', () => {
    const links = [ROUTES.driverDetail(UUID), ROUTES.driverProfile(UUID), ROUTES.driverAnalytics(UUID)];
    for (const l of links) {
      expect(l.startsWith(`/fleet-driver/${UUID}`)).toBe(true);
      expect(netlify(l)).toBeNull();
    }
  });

  it('missing hashed driver chunks 404 instead of serving HTML', () => {
    expect(netlify('/driver/_expo/static/js/web/entry-deadbeef.js')).toEqual({ to: '/driver/index.html', status: 404 });
  });

  it('does not touch main-app paths', () => {
    for (const u of ['/', '/fleet-driver/abc', '/driver-sign-in', '/driver-trip/t1', '/wallet', '/trip/t1']) expect(netlify(u)).toBeNull();
  });

  it('keeps the driver index.html uncached and hashed chunks immutable', () => {
    const h = driverHeaders();
    expect(h).toMatch(/\/driver\/index\.html\n {2}Cache-Control: no-cache/);
    expect(h).toMatch(/\/driver\/_expo\/static\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  });
});
