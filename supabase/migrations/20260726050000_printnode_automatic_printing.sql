create extension if not exists pgcrypto;

alter table public.orders alter column print_status drop default;

create table if not exists public.print_settings (
  id text primary key,
  automatic_enabled boolean not null default false,
  store_name text not null default 'DNA DO AÇAÍ',
  paper_width integer not null default 80 check (paper_width in (58, 80)),
  characters_per_line integer not null default 48 check (characters_per_line between 24 and 64),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.print_settings (
  id,
  automatic_enabled,
  store_name,
  paper_width,
  characters_per_line,
  max_attempts
)
values ('main', false, 'DNA DO AÇAÍ', 80, 48, 3)
on conflict (id) do nothing;

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null default 'automatic'
    check (kind in ('automatic', 'manual', 'test')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'printed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_job_id text,
  provider_response jsonb,
  error_message text,
  requested_by text,
  test_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  printed_at timestamptz,
  constraint print_jobs_order_or_test_check check (
    (kind = 'test' and order_id is null)
    or (kind <> 'test' and order_id is not null)
  )
);

alter table public.print_jobs
  add column if not exists provider_response jsonb;

create unique index if not exists print_jobs_one_automatic_per_order_idx
  on public.print_jobs (order_id)
  where kind = 'automatic';

create index if not exists print_jobs_order_id_idx
  on public.print_jobs (order_id, created_at desc);

create index if not exists print_jobs_status_idx
  on public.print_jobs (status, created_at);

alter table public.print_jobs enable row level security;
alter table public.print_settings enable row level security;

create or replace function public.touch_print_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists print_jobs_touch_updated_at on public.print_jobs;
create trigger print_jobs_touch_updated_at
before update on public.print_jobs
for each row
execute function public.touch_print_updated_at();

drop trigger if exists print_settings_touch_updated_at on public.print_settings;
create trigger print_settings_touch_updated_at
before update on public.print_settings
for each row
execute function public.touch_print_updated_at();

create or replace function public.enqueue_automatic_print_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  printing_enabled boolean;
begin
  select automatic_enabled
  into printing_enabled
  from public.print_settings
  where id = 'main';

  if coalesce(printing_enabled, false) and new.status = 'Novo' then
    insert into public.print_jobs (order_id, kind, status)
    values (new.id, 'automatic', 'pending')
    on conflict (order_id) where kind = 'automatic' do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enqueue_automatic_print on public.orders;
create trigger orders_enqueue_automatic_print
after insert on public.orders
for each row
execute function public.enqueue_automatic_print_job();

create or replace function public.sync_order_print_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_id is null then
    return new;
  end if;

  update public.orders
  set
    print_status = case
      when new.status = 'processing' then 'printing'
      else new.status
    end,
    print_attempts = greatest(coalesce(print_attempts, 0), new.attempts),
    print_error = new.error_message,
    print_updated_at = new.updated_at,
    printed_at = case
      when new.status = 'printed' then coalesce(printed_at, new.printed_at, now())
      else printed_at
    end
  where id = new.order_id;

  return new;
end;
$$;

drop trigger if exists print_jobs_sync_order_state on public.print_jobs;
create trigger print_jobs_sync_order_state
after insert or update on public.print_jobs
for each row
execute function public.sync_order_print_state();

create or replace function public.claim_print_job(p_job_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_job public.print_jobs;
begin
  update public.print_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    error_message = null
  where id = p_job_id
    and status = 'pending'
  returning * into claimed_job;

  return claimed_job;
end;
$$;

create or replace function public.request_order_reprint(
  p_order_id uuid,
  p_requested_by text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_job_id uuid;
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Pedido não encontrado.';
  end if;

  insert into public.print_jobs (
    order_id,
    kind,
    status,
    requested_by
  )
  values (
    p_order_id,
    'manual',
    'pending',
    nullif(left(trim(coalesce(p_requested_by, '')), 200), '')
  )
  returning id into new_job_id;

  return new_job_id;
end;
$$;

create or replace function public.request_test_print(
  p_requested_by text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_job_id uuid;
begin
  insert into public.print_jobs (
    order_id,
    kind,
    status,
    requested_by,
    test_payload
  )
  values (
    null,
    'test',
    'pending',
    nullif(left(trim(coalesce(p_requested_by, '')), 200), ''),
    jsonb_build_object('scenario', 'complete')
  )
  returning id into new_job_id;

  return new_job_id;
end;
$$;

create or replace function public.get_print_settings()
returns table (
  automatic_enabled boolean,
  store_name text,
  paper_width integer,
  characters_per_line integer,
  max_attempts integer,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    settings.automatic_enabled,
    settings.store_name,
    settings.paper_width,
    settings.characters_per_line,
    settings.max_attempts,
    settings.updated_at
  from public.print_settings as settings
  where settings.id = 'main';
$$;

create or replace function public.set_print_automatic_enabled(p_enabled boolean)
returns table (
  automatic_enabled boolean,
  store_name text,
  paper_width integer,
  characters_per_line integer,
  max_attempts integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.print_settings
  set automatic_enabled = p_enabled
  where id = 'main';

  return query
  select *
  from public.get_print_settings();
end;
$$;

revoke all on table public.print_jobs from anon, authenticated;
revoke all on table public.print_settings from anon, authenticated;

revoke all on function public.claim_print_job(uuid) from public;
revoke all on function public.request_order_reprint(uuid, text) from public;
revoke all on function public.request_test_print(text) from public;
revoke all on function public.get_print_settings() from public;
revoke all on function public.set_print_automatic_enabled(boolean) from public;

grant execute on function public.claim_print_job(uuid) to service_role;
grant execute on function public.request_order_reprint(uuid, text) to authenticated;
grant execute on function public.request_test_print(text) to authenticated;
grant execute on function public.get_print_settings() to authenticated;
grant execute on function public.set_print_automatic_enabled(boolean) to authenticated;
