/**
 * Re-apply linked-org avatar fields after delta sync.
 * `get_*_delta` returns raw table rows (null avatar_url); profile RPCs resolve
 * `organizations.logo_url` → owner `profiles.avatar_url` + `avatar_seed`.
 */
import { supabase } from '@pulse/core/lib/supabase';

type ConnectionRow = {
  id: string;
  linked_organization_id?: string | null;
  avatar_url?: string | null;
  avatar_seed?: string | null;
};

type PartnerAvatarRpc =
  | 'get_clients_with_profiles'
  | 'get_suppliers_with_profiles';

async function fetchPartnerAvatarsByRowId(
  orgId: string,
  rpc: PartnerAvatarRpc,
): Promise<Map<string, { avatar_url: string | null; avatar_seed: string | null }>> {
  const { data, error } = await supabase().rpc(rpc, { p_org_id: orgId });
  if (error || !data) return new Map();

  return new Map(
    (
      data as Array<{
        id: string;
        avatar_url?: string | null;
        avatar_seed?: string | null;
      }>
    ).map((row) => [
      row.id,
      {
        avatar_url: row.avatar_url ?? null,
        avatar_seed: row.avatar_seed ?? null,
      },
    ]),
  );
}

export async function enrichConnectionPartnerAvatars<T extends ConnectionRow>(
  orgId: string,
  rows: T[],
  rpc: PartnerAvatarRpc,
): Promise<T[]> {
  if (!rows.some((row) => row.linked_organization_id)) return rows;

  const avatarById = await fetchPartnerAvatarsByRowId(orgId, rpc);
  if (avatarById.size === 0) return rows;

  return rows.map((row) => {
    const enriched = avatarById.get(row.id);
    if (!enriched) return row;
    return {
      ...row,
      avatar_url: enriched.avatar_url ?? row.avatar_url ?? null,
      avatar_seed: enriched.avatar_seed ?? row.avatar_seed ?? null,
    };
  });
}
