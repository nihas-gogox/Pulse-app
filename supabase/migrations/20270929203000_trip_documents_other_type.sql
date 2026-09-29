-- Allow Trip Details "Other Documents" files on trip_documents.
-- Replaces the document-type check with the same catalog plus `other`.
--
-- Supersedes 20270928123000_trip_documents_other_type.sql (Praveen, commit
-- ae216f5b). That file is intentionally not carried into this release branch:
-- it sorts before migrations already applied on preprod (20270929162901), so
-- a normal `supabase db push` refuses it without --include-all. The constraint
-- below is identical to it (same 18 types, same drop/re-add); only the version
-- and the lock_timeout are new. Preprod already has this exact constraint, so
-- there it re-creates the same definition.

set local lock_timeout = '5s';

alter table public.trip_documents drop constraint if exists trip_documents_type_check;
alter table public.trip_documents drop constraint if exists trip_documents_document_type_check;

alter table public.trip_documents add constraint trip_documents_document_type_check
  check (document_type in (
    'manifest',
    'pod',
    'soft_pod',
    'pod_soft',
    'invoice',
    'memo',
    'other',
    'eway_bill',
    'loading_slip',
    'odometer_start_photo',
    'odometer_end_photo',
    'fuel_bill_photo',
    'toll_receipt_photo',
    'trip_expense_receipt_photo',
    'maintenance_invoice_photo',
    'lr',
    'insurance',
    'rc'
  ));
