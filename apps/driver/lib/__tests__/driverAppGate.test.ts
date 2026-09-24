import { decideDriverGate, type DriverGateInput } from '../driverAppGate';

const base: DriverGateInput = {
  sessionAttached: true,
  status: 'authenticated',
  loading: false,
  hasProfile: true,
  role: 'driver',
  publicRoute: false,
};

describe('decideDriverGate', () => {
  it('lets a signed-in driver in', () => {
    expect(decideDriverGate(base)).toBe('driver');
  });

  it('rejects a signed-in non-driver (the old (driver) layout wrong-role rule)', () => {
    expect(decideDriverGate({ ...base, role: 'dispatcher' })).toBe('not-driver');
    expect(decideDriverGate({ ...base, role: null })).toBe('not-driver');
  });

  it('waits while the profile resolves instead of rejecting', () => {
    expect(decideDriverGate({ ...base, loading: true, role: undefined })).toBe('splash');
    expect(decideDriverGate({ ...base, hasProfile: false, role: undefined })).toBe('splash');
  });

  it('sends a signed-out user on a private page to sign-in', () => {
    const out = { ...base, sessionAttached: false, hasProfile: false, role: undefined };
    expect(decideDriverGate({ ...out, status: 'unauthenticated' })).toBe('sign-in');
    expect(decideDriverGate({ ...out, status: 'expired' })).toBe('sign-in');
  });

  it('holds on splash while an existing session is being restored', () => {
    const restoring = { ...base, sessionAttached: false, status: 'restoring' as const };
    expect(decideDriverGate(restoring)).toBe('splash');
    expect(decideDriverGate({ ...restoring, status: 'authenticated' })).toBe('splash');
  });

  it('renders public auth pages with or without a session, never the role check', () => {
    expect(decideDriverGate({ ...base, sessionAttached: false, status: 'unauthenticated', publicRoute: true })).toBe('public');
    expect(decideDriverGate({ ...base, publicRoute: true, role: 'dispatcher' })).toBe('public-with-session');
  });
});
