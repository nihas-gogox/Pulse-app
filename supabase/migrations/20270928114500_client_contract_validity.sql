-- Customer profile contract window. Both dates are optional.
alter table public.clients
  add column if not exists valid_from date,
  add column if not exists valid_to date;

alter table public.clients
  drop constraint if exists clients_valid_range_check;

alter table public.clients
  add constraint clients_valid_range_check
  check (valid_from is null or valid_to is null or valid_to >= valid_from);

comment on column public.clients.valid_from is
  'Customer contract validity start (date).';
comment on column public.clients.valid_to is
  'Customer contract validity end (date).';
