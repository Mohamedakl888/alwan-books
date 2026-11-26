alter table public.orders
  drop constraint if exists orders_generation_status_check;

alter table public.orders
  add constraint orders_generation_status_check
  check (generation_status in ('not_started', 'queued', 'processing', 'needs_review', 'failed', 'completed', 'content_deleted'));
