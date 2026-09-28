-- Allow trip vault Memo files on trip_documents.
-- Replaces both historical document-type checks with one catalog so Memo
-- can be stored, and existing insurance / RC / expense rows still pass.

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
