import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_ACCESS_STATUS,
  readPersistedEntitlementSnapshot,
  resolveEntitlementAccess,
  resolveFounderEntitlementOverride,
} from "./entitlementAccess";

describe("entitlementAccess", () => {
  it("reads explicit and legacy premium snapshots", () => {
    expect(
      readPersistedEntitlementSnapshot({
        profile: {
          entitlements: { premium: true, source: "storekit" },
        },
      })
    ).toMatchObject({ premium: true, source: "storekit" });

    expect(
      readPersistedEntitlementSnapshot({
        profile: {
          plan: "premium",
        },
      })
    ).toMatchObject({ premium: true, source: "legacy_plan" });
  });

  it("detects founder override from auth metadata", () => {
    expect(
      resolveFounderEntitlementOverride({
        app_metadata: { entitlement_override: "founder" },
      })
    ).toBe("founder");
    expect(
      resolveFounderEntitlementOverride({
        app_metadata: { role: "admin" },
      })
    ).toBe("founder");
  });

  it("keeps status unknown while the first refresh is unresolved", () => {
    const access = resolveEntitlementAccess({
      user: null,
      safeData: {
        profile: {
          entitlements: { premium: true, source: "storekit" },
        },
      },
      refreshState: {
        hasResolved: false,
        isRefreshing: true,
        lastResult: null,
      },
    });

    expect(access.status).toBe(ENTITLEMENT_ACCESS_STATUS.UNKNOWN);
    expect(access.isResolved).toBe(false);
    expect(access.canOpenPaywall).toBe(false);
    expect(access.effectiveTier).toBe("premium");
  });

  it("resolves free after an explicit negative billing result", () => {
    const access = resolveEntitlementAccess({
      user: null,
      safeData: {
        profile: {
          plan: "premium",
          entitlements: { premium: true, source: "storekit" },
        },
      },
      refreshState: {
        hasResolved: true,
        isRefreshing: false,
        lastResult: {
          status: "ok",
          premium: false,
          source: "storekit",
          lastCheckedAt: "2026-04-13T09:00:00.000Z",
        },
      },
    });

    expect(access.status).toBe(ENTITLEMENT_ACCESS_STATUS.FREE);
    expect(access.effectiveTier).toBe("free");
    expect(access.canPreviewPremiumSession).toBe(true);
    expect(access.canLaunchPremiumSession).toBe(false);
    expect(access.canOpenPaywall).toBe(true);
  });

  it("treats founder as premium access without opening the paywall", () => {
    const access = resolveEntitlementAccess({
      user: {
        app_metadata: { entitlement_override: "founder" },
      },
      safeData: {
        profile: {
          plan: "free",
        },
      },
      refreshState: {
        hasResolved: false,
        isRefreshing: false,
        lastResult: null,
      },
    });

    expect(access.status).toBe(ENTITLEMENT_ACCESS_STATUS.FOUNDER);
    expect(access.effectiveTier).toBe("premium");
    expect(access.canLaunchPremiumSession).toBe(true);
    expect(access.canOpenPaywall).toBe(false);
  });

  it("keeps a persisted premium snapshot on store unavailability, but surfaces error without converting it to free", () => {
    const premiumAccess = resolveEntitlementAccess({
      safeData: {
        profile: {
          entitlements: { premium: true, source: "storekit" },
        },
      },
      refreshState: {
        hasResolved: true,
        isRefreshing: false,
        lastResult: {
          status: "unavailable",
          premium: false,
          source: "none",
          errorCode: "STORE_UNAVAILABLE",
          lastCheckedAt: "2026-04-13T09:00:00.000Z",
        },
      },
    });

    expect(premiumAccess.status).toBe(ENTITLEMENT_ACCESS_STATUS.PREMIUM);
    expect(premiumAccess.effectiveTier).toBe("premium");
    expect(premiumAccess.canOpenPaywall).toBe(false);

    const errorAccess = resolveEntitlementAccess({
      safeData: {
        profile: {
          entitlements: { premium: false, source: "storekit" },
        },
      },
      refreshState: {
        hasResolved: true,
        isRefreshing: false,
        lastResult: {
          status: "error",
          premium: false,
          source: "none",
          errorCode: "ENTITLEMENT_REFRESH_FAILED",
          lastCheckedAt: "2026-04-13T09:00:00.000Z",
        },
      },
    });

    expect(errorAccess.status).toBe(ENTITLEMENT_ACCESS_STATUS.ERROR);
    expect(errorAccess.canOpenPaywall).toBe(false);
    expect(errorAccess.effectiveTier).toBe("free");
  });
});
