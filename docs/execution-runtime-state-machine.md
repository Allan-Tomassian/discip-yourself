# Execution Runtime State Machine

## MVP state machine

### States
- `PLANNED`
- `READY`
- `RUNNING`
- `PAUSED`
- `PENDING_VALIDATION`
- `DONE`
- `SKIPPED`
- `CANCELED`
- `MISSED`

### Events
- `START`
- `PAUSE`
- `RESUME`
- `TIMER_ELAPSED`
- `VALIDATE_DONE`
- `VALIDATE_SKIPPED`
- `VALIDATE_CANCELED`
- `BACKFILL_MISSED`
- `DELETE_GOAL`

### Transitions (MVP)
| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| PLANNED | START | occurrence executable | RUNNING | set `ui.activeSession`, set occurrence `in_progress`, append/merge sessionHistory `in_progress` |
| RUNNING | PAUSE | timer running | PAUSED | persist elapsed, stop timer |
| PAUSED | RESUME | session valid | RUNNING | restart timer |
| RUNNING | TIMER_ELAPSED | duration defined | PENDING_VALIDATION | stop timer, mark runtime awaiting decision |
| RUNNING | VALIDATE_DONE | user confirms | DONE | occurrence `done`, history endedReason `done`, clear/close active runtime |
| RUNNING | VALIDATE_SKIPPED | user confirms | SKIPPED | occurrence `skipped`, history endedReason `canceled`, clear runtime |
| RUNNING | VALIDATE_CANCELED | user confirms | CANCELED | occurrence `canceled`, history endedReason `canceled`, clear runtime |
| PAUSED | VALIDATE_DONE | user confirms | DONE | same as above |
| PENDING_VALIDATION | VALIDATE_DONE | user confirms | DONE | same as above |
| PLANNED | BACKFILL_MISSED | occurrence end < now | MISSED | planner backfill update |
| RUNNING | DELETE_GOAL | action removed | CANCELED | sanitize active session refs + history close |

### Guards
- executable occurrence required (`resolveExecutableOccurrence` currently planned-only).
- no transition to RUNNING if occurrence terminal.
- no reward event before terminal `DONE` validation.

### Side effects scope
- **Logic**: occurrence status mutation + active runtime mutation + history upsert.
- **UI**: timer rendering, pending validation prompt, CTA updates.
- **Notifications**: optional reminders (MVP minimal).
- **Rewards**: on `DONE` only.

---

## Target state machine

### Additional states
- `RUNNING_GUIDED` (in-app timer)
- `RUNNING_FREE` (outside app allowed, no strict timer)
- `SUSPENDED` (app background / interrupted)
- `EXPIRED_UNVALIDATED` (long delay after execution end)

### Additional events
- `START_GUIDED`
- `START_FREE`
- `APP_BACKGROUND`
- `APP_FOREGROUND`
- `VALIDATION_TIMEOUT`
- `PROMPT_VALIDATE`
- `REMINDER_SENT`

### Transitions (Target)
| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| PLANNED | START_GUIDED | duration available or selected | RUNNING_GUIDED | start timer, schedule validation reminders |
| PLANNED | START_FREE | no strict duration | RUNNING_FREE | set lightweight runtime, schedule check-in ping |
| RUNNING_GUIDED | APP_BACKGROUND | user leaves app | SUSPENDED | keep runtime, keep planned reminders |
| SUSPENDED | APP_FOREGROUND | runtime still valid | RUNNING_GUIDED or RUNNING_FREE | rehydrate timer/context |
| RUNNING_FREE | PROMPT_VALIDATE | elapsed soft threshold | PENDING_VALIDATION | ask done/skip/cancel |
| RUNNING_GUIDED | TIMER_ELAPSED | elapsed >= target | PENDING_VALIDATION | stop guided timer |
| PENDING_VALIDATION | VALIDATION_TIMEOUT | no user decision | EXPIRED_UNVALIDATED | trigger missed-suggestion, no reward |
| EXPIRED_UNVALIDATED | VALIDATE_DONE | user late confirm accepted | DONE | done + low-confidence marker optional |
| EXPIRED_UNVALIDATED | BACKFILL_MISSED | strict policy | MISSED | mark missed |

### Guard policy (Target)
- soft anti-cheat checks: very short elapsed, repeated instant completes, multiple rapid done bursts.
- no hard block in MVP target, only confidence flags and reduced rewards where configured.

### Side effects by domain
- **Occurrence domain**: canonical terminal transitions only.
- **Runtime domain**: active execution object lifecycle.
- **History domain**: one record per occurrence execution.
- **Notification domain**: rate-limited reminders.
- **Reward domain**: award strictly post-validation.
