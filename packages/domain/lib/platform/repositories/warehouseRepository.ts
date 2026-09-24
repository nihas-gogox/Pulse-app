import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
import {
  CORE_WAREHOUSE_COLUMNS,
  buildWarehouseInsert,
  buildWarehouseUpdatePatch,
  mapRowToPlatformWarehouse,
  mapRowToWarehouseRecord,
} from '../mappers/warehouseMappers';
import type {
  CreatePlatformWarehouseInput,
  PlatformWarehouse,
  UpdatePlatformWarehouseInput,
  WorkspaceId,
} from '../types/master-data';

const WAREHOUSE_COLUMNS =
  'id,organization_id,client_id,name,address,city,state,contact_name,contact_phone,warehouse_code,pincode,latitude,longitude,capacity_tons,deleted_at,created_at,updated_at';

function mapRow(row: Record<string, unknown>): PlatformWarehouse {
  return mapRowToPlatformWarehouse(row);
}

export const warehouseRepository = {
  async list(workspaceId: WorkspaceId): Promise<PlatformWarehouse[]> {
    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .select(WAREHOUSE_COLUMNS)
      .eq('organization_id', workspaceId)
      .is('deleted_at', null)
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  },

  async listWarehouseRecordsByClient(
    workspaceId: WorkspaceId,
    clientId: string,
  ): Promise<Record<string, unknown>[]> {
    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .select(CORE_WAREHOUSE_COLUMNS)
      .eq('organization_id', workspaceId)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRowToWarehouseRecord(row as Record<string, unknown>));
  },

  async findWarehouseRecordById(warehouseId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .select(CORE_WAREHOUSE_COLUMNS)
      .eq('id', warehouseId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToWarehouseRecord(data as Record<string, unknown>) : null;
  },

  async count(workspaceId: WorkspaceId): Promise<number> {
    const { count, error } = await requirePlatformDb()
      .from('client_warehouses')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', workspaceId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async create(workspaceId: WorkspaceId, input: CreatePlatformWarehouseInput): Promise<PlatformWarehouse> {
    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .insert(buildWarehouseInsert(workspaceId, input))
      .select(WAREHOUSE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },

  async createWarehouseRecord(
    workspaceId: WorkspaceId,
    input: CreatePlatformWarehouseInput,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .insert(buildWarehouseInsert(workspaceId, input))
      .select(CORE_WAREHOUSE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRowToWarehouseRecord(data as Record<string, unknown>);
  },

  async update(
    workspaceId: WorkspaceId,
    warehouseId: string,
    input: UpdatePlatformWarehouseInput,
  ): Promise<PlatformWarehouse> {
    const patch = buildWarehouseUpdatePatch(input);
    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .update(patch)
      .eq('id', warehouseId)
      .eq('organization_id', workspaceId)
      .is('deleted_at', null)
      .select(WAREHOUSE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },

  async updateWarehouseRecord(
    workspaceId: WorkspaceId,
    warehouseId: string,
    input: UpdatePlatformWarehouseInput,
  ): Promise<Record<string, unknown> | null> {
    const patch = buildWarehouseUpdatePatch(input);
    if (Object.keys(patch).length === 0) return null;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await requirePlatformDb()
      .from('client_warehouses')
      .update(patch)
      .eq('id', warehouseId)
      .eq('organization_id', workspaceId)
      .is('deleted_at', null)
      .select(CORE_WAREHOUSE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRowToWarehouseRecord(data as Record<string, unknown>);
  },

  async softDelete(workspaceId: WorkspaceId, warehouseId: string): Promise<void> {
    const { error } = await requirePlatformDb()
      .from('client_warehouses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', warehouseId)
      .eq('organization_id', workspaceId);
    if (error) throw new Error(error.message);
  },
};
