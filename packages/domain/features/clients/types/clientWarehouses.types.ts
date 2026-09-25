// Types extracted from features/clients/services/clientWarehouses.service.ts (driver extraction, Phase 2, D19). Types only — no runtime code.

export interface ClientWarehouse {
  id: string;
  organization_id: string;
  client_id: string;
  warehouse_code: string | null;
  warehouse_zone: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  local_gstin: string | null;
  dock_count: number | null;
  capacity_tons: number | null;
  manager_name: string | null;
  manager_phone: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
}
