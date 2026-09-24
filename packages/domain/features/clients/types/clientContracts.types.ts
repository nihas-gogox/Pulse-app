// Types extracted from features/clients/services/clientContracts.service.ts (driver extraction, Phase 2, D19). Types only — no runtime code.

export interface ClientContract {
  id: string;
  organization_id: string;
  client_id: string;
  warehouse_id: string | null;
  pickup_area: string;
  drop_location: string;
  rate: number | null;
  rate_type: 'per_trip' | 'per_ton' | 'per_kg' | 'per_km' | 'fixed';
  billing_to_hq: boolean;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
