/**
 * Core warehouse compatibility adapter over platform WarehouseService.
 * CRUD delegates to WarehouseService → warehouseRepository → client_warehouses.
 */
import { WarehouseService } from '@/lib/platform';
import type {
  CreatePlatformWarehouseInput,
  UpdatePlatformWarehouseInput,
} from '@/lib/platform';
import type { ClientWarehouse } from '@pulse/domain/features/clients/types/clientWarehouses.types';
export type { ClientWarehouse } from '@pulse/domain/features/clients/types/clientWarehouses.types';

export type CreateWarehouseData = Omit<ClientWarehouse, 'id' | 'created_at' | 'updated_at'>;
export type UpdateWarehouseData = Partial<Omit<ClientWarehouse, 'id' | 'organization_id' | 'client_id' | 'created_at' | 'updated_at'>>;

function asClientWarehouse(record: Record<string, unknown> | null): ClientWarehouse | null {
  return record as ClientWarehouse | null;
}

function toPlatformCreateInput(
  clientId: string,
  data: UpdateWarehouseData,
): CreatePlatformWarehouseInput {
  return {
    clientId,
    name: (data.name ?? '').trim(),
    address: data.address ?? undefined,
    city: data.city ?? undefined,
    state: data.state ?? undefined,
    pincode: data.pincode ?? undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    capacityTons: data.capacity_tons ?? undefined,
    warehouseCode: data.warehouse_code ?? undefined,
    warehouseZone: data.warehouse_zone ?? undefined,
    localGstin: data.local_gstin ?? undefined,
    dockCount: data.dock_count ?? undefined,
    managerName: data.manager_name ?? undefined,
    managerPhone: data.manager_phone ?? undefined,
    contactName: data.contact_name ?? undefined,
    contactPhone: data.contact_phone ?? undefined,
  };
}

function toPlatformUpdateInput(data: UpdateWarehouseData): UpdatePlatformWarehouseInput {
  return {
    name: data.name,
    address: data.address ?? undefined,
    city: data.city ?? undefined,
    state: data.state ?? undefined,
    pincode: data.pincode ?? undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    capacityTons: data.capacity_tons ?? undefined,
    warehouseCode: data.warehouse_code ?? undefined,
    warehouseZone: data.warehouse_zone ?? undefined,
    localGstin: data.local_gstin ?? undefined,
    dockCount: data.dock_count ?? undefined,
    managerName: data.manager_name ?? undefined,
    managerPhone: data.manager_phone ?? undefined,
    contactName: data.contact_name ?? undefined,
    contactPhone: data.contact_phone ?? undefined,
  };
}

export async function getWarehousesByClient(
  orgId: string,
  clientId: string,
): Promise<{ error: Error | null; warehouses: ClientWarehouse[] }> {
  try {
    const warehouses = (await WarehouseService.listWarehouseRecordsByClient(orgId, clientId)) as unknown as ClientWarehouse[];
    return { error: null, warehouses };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), warehouses: [] };
  }
}

export async function createWarehouse(
  orgId: string,
  clientId: string,
  data: UpdateWarehouseData,
): Promise<{ error: Error | null; warehouse: ClientWarehouse | null }> {
  try {
    const warehouse = asClientWarehouse(
      await WarehouseService.createWarehouseRecord(orgId, toPlatformCreateInput(clientId, data)),
    );
    return { error: null, warehouse };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), warehouse: null };
  }
}

export async function updateWarehouse(
  warehouseId: string,
  data: UpdateWarehouseData,
): Promise<{ error: Error | null; updated: boolean }> {
  try {
    const updated = await WarehouseService.updateWarehouseRecordById(warehouseId, toPlatformUpdateInput(data));
    return { error: null, updated: updated != null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), updated: false };
  }
}

export async function deleteWarehouse(
  warehouseId: string,
): Promise<{ error: Error | null }> {
  try {
    await WarehouseService.deleteWarehouseRecordById(warehouseId);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
