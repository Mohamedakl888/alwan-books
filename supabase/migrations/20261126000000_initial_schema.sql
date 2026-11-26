create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'delivered', 'cancelled')),
  customer jsonb not null check (jsonb_typeof(customer) = 'object'),
  children jsonb not null check (jsonb_typeof(children) = 'array'),
  package jsonb not null check (jsonb_typeof(package) = 'object'),
  total integer not null check (total >= 0),
  payment_status text not null default 'not_paid'
    check (payment_status in ('not_paid', 'pending', 'paid', 'failed', 'refunded')),
  payment_provider text,
  payment_reference text,
  payment_url text,
  payment_status_token_hash text,
  email_notification jsonb not null default '{"status":"pending"}'::jsonb,
  whatsapp_notification jsonb not null default '{"status":"not_configured"}'::jsonb
);

alter table public.orders
  add column if not exists payment_status_token_hash text;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.trial_requests (
  id uuid primary key default gen_random_uuid(),
  mobile text not null check (mobile ~ '^[0-9]{7,12}$'),
  status text not null default 'trial_requested'
    check (status in ('trial_requested', 'verified', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists trial_requests_created_at_idx on public.trial_requests (created_at desc);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  child_index smallint not null check (child_index between 0 and 1),
  theme text not null check (theme in ('adventure', 'friendship', 'discovery')),
  content text not null check (length(content) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, child_index)
);

create index if not exists stories_order_id_idx on public.stories (order_id);

alter table public.orders enable row level security;
alter table public.trial_requests enable row level security;
alter table public.stories enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('child-photos', 'child-photos', false, 4194304, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
