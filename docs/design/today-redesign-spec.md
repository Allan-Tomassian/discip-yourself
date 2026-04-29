# Discip Yourself — Today Premium Redesign Spec

Reference visual:
- docs/design/references/today-reference.jpeg
- If the image is missing, use the validated screenshot attached in Codex.

## Product direction

Today is the main page of Discip Yourself.

Today must become the premium execution cockpit of the app:
- not a generic dashboard;
- not a todo list;
- not a motivation screen;
- a clear action cockpit that tells the user where they are and what to execute now.

Core feeling:
- dark premium;
- precise;
- modern;
- AI-friendly;
- execution-focused;
- no cheap gamification.

## Validated Today structure

Official order:

1. Header
   - Today
   - date
   - avatar / profile menu

2. FloatingWelcomeLine
   - short warm sentence without card container
   - example: “Bon retour — aujourd’hui, on avance bloc par bloc.”

3. TodayHero
   - discipline score
   - day status
   - daily progress

4. PrimaryActionCard
   - critical action
   - main CTA
   - secondary controls

5. TodayTimeline
   - compact interactive timeline
   - day blocks
   - progress percentage

6. AIInsightCard
   - AI recommendation
   - Apply button
   - Why button
   - Coach IA entry

7. BottomNavigation
   - Objectifs
   - Planning
   - Home
   - Coach IA
   - Ajuster

The old quick actions block must be removed.
The bottom navigation becomes the permanent access system.

## Visual rules

Color semantics:
- Green = execution / control / validation.
- Purple = AI only.
- Orange = risk / warning.
- Red = late / critical.
- White/off-white = primary commitment CTA.
- Gray = neutral / inactive.

No yellow default accents.
No confetti.
No cheap game effects.
No generic todo-list cards.

## Global surface style

All main blocks use a shared premium “Command Surface” style:
- deep black background;
- thin translucent border;
- large rounded corners;
- subtle inner light;
- fine grid / particles / abstract lines;
- controlled green glow;
- matte premium feel.

Each block keeps a different identity:
- TodayHero = diagnostic surface;
- PrimaryActionCard = engagement surface;
- TodayTimeline = temporal structure surface;
- AIInsightCard = intelligence / recommendation surface;
- BottomNavigation = access surface.

## Header

The avatar opens a user menu.

Profile menu entries:
- Profil
- Paramètres
- Abonnement
- Support
- Déconnexion

## FloatingWelcomeLine

Validated normal copy:
“Bon retour — aujourd’hui, on avance bloc par bloc.”

State variants:
- control: Bon retour — aujourd’hui, on avance bloc par bloc.
- neutral: La journée est ouverte — le prochain bloc décide du rythme.
- risk: La journée peut encore basculer — protège le prochain bloc.
- late: Tu as décroché — reprends avec un bloc simple.
- in_progress: Bloc en cours — termine avant de renégocier.
- locked: Journée verrouillée — garde cette preuve pour demain.
- first_day: Ton système est prêt — commence petit, mais commence maintenant.
- empty_day: Aucun bloc aujourd’hui — sans structure, tu vas improviser.
- offline: Mode hors-ligne — tu peux continuer à exécuter localement.
- error: Impossible de charger ta journée — tes données ne sont pas perdues.

## TodayHero

Normal structure:

MODE EXÉCUTION — 27 AVR.

72%
DISCIPLINE SCORE
+8% vs hier

Tu es en contrôle.
Ne casse pas le rythme maintenant.

PROGRESSION DU JOUR
2 / 3 blocs terminés

Rules:
- Score must display as a percentage: 72%.
- Previous day delta must display as a percentage: +8% vs hier.
- If delta unavailable, show “Point de départ”.
- Never show fake 0% if score is missing. Use --% or an empty state.
- No main CTA inside the hero.

Hero state labels:
- control: MODE EXÉCUTION
- neutral: MODE EXÉCUTION
- risk: MODE RATTRAPAGE
- late: MODE REPRISE
- in_progress: MODE FOCUS
- locked: JOURNÉE VERROUILLÉE
- first_day: SYSTÈME ACTIVÉ
- offline: HORS-LIGNE
- error: JOURNÉE INDISPONIBLE

## PrimaryActionCard

Normal structure:

ACTION CRITIQUE — 30 MIN

Deep work
Avancer sur ton objectif principal.

Travail · 13:00 · Priorité haute

C’est le bloc qui débloque ta journée.

[ VERROUILLER 30 MIN ]

Reporter
Voir détail

Rules:
- Main CTA is off-white.
- Secondary actions are low emphasis.
- No yellow default accent.
- No visual repetition of the Hero background.
- Use a vertical beam / symmetrical tension lines to differentiate the block.

CTA by state:
- ready: Verrouiller 30 min
- first_day: Verrouiller 20 min
- in_progress: Reprendre
- late: Rattraper maintenant
- risk: Verrouiller 15 min
- postponed: Lancer quand même
- completed: Voir prochaine action
- locked: Voir demain
- empty: Construire avec le Coach
- error: Réessayer
- offline_cached: Verrouiller localement

## TodayTimeline

Normal structure:

TIMELINE DU JOUR

07:00 Routine
09:30 Sport
13:00 Deep work
16:00 Apprentissage
19:30 Revue

Progress: 67%

Rules:
- Timeline is compact.
- It must show a horizontal interactive bar.
- It must display progress percentage on the right, e.g. 67%.
- Completed points are green with check.
- Active point is green and highlighted.
- Future points are gray.
- For V1, progress can be completedBlocks / totalBlocks.

Interactions:
- Tap a point to preview/select a block.
- Drag/scrub if feasible.
- Use bottom sheet for details, not a heavy page.

## AIInsightCard

Normal structure:

INSIGHT IA — COACH IA

Tu tiens mieux les blocs courts.
Garde ce bloc à 30 min.

Tes sessions de 20–40 min ont 67% de taux de complétion ces 7 derniers jours.

[ APPLIQUER ]
[ VOIR POURQUOI ]

Rules:
- Purple identity.
- Purple belongs to AI only.
- AI blocks use wave / signal / particle motif.
- AI must be visibly different from non-AI blocks while staying in the same DA.
- Do not turn Today into a chat UI.

AI states:
- available
- loading
- applied
- unavailable
- error
- hidden

## BottomNavigation

Official items:
- Objectifs
- Planning
- Home
- Coach IA
- Ajuster

Rules:
- Remove old quick actions block.
- Remove global manual + button.
- Home is centered and always green.
- Home returns to Today from any page.
- Coach IA keeps purple identity.
- Other icons are homogeneous and neutral unless selected.
- Ajuster opens an adjustment bottom sheet.

Ajuster sheet options:
- Simplifier la journée
- Réorganiser les horaires
- Réduire la charge
- Demander au Coach IA

Creation/adjustment should go through:
- Coach IA
- Ajuster
- Planning

No standalone global create button.

## Motion Spec

Motion principles:
- Motion must guide, confirm, explain, or reduce friction.
- No movement for decoration only.
- No confetti.
- No cartoon bounce.
- No distracting loops.

Motion tokens:
- tap: 80–120ms
- small transitions: 180–240ms
- screen transitions: 240–320ms
- score/progress emphasis: 500–700ms
- ambient loops: 10–18s

Page entrance:
- Header
- FloatingWelcomeLine
- TodayHero
- PrimaryActionCard
- TodayTimeline
- AIInsightCard
- BottomNavigation

Each block:
- opacity 0 to 1
- translateY 14px to 0
- slight scale 0.985 to 1
- stagger 40–70ms between blocks

Interactions:
- button press: scale 1 to 0.985 to 1
- CTA lock: glow increases, card intensifies, transition to Focus
- bottom sheet: overlay fade + sheet slides from bottom
- nav tap: icon press + active indicator
- Home tap: green capsule pulse
- Coach IA tap: purple pulse

Ambient:
- Hero: subtle halo drift and grid movement.
- ActionCard: vertical beam breathing.
- AIInsightCard: purple wave / particle motion.
- Timeline: active point subtle pulse.

Respect reduced motion.

## State Pass

States to cover:
- loading
- error
- offline
- first_day
- empty_day
- neutral
- control
- risk
- late
- in_progress
- postponed
- locked
- returning_after_absence
- ai_unavailable

State priority:

1. loading
2. fatal error without cache
3. empty day
4. first day
5. returning after absence
6. locked
7. in progress
8. late
9. risk
10. control
11. neutral

Offline is special:
- if cached data exists, keep Today usable locally;
- if no cache, show offline degraded state.

## Data requirements

Recommended TodayData shape:

- date
- user avatar/profile
- score
- previousDayDelta
- completedBlocks
- totalBlocks
- timelineProgressPercent
- primaryAction
- timeline items
- aiInsight
- network/loading/error state

Safe fallbacks:
- never show fake 0% if score is missing;
- handle missing primaryAction;
- handle empty timeline;
- handle unavailable AI;
- avoid duplicated actions after refresh or double tap.

## Components to create or refactor

- TodayScreen
- TodayHeader
- FloatingWelcomeLine
- CommandSurface
- SectionLabel
- TodayHero
- PrimaryActionCard
- TodayTimeline
- AIInsightCard
- BottomNavigation
- ProfileMenu
- BottomSheet
- CTAButton
- GhostButton
- AIBadge

## Cleanup decisions

Remove or deprecate:
- old quick actions block;
- global manual + creation button;
- legacy standalone create action modal if redundant;
- generic todo-list cards on Today;
- duplicated navigation;
- yellow default accents;
- confetti / cheap gamification;
- hardcoded colors that conflict with tokens.

## Implementation phases

Phase 0: Audit only.
Phase 1: Static Today UI.
Phase 2: Bind real data.
Phase 3: Motion.
Phase 4: Ambient motion.
Phase 5: State Pass.
Phase 6: Cleanup and QA.

## Acceptance criteria

Today is accepted when:
- static UI matches the reference closely;
- Today clearly feels like the main cockpit;
- quick actions block is removed;
- bottom nav contains Objectifs, Planning, Home, Coach IA, Ajuster;
- Home is centered, green, and returns to Today;
- Coach IA is purple;
- global + button is removed;
- avatar opens profile menu;
- score displays %;
- previous day delta displays %;
- timeline displays %;
- loading/error/offline states exist;
- risk/late states guide recovery;
- motion respects this spec;
- no obsolete UI pollutes Today.
