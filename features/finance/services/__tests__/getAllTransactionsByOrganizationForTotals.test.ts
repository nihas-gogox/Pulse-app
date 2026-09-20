/**
 * Covers the confirmed release blocker: getTransactionsByOrganization's
 * .limit(500) fetch was the only source for the Cash tab's headline totals,
 * silently truncating them for organizations with more than 500
 * transactions. getAllTransactionsByOrganizationForTotals is the separate,
 * unbounded fetch introduced to fix that -- this proves it never calls
 * .limit(), unlike the capped display fetch.
 */
jest.mock('@/lib/authEngine', () => ({
  AUTH_TIMEOUT_MS: 10_000,
  withTimeout: (p: Promise<unknown>) => p,
}));
jest.mock('@/lib/tripChatInvalidate', () => ({
  notifyTripChatMessagesChanged: jest.fn(),
}));
jest.mock('@/features/trips/services/tripWorkflow.service', () => ({
  recordTripWorkflowEvent: jest.fn(),
}));
jest.mock('@/features/drivers/services/drivers.service', () => ({
  getDriverProfileDisplay: jest.fn(),
  getDriverProfileDisplayBatch: jest.fn(),
}));
jest.mock('@/lib/avatarUpload', () => ({
  AVATAR_BUCKET: 'avatars',
  LEGACY_AVATAR_BUCKET: 'avatars-legacy',
  extractPathFromStorageUrl: jest.fn(),
  getSignedAvatarUrl: jest.fn(),
  resolveAvatarPublicUrl: jest.fn(),
}));

import { getAllTransactionsByOrganizationForTotals } from '../finance.service';

function builder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  ['select', 'eq', 'order'].forEach((m) => {
    b[m] = jest.fn(() => b);
  });
  // No `limit`/`range` on this builder — calling either would throw
  // "is not a function", which is exactly the regression this guards against.
  b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });
  return b;
}

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getAllTransactionsByOrganizationForTotals', () => {
  it('fetches every matching row with no row cap, unlike the capped display fetch', async () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({
      id: `tx-${i}`,
      organization_id: 'org-1',
      amount_in: 1,
      amount_out: 0,
      transaction_date: '2026-09-01',
      created_at: '2026-09-01T00:00:00Z',
    }));
    const b = builder(rows);
    mockFrom.mockReturnValue(b);

    const { error, transactions } = await getAllTransactionsByOrganizationForTotals('org-1');

    expect(error).toBeNull();
    expect(transactions).toHaveLength(600);
    expect(b.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    // No .limit/.range call exists on this builder at all -- if the
    // implementation added one back, this test would fail with
    // "b.limit is not a function" rather than silently passing.
  });

  it('returns an error, not a throw, on a query failure', async () => {
    const b: Record<string, unknown> = {};
    ['select', 'eq', 'order'].forEach((m) => {
      b[m] = jest.fn(() => b);
    });
    b.then = (resolve: (v: { data: null; error: { message: string } }) => unknown) =>
      resolve({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(b);

    const { error, transactions } = await getAllTransactionsByOrganizationForTotals('org-1');

    expect(error?.message).toBe('boom');
    expect(transactions).toEqual([]);
  });
});
