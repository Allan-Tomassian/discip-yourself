# Ads Ready Checklist

_Generated: 2026-02-18T02:53:04.044Z_

## Core architecture
- [x] Rewarded abstraction module exists (src/logic/rewardedAds.js)
- [x] Wallet module exists (src/logic/walletV1.js)
- [ ] Real provider adapter implemented (AdMob/Unity)
- [ ] Runtime switch stub|real documented and tested

## UI + UX
- [x] Watch-ad CTA detected in UI
- [x] Rewarded modal/stub flow exists
- [ ] Provider unavailable UX fully specified and localized

## Persistence + guards
- [x] Wallet persistence path exists (normalizers/migrations)
- [ ] Anti-abuse strategy documented for production
- [ ] Server-side reward verification strategy (if needed)

## Compliance
- [ ] ATT flow integrated (iOS real SDK case)
- [ ] Consent/GDPR flow integrated
- [ ] Privacy policy + tracking disclosure aligned with implementation

## Testing
- [x] Ads/wallet e2e test detected
- [ ] Provider real integration tests
- [ ] Failure-path tests (timeout/no-fill/network)

