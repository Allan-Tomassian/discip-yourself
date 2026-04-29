# Codex Prompt 1 — Audit + Plan Only

We are redesigning the Today screen of Discip Yourself.

IMPORTANT:
Do not modify code yet.
First audit the current codebase and produce an implementation plan.

Reference files:
- AGENTS.md
- docs/design/today-redesign-spec.md
- docs/design/references/today-reference.jpeg

Goal:
Today must become the main premium execution cockpit of the app.

Validated Today structure:
1. Header with Today, date, avatar/profile menu
2. Floating welcome line
3. TodayHero
4. PrimaryActionCard
5. TodayTimeline
6. AIInsightCard
7. BottomNavigation

Key product decisions:
- Today is the main cockpit/page of the app.
- The old quick actions block must be removed.
- The bottom navigation becomes the permanent access system.
- Bottom nav items: Objectifs, Planning, Home, Coach IA, Ajuster.
- Home is centered and always green.
- Coach IA keeps a purple AI identity.
- Other nav icons are neutral unless selected.
- The global manual + creation button must be removed.
- Creation/adjustment must go through Coach IA, Ajuster, or Planning depending on context.
- The avatar opens a user menu: Profil, Paramètres, Abonnement, Support, Déconnexion.
- Discipline score must display as a percentage, e.g. 72%.
- Previous day delta must display as a percentage, e.g. +8% vs hier.
- Timeline must display current progress percentage, e.g. 67%.
- Green = execution/control/validation.
- Purple = AI only.
- Orange/red = risk/late states only.
- No cheap gamification.
- No confetti.
- No generic todo-list UI.

Audit and report:
1. Current routing/navigation structure.
2. Current Today screen files/components.
3. Current bottom navigation/tab navigation.
4. Current profile/avatar/menu logic.
5. Current task/action/block data model.
6. Current AI/coach components and data flow.
7. Current planning/timeline components.
8. Current manual creation flows, especially any global + button or standalone create form.
9. Existing design tokens/styles/theme files.
10. Existing animation libraries.
11. Components/styles that conflict with the new DA.
12. Components/routes that should probably be removed, replaced, or redirected.
13. Risks before implementation.

Output:
- File map.
- Current behavior summary.
- Conflicts with the target design.
- Proposed implementation phases.
- Components to create/refactor.
- Components/files to delete, deprecate, or redirect.
- Data gaps or blockers.
- Questions before implementation.

Do not modify files until I approve the plan.
