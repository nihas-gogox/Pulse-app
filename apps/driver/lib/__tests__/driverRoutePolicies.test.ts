import fs from 'fs';
import path from 'path';
import { DRIVER_APP_POLICIES } from '../navigationPolicy/registry';
import { isPublicDriverPath, LEGACY_ROUTE_ALIASES, mainAppHref, stripBaseUrl } from '../routes';

const APP_DIR = path.resolve(__dirname, '../../app');
const NON_ROUTES = /(^|\/)(_layout|loading|\+not-found|\+html)\.tsx$/;

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) routeFiles(abs, out);
    else if (/\.tsx?$/.test(e.name)) out.push(path.relative(APP_DIR, abs).replace(/\\/g, '/'));
  }
  return out;
}

/** app/(driver)/passbook/[orgId].tsx → '/(driver)/passbook/:orgId' (registry pattern form). */
function patternOf(file: string): string {
  const segs = file.replace(/\.tsx?$/, '').split('/').filter((s) => s !== 'index');
  return `/${segs.map((s) => s.replace(/^\[(.+)\]$/, ':$1')).join('/')}`;
}

describe('Pulse Driver route policies', () => {
  const routes = routeFiles(APP_DIR).filter((f) => !NON_ROUTES.test(f));

  it('finds the driver routes', () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes)('%s has a policy', (file) => {
    expect(DRIVER_APP_POLICIES.map((p) => p.pattern)).toContain(patternOf(file));
  });

  it('has no policy without a route', () => {
    const patterns = new Set(routes.map(patternOf));
    expect(DRIVER_APP_POLICIES.filter((p) => !patterns.has(p.pattern))).toEqual([]);
  });

  it('policy ids are unique', () => {
    const ids = DRIVER_APP_POLICIES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('public pages are exactly the auth pages and their legacy names', () => {
    const publicPatterns = DRIVER_APP_POLICIES.filter((p) => p.experience === 'public').map((p) => p.pattern);
    for (const p of publicPatterns) expect(isPublicDriverPath(p.replace('/(auth)', ''))).toBe(true);
    expect(isPublicDriverPath('/wallet')).toBe(false);
    expect(isPublicDriverPath('/')).toBe(false);
    const routePaths = new Set(routes.map((f) => patternOf(f).replace(/\/\([^)]+\)/g, '')));
    for (const legacy of Object.keys(LEGACY_ROUTE_ALIASES)) expect(routePaths).toContain(legacy);
  });

  it('strips the web base URL before matching (raw browser path on first render)', () => {
    expect(stripBaseUrl('/driver/onboarding', '/driver')).toBe('/onboarding');
    expect(stripBaseUrl('/driver', '/driver')).toBe('/');
    expect(stripBaseUrl('/driver-sign-in', '/driver')).toBe('/driver-sign-in');
    expect(stripBaseUrl('/wallet', '')).toBe('/wallet');
    expect(isPublicDriverPath('/driver/sign-in', '/driver')).toBe(true);
    expect(isPublicDriverPath('/driver/wallet', '/driver')).toBe(false);
  });

  it('links to the main app on the same origin under a base path, else production', () => {
    expect(mainAppHref('/terminal-website', { origin: 'https://preprod.example', baseUrl: '/driver' })).toBe('https://preprod.example/terminal-website');
    expect(mainAppHref('/', { origin: 'https://driver.gogopulse.com', baseUrl: '' })).toBe('https://gogopulse.com/');
    expect(mainAppHref('/terminal-website')).toBe('https://gogopulse.com/terminal-website');
    expect(isPublicDriverPath('/terminal-website')).toBe(true);
  });
});
