# Text Audit (LOT 10)

- Generated: 2026-02-23T13:29:22.589Z
- Source map: `docs/text-map.json`
- Total strings collectées: 9065
- Textes uniques: 3256
- Groupes normalisés: 3110

## Répartition par contexte

- string-literal: 6333
- title: 555
- status: 417
- label: 391
- menuItem: 349
- jsx-text: 321
- button: 278
- error: 147
- aria-label: 84
- placeholder: 49
- emptyState: 48
- name: 42
- description: 31
- subtitle: 20

## Hotspots textuels (fichiers)

1. `src/tour/tourSpec.js` — 435 chaînes
2. `src/pages/Home.jsx` — 396 chaînes
3. `src/theme/themeTokens.js` — 391 chaînes
4. `src/pages/CreateV2Habits.jsx` — 326 chaînes
5. `src/components/TopMenuPopover.jsx` — 300 chaînes
6. `src/pages/EditItem.jsx` — 272 chaînes
7. `src/pages/Pilotage.jsx` — 261 chaînes
8. `src/logic/templates.js` — 241 chaînes
9. `src/App.jsx` — 217 chaînes
10. `src/components/EditItemPanel.jsx` — 210 chaînes
11. `src/pages/Categories.jsx` — 198 chaînes
12. `src/pages/Session.jsx` — 172 chaînes
13. `src/logic/state/migrations.js` — 171 chaînes
14. `src/logic/goals.js` — 167 chaînes
15. `src/logic/state/normalizers.js` — 163 chaînes
16. `src/pages/Onboarding.jsx` — 156 chaînes
17. `src/logic/occurrencePlanner.js` — 152 chaînes
18. `src/features/library/CategoryManageInline.jsx` — 150 chaînes
19. `src/ui/totem/TotemDockPanel.jsx` — 139 chaînes
20. `src/core/microActions/microActionsLibrary.js` — 135 chaînes

## Cohérence terminologique

- **save**
  - variante `enregistrer`: Enregistrer | Impossible d'enregistrer. | Impossible d'enregistrer le profil.
  - variante `sauvegarder`: Q: Comment sauvegarder mes données ?
- **cancel-close**
  - variante `annuler`: Annuler
  - variante `fermer`: Fermer | Fermer le menu | Fermer le panneau totem
- **continue-validate**
  - variante `continuer`: Active une catégorie pour continuer | Continuer | Complète ton profil pour continuer. | Ouvre l’app pour continuer.
  - variante `valider`: Valider: ${item.title}
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
- done: done (71) | DONE (2)
- action: ACTION (42) | Action (22) | action (4) | Action+ (1)
- outcome: OUTCOME (56) | outcome (5)
- prioritaire: prioritaire (34) | Prioritaire (8)
- active: active (31) | ACTIVE (5) | Active (3) | Activé (1)
- general: Général (21) | general (16)
- weekly: weekly (26) | WEEKLY (10)
- window: window (29) | WINDOW (3)
- pilotage: pilotage (25) | Pilotage (6)
- secondaire: secondaire (27) | Secondaire (4)
- daily: daily (19) | DAILY (11)
- business: business (13) | Business (10) | Business+ (4)
- categorie: Catégorie (25) | Categorie (1) | Catégorie : — (1)
- day: DAY (20) | day (6)
- sante: sante (16) | Santé (8)
- recurring: recurring (12) | RECURRING (10)
- anytime: ANYTIME (16) | anytime (5)
- session: session (12) | Session (4)
- sport: sport (11) | Sport (5)
- bonus: bonus (12) | Bonus (3)
- travail: travail (10) | Travail (5)
- finance: finance (10) | Finance (3)
- micro done: micro_done (11) | MICRO_DONE (2)
- enter: Enter (11) | enter (1)
- accent: --accent (7) | accent (4)
- escape: Escape (9) | escape (2)
- not found: not_found (10) | NOT_FOUND (1)
- support: support (7) | Support (4)

## Ton & narration

- Occurrences liées à `tu`: 48
- Occurrences liées à `vous`: 0
- Recommandation: fixer un registre unique et l’appliquer aux CTA, erreurs, onboarding, support.

## Accessibilité microcopy

- Vérifier les icônes sans label explicite (aria-label absent).
- Vérifier les textes longs sur mobile pour éviter la coupure CTA.
- Uniformiser les messages d’erreur avec action immédiate (`Réessayer`, `Contacter le support`).

## Extraits sémantiques (échantillon)

- enregistrer: Enregistrer | Impossible d'enregistrer. | Impossible d'enregistrer le profil.
- sauvegarder: Q: Comment sauvegarder mes données ?
- annuler: Annuler
- fermer: Fermer | Fermer le menu | Fermer le panneau totem
- continuer: Active une catégorie pour continuer | Continuer | Complète ton profil pour continuer. | Ouvre l’app pour continuer.
- valider: Valider: ${item.title}
- profil: Compte / Profil | PROFILE_NETWORK | PROFILE_RLS | profiles | Impossible de charger le profil. | profile.name
- compte: Compte / Profil | Actions liées à ton compte | Définis ce qui compte vraiment. | 🔢 Compteur
- support: support | Support | unsupported | support@discip-yourself.app | computeDiff supports known paths | Le support et la FAQ seront accessibles dans ce panneau.
- aide: Besoin d’aide juridique ou produit ? | Aide & contact

## Prochaine étape (non appliquée)

- Construire un dictionnaire de copy canonique (actions, états, erreurs, titres), puis lancer une migration contrôlée par lot.
