# Totem Dock — Ready-to-Implement Checklist

1. Confirm dock is mounted once at app root level (not per-page).
2. Confirm dock UI is rendered through a portal to `document.body`.
3. Reserve z-index tier for dock base and dock panel (between topbar and modal).
4. Keep topbar z-index and behavior unchanged (nav-only target for next implementation).
5. Reuse `GateGlassOuter + GateGlassClip + GateGlassBackdrop + GateGlassContent` on dock surfaces.
6. Reuse `GateSurfacePremium + GateCardPremium` for panel body.
7. Avoid placing dock fixed nodes inside transformed/overflow-hidden ancestors.
8. Use safe-area offsets (`--safe-top/right/bottom/left`) for right-edge placement.
9. Clamp dock panel size: width on mobile (`100vw - margins`) and max-height (`100dvh - safe areas`).
10. Ensure panel scroll is internal (`overflow:auto`, overscroll contained).
11. Keep outside-click + ESC close behavior aligned with menu pattern.
12. Validate no collision with bottom category bar on iPhone (home indicator zone).
13. Validate no collision with top menu popover when both can be opened.
14. Define panel view model in-place (`root/wallet/shop/customize/behaviors`) without route navigation.
15. Keep wallet/totem business logic untouched; UI reads existing `walletV1` and `totemV1`.
16. Add `data.ui.totemDockV1` (UI state only) or explicitly decide to nest under `totemV1.dock`.
17. Respect existing e2e hooks (avoid removing current `data-tour-id`/`data-testid` unexpectedly).
18. Verify layering against modal/paywall: dock must not block critical modals.
19. iOS smoke test: open/close dock, rotate device, keyboard open, safe-area clipping.
20. Regression pass: `npm test`, `npm run build`, `npm run test:e2e` after implementation.
