# 1) Verdict produit (max 12 lignes)
Le runtime actuel est utilisable mais incomplet pour un usage réel intensif. Le cœur fonctionne: démarrer depuis Aujourd’hui, exécuter en Session, valider done/skipped. Le principal défaut est conceptuel: l’état “en cours” vit dans `ui.activeSession` mais pas dans le statut occurrence, ce qui fragilise la cohérence inter-écrans. Le second défaut est d’usage réel: pas de notifications runtime activées en production, donc faible rappel de validation hors app ouverte. Le troisième défaut est produit: aucune voie canonique pour “quick action/flexible” car ces actions n’entrent pas dans le même moteur d’exécution. Verdict: base solide pour un moteur top-tier, mais il faut unifier l’exécution autour d’un modèle hybride unique et rendre explicites validation, notifications et récompenses à la fin d’exécution.

# 2) Problèmes critiques du runtime actuel (P0/P1/P2)
## P0
- État “running” non canonique (occurrence reste `planned`, session = `partial`) (`/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx:1269-1279`, `/Users/allan/Desktop/discip-yourself code/src/logic/sessionResolver.js:49-51`).
- Flexible anytime non exécutable via runtime Session (`/Users/allan/Desktop/discip-yourself code/src/logic/occurrencePlanner.js:396-398`).

## P1
- Auto-fin basée sur timer seulement si écran Session actif (`/Users/allan/Desktop/discip-yourself code/src/pages/Session.jsx:255-324`).
- Notifications runtime non actives (flag disabled) (`/Users/allan/Desktop/discip-yourself code/src/logic/reminders.js:5`, `/Users/allan/Desktop/discip-yourself code/src/logic/reminders.js:236-252`).
- Legacy session model encore présent (`/Users/allan/Desktop/discip-yourself code/src/logic/sessions.js:5`).

## P2
- Nom “Session” peu explicite pour débutant.
- Récompenses surtout micro-actions/ads, peu liées à l’exécution principale (`/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx:1638-1649`, `/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx:1771-1775`).

# 3) Modèle canonique recommandé (diagramme textuel simple)
Recommandation ferme: **modèle Hybride canonique**.
- Tâches avec durée -> Exécution guidée (timer recommandé, validation finale).
- Tâches sans durée -> Exécution hors-app possible avec ping de validation (no timer strict).
- Les deux passent par le même objet runtime d’exécution et les mêmes transitions.

Diagramme:
`Planifié -> Prêt -> En cours (guidé|hors-app) -> En attente de validation -> Validé (done|skipped|canceled) -> Impact stats/récompenses`

# 4) Machine d’états utilisateur (planifié -> prêt -> en cours -> …)
- `PLANIFIE`: occurrence créée, visible Today/Calendrier.
- `PRET`: occurrence sélectionnée pour action immédiate (CTA).
- `EN_COURS_GUIDE`: timer actif dans app.
- `EN_COURS_LIBRE`: exécution déclarative hors-app ou sans durée stricte.
- `PAUSE`: seulement pour mode guidé.
- `A_VALIDER`: exécution terminée ou interrompue, décision attendue.
- `VALIDE_DONE`: done confirmé, clôture.
- `VALIDE_SKIPPED`: report/skip confirmé.
- `VALIDE_CANCELED`: annulé confirmé.
- `MISSED_SYSTEM`: passé non validé (backfill planner).

# 5) Règles d’exécution (durée, start, pause, abandon, reprise, validation)
1. **Start**: toujours créer/mettre à jour une instance runtime unique d’exécution.
2. **Statut occurrence au start**: passer à `in_progress` (pas rester `planned`).
3. **Durée absente**: proposer 3 options rapides: `10 min`, `25 min`, `Quand j’ai fini` (fallback smart).
4. **Durée présente**: timer souple (pause/reprise), pas verrouillage dur.
5. **Sortie app**: conserver état en cours; au retour, proposer reprise ou validation.
6. **Fin timer**: passer à `A_VALIDER`, ne pas auto-crediter silencieusement.
7. **Validation explicite**: `Fait`, `Reporté`, `Annulé` (un seul point de vérité).
8. **Reprise tardive**: si exécution vieille (>X heures), proposer “valider maintenant” vs “marquer manqué”.
9. **Résolution de conflit horaire**: garder stratégie existante, ne pas bloquer validation.
10. **Occurrence sans session possible**: interdire en runtime canonique (ou créer occurrence runtime ad-hoc).

# 6) Règles récompenses (coins/xp/rangs/totem feedback)
Recommandation ferme:
- **Récompense principale à la validation `done`**, jamais au start.
- `skipped/canceled`: pas de récompense positive.
- `in_progress`: aucun gain.
- Micro-actions gardent leur boucle actuelle mais deviennent “side loop” et non moteur principal.
- Totem feedback:
  - micro-action: micro animation courte
  - session validée done: feedback plus premium (badge + totem signal) sans popup bloquant.
- Anti-exploit: pas de gain multiple pour la même occurrence.

# 7) Règles notifications
- Notification de rappel de validation:
  - timer défini: à `heure_fin + 0min`, puis rappel unique à +15min si non validé.
  - sans durée: ping à +10min après start, puis rappel unique à +60min.
- Notification de session oubliée: 1/jour max.
- Rappel micro-action quotidien: 1 créneau paramétrable.
- Anti-spam:
  - max 3 notifications “exécution” par jour
  - priorité: validation > session oubliée > micro-action
  - pas de doublon pour même occurrence.

# 8) Basique vs Premium (tableau comparatif logique, pas marketing)
| Capability | Basique | Premium |
|---|---|---|
| Start/Stop/Validate exécution | Oui | Oui |
| Timer guidé | Oui (simple) | Oui (avancé: presets personnalisés) |
| Rappels validation | Oui (1 rappel) | Oui (rappels configurables) |
| Quick presets durée | Oui (fixes) | Oui (éditables) |
| Historique sessions | Oui (essentiel) | Oui (analytics détaillés) |
| Anti-cheat soft checks | Oui | Oui + insights comportement |
| Totem feedback | Oui (léger) | Oui (personnalisation + variantes) |

# 9) Cas limites (10 minimum)
1. Démarrage puis fermeture app immédiate.
2. Démarrage sans durée puis retour tardif.
3. Timer fini en arrière-plan, app rouverte plus tard.
4. Occurrence déjà `done`, tentative de redémarrage.
5. Passage de date minuit pendant exécution.
6. Changement d’onglet pendant timer (Today/Pilotage).
7. Suppression de l’action en cours d’exécution.
8. Occurrence planifiée mais category/objective supprimé.
9. Conflit horaire résolu après démarrage.
10. Mode reduced motion actif avec feedback totem.
11. User offline pendant validation.
12. Rappel notif reçu mais session déjà finalisée sur autre écran.

# 10) Plan d’implémentation en lots (ordre strict, non-code)
1. **Lot A — Runtime SSoT complet**: aligner occurrence `in_progress` au start + état unique validation.
2. **Lot B — Exécution hybride UX**: mode guidé vs mode libre sous même runtime.
3. **Lot C — Notification runtime**: pipeline rappel validation et anti-spam.
4. **Lot D — Rewards/anti-cheat léger**: gain à validation + garde-fous soft.
5. **Lot E — Premium extensions**: presets avancés, analytics d’exécution, coaching totem enrichi.
