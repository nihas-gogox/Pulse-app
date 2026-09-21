-- Phase 7G — from-scratch-replay prerequisite for THREE September 3 Admin
-- Console migrations only:
--   20260903053951_support_admin_session_auth.sql
--   20260903054729_support_admin_queue_pagination.sql
--   20260903062910_kyc_admin_session_access.sql
--
-- Explicitly NOT for 20260903072324_admindata_admin_access.sql, whose final
-- four GRANT EXECUTE statements target functions created much later
-- (emit_network_notification, platform_next_canonical_code,
-- fn_ensure_trip_chat_room_core, _ensure_mover_asset_trip) — see the Phase 7F
-- investigation for why those are deliberately excluded, not merely
-- overlooked. This migration does not touch that file, those four grants, or
-- any of the four later function-creator migrations.
--
-- Every object below is copied verbatim (not simplified/invented) from its
-- real canonical creator, per the Phase 7D/7E dependency-tree investigation:
--   platform_roles / platform_permissions / platform_role_permissions
--     <- 20261224000000_platform_iam.sql
--   owner_vehicles
--     <- 20270210114000_create_owner_vehicles.sql
--     (Phase 7H verified creation-time FK prerequisite for
--      support_tickets.owner_vehicle_id; Phase 7I adds the bare table only)
--   market_bids
--     <- 20270301040000_market_bids.sql
--     (Phase 7K verified creation-time FK prerequisite for
--      support_tickets.market_bid_id; Phase 7L adds the bare table only,
--      after owner_vehicles)
--   support_tickets / support_ticket_comments / support_ticket_activity /
--   support_ticket_attachments
--     <- 20270302000000_support_tickets_schema.sql
--   support_tickets.last_public_author_type / last_public_activity_at
--     <- 20270303030000_support_ticket_read_cursors.sql (ADD COLUMN only;
--      Phase 7M verified for 20260903054729's index; Phase 7N)
--   support_tickets.agent_last_read_at
--     <- 20270303030000_support_ticket_read_cursors.sql (ADD COLUMN only;
--      Phase 7O verified for 20260903055231 LANGUAGE sql; Phase 7P)
--   organization_kyc_documents <- 20261107070000_organization_kyc_documents.sql
--   driver_kyc_documents       <- 20270118000000_driver_kyc_documents.sql
--   driver_kyc_submissions     <- 20270118000500_driver_kyc_submission_gate.sql
--   verification_audit_logs    <- 20261101000000_business_verification_sprint1.sql
--     (its previous_status/new_status columns use public.kyc_verification_status,
--      already created by 20260801000000_workspace_kyc_structure.sql — pre-dates
--      Sept 3, no action needed here)
--   org_feature_flags          <- 20261101000006_org_feature_flags.sql
--   can_review_driver_kyc()    <- 20270121000000_driver_kyc_service_role_reviewer.sql
--     (its only immediate dependency, has_platform_permission(), already
--      exists from 20260731000000_has_platform_permission_bootstrap_stub.sql
--      — pre-dates Sept 3, verified, not created here)
--
-- Ownership: this migration is a replay prerequisite ONLY. Every later
-- canonical migration listed above still runs for real — every statement it
-- contains uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS, so
-- table/function bodies here becoming no-ops there does not skip any
-- lifecycle work; the later migrations remain the sole owner of: secondary
-- (non-unique) indexes, the support-ticket display-id sequence + helper
-- function, RLS enablement, policies, grants, comments, realtime publication
-- registration, and every RPC/trigger not required for the three September
-- migrations to execute.
--
-- Intentional difference from the canonical seed: the platform_roles seed
-- INSERT below is copied in full (all three roles: super_admin, control_tower,
-- reach_admin) rather than trimmed to the two Sept 3 actually queries by name
-- — trimming the multi-row VALUES list would itself be "inventing" a modified
-- statement; this is the literal statement from 20261224000000.

-- ── platform_roles / platform_permissions / platform_role_permissions ──────
-- (20261224000000_platform_iam.sql, lines 27-45)

CREATE TABLE IF NOT EXISTS public.platform_roles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_permissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        NOT NULL UNIQUE,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_role_permissions (
  role_id        uuid NOT NULL REFERENCES public.platform_roles(id) ON DELETE CASCADE,
  permission_id  uuid NOT NULL REFERENCES public.platform_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Seed (20261224000000, lines 61-65) — required so 20260903053951's own
-- WHERE r.name = 'super_admin' / 'control_tower' inserts actually match rows.
INSERT INTO public.platform_roles (name, description) VALUES
  ('super_admin',   'Full platform access across all modules'),
  ('control_tower', 'Verification review and credit adjustments'),
  ('reach_admin',   'Reach campaign, audience, and analytics management')
ON CONFLICT (name) DO NOTHING;

-- ── owner_vehicles ──────────────────────────────────────────────────────────
-- (20270210114000_create_owner_vehicles.sql, lines 7-28 — table body only.
-- Phase 7H: depends only on public.profiles → auth.users, both of which
-- predate this cluster. Indexes, trigger, RLS, policies, grants, comments,
-- and ALTER TABLE OWNER remain owned by the canonical creator.)

CREATE TABLE IF NOT EXISTS public.owner_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  vehicle_type text,
  capacity text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_body_type text,
  vehicle_size text,
  vehicle_axle text,
  fuel_type text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'maintenance'::text])),
  documents jsonb NOT NULL DEFAULT '{}'::jsonb,
  avatar_url text,
  avatar_seed text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_vehicles_number_nonempty CHECK (length(trim(vehicle_number)) > 0)
);

-- ── market_bids ─────────────────────────────────────────────────────────────
-- (20270301040000_market_bids.sql, lines 11-30 — table body only.
-- Phase 7K: FKs indents / auth.users / organizations (all predate this
-- cluster) and owner_vehicles (already created above in this file).
-- Indexes, trigger, RLS, policies, grants, comments, RPCs, later
-- status-check widening, and later fee columns remain owned by their
-- canonical/later migrations.)

CREATE TABLE IF NOT EXISTS public.market_bids (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indent_id               uuid NOT NULL REFERENCES public.indents(id) ON DELETE CASCADE,
  bidder_type             text NOT NULL CHECK (bidder_type IN ('dco', 'organization')),
  bidder_user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bidder_organization_id  uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_vehicle_id        uuid NULL REFERENCES public.owner_vehicles(id) ON DELETE SET NULL,
  amount                  numeric NOT NULL CHECK (amount > 0),
  note                    text,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  accepted_at             timestamptz,
  CONSTRAINT market_bids_bidder_shape CHECK (
    (bidder_type = 'dco' AND bidder_organization_id IS NULL)
    OR (bidder_type = 'organization' AND bidder_organization_id IS NOT NULL)
  ),
  UNIQUE (indent_id, bidder_user_id)
);

-- ── support_tickets + 3 child tables ────────────────────────────────────────
-- (20270302000000_support_tickets_schema.sql, lines 15-107 — table bodies
-- only; the display-id sequence/helper, indexes, RLS, and policies in that
-- file remain owned by it)

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  display_id text not null,
  created_by_user_id uuid not null references auth.users(id),
  organization_id uuid references public.organizations(id),
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  assigned_to uuid,
  source_screen text,
  trip_id uuid references public.trips(id),
  indent_id uuid references public.indents(id),
  owner_vehicle_id uuid references public.owner_vehicles(id),
  market_bid_id uuid references public.market_bids(id),
  reporter_display_name text,
  organization_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  constraint support_tickets_display_id_unique unique (display_id),
  constraint support_tickets_status_check check (
    status = any (array['open','assigned','in_progress','waiting_for_user','resolved','closed'])
  ),
  constraint support_tickets_priority_check check (
    priority = any (array['low','medium','high','critical'])
  )
);

-- (20270303030000_support_ticket_read_cursors.sql, lines 10-12 — the two
-- columns required by 20260903054729's idx_support_tickets_needs_attention.
-- Sibling columns, CHECK, backfill, and RPCs remain owned by that file.)

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS last_public_author_type text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS last_public_activity_at timestamptz NOT NULL DEFAULT now();

-- (20270303030000_support_ticket_read_cursors.sql, line 14 — Phase 7O:
-- LANGUAGE sql admin_support_attention_count() binds this column at CREATE.
-- user_last_read_at, CHECK, backfill, and RPCs remain owned by that file.)

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS agent_last_read_at timestamptz;

create table if not exists public.support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body text not null,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  constraint support_ticket_comments_visibility_check check (
    visibility = any (array['public','internal'])
  )
);

create table if not exists public.support_ticket_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  comment_id uuid references public.support_ticket_comments(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ── organization_kyc_documents ──────────────────────────────────────────────
-- (20261107070000_organization_kyc_documents.sql, lines 4-32 — table body
-- only; its indexes/comment/RLS/policies/trigger remain owned by it)

CREATE TABLE IF NOT EXISTS public.organization_kyc_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_type         text NOT NULL CHECK (doc_type IN (
    'gst_certificate',
    'pan_card',
    'cin_certificate',
    'address_proof',
    'msme_certificate',
    'iec_certificate',
    'incorporation_certificate',
    'other'
  )),
  doc_label        text,
  storage_path     text,
  file_name        text,
  mime_type        text,
  file_size_bytes  bigint,
  is_mandatory     boolean NOT NULL DEFAULT true,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_at      timestamptz,
  verified_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_notes  text,
  uploaded_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- ── driver_kyc_documents ────────────────────────────────────────────────────
-- (20270118000000_driver_kyc_documents.sql, lines 12-37 — table body only)

CREATE TABLE IF NOT EXISTS public.driver_kyc_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type         text NOT NULL CHECK (doc_type IN (
    'license',
    'aadhaar',
    'pan',
    'selfie',
    'other'
  )),
  doc_label        text,
  storage_path     text,
  file_name        text,
  mime_type        text,
  file_size_bytes  bigint,
  is_mandatory     boolean NOT NULL DEFAULT true,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_at      timestamptz,
  verified_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_notes  text,
  uploaded_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- ── driver_kyc_submissions ──────────────────────────────────────────────────
-- (20270118000500_driver_kyc_submission_gate.sql, lines 11-22 — table body
-- only)

create table if not exists public.driver_kyc_submissions (
  driver_user_id   uuid primary key references auth.users(id) on delete cascade,
  submitted_at     timestamptz not null default now(),
  review_status    text not null default 'submitted'
                     check (review_status in ('submitted', 'approved', 'rejected')),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id),
  review_notes     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── verification_audit_logs ─────────────────────────────────────────────────
-- (20261101000000_business_verification_sprint1.sql, lines 38-48 — table
-- body only; public.kyc_verification_status already exists, from
-- 20260801000000_workspace_kyc_structure.sql)

CREATE TABLE IF NOT EXISTS public.verification_audit_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status  public.kyc_verification_status,
  new_status       public.kyc_verification_status NOT NULL,
  rejection_reasons jsonb,
  notes            text,
  ip_address       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── org_feature_flags ───────────────────────────────────────────────────────
-- (20261101000006_org_feature_flags.sql, lines 2-9 — table body only)

CREATE TABLE IF NOT EXISTS public.org_feature_flags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_id     text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, flag_id)
);

-- ── can_review_driver_kyc() ─────────────────────────────────────────────────
-- (20270121000000_driver_kyc_service_role_reviewer.sql, lines 26-39 —
-- function body only; 20260903062910 itself already contains the
-- REVOKE/GRANT for this function, so none is duplicated here)

create or replace function public.can_review_driver_kyc()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    current_user = 'service_role'
    or current_setting('role', true) = 'service_role'
    or public.has_platform_permission((select auth.uid()), 'driver_kyc.review');
$$;
