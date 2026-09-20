-- Pulse V2 persistence boundary. NOT production supabase/migrations.
-- Do not apply to the shared Pulse / pulse-unified-base project.
-- Identity/authorization is not implemented: RLS is deny-by-default.

CREATE SCHEMA IF NOT EXISTS v2_identity;
CREATE SCHEMA IF NOT EXISTS v2_commerce;
CREATE SCHEMA IF NOT EXISTS v2_execution;
CREATE SCHEMA IF NOT EXISTS v2_finance;
CREATE SCHEMA IF NOT EXISTS v2_network;

COMMENT ON SCHEMA v2_identity IS 'V2 Identity ownership fence. No tables until identity decision. Do not use packages/platform/identity.';
COMMENT ON SCHEMA v2_commerce IS 'V2 Commerce write schema.';
COMMENT ON SCHEMA v2_execution IS 'V2 Execution write schema.';
COMMENT ON SCHEMA v2_finance IS 'V2 Finance ownership fence. Extraction not in this slice.';
COMMENT ON SCHEMA v2_network IS 'V2 Network ownership fence. Modular initially.';

CREATE TABLE IF NOT EXISTS v2_commerce.sales_orders (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2_execution.trips (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  order_id text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE v2_commerce.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_execution.trips ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated/anon denied. Service role is for operators only,
-- never for domain adapters (they use PULSE_V2_SUPABASE_ANON_KEY).
-- Future identity: workspace_id = auth.jwt()->>'workspace_id'
