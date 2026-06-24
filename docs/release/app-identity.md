# Discip Yourself Release Identity

## Canonical identity

- App name: Discip Yourself
- Bundle ID: `com.allantomassian.discipyourself`
- Version source of truth: `package.json`
- Current public version: `1.0.0`
- Current iOS build: `1`
- Apple Team ID: `J6UH62LPX6`
- Proposed App Store SKU: `discipyourself-ios-001`

## Versioning

- Increment `CURRENT_PROJECT_VERSION` for every TestFlight upload.
- Keep `MARKETING_VERSION` aligned with the public version from `package.json`.
- Patch releases should update `package.json`, `package-lock.json`, and `MARKETING_VERSION` together.

## Pending release decisions

- IAP identifiers are not finalized. Current product identifiers remain unchanged in this lot:
  - `com.discipyourself.premium.monthly`
  - `com.discipyourself.premium.yearly`
- Recommended future IAP identifiers:
  - `com.allantomassian.discipyourself.premium.monthly`
  - `com.allantomassian.discipyourself.premium.yearly`
- Native deep-link and email-link return strategy is not finalized.
- Do not change the bundle ID after App Store Connect registration without an explicit migration decision.

This document must never contain Apple credentials, signing certificates, API keys, provisioning profiles, or private keys.
