-- Reusable Workspace Vehicle Documents in Trip Compliance + Trip Detail.
--
-- Goal: let a compliance reviewer attach an already-verified vehicle
-- document (public.entity_documents, entity_type = 'vehicle') as a trip's
-- own compliance evidence for the 'rc'/'insurance' document types, without
-- re-uploading the file and without duplicating it into storage.
--
-- Architecture decision (see repo-wide discovery before this migration):
--   - `public.vehicles.documents` (the JSONB "vault") has NO versioning, NO
--     verification concept, and overwrite semantics — it cannot satisfy the
--     historical-immutability requirement ("trip A must keep showing the
--     exact version it used, even after the vehicle gets a v4"). It is NOT
--     used as the reuse source.
--   - `public.entity_documents` already has exactly the versioning precedent
--     required: `replaced_by_id` + `status = 'replaced'`, plus real
--     verification fields (`verified_by`/`verified_at`) and `expiry_date`.
--     It IS the reuse source. A referenced row's id never changes even after
--     it is superseded (status flips to 'replaced', but the row — and this
--     FK — still resolve to the exact version that was used).
--   - `public.trip_documents.storage_path` is read everywhere via
--     `getDocumentViewUrl()` (features/trips/services/tripDocuments.service.ts),
--     which is hard-coded to the `trip-documents` bucket. `entity_documents`
--     files live in the `compliance-documents` bucket. Writing an
--     entity_documents storage_path into trip_documents.storage_path would
--     silently break every generic trip-document viewer (wrong bucket).
--     Copying the file across buckets would violate the explicit
--     no-duplicate-storage requirement. So a reused row's storage_path is a
--     synthetic reference marker (`ref:vehicle-document:...`), never a real
--     bucket object — the same "metadata-only trip_documents row" pattern
--     already used for LR/e-way-bill field rows
--     (lrFieldsStoragePath()/ewayBillFieldsStoragePath(), detected via
--     isLrFieldsMetaPath()/isEwayBillMetaPath()). The real file is resolved
--     through the existing compliance-documents signer
--     (getComplianceDocumentSignedUrl), exactly as entity_documents rows are
--     already previewed today in ComplianceDocumentReviewSheet — not a
--     second preview/storage implementation.
--   - No new document/versioning/audit system: this migration adds one
--     nullable FK column (+ index) to the existing trip_documents table, and
--     one RPC that writes trip_documents/document_audit_log/
--     trip_workflow_events through their existing shapes and CHECK
--     constraints (no enum widened).

-- ── 1. trip_documents: record which entity_documents version was reused ────

alter table public.trip_documents
  add column if not exists source_entity_document_id uuid
    references public.entity_documents(id) on delete set null;

comment on column public.trip_documents.source_entity_document_id is
  'Set only when this row is reused workspace-vehicle evidence (see use_vehicle_document_for_trip()). Points at the exact public.entity_documents version used — the FK target keeps resolving to that same row even after the vehicle document is later replaced, satisfying historical immutability. Null for a freshly uploaded trip document. When set, storage_path is a synthetic "ref:vehicle-document:..." marker, not a trip-documents-bucket object — resolve the real file via getComplianceDocumentSignedUrl(entity_documents.storage_path), not getDocumentViewUrl().';

create index if not exists idx_trip_documents_source_entity_document_id
  on public.trip_documents (source_entity_document_id)
  where source_entity_document_id is not null;

-- ── 2. use_vehicle_document_for_trip — the domain operation ────────────────
--
-- Same SECURITY DEFINER + has_member_surface() pattern as every other
-- compliance mutation RPC in this feature (verify_trip_document,
-- mark_trip_compliance_verified, approve_trip_compliance_with_exception).
-- Reuses the existing 'trip_compliance.documents.verify' surface — reusing
-- an already-verified vehicle document as trip evidence is the same class of
-- action (asserting a document is valid evidence for this trip) as verifying
-- a freshly uploaded one, so no new permission surface is introduced.
--
-- Only 'rc' and 'insurance' are accepted: those are the only vehicle-type
-- values `trip_documents_document_type_check` already allows (added by
-- 20260915162440) — fitness/permit/pollution/road_tax stay display-only via
-- the existing Vehicle checklist group (features/tripCompliance/utils/
-- complianceChecklist.util.ts), unchanged by this migration.
--
-- Idempotency: re-selecting the exact same entity_documents version for the
-- same trip/document_type is a no-op (returns the existing row). Selecting a
-- *different* version replaces the row in place — same convention
-- uploadTripDocument()'s `replaceExistingOfType` already uses for a fresh
-- re-upload — and is audited as a distinct 'replaced' event.

create or replace function public.use_vehicle_document_for_trip(
  p_trip_id uuid,
  p_entity_document_id uuid,
  p_document_type text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_org_id        uuid;
  v_vehicle_id    uuid;
  v_doc_org_id    uuid;
  v_doc_entity    text;
  v_doc_entity_id uuid;
  v_doc_type      text;
  v_doc_status    text;
  v_doc_expiry    date;
  v_doc_label     text;
  v_doc_number    text;
  v_ref_path      text;
  v_file_name     text;
  v_existing_id   uuid;
  v_existing_src  uuid;
  v_result_id     uuid;
  v_action        text;
begin
  if p_document_type not in ('rc', 'insurance') then
    raise exception 'document type % cannot be reused as trip compliance evidence (only rc/insurance are supported)', p_document_type;
  end if;

  select organization_id, vehicle_id
    into v_org_id, v_vehicle_id
    from public.trips
   where id = p_trip_id
     for update;

  if v_org_id is null then
    raise exception 'trip not found';
  end if;
  if not public.has_member_surface(v_org_id, 'trip_compliance.documents.verify') then
    raise exception 'not authorized to attach compliance documents for this organization';
  end if;
  if v_vehicle_id is null then
    raise exception 'trip has no assigned vehicle';
  end if;

  select organization_id, entity_type, entity_id, doc_type, status, expiry_date, doc_label, doc_number
    into v_doc_org_id, v_doc_entity, v_doc_entity_id, v_doc_type, v_doc_status, v_doc_expiry, v_doc_label, v_doc_number
    from public.entity_documents
   where id = p_entity_document_id;

  if v_doc_org_id is null then
    raise exception 'vehicle document not found';
  end if;
  if v_doc_org_id != v_org_id then
    raise exception 'vehicle document belongs to a different workspace';
  end if;
  if v_doc_entity != 'vehicle' or v_doc_entity_id != v_vehicle_id then
    raise exception 'vehicle document does not belong to this trip''s assigned vehicle';
  end if;
  if v_doc_type != p_document_type then
    raise exception 'vehicle document type (%) does not match the requested requirement (%)', v_doc_type, p_document_type;
  end if;
  if v_doc_status != 'verified' then
    raise exception 'vehicle document is not eligible for reuse (status: %)', v_doc_status;
  end if;
  if v_doc_expiry is not null and v_doc_expiry < current_date then
    raise exception 'vehicle document is expired (expiry date: %)', v_doc_expiry;
  end if;

  select id, source_entity_document_id
    into v_existing_id, v_existing_src
    from public.trip_documents
   where trip_id = p_trip_id
     and document_type = p_document_type
   order by uploaded_at desc
   limit 1;

  if v_existing_id is not null and v_existing_src = p_entity_document_id then
    -- Idempotent retry of the exact same reuse action.
    return jsonb_build_object(
      'trip_document_id', v_existing_id,
      'entity_document_id', p_entity_document_id,
      'document_type', p_document_type,
      'already_attached', true
    );
  end if;

  v_ref_path := 'ref:vehicle-document:' || p_trip_id::text || ':' || p_document_type || ':' || p_entity_document_id::text;
  v_file_name := coalesce(v_doc_label, initcap(p_document_type) || ' (workspace vehicle document)');

  if v_existing_id is not null then
    update public.trip_documents
       set file_name = v_file_name,
           storage_path = v_ref_path,
           mime_type = null,
           size_bytes = null,
           document_number = v_doc_number,
           uploaded_by = v_uid,
           uploaded_at = now(),
           status = 'verified',
           verified_by = v_uid,
           verified_at = now(),
           rejection_reason = null,
           source_entity_document_id = p_entity_document_id
     where id = v_existing_id;
    v_result_id := v_existing_id;
    v_action := 'replaced';
  else
    insert into public.trip_documents
      (trip_id, file_name, storage_path, mime_type, size_bytes, document_type,
       document_number, uploaded_by, uploaded_at, status, verified_by, verified_at,
       source_entity_document_id)
    values
      (p_trip_id, v_file_name, v_ref_path, null, null, p_document_type,
       v_doc_number, v_uid, now(), 'verified', v_uid, now(),
       p_entity_document_id)
    returning id into v_result_id;
    v_action := 'uploaded';
  end if;

  insert into public.document_audit_log
    (document_id, organization_id, entity_type, entity_id, action, actor_id, old_status, new_status, notes, metadata)
  values
    (p_entity_document_id, v_org_id, 'trip_document', v_result_id, v_action, v_uid, null, 'verified',
     'Reused workspace vehicle document as trip compliance evidence.',
     jsonb_build_object(
       'source', 'workspace_vehicle_document',
       'action_detail', 'reused',
       'trip_id', p_trip_id,
       'vehicle_id', v_vehicle_id,
       'document_type', p_document_type,
       'entity_document_id', p_entity_document_id
     ));

  begin
    insert into public.trip_workflow_events
      (trip_id, org_id, actor_id, event_type, payload, idempotency_key)
    values
      (p_trip_id, v_org_id, v_uid, 'compliance.vehicle_document_reused',
       jsonb_build_object(
         'document_type', p_document_type,
         'entity_document_id', p_entity_document_id,
         'trip_document_id', v_result_id
       ),
       p_trip_id::text || ':compliance.vehicle_document_reused:' || p_document_type || ':' || p_entity_document_id::text);
  exception when unique_violation then
    null;
  end;

  return jsonb_build_object(
    'trip_document_id', v_result_id,
    'entity_document_id', p_entity_document_id,
    'document_type', p_document_type,
    'already_attached', false
  );
end;
$$;

grant execute on function public.use_vehicle_document_for_trip(uuid, uuid, text) to authenticated;
revoke all on function public.use_vehicle_document_for_trip(uuid, uuid, text) from public;
