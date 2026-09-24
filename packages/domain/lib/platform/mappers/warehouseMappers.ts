import type { PlatformWarehouse } from '../../../../../lib/platform/types/master-data';

/** Core `ClientWarehouse` columns — full row reads for the Core adapter. */
export const CORE_WAREHOUSE_COLUMNS =
  'id,organization_id,client_id,warehouse_code,warehouse_zone,name,address,city,state,pincode,local_gstin,dock_count,capacity_tons,manager_name,manager_phone,contact_name,contact_phone,latitude,longitude,deleted_at,created_at,updated_at';

export function mapRowToPlatformWarehouse(row: Record<string, unknown>): PlatformWarehouse {
  return {
    id: String(row.id),
    workspaceId: String(row.organization_id),
    clientId: String(row.client_id),
    name: String(row.name ?? ''),
    code: (row.warehouse_code as string | null) ?? null,
    addressLine: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    pincode: (row.pincode as string | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    capacityTons: (row.capacity_tons as number | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapRowToWarehouseRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    client_id: String(row.client_id),
    warehouse_code: (row.warehouse_code as string | null) ?? null,
    warehouse_zone: (row.warehouse_zone as string | null) ?? null,
    name: String(row.name ?? ''),
    address: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    pincode: (row.pincode as string | null) ?? null,
    local_gstin: (row.local_gstin as string | null) ?? null,
    dock_count: (row.dock_count as number | null) ?? null,
    capacity_tons: (row.capacity_tons as number | null) ?? null,
    manager_name: (row.manager_name as string | null) ?? null,
    manager_phone: (row.manager_phone as string | null) ?? null,
    contact_name: (row.contact_name as string | null) ?? null,
    contact_phone: (row.contact_phone as string | null) ?? null,
    latitude:
      row.latitude == null || row.latitude === ''
        ? null
        : Number(row.latitude),
    longitude:
      row.longitude == null || row.longitude === ''
        ? null
        : Number(row.longitude),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function applyWarehousePatch(patch: Record<string, unknown>, input: {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  capacityTons?: number;
  warehouseCode?: string;
  warehouseZone?: string;
  localGstin?: string;
  dockCount?: number;
  managerName?: string;
  managerPhone?: string;
  contactName?: string;
  contactPhone?: string;
}): void {
  if (input.name !== undefined) patch.name = input.name;
  if (input.address !== undefined) patch.address = input.address;
  if (input.city !== undefined) patch.city = input.city;
  if (input.state !== undefined) patch.state = input.state;
  if (input.pincode !== undefined) patch.pincode = input.pincode;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.capacityTons !== undefined) patch.capacity_tons = input.capacityTons;
  if (input.warehouseCode !== undefined) patch.warehouse_code = input.warehouseCode;
  if (input.warehouseZone !== undefined) patch.warehouse_zone = input.warehouseZone;
  if (input.localGstin !== undefined) patch.local_gstin = input.localGstin;
  if (input.dockCount !== undefined) patch.dock_count = input.dockCount;
  if (input.managerName !== undefined) patch.manager_name = input.managerName;
  if (input.managerPhone !== undefined) patch.manager_phone = input.managerPhone;
  if (input.contactName !== undefined) patch.contact_name = input.contactName;
  if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone;
}

export function buildWarehouseInsert(
  workspaceId: string,
  input: {
    clientId: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
    capacityTons?: number;
    warehouseCode?: string;
    warehouseZone?: string;
    localGstin?: string;
    dockCount?: number;
    managerName?: string;
    managerPhone?: string;
    contactName?: string;
    contactPhone?: string;
  },
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    organization_id: workspaceId,
    client_id: input.clientId,
    name: input.name,
  };
  applyWarehousePatch(row, input);
  return row;
}

export function buildWarehouseUpdatePatch(input: {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  capacityTons?: number;
  warehouseCode?: string;
  warehouseZone?: string;
  localGstin?: string;
  dockCount?: number;
  managerName?: string;
  managerPhone?: string;
  contactName?: string;
  contactPhone?: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  applyWarehousePatch(patch, input);
  return patch;
}
