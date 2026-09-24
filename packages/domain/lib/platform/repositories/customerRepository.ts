import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
import {
  CORE_CLIENT_COLUMNS,
  mapRowToClientRecord,
  mapRowToPlatformCustomer,
} from '../mappers/clientMappers';
import { buildClientHubProfilePatch } from '../mappers/clientHubProfileMapper';
import type { UpdateClientHubProfileInput } from '../../../../../lib/platform/types/client-hub-profile';
import type {
  CreatePlatformCustomerInput,
  PlatformCustomer,
  UpdatePlatformCustomerInput,
  WorkspaceId,
} from '../../../../../lib/platform/types/master-data';

const CLIENT_COLUMNS =
  'id,organization_id,name,contact_person,phone,email,address,gstin,status,legal_name,trade_name,client_code,industry,country,state,registered_address,client_status,created_at,updated_at';

function mapRow(row: Record<string, unknown>): PlatformCustomer {
  return mapRowToPlatformCustomer(row);
}

export const customerRepository = {
  async list(workspaceId: WorkspaceId): Promise<PlatformCustomer[]> {
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .select(CLIENT_COLUMNS)
      .eq('organization_id', workspaceId)
      .eq('status', 'active')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  },

  async listClientRecords(workspaceId: WorkspaceId): Promise<Record<string, unknown>[]> {
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .select(CORE_CLIENT_COLUMNS)
      .eq('organization_id', workspaceId)
      .eq('status', 'active')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRowToClientRecord(row as Record<string, unknown>));
  },

  async listClientRecordsWithProfiles(workspaceId: WorkspaceId): Promise<Record<string, unknown>[]> {
    const { data, error } = await requirePlatformDb().rpc('get_clients_with_profiles', {
      p_org_id: workspaceId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => mapRowToClientRecord(row));
  },

  async count(workspaceId: WorkspaceId): Promise<number> {
    const { count, error } = await requirePlatformDb()
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', workspaceId)
      .eq('status', 'active');
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async findClientRecord(
    workspaceId: WorkspaceId,
    customerId: string,
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .select(CORE_CLIENT_COLUMNS)
      .eq('organization_id', workspaceId)
      .eq('id', customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToClientRecord(data as Record<string, unknown>) : null;
  },

  async findClientByName(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<Record<string, unknown> | null> {
    const normalized = name.trim();
    if (!normalized) return null;
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .select(CORE_CLIENT_COLUMNS)
      .eq('organization_id', workspaceId)
      .eq('status', 'active')
      .eq('name', normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToClientRecord(data as Record<string, unknown>) : null;
  },

  async findClientByPhone(
    workspaceId: WorkspaceId,
    phone: string,
  ): Promise<Record<string, unknown> | null> {
    const normalized = phone.trim();
    if (!normalized) return null;
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .select(CORE_CLIENT_COLUMNS)
      .eq('organization_id', workspaceId)
      .eq('status', 'active')
      .eq('phone', normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToClientRecord(data as Record<string, unknown>) : null;
  },

  async create(workspaceId: WorkspaceId, input: CreatePlatformCustomerInput): Promise<PlatformCustomer> {
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .insert({
        organization_id: workspaceId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        gstin: input.gstin,
        address: input.address,
        trade_name: input.tradeName,
        legal_name: input.legalName ?? input.name,
        state: input.state,
        contact_person: input.contactPerson,
        pan_number: input.panNumber,
        notes: input.notes,
        is_integrated: input.isIntegrated ?? false,
        status: 'active',
        created_by: input.createdBy,
      })
      .select(CLIENT_COLUMNS)
      .single();
    if (error) throw {
      message: error.message,
      code: error.code,
    } as Error & { code?: string };
    return mapRow(data as Record<string, unknown>);
  },

  async createClientRecord(
    workspaceId: WorkspaceId,
    input: CreatePlatformCustomerInput,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await requirePlatformDb()
      .from('clients')
      .insert({
        organization_id: workspaceId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        gstin: input.gstin,
        address: input.address,
        trade_name: input.tradeName,
        legal_name: input.legalName ?? input.name,
        state: input.state,
        contact_person: input.contactPerson,
        pan_number: input.panNumber,
        notes: input.notes,
        is_integrated: input.isIntegrated ?? false,
        status: 'active',
        created_by: input.createdBy,
      })
      .select(CORE_CLIENT_COLUMNS)
      .single();
    if (error) throw {
      message: error.message,
      code: error.code,
    } as Error & { code?: string };
    return mapRowToClientRecord(data as Record<string, unknown>);
  },

  async update(
    workspaceId: WorkspaceId,
    customerId: string,
    input: UpdatePlatformCustomerInput,
  ): Promise<PlatformCustomer> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.email !== undefined) patch.email = input.email;
    if (input.gstin !== undefined) patch.gstin = input.gstin;
    if (input.address !== undefined) {
      patch.address = input.address;
      patch.registered_address = input.address;
      patch.billing_address = input.address;
    }
    if (input.tradeName !== undefined) patch.trade_name = input.tradeName;
    if (input.legalName !== undefined) patch.legal_name = input.legalName;
    if (input.state !== undefined) patch.state = input.state;
    if (input.contactPerson !== undefined) patch.contact_person = input.contactPerson;
    if (input.panNumber !== undefined) patch.pan_number = input.panNumber;

    const { data, error } = await requirePlatformDb()
      .from('clients')
      .update(patch)
      .eq('id', customerId)
      .eq('organization_id', workspaceId)
      .select(CLIENT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },

  async updateClientRecord(
    workspaceId: WorkspaceId,
    customerId: string,
    input: UpdatePlatformCustomerInput,
  ): Promise<Record<string, unknown> | null> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.email !== undefined) patch.email = input.email;
    if (input.gstin !== undefined) patch.gstin = input.gstin;
    if (input.address !== undefined) {
      patch.address = input.address;
      // Keep invoice Bill To (billing_address) aligned with the shared Edit Client form.
      patch.billing_address = input.address;
    }
    if (input.contactPerson !== undefined) patch.contact_person = input.contactPerson;
    if (input.panNumber !== undefined) patch.pan_number = input.panNumber;
    if (Object.keys(patch).length === 0) return null;

    const { data, error } = await requirePlatformDb()
      .from('clients')
      .update(patch)
      .eq('id', customerId)
      .eq('organization_id', workspaceId)
      .select(CORE_CLIENT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRowToClientRecord(data as Record<string, unknown>);
  },

  async updateHubProfile(
    workspaceId: WorkspaceId,
    customerId: string,
    input: UpdateClientHubProfileInput,
  ): Promise<void> {
    const patch = buildClientHubProfilePatch(input);
    if (Object.keys(patch).length <= 1) return;

    const { error } = await requirePlatformDb()
      .from('clients')
      .update(patch)
      .eq('id', customerId)
      .eq('organization_id', workspaceId);
    if (error) throw new Error(error.message);
  },

  async softDelete(workspaceId: WorkspaceId, customerId: string): Promise<void> {
    const { error } = await requirePlatformDb()
      .from('clients')
      .update({ status: 'inactive' })
      .eq('id', customerId)
      .eq('organization_id', workspaceId);
    if (error) throw new Error(error.message);
  },
};
