# Data model (post Phase 7)

This document describes the current persisted data model and the legacy compatibility fields.

## Root state

- schemaVersion: number
- profile: user profile and entitlement data
- ui: UI state (including activeSession)
- categories: category list
- goals: actions / outcomes (legacy naming, still used by UI)
- scheduleRules: planning rules (source for occurrence generation)
- occurrences: planned instances (legacy + v2 fields)
- sessionHistory: Session V2 records (per occurrence)
- sessions: legacy session list (kept for compatibility)
- reminders, checks, microChecks: legacy and supporting data

## Goals / actions

Goals are still the primary UI model. PROCESS goals represent actions.

Common fields:
- id, title, categoryId
- type: PROCESS | OUTCOME
- status: active | done | invalid | abandoned (legacy)
- schedule fields (legacy): daysOfWeek, timeSlots, oneOffDate, timeMode, windowStart/windowEnd, durationMinutes

ScheduleRule generation (Phase 1) uses legacy schedule fields to create scheduleRules.

## ScheduleRule (source of truth for planning)

Stored in data.scheduleRules[].

Minimum fields:
- id
- actionId (goal id)
- kind: one_time | recurring
- timezone (optional)
- startDate, endDate
- daysOfWeek (recurring)
- timeType: fixed | window
- startTime/endTime or windowStart/windowEnd
- durationMin
- isActive
- sourceKey (stable fingerprint)
- createdAt / updatedAt

## Occurrence (legacy + v2 fields)

Stored in data.occurrences[].

Legacy fields used by UI today:
- id
- goalId
- date (YYYY-MM-DD)
- start (HH:mm or "00:00" for no-time)
- slotKey
- noTime
- conflict (legacy)
- durationMinutes
- status: planned | done | skipped | canceled (legacy set)

V2 fields added in phases 1-3:
- scheduleRuleId
- timeType: fixed | window
- startAt / endAt (ISO, fixed)
- windowStartAt / windowEndAt (ISO, window)
- resolvedStart / resolvedStartAt (optional for window placement)

Legacy compatibility:
- UI still reads start/slotKey/noTime. normalizeOccurrenceForUI(occ) guarantees these fields for display.

## Sessions

### ui.activeSession (legacy UI runtime)

Stored in data.ui.activeSession.

Fields (legacy UI):
- id
- occurrenceId (required for Phase 0+)
- dateKey (YYYY-MM-DD)
- habitIds (goal ids)
- status: partial | done | canceled
- timer fields, notes

Compatibility helper:
- normalizeActiveSessionForUI(session) ensures dateKey, habitIds, status exist for UI usage.

### Session V2 history (source of truth for execution history)

Stored in data.sessionHistory[].

Fields:
- id
- occurrenceId (unique)
- actionId (goalId)
- dateKey
- startAt, endAt
- state: in_progress | ended
- endedReason: done | canceled
- timerSeconds, notes

Sessions are upserted by occurrenceId (idempotent).

## Metrics (derived)

Metrics are derived only (no persistence):
- metrics.js selectors compute expected/done/missed/canceled/planned
- reporting.js builds daily and per-goal exports using metrics

