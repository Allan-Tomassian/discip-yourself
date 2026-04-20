alter table public.ai_request_logs
  add column if not exists provider_ms integer,
  add column if not exists repaired_occurrence_count integer,
  add column if not exists repaired_minutes_delta integer,
  add column if not exists active_days jsonb,
  add column if not exists light_days jsonb,
  add column if not exists dense_days jsonb;

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_coach_kind_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_coach_kind_check
  check (coach_kind in ('now', 'recovery', 'chat', 'local-analysis', 'session-guidance', 'first-run-plan'));
