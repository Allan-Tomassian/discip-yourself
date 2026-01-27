# QA Checklist

## Commandes
- npm run lint
- npm run build
- npm run check

## Checklist manuelle (critique)
1) Navigation: Aujourd’hui, Bibliothèque, Pilotage, Réglages
2) Création action via + (Créer une action) -> valide
3) Création objectif via + (Créer un objectif) -> valide
4) Post-action: Objectif ? puis Catégorie ? -> terminer
5) Post-objectif: "Créer 1ère action" -> action liée
6) Paywall: Free dépassement (objectifs/actions) -> modal, refus => aucune création
7) Toggle occurrence (Today/Planning) -> une seule occurrence modifiée
8) Suppression action -> occurrences/reminders nettoyés

## Test iPhone (LAN)
- Local: `npm run dev` puis `http://localhost:5174`.
- iPhone: `npm run dev:lan` puis `http://<IP_MAC>:5174`.
- IP Mac: `ipconfig getifaddr en0`.
- Si la page ne charge pas: vérifier firewall macOS, VPN/Private Relay, et le même Wi‑Fi.
