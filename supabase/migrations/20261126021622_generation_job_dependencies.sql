create table if not exists public.generation_job_dependencies (
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  depends_on_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, depends_on_job_id),
  check (job_id <> depends_on_job_id)
);

alter table public.generation_job_dependencies enable row level security;
