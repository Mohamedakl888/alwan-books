alter table public.orders
  add column if not exists generation_status text not null default 'not_started',
  add column if not exists generation_error text,
  add column if not exists book_pdf_path text,
  add column if not exists ai_processing_consent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_generation_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_generation_status_check
      check (generation_status in ('not_started', 'queued', 'processing', 'needs_review', 'failed', 'completed'));
  end if;
end
$$;

create table if not exists public.preview_sessions (
  id uuid primary key default gen_random_uuid(),
  resume_token_hash text not null unique,
  child_data jsonb not null check (jsonb_typeof(child_data) = 'object'),
  source_image_path text not null,
  generated_pages jsonb not null default '[]'::jsonb check (jsonb_typeof(generated_pages) = 'array'),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'needs_review', 'failed', 'completed', 'cancelled')),
  consent_at timestamptz not null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists preview_sessions_status_created_idx
  on public.preview_sessions (status, created_at);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id text references public.orders(id) on delete cascade,
  preview_id uuid references public.preview_sessions(id) on delete cascade,
  job_type text not null check (job_type in ('photo_review', 'preview_pages', 'book_illustrations', 'pdf_assembly')),
  child_index smallint check (child_index between 0 and 1),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'needs_review', 'failed', 'completed', 'cancelled')),
  source_image_path text,
  result_path text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((order_id is not null and preview_id is null) or (order_id is null and preview_id is not null))
);

create index if not exists generation_jobs_queue_idx
  on public.generation_jobs (status, created_at);
create index if not exists generation_jobs_order_idx
  on public.generation_jobs (order_id, created_at desc)
  where order_id is not null;
create index if not exists generation_jobs_preview_idx
  on public.generation_jobs (preview_id, created_at desc)
  where preview_id is not null;

alter table public.preview_sessions enable row level security;
alter table public.generation_jobs enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-books',
  'generated-books',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
