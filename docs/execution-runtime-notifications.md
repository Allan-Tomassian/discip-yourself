# Execution Runtime Notifications

## Current state (repo-backed)
- Reminder loop is app-open polling every 30s (`/Users/allan/Desktop/discip-yourself code/src/hooks/useRemindersLoop.js:53-90`).
- Due reminders are derived from planned occurrences for today within `DUE_SOON_MINUTES=15` (`/Users/allan/Desktop/discip-yourself code/src/logic/reminders.js:8`, `/Users/allan/Desktop/discip-yourself code/src/logic/reminders.js:74-88`).
- Browser notifications are disabled via `ENABLE_WEB_NOTIFICATIONS = false` (`/Users/allan/Desktop/discip-yourself code/src/logic/reminders.js:5`).
- Net effect: runtime reminders exist only while app is open; no robust out-of-app notification behavior.

## Recommended notification spec (product-level)

### Priority model
1. `Validation reminder` (highest)
2. `Execution resume reminder`
3. `Daily micro-action reminder`
4. `Motivation/totem nudges` (lowest)

### Trigger rules
#### A) Timed execution (guided)
- On `START_GUIDED`: schedule expected-end reminder at `start + duration`.
- If not validated after +15 min: send 1 follow-up reminder.
- Stop reminders when session becomes terminal (`done/skipped/canceled/missed`).

#### B) Untimed execution (free)
- On `START_FREE`: schedule check-in reminder at +10 min.
- If still not validated at +60 min: send final “valider ou reporter” reminder.

#### C) Planned occurrence reminder
- Keep existing pre-due behavior (occurrence due-soon), but deduplicate against runtime reminders.

#### D) Daily behavior reminders
- One user-configurable slot for micro-action/day-start nudge.
- Suppress if user already completed key action within recent window.

## Anti-spam policy
- Max 3 execution-related notifications/day.
- Max 1 unresolved reminder per occurrence at a time.
- Quiet hours enforced by user locale.
- No notification storms when app reconnects after offline period.

## Delivery channels roadmap
- MVP: in-app modal + optional local notification when supported.
- Target: native local notifications (iOS/Android) with persistence keys per execution instance.
- Fallback: notification unavailable => keep in-app inbox/reminder center.

## Data model hooks (spec only)
- Add notification envelope keyed by `executionId|occurrenceId`.
- Store last sent timestamp + count + next due.
- On terminal state, clear pending notification jobs.

## Failure handling
- If permissions denied: show inline status, do not nag repeatedly.
- If scheduler unavailable: degrade gracefully to in-app reminder badge.
- If timezone changes: recompute queued reminders at app foreground.
