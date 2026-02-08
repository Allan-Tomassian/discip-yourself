import { useCallback, useEffect, useState } from "react";
import {
  canCreateAction,
  canCreateOutcome,
  getGenerationWindowDays,
  getPlanLimits,
  isPlanningUnlimited,
  isPremium,
} from "../logic/entitlements";
import { getPremiumEntitlement, purchase, restore } from "../logic/purchases";
import { safeAlert } from "../utils/dialogs";

export function useEntitlementsPaywall({ safeData, setData }) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState("");

  const planLimits = getPlanLimits();
  const isPremiumPlan = isPremium(safeData);
  const generationWindowDays = getGenerationWindowDays(safeData);
  const planningUnlimited = isPlanningUnlimited(safeData);
  const canCreateOutcomeNow = canCreateOutcome(safeData);
  const canCreateActionNow = canCreateAction(safeData);

  const refreshEntitlement = useCallback(
    async (cancelledRef) => {
      const result = await getPremiumEntitlement();
      if (cancelledRef?.current) return result;
      if (typeof setData !== "function") return result;
      setData((prev) => {
        const profile = prev.profile && typeof prev.profile === "object" ? prev.profile : {};
        const prevEntitlements =
          profile.entitlements && typeof profile.entitlements === "object" ? profile.entitlements : {};
        const premium = Boolean(result?.premium);
        const expiresAt = typeof result?.expiresAt === "string" ? result.expiresAt : null;
        const entitlements = {
          ...prevEntitlements,
          premium,
          expiresAt,
          lastCheckedAt: new Date().toISOString(),
          source: result?.source || prevEntitlements.source || "none",
        };
        const nextPlan = premium ? "premium" : profile.plan || "free";
        return { ...prev, profile: { ...profile, plan: nextPlan, entitlements } };
      });
      return result;
    },
    [setData]
  );

  useEffect(() => {
    const cancelledRef = { current: false };
    refreshEntitlement(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [refreshEntitlement]);

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
      await refreshEntitlement();
      setPaywallOpen(false);
    },
    [refreshEntitlement]
  );

  const handleRestorePurchases = useCallback(async () => {
    const result = await restore();
    if (!result?.success) {
      if (typeof safeAlert === "function") safeAlert("Restauration indisponible pour le moment.");
      return;
    }
    await refreshEntitlement();
  }, [refreshEntitlement]);

  return {
    paywallOpen,
    paywallReason,
    setPaywallOpen,
    openPaywall,
    handlePurchase,
    handleRestorePurchases,
    refreshEntitlement,
    planLimits,
    isPremiumPlan,
    generationWindowDays,
    planningUnlimited,
    canCreateOutcomeNow,
    canCreateActionNow,
  };
}
