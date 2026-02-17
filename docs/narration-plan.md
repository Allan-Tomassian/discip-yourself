# Narration & Microcopy Plan (LOT 10)

## Style guide (proposé)

- Voix: directe, courte, orientée action.
- Personne grammaticale: choisir une seule forme (`tu` ou `vous`) et l’appliquer partout.
- Verbes d’action cohérents: `Enregistrer`, `Annuler`, `Continuer`, `Supprimer`, `Réessayer`.
- Messages d’erreur: cause + impact + prochaine action.
- Messages succès: courts, explicites, sans ambiguïté.

## Règles microcopy

- Boutons primaires: verbe + objet (`Enregistrer le profil`).
- Boutons secondaires: action courte (`Annuler`, `Retour`).
- Placeholders: exemple utile, pas une répétition du label.
- Empty states: contexte + bénéfice + CTA immédiat.
- Erreurs réseau/API: code (si dispo) + message humain + action (`Réessayer`).

## Narration produit

- Onboarding: 3 étapes max, texte séquencé (objectif, action, feedback).
- Progression: wording constant entre `Aujourd’hui`, `Bibliothèque`, `Pilotage`.
- Premium/paywall: bénéfice concret avant le prix, CTA unique.
- Support/légal: ton neutre, clair, sans jargon.

## Accessibilité textuelle

- Vérifier présence des `aria-label` sur icônes sans texte.
- Longueur mobile: éviter les chaînes > 70 caractères dans les boutons.
- Contraste sémantique: états erreur/succès avec texte explicite (pas couleur seule).
- Focus clavier: labels et aides contextualisées.

## Feedback & motion (recommandations, non implémentées)

- Press feedback: `.GatePressable` uniquement sur CTA/rows autorisés.
- Haptics (mobile): déclenchement léger sur validation primaire (optionnel, opt-in).
- Son de clic: désactivé par défaut, activable en préférences.
- Transitions: 120-180ms, easing homogène, pas d’animations concurrentes.
- Toasts: durée stable (2.5–4s), action de fermeture claire.

## Plan d’exécution recommandé (non appliqué)

1. Harmoniser terminologie globale (actions + erreurs).
2. Uniformiser textes onboarding/empty states.
3. Valider accessibilité (aria + longueurs + contrastes).
4. Ajouter feedback motion/son en feature flag.
