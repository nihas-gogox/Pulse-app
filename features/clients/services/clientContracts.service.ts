import { supabase } from '@/lib/supabase';
import type { ClientContract } from '@pulse/domain/features/clients/types/clientContracts.types';
export type { ClientContract } from '@pulse/domain/features/clients/types/clientContracts.types';

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export type CreateContractData = Omit<ClientContract, 'id' | 'created_at' | 'updated_at'>;
export type UpdateContractData = Partial<
  Omit<ClientContract, 'id' | 'organization_id' | 'client_id' | 'created_at' | 'updated_at'>
>;

export async function getContractsByClient(
  orgId: string,
  clientId: string,
  opts?: { activeOnly?: boolean },
): Promise<{ error: Error | null; contracts: ClientContract[] }> {
  let query = supabase()
    .from('client_contracts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (opts?.activeOnly) {
    const today = new Date().toISOString().slice(0, 10);
    query = query.or(`valid_to.is.null,valid_to.gte.${today}`);
  }
  const { data, error } = await query;
  if (error) return { error: new Error(error.message), contracts: [] };
  return { error: null, contracts: (data ?? []) as ClientContract[] };
}

export async function createContract(
  orgId: string,
  clientId: string,
  data: UpdateContractData,
): Promise<{ error: Error | null; contract: ClientContract | null }> {
  const { data: row, error } = await supabase()
    .from('client_contracts')
    .insert({ organization_id: orgId, client_id: clientId, ...data })
    .select()
    .single();
  if (error) return { error: new Error(error.message), contract: null };
  return { error: null, contract: row as ClientContract };
}

export async function updateContract(
  contractId: string,
  data: UpdateContractData,
): Promise<{ error: Error | null; updated: boolean }> {
  const { error } = await supabase()
    .from('client_contracts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', contractId);
  if (error) return { error: new Error(error.message), updated: false };
  return { error: null, updated: true };
}

export async function deleteContract(
  contractId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase()
    .from('client_contracts')
    .delete()
    .eq('id', contractId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function getActiveContractsForLane(
  orgId: string,
  clientId: string,
  pickupArea: string,
  dropLocation: string,
): Promise<{ error: Error | null; contracts: ClientContract[] }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from('client_contracts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .ilike('pickup_area', `%${escapeLike(pickupArea.trim())}%`)
    .ilike('drop_location', `%${escapeLike(dropLocation.trim())}%`)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('rate', { ascending: true });
  if (error) return { error: new Error(error.message), contracts: [] };
  return { error: null, contracts: (data ?? []) as ClientContract[] };
}
