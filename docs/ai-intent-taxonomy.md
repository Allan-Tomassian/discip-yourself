# AI-1 — Taxonomie d'intents interne

Ce document fixe la hiérarchie conceptuelle utilisée par l'orchestration IA.

## Hiérarchie
- `intent`: travail à accomplir
- `useCase`: contexte métier ou domaine
- `behaviorProfile`: style de réponse et cadrage
- `engine`: moteur interne qui traite l'intent
- `transport`: client ou endpoint utilisé
- `outputContract`: forme de sortie attendue

## Canon d'intents
- `explore`
- `plan_create`
- `plan_adjust`
- `execute_now`
- `session_prepare`
- `session_adapt`
- `review`
- `recovery`

## Déclassements explicites
- `free`, `plan`, `card`: modes ou contrats de sortie, pas intents
- `life_plan`, `stats_review`: use cases, pas intents
- `manual_plan`, `assistant_auto`, `manual_reentry`, `contextual`: sources d'activation, pas intents
- `coachBehavior.*`: ton et stratégie, pas routage primaire
- `session_guidance.prepare|adjust|tool`: sous-modes du moteur session, mappés vers `session_prepare` ou `session_adapt`

## Règle de migration
- lecture legacy conservée
- émission canonique via `aiIntent`
- aucun changement visible utilisateur dans AI-1
