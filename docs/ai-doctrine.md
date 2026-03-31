# Doctrine IA

## Hiérarchie
- `Coach libre` = seule conversation naturelle et non exécutive.
- `Coach Plan` = seule voie conversationnelle de structuration et de création validée.
- `Lecture IA locale` = analyse secondaire, courte, contextuelle, non souveraine.
- `Mutation review` = capacité différée, séparée du Coach et jamais active sans surface de review explicite.

## Règles d'autorité
- Le mode `free` ne crée rien, ne propose pas de structure et n'applique rien.
- Le mode `plan` peut proposer une structure exploitable, mais toute création réelle passe par une validation explicite.
- Les analyses locales ne conversent pas, ne créent pas et ne modifient pas l'existant.
- Toute action importante de l'IA doit être portée par un CTA visible.

## Contrats
- `/ai/chat` porte uniquement le Coach conversationnel (`free` et `plan`).
- `/ai/now` reste dédié à Today.
- `/ai/local-analysis` porte les lectures locales secondaires de Planning et Pilotage.
- Aucune mutation d'existant ne doit réutiliser `/ai/chat`.

## Garde-fous
- Aucune création silencieuse.
- Aucune mutation silencieuse.
- Aucune deuxième surface Coach.
- Aucune confusion volontaire entre analyses locales et Coach.

## Matrice de régression
- `free` retourne uniquement une reply `conversation` sans `proposal`.
- `plan` retourne uniquement une reply `conversation` avec `proposal` optionnelle et jamais de `draftChanges`.
- `card` reste réservé aux lectures locales et ne devient jamais une conversation structurante.
