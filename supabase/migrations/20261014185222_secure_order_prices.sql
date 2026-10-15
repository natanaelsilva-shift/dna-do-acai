-- O catálogo continua em src/data/menu.ts. Não duplica produtos no banco.
-- Aplicar junto da API que usa SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY.
begin;

-- Apenas o backend com service_role pode inserir o snapshot já validado.
drop policy if exists "orders_public_insert" on public.orders;
revoke insert on table public.orders from public, anon, authenticated;
grant insert on table public.orders to service_role;

-- Bloqueia também tentativas de adulterar preços depois da inserção.
-- Preserva as atualizações existentes de status, entrega e impressão.
create or replace function public.protect_order_price_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.items is distinct from old.items
     or new.subtotal is distinct from old.subtotal
     or new.whatsapp_payload is distinct from old.whatsapp_payload then
    raise exception 'O valor e os itens de um pedido finalizado são imutáveis.'
      using errcode = '23514';
  end if;
  if (new.total is distinct from old.total or new.delivery_fee is distinct from old.delivery_fee)
     and new.total is distinct from (old.subtotal + coalesce(new.delivery_fee, 0)) then
    raise exception 'O total deve corresponder ao subtotal salvo mais a entrega.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_protect_price_snapshot on public.orders;
create trigger orders_protect_price_snapshot
before update on public.orders
for each row execute function public.protect_order_price_snapshot();

commit;
