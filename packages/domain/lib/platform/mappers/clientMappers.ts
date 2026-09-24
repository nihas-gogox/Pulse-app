import type { PlatformCustomer } from '../types/master-data';

/** Core `ClientRow` columns — shared between repository reads and Core adapter. */
export const CORE_CLIENT_COLUMNS =
  'id,organization_id,name,contact_person,phone,email,address,registered_address,hq_address,billing_address,gstin,pan_number,status,created_at,updated_at,display_id,is_integrated,linked_organization_id,contact_percent,avatar_url,avatar_seed,owner_full_name';

export function mapRowToPlatformCustomer(row: Record<string, unknown>): PlatformCustomer {
  return {
    id: String(row.id),
    workspaceId: String(row.organization_id),
    name: String(row.name ?? ''),
    legalName: (row.legal_name as string | null) ?? null,
    tradeName: (row.trade_name as string | null) ?? null,
    phone: String(row.phone ?? ''),
    email: (row.email as string | null) ?? null,
    gstin: (row.gstin as string | null) ?? null,
    address:
      (row.hq_address as string | null) ??
      (row.registered_address as string | null) ??
      (row.billing_address as string | null) ??
      (row.address as string | null) ??
      null,
    state: (row.state as string | null) ?? null,
    status: String(row.status ?? 'active'),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapRowToClientRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name ?? ''),
    contact_person: (row.contact_person as string | null) ?? null,
    phone: String(row.phone ?? ''),
    email: (row.email as string | null) ?? null,
    address:
      (row.hq_address as string | null) ??
      (row.registered_address as string | null) ??
      (row.billing_address as string | null) ??
      (row.address as string | null) ??
      null,
    gstin: (row.gstin as string | null) ?? null,
    pan_number: (row.pan_number as string | null) ?? null,
    status: String(row.status ?? 'active'),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    display_id: row.display_id as string | undefined,
    is_integrated: Boolean(row.is_integrated),
    linked_organization_id: (row.linked_organization_id as string | null) ?? null,
    contact_percent: (row.contact_percent as number | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    avatar_seed: (row.avatar_seed as string | null) ?? null,
    owner_full_name: (row.owner_full_name as string | null) ?? null,
  };
}
