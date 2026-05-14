-- APP 1 — Product Inventory: schema
-- Paste into the Supabase SQL editor and run once per project.
-- Re-running is safe (everything is `if not exists` / `create or replace`).

create extension if not exists "pgcrypto";

create table if not exists public.product_inventory (
  id                uuid        primary key default gen_random_uuid(),
  instance_name     text        not null,
  sku               text        not null,
  product_name      text        not null,
  category          text        not null,
  on_hand           integer     not null default 0 check (on_hand >= 0),
  reserved          integer     not null default 0 check (reserved >= 0),
  reorder_threshold integer     not null default 0 check (reorder_threshold >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint product_inventory_instance_sku_unique unique (instance_name, sku)
);

create index if not exists product_inventory_instance_name_idx
  on public.product_inventory (instance_name);

create index if not exists product_inventory_instance_sku_idx
  on public.product_inventory (instance_name, sku);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_inventory_set_updated_at
  on public.product_inventory;

create trigger product_inventory_set_updated_at
  before update on public.product_inventory
  for each row execute function public.set_updated_at();

-- Demo: disable RLS so the anon key the app uses can read/write.
-- For production, enable RLS and add policies scoped to instance_name.
alter table public.product_inventory disable row level security;
