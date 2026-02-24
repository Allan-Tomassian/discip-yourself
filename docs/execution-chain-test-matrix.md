# Execution Chain — Test Matrix

| Chaîne | Couverture actuelle | Ce qu’il faut vérifier | Priorité |
|---|---|---|---|
| Planification -> Calendrier | tests/e2e/createFlow.appSync.spec.js::CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: action ponctuelle met à jour toute l’app | Vérifier occurrences générées et visibles bons jours | P0 |
| Planification -> Today | tests/e2e/createFlow.appSync.spec.js::CreateFlow: action ponctuelle met à jour toute l’app ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: action anytime sans horaire + présence dans les vues attendues | Vérifier CTA Today sur action créée | P0 |
| Today -> Session | tests/e2e/auth-gate.spec.js::sans session: affiche LoginScreen et bloque l ; tests/e2e/auth-gate.spec.js::session mockée: accès à l | Vérifier start session + état activeSession | P0 |
| Session -> Validation | tests/e2e/auth-gate.spec.js::sans session: affiche LoginScreen et bloque l ; tests/e2e/auth-gate.spec.js::session mockée: accès à l | Done/Skipped/Canceled persistent + reload | P0 |
| Validation -> Pilotage | src/logic/reporting.test.js::report totals match metrics ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage | expected/done/missed cohérents inter-écrans | P0 |
| Suppression action | tests/e2e/createFlow.appSync.spec.js::CategoryGate: désactivation non vide avec migration vers Général | Aucune occurrence/règle orpheline | P0/P1 |
| Timezone/dateKey | tests/e2e/createFlow.appSync.spec.js::Calendrier mois: anti-décalage fin de mois vers mois suivant | Pas de drift de date mois/jour | P0/P1 |

## Scénarios edge cases obligatoires (avant redesign)

1. Suppression d’action récurrente + retour sur Today + vérif non-régénération.
2. Retour après 7 jours inactif + vérif conversion planned->missed.
3. selectedDate passé/futur + tentative d’exécution + cohérence verrouillage.
4. Action ANYTIME sans heure + validation + impact pilotage.
5. Modification plan (jours/heure/période) + cohérence Calendar/Today/Pilotage.

