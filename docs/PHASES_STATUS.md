# Phases status (0 to 7)

This file documents what is done and what remains out of scope.

## Phase 0 (invariants)
Done.
- One session per occurrence max.
- Session can start only via occurrenceId.
- Final occurrence statuses cannot restart a session.
- Idempotent state writes in session flows.

## Phase 1 (ScheduleRule + Session V2)
Done.
- scheduleRules added and migrated from legacy goal schedules.
- Session V2 (sessionHistory) persisted on session end.

## Phase 2 (occurrence generation)
Done.
- ensureWindowFromScheduleRules generates occurrences on a sliding window.
- Idempotent upsert by (scheduleRuleId, date).
- Legacy occurrence fields preserved for UI compatibility.

## Phase 3 (window placement)
Done.
- Window occurrences can receive resolvedStart without changing start.
- Conflicts flagged when no placement possible.

## Phase 4 (session selection and locking)
Done.
- GO resolves a deterministic executable occurrence.
- Session screen blocks final occurrences and restarts.

## Phase 5 (metrics)
Done.
- Metrics derived from occurrences only (no setData loops).
- Windows: today, 7d, 14d, 90d.

## Phase 6 (reporting)
Done.
- Reporting export for JSON + CSV using metrics.
- Filters by window, category, goal.

## Phase 7 (cleanup and legacy)
Done.
- Helper consolidation for final statuses.
- Compat helpers for UI fields.
- Dev-only invariants and warnings.
- Documentation updates.

Out of scope (not implemented here):
- Phase 3 auto-placement beyond minimal window placement rules.
- Phase 6 advanced report formatting or external storage.
