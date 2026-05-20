alter table public.ai_request_logs
  add column if not exists feature_id text,
  add column if not exists cost_class text,
  add column if not exists model_class text,
  add column if not exists model text,
  add column if not exists prompt_version text,
  add column if not exists counts_for_quota boolean not null default false,
  add column if not exists usage_units integer not null default 0,
  add column if not exists cache_hit boolean not null default false,
  add column if not exists input_bytes integer,
  add column if not exists output_bytes integer,
  add column if not exists provider_input_tokens integer,
  add column if not exists provider_output_tokens integer,
  add column if not exists route_name text;

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_coach_kind_check;

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_plan_tier_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_plan_tier_check
  check (plan_tier in ('free', 'trial', 'premium', 'premium_plus'));

alter table public.billing_entitlements
  drop constraint if exists billing_entitlements_plan_tier_check;

alter table public.billing_entitlements
  add constraint billing_entitlements_plan_tier_check
  check (plan_tier in ('free', 'trial', 'premium', 'premium_plus'));

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_feature_id_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_feature_id_check
  check (
    feature_id is null or feature_id in (
      'why_clarification',
      'first_run_starter_hints',
      'first_run_full_plan_legacy',
      'coach_chat_free',
      'coach_chat_premium',
      'coach_plan',
      'session_guidance',
      'today_ai_insight',
      'system_analysis',
      'future_weekly_review',
      'future_project_context_analysis',
      'future_coach_image_input',
      'future_coach_document_input',
      'future_session_floating_coach'
    )
  );

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_cost_class_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_cost_class_check
  check (
    cost_class is null or cost_class in (
      'cheap',
      'medium',
      'expensive',
      'premium_deep',
      'multimodal_expensive'
    )
  );

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_model_class_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_model_class_check
  check (
    model_class is null or model_class in (
      'fast_low_cost_text',
      'structured_json_small',
      'reasoning_medium',
      'reasoning_deep',
      'premium_deep_analysis',
      'multimodal_vision',
      'document_summary'
    )
  );

alter table public.ai_request_logs
  drop constraint if exists ai_request_logs_usage_non_negative_check;

alter table public.ai_request_logs
  add constraint ai_request_logs_usage_non_negative_check
  check (
    usage_units >= 0 and
    (input_bytes is null or input_bytes >= 0) and
    (output_bytes is null or output_bytes >= 0) and
    (provider_input_tokens is null or provider_input_tokens >= 0) and
    (provider_output_tokens is null or provider_output_tokens >= 0)
  );

update public.ai_request_logs
set feature_id = case coach_kind
  when 'now' then 'today_ai_insight'
  when 'recovery' then 'today_ai_insight'
  when 'local-analysis' then 'today_ai_insight'
  when 'chat' then 'coach_chat_free'
  when 'session-guidance' then 'session_guidance'
  when 'first-run-plan' then 'first_run_full_plan_legacy'
  when 'first-run-starter-hints' then 'first_run_starter_hints'
  when 'first-run-why-clarification' then 'why_clarification'
  when 'system-analysis' then 'system_analysis'
  else feature_id
end
where feature_id is null;

update public.ai_request_logs
set cost_class = case feature_id
  when 'why_clarification' then 'cheap'
  when 'first_run_starter_hints' then 'medium'
  when 'first_run_full_plan_legacy' then 'expensive'
  when 'coach_chat_free' then 'medium'
  when 'coach_chat_premium' then 'medium'
  when 'coach_plan' then 'expensive'
  when 'session_guidance' then 'expensive'
  when 'today_ai_insight' then 'medium'
  when 'system_analysis' then 'premium_deep'
  else cost_class
end
where cost_class is null;

update public.ai_request_logs
set model_class = case feature_id
  when 'why_clarification' then 'structured_json_small'
  when 'first_run_starter_hints' then 'structured_json_small'
  when 'first_run_full_plan_legacy' then 'reasoning_deep'
  when 'coach_chat_free' then 'fast_low_cost_text'
  when 'coach_chat_premium' then 'reasoning_medium'
  when 'coach_plan' then 'reasoning_medium'
  when 'session_guidance' then 'reasoning_deep'
  when 'today_ai_insight' then 'fast_low_cost_text'
  when 'system_analysis' then 'premium_deep_analysis'
  else model_class
end
where model_class is null;

update public.ai_request_logs
set counts_for_quota = true,
    usage_units = greatest(usage_units, 1)
where status_code >= 200
  and status_code < 300
  and coalesce(cache_hit, false) = false
  and coalesce(validation_passed, true) = true
  and coalesce(provider_status, 'ok') not in ('blocked', 'timeout', 'error', 'invalid_response');

create index if not exists ai_request_logs_user_feature_created_at_idx
  on public.ai_request_logs (user_id, feature_id, created_at desc);

create index if not exists ai_request_logs_user_counts_created_at_idx
  on public.ai_request_logs (user_id, counts_for_quota, created_at desc);

create index if not exists ai_request_logs_feature_created_at_idx
  on public.ai_request_logs (feature_id, created_at desc);

create index if not exists ai_request_logs_request_hash_idx
  on public.ai_request_logs (request_hash)
  where request_hash is not null;
