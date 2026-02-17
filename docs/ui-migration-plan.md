# UI Migration Plan (Gate Only)
Generated: 2026-02-17T11:46:36.304Z

## Objective
Move all visible/clickable surfaces to a single Gate design system and remove legacy/liquid/glass drift.

## Missing Gate Tokens To Add/Normalize
- Buttons states (primary/secondary/ghost/danger + press/focus/disabled): missing/inconsistent
- Inputs/textarea/select/file/number + validation: missing/inconsistent
- Dense cards/panels gradients/borders/shadows/highlight: missing/inconsistent
- Rows/list items (flat row + meta + chevron + hover/press): missing/inconsistent
- Tabs/segmented controls: missing/inconsistent
- Modals/popovers/scrims tokens: missing/inconsistent
- Toasts/alerts/empty states: missing/inconsistent
- Calendar/toggle exceptions for press fx: needs explicit policy

## Lot 0 - Guardrails
Goal: Stop regressions before further migration.
Files:
- scripts/check-no-legacy-ui.mjs
- package.json
- docs/ui-audit.md
- docs/ui-style-map.json
Acceptance criteria:
- CI/local check fails on new Liquid/legacy imports in forbidden zones.
- Audit artifacts regenerated and tracked per iteration.
Risks and mitigation:
- False positives on allowed transitional files.
- Mitigation: maintain explicit allowlist with expiration notes.
Tests:
- npm run ui:check
- npm run ui:audit

## Lot 1 - Navigation + Hamburger
Goal: Keep top navigation and menu on a single Gate visual language.
Files:
- src/components/TopNav.jsx
- src/components/TopMenuPopover.jsx
- src/features/navigation/topMenuGate.css
Acceptance criteria:
- No LiquidGlassSurface in TopNav/TopMenuPopover.
- Single dense popover surface with readable rows.
- Outside click, ESC, and touch close still work.
Risks and mitigation:
- Layering/z-index conflicts with other overlays.
- Mitigation: QA with modal + menu open sequence on desktop/mobile.
Tests:
- npm test
- npm run build
- npm run test:e2e

## Lot 2 - Account + Preferences
Goal: Finish Gate-only conversion for account and settings surfaces.
Files:
- src/pages/Account.jsx
- src/pages/Preferences.jsx
- src/features/account/accountGate.css
- src/features/preferences/preferencesGate.css
Acceptance criteria:
- No imports from components/UI in Account/Preferences.
- No double-surface card stacking.
- Username availability, save/reload, theme apply/reset unchanged.
Risks and mitigation:
- Logic regressions during markup swap.
- Mitigation: preserve handlers and add smoke e2e for save flows.
Tests:
- npm test
- npm run build
- manual QA account/preferences

## Lot 3 - Menu Pages Dedicated
Goal: Align Subscription, Data, Privacy, Terms, Support to pure Gate primitives.
Files:
- src/pages/Subscription.jsx
- src/pages/Data.jsx
- src/pages/Privacy.jsx
- src/pages/Terms.jsx
- src/pages/Support.jsx
Acceptance criteria:
- No LiquidGlassSurface in dedicated menu pages.
- Typography/spacing match Gate references.
Risks and mitigation:
- Visual drift due to duplicated custom classes.
- Mitigation: consolidate class hooks into gate.css-driven variants.
Tests:
- npm test
- npm run build
- manual responsive checks

## Lot 4 - Core Product Pages
Goal: Migrate Today/Library/Pilotage/Category flows to Gate surfaces.
Files:
- src/pages/Data.jsx
- src/pages/Privacy.jsx
- src/pages/Subscription.jsx
- src/pages/Terms.jsx
- src/pages/Home.jsx
- src/pages/CategoryView.jsx
- src/pages/CreateV2Habits.jsx
- src/pages/CreateV2LinkOutcome.jsx
- src/pages/CreateV2Outcome.jsx
- src/pages/Support.jsx
- src/pages/CreateV2HabitType.jsx
- src/pages/CreateV2OutcomeNextAction.jsx
Acceptance criteria:
- Legacy Card/Button/Input removed from top hotspots.
- Create/edit/session/category screens stay behavior-compatible.
Risks and mitigation:
- High blast radius across daily workflows.
- Mitigation: migrate per page cluster with before/after snapshots.
Tests:
- npm test
- npm run test:e2e
- manual scenario walkthrough

## Lot 5 - Modals/Toasts/Overlays
Goal: Unify all overlays and transient feedback into Gate tokens.
Files:
- src/components/*Modal*.jsx
- src/tour/TourOverlay.jsx
- src/components/DiagnosticOverlay.jsx
- src/index.css (overlay/toast legacy blocks)
Acceptance criteria:
- Gate scrim + panel tokens used everywhere.
- No modal-specific legacy gradient leftovers.
Risks and mitigation:
- Focus-trap and accessibility regressions.
- Mitigation: keyboard traversal checks + e2e overlay tests.
Tests:
- npm test
- npm run build
- manual keyboard QA

## Lot 6 - Legacy Removal
Goal: Delete old UI systems and dead classes once migration is complete.
Files:
- src/components/UI.jsx
- src/ui/LiquidGlassSurface.jsx
- legacy glass classes in src/index.css
Acceptance criteria:
- No imports remain from removed legacy modules.
- ui:check passes without allowlist exceptions.
Risks and mitigation:
- Hidden dependencies in tests or niche flows.
- Mitigation: full-text import grep before deletion + full CI run.
Tests:
- npm run ui:check
- npm test
- npm run build
- npm run test:e2e

## QA Checklist (Mac + iPhone)
- Open/close hamburger with mouse, trackpad tap, and touch.
- Validate ESC close and outside click/tap close on each overlay.
- Check route transitions for /account, /preferences, /subscription, /data, /privacy, /terms, /support.
- Verify profile save, username availability, theme apply/reset, why-save flows.
- Verify readability (contrast) in dark backgrounds and small screens.
