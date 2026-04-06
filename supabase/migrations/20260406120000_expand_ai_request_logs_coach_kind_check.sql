alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_coach_kind_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_coach_kind_check
  check (coach_kind in ('now', 'recovery', 'chat', 'local-analysis'));
