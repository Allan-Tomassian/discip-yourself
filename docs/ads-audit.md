# Ads Audit

_Generated: 2026-02-18T02:53:04.044Z_

## Verdict
- Status: provider abstraction (stub only)
- Real ad SDK detected: no
- Provider abstraction present: yes

## Section 1: Ce qui est déjà en place
- Wallet module: present (src/logic/walletV1.js)
- Rewarded ads abstraction: present (src/logic/rewardedAds.js)
- Rewarded modal UI: present (src/ui/today/RewardedAdModal.jsx)
- Persistance UI (normalizers/migrations): present
- CTA UI Regarder une vidéo: present
- Tests e2e ads/wallet: present (tests/e2e/micro-actions.coins-and-ads.spec.js)

## Section 2: Ce qui manque pour brancher un provider réel
- Aucun SDK provider réel détecté (AdMob/Unity/IronSource/etc.) dans package.json / package-lock.json.
- Pas de couche explicite provider=stub|real pilotée par env dédiée ads.
- Pas de stratégie explicite de preload/load-state provider (ready, unavailable, timeout).
- Pas de fallback réseau/offline documenté pour ad load/show/reward.
- Pas de télémétrie provider standardisée (impression/click/reward/fail) dédiée ads.

## Section 3: Où l’UI déclenche les ads
- src/hooks/useEntitlementsPaywall.js:10: import { getPremiumEntitlement, purchase, restore } from "../logic/purchases";
- src/hooks/useEntitlementsPaywall.js:77: const result = await restore();
- src/pages/Home.jsx:1783: const rewarded = applyAdReward(currentWallet, {
- src/pages/Home.jsx:1788: if (!rewarded.granted) return prev;
- src/pages/Home.jsx:1800: isSameWalletV1(prevUi.walletV1, rewarded.wallet) &&
- src/pages/Home.jsx:1810: walletV1: rewarded.wallet,
- src/ui/today/MicroActionsCard.jsx:261: data-testid="micro-watch-ad"
- src/ui/today/RewardedAdModal.jsx:76: data-testid="rewarded-ad-modal"
- src/ui/today/RewardedAdModal.jsx:93: data-testid="rewarded-ad-complete"
- src/ui/today/RewardedAdModal.jsx:104: data-testid="rewarded-ad-close"

## Section 4: Risque / conformité App Store
- Hits tracking/consent/ATT/IDFA: 0
- Niveau de risque estimé (statique): low
- SDK ads réels détectés: 0
- Variables d’environnement ads détectées: 0

### Observations conformité
- Aucune intégration provider ads réelle détectée: risque ATT/IDFA immédiat réduit côté code actuel.
- Des mentions tracking/consent peuvent exister dans docs/tests; à vérifier avant release native avec SDK réel.
- La séparation stub/réel n’est pas explicitement câblée par configuration runtime ads (env flag dédié).

## Section 5: Plan minimal recommandé (non appliqué)
1. Introduire un adapter adsProvider (stub + real) avec interface unique loadRewarded/showRewarded.
2. Ajouter un switch config explicite (ADS_PROVIDER=stub|real) et garde-fou fail-safe.
3. Standardiser les états UI provider (loading/unavailable/rewarded/dismissed/error).
4. Ajouter logs structurés ads (load start/success/fail, show start/fail, reward granted).
5. Prévoir policy consent/ATT avant intégration SDK réel (iOS + Android).
6. Ajouter tests e2e provider unavailable et reward denied en plus des cas happy path.
7. Documenter les limites journalières + synchronisation backend éventuelle anti-abus.
8. Prévoir fallback hors ligne (désactivation CTA + message explicite).

## Données brutes
- Map JSON: docs/ads-map.json
- Commandes utilisées:
  - node scripts/ads-audit-scan.mjs && node scripts/ads-audit-report.mjs

