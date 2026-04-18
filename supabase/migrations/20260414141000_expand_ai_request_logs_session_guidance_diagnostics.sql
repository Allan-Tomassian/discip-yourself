alter table public.ai_request_logs
  add column if not exists mode text,
  add column if not exists protocol_type text,
  add column if not exists provider_status text,
  add column if not exists rejection_stage text,
  add column if not exists rejection_reason text,
  add column if not exists validation_passed boolean,
  add column if not exists richness_passed boolean,
  add column if not exists step_count integer,
  add column if not exists item_count integer,
  add column if not exists zod_issue_paths jsonb;

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_coach_kind_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_coach_kind_check
  check (coach_kind in ('now', 'recovery', 'chat', 'local-analysis', 'session-guidance'));
