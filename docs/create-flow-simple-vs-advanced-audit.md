# Create Flow — Essentiel vs Avancé (audit logique)

## Résumé

- États locaux dans `CreateV2Habits`: **23**
- Flow habit par défaut legacy: **oui**
- Flow uxV2 disponible: **oui**

## Mode Essentiel (débutant)

| Champ | Pourquoi indispensable | Réf |
|---|---|---|
| Type d’action (ponctuelle / récurrente / anytime) | choix indispensable pour définir le modèle d’occurrence | `src/pages/CreateV2HabitType.jsx:9` |
| Titre action | minimum pour persistance/actionnable | `src/pages/CreateV2Habits.jsx:278` |
| Date unique ou jours attendus | définit la cadence attendue | `src/pages/CreateV2Habits.jsx:152` |
| Heure (optionnelle one-off, requise récurrent standard) | nécessaire pour Session/Aujourd’hui | `src/pages/CreateV2Habits.jsx:383` |
| Catégorie finale | détermine affichage Home/Bibliothèque/Pilotage | `src/pages/CreateV2PickCategory.jsx:8` |

## Mode Avancé (power user)

| Champ | Pourquoi avancé | Réf |
|---|---|---|
| Période activeFrom/activeTo | utile pour power users, surcharge débutant | `src/pages/CreateV2Habits.jsx:284` |
| Schedule mode WEEKLY_SLOTS + slots par jour | configuration fine; candidat mode avancé | `src/pages/CreateV2Habits.jsx:152` |
| Rappels + fenêtre reminder | non essentiel pour premier succès utilisateur | `src/pages/CreateV2Habits.jsx:314` |
| Quantity value/unit/period | mesure avancée; augmente charge cognitive | `src/pages/CreateV2Habits.jsx:93` |
| Miss policy / grace / completionMode | contrats comportementaux avancés | `src/pages/CreateV2Habits.jsx:702` |
| Résolution de conflit proactive | utile mais doit rester option avancée | `src/pages/CreateV2Habits.jsx:17` |

## Verdict faisabilité (sans casser logique)

- **Viable**: la logique actuelle supporte un découpage Essentiel/Avancé.
- Implémentation future recommandée (hors ce lot):
- Étape 1 (Essentiel): type, titre, date/jours, heure optionnelle, catégorie.
- Étape 2 (Avancé): période, créneaux par jour, rappel, quantité, politiques d’échec.
- Étape 3: résolution conflit affichée seulement en cas de collision.

