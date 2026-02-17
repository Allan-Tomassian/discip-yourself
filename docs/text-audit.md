# Text Audit (LOT 10)

- Generated: 2026-02-17T16:16:44.015Z
- Source map: `docs/text-map.json`
- Total strings collectées: 8241
- Textes uniques: 2894
- Groupes normalisés: 2756

## Répartition par contexte

- string-literal: 5812
- title: 524
- status: 370
- label: 347
- jsx-text: 287
- menuItem: 257
- button: 255
- error: 143
- aria-label: 64
- placeholder: 48
- emptyState: 46
- name: 40
- description: 31
- subtitle: 17

## Hotspots textuels (fichiers)

1. `src/tour/tourSpec.js` — 435 chaînes
2. `src/theme/themeTokens.js` — 391 chaînes
3. `src/pages/Home.jsx` — 339 chaînes
4. `src/pages/CreateV2Habits.jsx` — 326 chaînes
5. `src/pages/EditItem.jsx` — 272 chaînes
6. `src/pages/Pilotage.jsx` — 260 chaînes
7. `src/logic/templates.js` — 241 chaînes
8. `src/App.jsx` — 212 chaînes
9. `src/components/EditItemPanel.jsx` — 210 chaînes
10. `src/pages/Categories.jsx` — 204 chaînes
11. `src/pages/Session.jsx` — 172 chaînes
12. `src/logic/goals.js` — 167 chaînes
13. `src/logic/state/normalizers.js` — 159 chaînes
14. `src/pages/Onboarding.jsx` — 156 chaînes
15. `src/logic/occurrencePlanner.js` — 152 chaînes
16. `src/features/library/CategoryManageInline.jsx` — 149 chaînes
17. `src/logic/state/migrations.js` — 147 chaînes
18. `src/core/microActions/microActionsLibrary.js` — 135 chaînes
19. `src/pages/Preferences.jsx` — 120 chaînes
20. `src/components/CategoryGateModal.jsx` — 105 chaînes

## Cohérence terminologique

- **save**
  - variante `enregistrer`: Enregistrer | Impossible d'enregistrer le profil.
  - variante `sauvegarder`: Q: Comment sauvegarder mes données ?
- **cancel-close**
  - variante `annuler`: Annuler
  - variante `fermer`: Fermer
- **login**
  - variante `connexion`: Réseau indisponible. Vérifie ta connexion puis réessaie. | Déconnexion | Déconnexion... | Connexion
  - variante `connecte`: Accès refusé (RLS). Reconnecte-toi puis réessaie. | Connecté. | Connecte-toi pour accéder à l’application. | Impossible de se déconnecter.
- **logout**
  - variante `deconnexion`: Déconnexion | Déconnexion...
  - variante `se deconnecter`: Impossible de se déconnecter.
- **support-help**
  - variante `support`: support | Support | unsupported | support@discip-yourself.app
  - variante `aide`: Besoin d’aide juridique ou produit ? | Aide & contact

## Variantes proches (normalisation)

- fixed: fixed (54) | FIXED (48)
- none: none (56) | NONE (30)
- done: done (74) | DONE (2)
- action: ACTION (42) | Action (22) | action (4) | Action+ (1)
- outcome: OUTCOME (55) | outcome (5)
- prioritaire: prioritaire (34) | Prioritaire (8)
- active: active (31) | ACTIVE (5) | Active (3) | Activé (1)
- weekly: weekly (26) | WEEKLY (10)
- general: Général (20) | general (13)
- window: window (29) | WINDOW (3)
- pilotage: pilotage (25) | Pilotage (6)
- secondaire: secondaire (27) | Secondaire (4)
- daily: daily (19) | DAILY (11)
- categorie: Catégorie (25) | Categorie (1) | Catégorie : — (1)
- day: DAY (20) | day (6)
- business: business (12) | Business (8) | Business+ (4)
- recurring: recurring (12) | RECURRING (10)
- anytime: ANYTIME (16) | anytime (5)
- sante: sante (15) | Santé (6)
- session: session (12) | Session (4)
- sport: sport (11) | Sport (5)
- bonus: bonus (12) | Bonus (3)
- travail: travail (10) | Travail (5)
- finance: finance (10) | Finance (3)
- enter: Enter (11) | enter (1)
- accent: --accent (7) | accent (4)
- not found: not_found (10) | NOT_FOUND (1)
- support: support (7) | Support (4)
- aujourdhui: Aujourd’hui (7) | Aujourd'hui (3)
- focus: focus (5) | Focus (3) | --focus (2)

## Ton & narration

- Occurrences liées à `tu`: 44
- Occurrences liées à `vous`: 0
- Recommandation: fixer un registre unique et l’appliquer aux CTA, erreurs, onboarding, support.

## Accessibilité microcopy

- Vérifier les icônes sans label explicite (aria-label absent).
- Vérifier les textes longs sur mobile pour éviter la coupure CTA.
- Uniformiser les messages d’erreur avec action immédiate (`Réessayer`, `Contacter le support`).

## Extraits sémantiques (échantillon)

- enregistrer: Enregistrer | Impossible d'enregistrer le profil.
- sauvegarder: Q: Comment sauvegarder mes données ?
- annuler: Annuler
- fermer: Fermer
- continuer: Active une catégorie pour continuer | Continuer | Complète ton profil pour continuer. | Ouvre l’app pour continuer.
- profil: Compte / Profil | PROFILE_NETWORK | PROFILE_RLS | profiles | Impossible de charger le profil. | profile.name
- compte: Compte / Profil | Actions liées à ton compte | Définis ce qui compte vraiment. | 🔢 Compteur
- support: support | Support | unsupported | support@discip-yourself.app | computeDiff supports known paths | Légal & Support
- aide: Besoin d’aide juridique ou produit ? | Aide & contact

## Prochaine étape (non appliquée)

- Construire un dictionnaire de copy canonique (actions, états, erreurs, titres), puis lancer une migration contrôlée par lot.
