import { getMutualConnections } from '../mutual-connections.service';

const mockGetLinkedOrgProfilesBatch = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/features/clients/services/clients.service', () => ({
  getLinkedOrgProfilesBatch: (...args: unknown[]) =>
    mockGetLinkedOrgProfilesBatch(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({
    rpc: mockRpc,
  }),
}));

beforeEach(() => {
  mockGetLinkedOrgProfilesBatch.mockReset();
  mockRpc.mockReset();
});

describe('getMutualConnections partner-display enrichment', () => {
  it('does not call partner-display when the RPC already returned avatar_url', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'org-a',
          name: 'A',
          avatar_seed: 'seed-a',
          avatar_url: 'https://cdn.example/a.png',
        },
      ],
      error: null,
    });

    const { error, mutuals } = await getMutualConnections('viewer', 'target');
    expect(error).toBeNull();
    expect(mutuals).toHaveLength(1);
    expect(mutuals[0].avatar_url).toBe('https://cdn.example/a.png');
    expect(mockGetLinkedOrgProfilesBatch).not.toHaveBeenCalled();
  });

  it('batches only ids that are missing avatar_url', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'org-a',
          name: 'A',
          avatar_seed: null,
          avatar_url: 'https://cdn.example/a.png',
        },
        { id: 'org-b', name: 'B', avatar_seed: null, avatar_url: null },
      ],
      error: null,
    });
    mockGetLinkedOrgProfilesBatch.mockResolvedValue({
      'org-b': { avatarUrl: 'https://cdn.example/b.png' },
    });

    const { mutuals } = await getMutualConnections('viewer', 'target');
    expect(mockGetLinkedOrgProfilesBatch).toHaveBeenCalledWith(['org-b']);
    expect(mutuals.find((m) => m.id === 'org-b')?.avatar_url).toBe(
      'https://cdn.example/b.png',
    );
    expect(mutuals.find((m) => m.id === 'org-a')?.avatar_url).toBe(
      'https://cdn.example/a.png',
    );
  });
});
