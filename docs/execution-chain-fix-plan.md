# Execution Chain — Fix Plan Priorisé

## P0 (bloquants cohérence moteur)

- Suppression d’action sans cleanup explicite des scheduleRules
- Impact: Risque d’occurrences orphelines régénérées après suppression
- Zone: planning->calendar
- Réf principale: `src/pages/Categories.jsx:384`
- Backfill des missed contraint à la fenêtre selectedDate ±1
- Impact: Occurences anciennes potentiellement laissées en planned après longue absence
- Zone: today->validation
- Réf principale: `src/pages/Home.jsx:1326`

## P1 (cohérence fonctionnelle + UX logique)

- Le tab session monte SessionMVP; Session.jsx riche existe mais n’est pas branché
- Impact: Risque de logique/exigences d’exécution fragmentées (deux implémentations)
- Zone: today->execution
- Réf principale: `src/App.jsx:38`
- API sessions.js présente mais flux actif basé sur ui.activeSession + sessionsV2
- Impact: Dette de maintenance et confusion sur la source de vérité de session
- Zone: execution->validation
- Réf principale: `src/logic/sessions.js:65`
- Vocabulaire de statuts différent selon modules
- Impact: Interprétation divergente des statuts finaux et expected
- Zone: validation->pilotage
- Réf principale: `src/logic/occurrences.js:4`
- Flow création dense pour débutant; mode Essentiel non explicite
- Impact: Abandon en création et confusion entre Quick/Focus planning
- Zone: planning
- Réf principale: `src/pages/CreateV2Habits.jsx:278`

## P2 (hygiène / dette secondaire)

- CTA Ajouter occurrence dans calendrier potentiellement non câblé au parent
- Impact: Action UI visible mais sans effet selon contexte
- Zone: calendar->today
- Réf principale: `src/pages/Home.jsx:271`

## Ordre d’exécution recommandé

1. Corriger les P0 moteur (suppression rules + backfill missed).
2. Unifier Session runtime (single implementation branchée).
3. Harmoniser sémantique statuts (occurrences/metrics/session/pilotage).
4. Découper Create en mode Essentiel/Avancé sans modifier le modèle.
5. Finaliser les chemins UI secondaires non câblés.

## Dépendances

- P0 doit être validé avant toute refonte visuelle majeure de la chaîne Today/Session/Pilotage.
- La décision produit sur Session (garder/transformer) précède toute simplification UX d’exécution.

