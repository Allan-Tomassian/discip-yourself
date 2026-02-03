# Debug playbook

This is a pragmatic checklist for common failures and regressions.

## React loops (Maximum update depth)

1) Search for setData in useEffect / useLayoutEffect.
   - Focus on Home.jsx, App.jsx, Session.jsx, occurrencePlanner.js integration.
2) Ensure idempotence:
   - functions must return prev when no real changes.
   - guards use stable signatures (useRef) before setData.
3) Confirm ensureWindowFromScheduleRules returns the same object when no changes.
4) Use the console to find repeating warnings.

## Duplicate occurrences

- DEV warning: assertStateInvariants logs duplicates by (scheduleRuleId, date).
- If you see duplicates, check:
  - scheduleRuleId mapping for legacy occurrences.
  - attach logic inside ensureWindowFromScheduleRules.

## Migration issues

- Migration source: src/logic/state.js (migrate).
- scheduleRules are derived from legacy goal schedule fields.
- Running migrate multiple times must not duplicate rules (sourceKey).

## Local storage reset (safe)

Keys are in src/utils/storage.js:
- LS_KEY: discip_yourself_v2
- Backup: discip_yourself_v2__bak
- Meta: discip_yourself_v2__meta

Safe reset steps:
1) Export data if needed.
2) Clear the keys above from localStorage.
3) Reload the app to recreate initial data.

## Reporting checks

- Reporting uses metrics selectors only (no setData).
- buildReport lives in src/logic/reporting.js.

## Build/test

- npm test
- npm run build

Chunk-size warning:
- Vite warns about >500k chunks. Do not optimize here; track for later.
