export const ENTITLEMENT_ACCESS_STATUS = Object.freeze({
  UNKNOWN: "unknown",
  FREE: "free",
  PREMIUM: "premium",
  FOUNDER: "founder",
  ERROR: "error",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRefreshResult(value) {
  const source = isPlainObject(value) ? value : {};
  const premium = source.premium === true;
  const sourceName = normalizeString(source.source || "none") || "none";
  const lastCheckedAt = normalizeString(source.lastCheckedAt) || null;
  const expiresAt = normalizeString(source.expiresAt) || null;
  const errorCode = normalizeString(source.errorCode).toUpperCase() || null;
  const status = normalizeString(source.status || "").toLowerCase();
  if (status === "ok") {
    return {
      status: "ok",
      premium,
      source: sourceName,
      lastCheckedAt,
      expiresAt,
      errorCode: null,
    };
  }
  if (status === "unavailable") {
    return {
      status: "unavailable",
      premium: false,
      source: sourceName,
      lastCheckedAt,
      expiresAt: null,
      errorCode,
    };
  }
  if (status === "error") {
    return {
      status: "error",
      premium: false,
      source: sourceName,
      lastCheckedAt,
      expiresAt: null,
      errorCode: errorCode || "ENTITLEMENT_REFRESH_FAILED",
    };
  }
  return {
    status: "unavailable",
    premium: false,
    source: sourceName,
    lastCheckedAt,
    expiresAt: null,
    errorCode,
  };
}

function readUserAppMetadata(user) {
  return isPlainObject(user?.app_metadata) ? user.app_metadata : {};
}

export function resolveFounderEntitlementOverride(user) {
  const appMetadata = readUserAppMetadata(user);
  const entitlementOverride = normalizeString(appMetadata.entitlement_override).toLowerCase();
  if (entitlementOverride === "founder") return "founder";
  const role = normalizeString(appMetadata.role || user?.role).toLowerCase();
  if (role === "founder" || role === "admin") return "founder";
  return "";
}

export function readPersistedEntitlementSnapshot(data) {
  const profile = isPlainObject(data?.profile) ? data.profile : {};
  const entitlements = isPlainObject(profile.entitlements) ? profile.entitlements : {};
  const explicitPremium = entitlements.premium === true;
  const legacyPlanPremium = !explicitPremium && normalizeString(profile.plan).toLowerCase() === "premium";
  return {
    premium: explicitPremium || legacyPlanPremium,
    source:
      normalizeString(entitlements.source) ||
      (explicitPremium ? "persisted_snapshot" : legacyPlanPremium ? "legacy_plan" : "none"),
    expiresAt: normalizeString(entitlements.expiresAt) || null,
    lastCheckedAt: normalizeString(entitlements.lastCheckedAt) || null,
    errorCode: normalizeString(entitlements.errorCode).toUpperCase() || null,
  };
}

function resolveKnownStatusFromRefresh({
  refreshResult,
  snapshot,
} = {}) {
  const normalizedRefresh = normalizeRefreshResult(refreshResult);
  if (normalizedRefresh.status === "ok") {
    return {
      status: normalizedRefresh.premium
        ? ENTITLEMENT_ACCESS_STATUS.PREMIUM
        : ENTITLEMENT_ACCESS_STATUS.FREE,
      effectiveTier: normalizedRefresh.premium ? "premium" : "free",
      source: "billing_refresh",
      lastCheckedAt: normalizedRefresh.lastCheckedAt || snapshot.lastCheckedAt || null,
      errorCode: null,
      expiresAt: normalizedRefresh.expiresAt || null,
    };
  }
  if (normalizedRefresh.status === "unavailable") {
    if (snapshot.premium) {
      return {
        status: ENTITLEMENT_ACCESS_STATUS.PREMIUM,
        effectiveTier: "premium",
        source: snapshot.source === "legacy_plan" ? "legacy_plan" : "persisted_snapshot",
        lastCheckedAt: snapshot.lastCheckedAt || normalizedRefresh.lastCheckedAt || null,
        errorCode: normalizedRefresh.errorCode,
        expiresAt: snapshot.expiresAt || null,
      };
    }
    return {
      status: ENTITLEMENT_ACCESS_STATUS.FREE,
      effectiveTier: "free",
      source: "billing_refresh",
      lastCheckedAt: normalizedRefresh.lastCheckedAt || snapshot.lastCheckedAt || null,
      errorCode: null,
      expiresAt: null,
    };
  }
  if (snapshot.premium) {
    return {
      status: ENTITLEMENT_ACCESS_STATUS.PREMIUM,
      effectiveTier: "premium",
      source: snapshot.source === "legacy_plan" ? "legacy_plan" : "persisted_snapshot",
      lastCheckedAt: snapshot.lastCheckedAt || normalizedRefresh.lastCheckedAt || null,
      errorCode: normalizedRefresh.errorCode,
      expiresAt: snapshot.expiresAt || null,
    };
  }
  return {
    status: ENTITLEMENT_ACCESS_STATUS.ERROR,
    effectiveTier: "free",
    source: "billing_refresh",
    lastCheckedAt: normalizedRefresh.lastCheckedAt || snapshot.lastCheckedAt || null,
    errorCode: normalizedRefresh.errorCode || snapshot.errorCode || "ENTITLEMENT_REFRESH_FAILED",
    expiresAt: null,
  };
}

export function resolveEntitlementAccess({
  user = null,
  safeData = null,
  refreshState = null,
} = {}) {
  const snapshot = readPersistedEntitlementSnapshot(safeData);
  const founderOverride = resolveFounderEntitlementOverride(user);
  if (founderOverride === "founder") {
    return {
      status: ENTITLEMENT_ACCESS_STATUS.FOUNDER,
      effectiveTier: "premium",
      isResolved: true,
      canPreviewPremiumSession: true,
      canLaunchPremiumSession: true,
      canOpenPaywall: false,
      source: "auth_override",
      lastCheckedAt: snapshot.lastCheckedAt || null,
      errorCode: null,
      expiresAt: snapshot.expiresAt || null,
    };
  }

  const state = isPlainObject(refreshState) ? refreshState : {};
  const hasResolved = state.hasResolved === true;
  if (!hasResolved) {
    return {
      status: ENTITLEMENT_ACCESS_STATUS.UNKNOWN,
      effectiveTier: snapshot.premium ? "premium" : "free",
      isResolved: false,
      canPreviewPremiumSession: false,
      canLaunchPremiumSession: false,
      canOpenPaywall: false,
      source: snapshot.premium
        ? snapshot.source === "legacy_plan"
          ? "legacy_plan"
          : "persisted_snapshot"
        : "none",
      lastCheckedAt: snapshot.lastCheckedAt || null,
      errorCode: null,
      expiresAt: snapshot.expiresAt || null,
    };
  }

  const known = resolveKnownStatusFromRefresh({
    refreshResult: state.lastResult,
    snapshot,
  });
  return {
    status: known.status,
    effectiveTier: known.effectiveTier,
    isResolved: known.status !== ENTITLEMENT_ACCESS_STATUS.UNKNOWN,
    canPreviewPremiumSession:
      known.status === ENTITLEMENT_ACCESS_STATUS.FREE ||
      known.status === ENTITLEMENT_ACCESS_STATUS.PREMIUM ||
      known.status === ENTITLEMENT_ACCESS_STATUS.FOUNDER,
    canLaunchPremiumSession:
      known.status === ENTITLEMENT_ACCESS_STATUS.PREMIUM ||
      known.status === ENTITLEMENT_ACCESS_STATUS.FOUNDER,
    canOpenPaywall: known.status === ENTITLEMENT_ACCESS_STATUS.FREE,
    source: known.source,
    lastCheckedAt: known.lastCheckedAt,
    errorCode: known.errorCode,
    expiresAt: known.expiresAt,
  };
}
