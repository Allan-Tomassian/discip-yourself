# Execution Runtime Audit

## Scope and method
- Read-only analysis of runtime execution chain: Today -> start -> Session -> validation -> pilotage/progression.
- Sources inspected: `src/App.jsx`, `src/pages/Home.jsx`, `src/pages/Session.jsx`, `src/logic/sessionResolver.js`, `src/logic/sessionsV2.js`, `src/logic/sessions.js`, `src/logic/occurrenceStatus.js`, `src/logic/reminders.js`, `src/hooks/useRemindersLoop.js`, `src/pages/CreateV2Habits.jsx`, `src/pages/CreateV2HabitAnytime.jsx`, tests in `src/logic/*session*.test.js`, `tests/e2e/*`.

## Current runtime (observed)
### 1) Entry points to execution
- Main entry is Today hero CTA `Commencer maintenant` (`src/pages/Home.jsx:1858-1867`).
- CTA calls `handleStartSession` (`src/pages/Home.jsx:1260-1303`) which writes `ui.activeSession` then navigates to tab `session`.
- Secondary entry exists in reminder modal `Commencer` (`src/App.jsx:949-1024`), also writing `ui.activeSession`.
- Top navigation has no direct Session tab (only `Aujourd’hui`, `Bibliothèque`, `Pilotage`) (`src/components/TopNav.jsx:11-15`).

### 2) Runtime session screen actually used
- App routes tab `session` to `Session` page (`src/App.jsx:895-907`).
- `SessionMVP` is wrapper only (`src/pages/SessionMVP.jsx:4-7`).
- Wiring test enforces this (`src/logic/sessionRuntimeWiring.test.js:13-39`).

### 3) Source of truth used at runtime
- Runtime uses `ui.activeSession` + `sessionHistory` upserts (`src/pages/Session.jsx:54-58`, `src/pages/Session.jsx:215-253`).
- Canonical history helper is `upsertSessionV2` (`src/logic/sessionsV2.js:58-86`).
- Legacy `sessions.js` still exists with old `ui.activeSessionId` + `sessions[]` model (`src/logic/sessions.js:5`, `src/logic/sessions.js:77-123`) but appears non-runtime.

### 4) Occurrence and status semantics in execution
- Canonical occurrence statuses are defined centrally (`src/logic/occurrenceStatus.js:1-94`).
- Executable occurrence resolver only picks `status === "planned"` (`src/logic/sessionResolver.js:49-51`).
- Session completion writes occurrence status to `done` (`src/pages/Session.jsx:406-409`) and cancel writes `skipped` (`src/pages/Session.jsx:491-494`).
- Session start does **not** mark occurrence `in_progress`; it only writes `ui.activeSession.status = "partial"` (`src/pages/Home.jsx:1269-1279`).

### 5) Timer and lifecycle behavior
- Session timer is local-state driven from `timerStartedAt` + `timerAccumulatedSec` (`src/pages/Session.jsx:113-119`).
- If no duration is available, fallback target is 30 minutes (`src/pages/Session.jsx:168-173`).
- Auto-complete to `done` only runs inside Session screen effect when remaining hits 0 (`src/pages/Session.jsx:255-324`).
- If user leaves Session screen/app, no background worker enforces timely completion.

### 6) Quick action / flexible action reality
- No dedicated runtime concept named Quick Action.
- Flexible anytime actions are explicitly excluded from planned occurrence generation (`src/logic/occurrencePlanner.js:396-398`).
- Since session resolver requires planned occurrence (`src/logic/sessionResolver.js:49-51`), flexible anytime has no canonical execution path.

### 7) Validation and rewards coupling
- Session validation updates occurrence and sessionHistory, but no wallet/totem reward write in Session page imports/logic (`src/pages/Session.jsx:1-14`, `src/pages/Session.jsx:399-539`).
- Coins are awarded in micro-actions flow: +2 on done (`src/pages/Home.jsx:1638-1649`), +50 on rewarded ad (`src/pages/Home.jsx:1771-1775`, `src/logic/walletV1.js:4-6`).
- Totem event bus trigger used for `MICRO_DONE` only (`src/pages/Home.jsx:1672-1675`, `src/ui/totem/TotemDockLayer.jsx:486-490`).

### 8) Notifications reality
- Reminder loop is in-app polling every 30s (`src/hooks/useRemindersLoop.js:53-90`).
- Web notification sending exists but is globally disabled (`ENABLE_WEB_NOTIFICATIONS = false`) (`src/logic/reminders.js:5`, `src/logic/reminders.js:236-252`).
- Therefore no production push/local-notification pipeline beyond in-app modal while app is open.

### 9) Testing coverage reality
- Good unit coverage for resolver/model wiring (`src/logic/sessionResolver.test.js`, `src/logic/sessionsV2.test.js`, `src/logic/sessionRuntimeWiring.test.js`).
- No dedicated e2e for end-to-end Session lifecycle (start -> timer -> end/cancel -> stats).
- Existing e2e emphasize create flow, micro-actions, totem, auth (`tests/e2e/*.spec.js`).

## Critical findings (prioritized)
### P0
1. **Execution SSoT mismatch at status level**: runtime in-progress is tracked in `ui.activeSession.status="partial"` while occurrence remains `planned` until end/cancel.
   - Impact: same action appears “planned” even when running; weak semantic consistency across screens and metrics.

2. **Anytime/flexible execution gap**: flexible actions do not generate occurrences and therefore cannot enter canonical session runtime.
   - Impact: major product promise gap for quick real-life execution.

### P1
3. **Auto-end only on Session screen mount/tick**.
   - Impact: if user leaves app, completion timing is deferred and potentially misleading.

4. **No real notification stack in runtime loop** (`ENABLE_WEB_NOTIFICATIONS=false`).
   - Impact: weak re-engagement and poor completion/validation recall outside active app usage.

5. **Dual model legacy still present (`sessions.js`)** though non-runtime.
   - Impact: maintenance ambiguity, onboarding cost for contributors.

### P2
6. Session naming/mental model mismatch: “Session” is technical and not explicit for beginners.
7. Rewards are disconnected from core execution completion; engagement loop is dominated by micro-actions/ads.

## Product viability assessment (current)
- Planification -> occurrence -> Today visibility: **Partially OK**.
- Today -> execution start: **OK** for planned actions.
- Execution runtime consistency: **Partially OK** (status split between occurrence and activeSession).
- Validation closure: **OK** technically, weakly communicated.
- Reminder/notification continuity out-of-app: **KO** for production-grade expectations.
- Beginner clarity for “what to do now”: **Partially OK**, but runtime concepts remain fragmented.
