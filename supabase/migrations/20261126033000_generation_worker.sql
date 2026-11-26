alter table public.generation_jobs
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists worker_token uuid;

create index if not exists generation_jobs_available_idx
  on public.generation_jobs (available_at, created_at)
  where status = 'queued';

create or replace function public.claim_generation_job()
returns setof public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.generation_jobs
  set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
      last_error = 'worker_lease_expired',
      started_at = null,
      worker_token = null,
      finished_at = case when attempts >= max_attempts then now() else null end,
      available_at = now(),
      updated_at = now()
  where status = 'processing'
    and updated_at < now() - interval '20 minutes';

  update public.orders as order_row
  set generation_status = 'failed',
      generation_error = 'worker_lease_expired',
      updated_at = now()
  where order_row.generation_status <> 'content_deleted'
    and exists (
      select 1
      from public.generation_jobs as job
      where job.order_id = order_row.id
        and job.status = 'failed'
        and job.last_error = 'worker_lease_expired'
    );

  update public.preview_sessions as preview
  set status = 'failed',
      last_error = 'worker_lease_expired',
      updated_at = now()
  where exists (
    select 1
    from public.generation_jobs as job
    where job.preview_id = preview.id
      and job.status = 'failed'
      and job.last_error = 'worker_lease_expired'
  );

  return query
  with candidate as (
    select job.id
    from public.generation_jobs as job
    where job.status = 'queued'
      and job.available_at <= now()
      and not exists (
        select 1
        from public.generation_job_dependencies as dependency
        join public.generation_jobs as prerequisite
          on prerequisite.id = dependency.depends_on_job_id
        where dependency.job_id = job.id
          and prerequisite.status <> 'completed'
      )
    order by job.created_at, job.id
    for update of job skip locked
    limit 1
  )
  update public.generation_jobs as job
  set status = 'processing',
      attempts = job.attempts + 1,
      worker_token = gen_random_uuid(),
      started_at = now(),
      finished_at = null,
      last_error = null,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end
$function$;

revoke all on function public.claim_generation_job() from public, anon, authenticated;
grant execute on function public.claim_generation_job() to service_role;
