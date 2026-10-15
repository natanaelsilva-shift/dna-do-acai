begin;
-- Consulta os metadados atuais: revogar o papel tem efeito mesmo em JWT antigo.
create schema if not exists dna_private;
revoke all on schema dna_private from public, anon;
grant usage on schema dna_private to authenticated;
create or replace function dna_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users where id = (select auth.uid())
    and raw_app_meta_data->>'role' = 'admin'
  );
$$;
revoke all on function dna_private.is_admin() from public, anon;
grant execute on function dna_private.is_admin() to authenticated;

insert into public.store_settings (id,status) values ('main','open') on conflict (id) do nothing;
alter table public.store_settings enable row level security;
drop policy if exists store_settings_public_update on public.store_settings;
drop policy if exists store_settings_public_select on public.store_settings;
drop policy if exists dna_store_admin_update on public.store_settings;
create policy store_settings_public_select on public.store_settings for select to anon, authenticated using (id='main');
create policy dna_store_admin_update on public.store_settings for update to authenticated
  using (id='main' and (select dna_private.is_admin()))
  with check (id='main' and status in ('open','closed') and (select dna_private.is_admin()));
revoke all on table public.store_settings from public, anon, authenticated;
grant select on table public.store_settings to anon, authenticated;
grant update (status,updated_at) on public.store_settings to authenticated;
grant all on public.store_settings to service_role;

alter table public.orders enable row level security;
drop policy if exists orders_public_insert on public.orders;
drop policy if exists orders_public_select on public.orders;
drop policy if exists orders_public_update_status on public.orders;
drop policy if exists dna_orders_admin_select on public.orders;
drop policy if exists dna_orders_admin_update on public.orders;
create policy dna_orders_admin_select on public.orders for select to authenticated using ((select dna_private.is_admin()));
create policy dna_orders_admin_update on public.orders for update to authenticated using ((select dna_private.is_admin())) with check ((select dna_private.is_admin()));
revoke all on public.orders from public, anon, authenticated;
grant select on public.orders to authenticated;
grant update (status, delivery_fee, total, updated_at) on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.orders add column if not exists request_id uuid;
create unique index if not exists orders_request_id_unique on public.orders (request_id) where request_id is not null;
-- O identificador de uma tentativa não pode ser trocado após o pedido ser salvo.
create or replace function dna_private.protect_request_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.request_id is distinct from old.request_id then
    raise exception 'O identificador original do pedido é imutável.';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_protect_request_id on public.orders;
create trigger orders_protect_request_id before update on public.orders for each row execute function dna_private.protect_request_id();

create table if not exists public.catalog_settings (
  id text primary key check (id='main'),
  snapshot jsonb check (snapshot is null or jsonb_typeof(snapshot)='object'),
  updated_at timestamptz not null default now()
);
-- NULL seleciona o catálogo versionado em menu.ts, sem duplicar preços no SQL.
insert into public.catalog_settings (id,snapshot) values ('main',null) on conflict (id) do nothing;
alter table public.catalog_settings enable row level security;
drop policy if exists dna_catalog_public_select on public.catalog_settings;
drop policy if exists dna_catalog_admin_update on public.catalog_settings;
create policy dna_catalog_public_select on public.catalog_settings for select to anon, authenticated using (id='main');
create policy dna_catalog_admin_update on public.catalog_settings for update to authenticated using ((select dna_private.is_admin())) with check ((select dna_private.is_admin()));
revoke all on public.catalog_settings from public, anon, authenticated;
grant select on public.catalog_settings to anon, authenticated;
grant update (snapshot,updated_at) on public.catalog_settings to authenticated;
grant all on public.catalog_settings to service_role;

-- Funções que alteram pedidos ou impressão passam somente pelo backend autorizado.
revoke all on function public.claim_order_print(uuid), public.complete_order_print(uuid), public.fail_order_print(uuid,text), public.register_order_reprint(uuid),
  public.claim_print_job(uuid), public.request_order_reprint(uuid,text), public.request_test_print(text), public.get_print_settings(), public.set_print_automatic_enabled(boolean)
  from public, anon, authenticated;
grant execute on function public.claim_order_print(uuid), public.complete_order_print(uuid), public.fail_order_print(uuid,text), public.register_order_reprint(uuid),
  public.claim_print_job(uuid), public.request_order_reprint(uuid,text), public.request_test_print(text), public.get_print_settings(), public.set_print_automatic_enabled(boolean)
  to service_role;
grant all on public.print_settings, public.print_jobs to service_role;

-- A fila é secundária: uma falha nela nunca desfaz o pedido.
create or replace function public.enqueue_automatic_print_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if new.status='Novo' and exists (select 1 from public.print_settings where id='main' and automatic_enabled) then
      insert into public.print_jobs (order_id,kind,status) values (new.id,'automatic','pending')
      on conflict (order_id) where kind='automatic' do nothing;
    end if;
  exception when others then
    raise warning 'DNA_PRINT_QUEUE_UNAVAILABLE [%]', sqlstate;
    begin
      update public.orders set print_status='failed', print_error='Falha ao enfileirar impressão. Reenvie pelo painel.', print_updated_at=now() where id=new.id;
    exception when others then
      raise warning 'DNA_PRINT_STATE_UNAVAILABLE [%]', sqlstate;
    end;
  end;
  return new;
end;
$$;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='store_settings') then
      alter publication supabase_realtime add table public.store_settings;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
  end if;
end;
$$;
commit;
