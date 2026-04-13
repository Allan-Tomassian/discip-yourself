import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canCreateAction,
  canCreateOutcome,
  getGenerationWindowDays,
  getPlanLimits,
  isPlanningUnlimited,
} from "../logic/entitlements";
import { getPremiumEntitlement, purchase, restore } from "../logic/purchases";
import { safeAlert } from "../utils/dialogs";
import { useAuth } from "../auth/useAuth";
import { resolveEntitlementAccess } from "../domain/entitlementAccess";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRefreshResult(result) {
  const source = isPlainObject(result) ? result : {};
  const status = typeof source.status === "string" ? source.status.trim().toLowerCase() : "";
  return {
    premium: source.premium === true,
    expiresAt: typeof source.expiresAt === "string" ? source.expiresAt : null,
    source: typeof source.source === "string" && source.source.trim() ? source.source.trim() : "none",
    status: status === "ok" || status === "unavailable" || status === "error" ? status : "unavailable",
    errorCode: typeof source.errorCode === "string" && source.errorCode.trim() ? source.errorCode.trim() : null,
    lastCheckedAt: new Date().toISOString(),
  };
}

function shouldPersistExplicitPremium(result) {
  return result?.status === "ok";
}

function mergeDataWithEffectiveTier(data, effectiveTier) {
  const safeData = isPlainObject(data) ? data : {};
  const profile = isPlainObject(safeData.profile) ? safeData.profile : {};
  const prevEntitlements = isPlainObject(profile.entitlements) ? profile.entitlements : {};
  const premium = effectiveTier === "premium";
  return {
    ...safeData,
    profile: {
      ...profile,
      plan: premium ? "premium" : "free",
      entitlements: {
        ...prevEntitlements,
        premium,
      },
    },
  };
}

export function useEntitlementsPaywall({ safeData, setData }) {
  const { user } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState("");
  const [refreshState, setRefreshState] = useState({
    hasResolved: false,
    isRefreshing: false,
    lastResult: null,
  });
  const refreshPromiseRef = useRef(null);
  const safeDataRef = useRef(safeData);
  const userRef = useRef(user);

  useEffect(() => {
    safeDataRef.current = safeData;
  }, [safeData]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const planLimits = getPlanLimits();
  const entitlementAccess = useMemo(
    () =>
      resolveEntitlementAccess({
        user,
        safeData,
        refreshState,
      }),
    [refreshState, safeData, user]
  );
  const isPremiumPlan = entitlementAccess.effectiveTier === "premium";
  const effectiveData = useMemo(
    () => mergeDataWithEffectiveTier(safeData, entitlementAccess.effectiveTier),
    [entitlementAccess.effectiveTier, safeData]
  );
  const generationWindowDays = getGenerationWindowDays(effectiveData);
  const planningUnlimited = isPlanningUnlimited(effectiveData);
  const canCreateOutcomeNow = canCreateOutcome(effectiveData);
  const canCreateActionNow = canCreateAction(effectiveData);

  const computeCurrentAccess = useCallback(
    (nextRefreshState = refreshState) =>
      resolveEntitlementAccess({
        user: userRef.current,
        safeData: safeDataRef.current,
        refreshState: nextRefreshState,
      }),
    [refreshState]
  );

  const refreshEntitlement = useCallback(
    async (options = {}) => {
      const force = isPlainObject(options) && options.force === true;
      const cancelledRef = isPlainObject(options) ? options.cancelledRef || null : null;
      if (!force && refreshPromiseRef.current) return refreshPromiseRef.current;

      const nextPromise = (async () => {
        setRefreshState((prev) => ({ ...prev, isRefreshing: true }));
        const result = normalizeRefreshResult(await getPremiumEntitlement());
        if (cancelledRef?.current) return result;
        const nextRefreshState = {
          hasResolved: true,
          isRefreshing: false,
          lastResult: result,
        };
        setRefreshState(nextRefreshState);
        if (typeof setData === "function") {
          setData((prev) => {
            const profile = isPlainObject(prev?.profile) ? prev.profile : {};
            const prevEntitlements = isPlainObject(profile.entitlements) ? profile.entitlements : {};
            const entitlements = {
              ...prevEntitlements,
              lastCheckedAt: result.lastCheckedAt,
              source: result.source || prevEntitlements.source || "none",
              errorCode: result.errorCode,
              status: result.status,
            };
            if (result.expiresAt) entitlements.expiresAt = result.expiresAt;
            if (shouldPersistExplicitPremium(result)) {
              entitlements.premium = result.premium;
            }
            const nextProfile = {
              ...profile,
              entitlements,
            };
            if (shouldPersistExplicitPremium(result)) {
              nextProfile.plan = result.premium ? "premium" : "free";
            }
            return { ...prev, profile: nextProfile };
          });
        }
        return result;
      })();

      refreshPromiseRef.current = nextPromise;
      try {
        return await nextPromise;
      } catch (error) {
        const errorCode = String(error?.code || "ENTITLEMENT_REFRESH_FAILED").trim().toUpperCase();
        const nextRefreshState = {
          hasResolved: true,
          isRefreshing: false,
          lastResult: {
            premium: false,
            expiresAt: null,
            source: "none",
            status: "error",
            errorCode,
            lastCheckedAt: new Date().toISOString(),
          },
        };
        setRefreshState(nextRefreshState);
        return nextRefreshState.lastResult;
      } finally {
        if (refreshPromiseRef.current === nextPromise) refreshPromiseRef.current = null;
      }
    },
    [setData]
  );

  const ensureResolved = useCallback(
    async ({ force = false } = {}) => {
      const currentAccess = computeCurrentAccess();
      if (currentAccess.isResolved && !force) return currentAccess;
      const result = await refreshEntitlement({ force });
      return resolveEntitlementAccess({
        user: userRef.current,
        safeData: safeDataRef.current,
        refreshState: {
          hasResolved: true,
          isRefreshing: false,
          lastResult: result,
        },
      });
    },
    [computeCurrentAccess, refreshEntitlement]
  );

  useEffect(() => {
    const cancelledRef = { current: false };
    refreshEntitlement({ cancelledRef });
    return () => {
      cancelledRef.current = true;
    };
  }, [refreshEntitlement]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshIfStale = () => {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      const checkedAtMs = entitlementAccess.lastCheckedAt ? Date.parse(entitlementAccess.lastCheckedAt) : NaN;
      const isStale = !Number.isFinite(checkedAtMs) || Date.now() - checkedAtMs > 60 * 1000;
      if (!isStale && entitlementAccess.isResolved) return;
      void refreshEntitlement({ force: true });
    };
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [entitlementAccess.isResolved, entitlementAccess.lastCheckedAt, refreshEntitlement]);

  const openPaywall = useCallback((reason) => {
    setPaywallReason(reason || "");
    setPaywallOpen(true);
  }, []);

  const handlePurchase = useCallback(
    async (productId) => {
      const result = await purchase(productId);
      if (!result?.success) {
        if (typeof safeAlert === "function") safeAlert("Achat indisponible pour le moment.");
        return;
      }
      const nextAccess = await ensureResolved({ force: true });
      if (nextAccess.effectiveTier === "premium") setPaywallOpen(false);
    },
    [ensureResolved]
  );

  const handleRestorePurchases = useCallback(async () => {
    const result = await restore();
    if (!result?.success) {
      if (typeof safeAlert === "function") safeAlert("Restauration indisponible pour le moment.");
      return;
    }
    await ensureResolved({ force: true });
  }, [ensureResolved]);

  return {
    paywallOpen,
    paywallReason,
    setPaywallOpen,
    openPaywall,
    handlePurchase,
    handleRestorePurchases,
    refreshEntitlement,
    ensureResolved,
    entitlementAccess,
    planLimits,
    isPremiumPlan,
    generationWindowDays,
    planningUnlimited,
    canCreateOutcomeNow,
    canCreateActionNow,
  };
}
