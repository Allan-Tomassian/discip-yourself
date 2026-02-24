# Execution Runtime Test Matrix

## Unit tests (logic)
| ID | Scenario | Layer | Expected |
|---|---|---|---|
| U1 | Start execution on planned occurrence | session logic | occurrence -> `in_progress`, active runtime set |
| U2 | Start when occurrence already terminal | session logic | rejected/no-op |
| U3 | End session done | session logic | occurrence `done`, history `ended:done`, runtime closed |
| U4 | Cancel session | session logic | occurrence `skipped/canceled` per rule, history ended, runtime closed |
| U5 | Resume paused session | session logic | elapsed accumulation coherent |
| U6 | Duration missing fallback | runtime policy | fallback path chosen, no crash |
| U7 | Backfill missed after late return | planner | planned past occurrences become `missed` only when eligible |
| U8 | Resolver deterministic selection | resolver | stable occurrence pick order |
| U9 | Anytime flexible execution policy | planner/runtime | defined behavior (currently no planned occurrence) |
| U10 | Reward idempotency on done | wallet/reward | one reward per occurrence |

## E2E tests (user flow)
| ID | Scenario | Steps | Expected |
|---|---|---|---|
| E1 | Today -> Start -> Session visible | select focus action -> start | session screen opens with matching occurrence |
| E2 | Session guided done | start timer -> end -> done | status reflected in Today + Pilotage |
| E3 | Session cancel | start -> cancel | occurrence excluded from expected per canonical rules |
| E4 | App background/return | start -> reload -> reopen session | runtime rehydrated correctly |
| E5 | Return after target elapsed | start timed -> wait/reload | pending validation or done per policy |
| E6 | Date change at midnight | start before midnight -> continue after | state remains coherent, date mapping explicit |
| E7 | No duration task | start from no-duration action | user gets free-mode or fallback duration choice |
| E8 | Reminder -> start path | trigger reminder modal -> Commencer | opens canonical execution path |
| E9 | Micro-action + totem + wallet | complete micro-action | wallet delta + totem flight, no session side effects |
| E10 | Reduced motion | enable reduced motion -> trigger totem feedback | non-blocking reduced behavior |

## Manual smoke matrix
| ID | Device | Scenario | What to verify |
|---|---|---|---|
| M1 | iPhone Safari | Start and leave app | no UI freeze, runtime resumes logically |
| M2 | iPhone Safari | Reminder cadence | no spam, reminders stop after validation |
| M3 | Android Chrome | Guided timer | countdown display and pause/resume reliability |
| M4 | Desktop Mac | Session + tab switching | top-level navigation does not break active runtime |
| M5 | Desktop Mac | Session final screen | clear terminal state and return path |
| M6 | Any | Offline during session end | graceful fallback, no data corruption |
| M7 | Any | Delete action during active runtime | runtime cleanup + no orphan pointers |
| M8 | Any | selectedDate != today | execution entry still coherent and explicit |

## Coverage gaps in current repo (observed)
- No dedicated e2e covering full Session lifecycle start->pause/resume->done/cancel.
- No e2e for reminders driving runtime validation loop.
- No e2e for app close/reopen behavior during active execution.
