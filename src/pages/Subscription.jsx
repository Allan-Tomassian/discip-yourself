import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button } from "../components/UI";
import LiquidGlassSurface from "../ui/LiquidGlassSurface";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { LABELS } from "../ui/labels";

export default function Subscription({ data, onOpenPaywall, onRestorePurchases }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const premium = isPremium(safeData);
  const limits = getPlanLimits();
  const entitlements =
    safeData?.profile?.entitlements && typeof safeData.profile.entitlements === "object"
      ? safeData.profile.entitlements
      : {};

  const expiryMs = entitlements?.expiresAt ? Date.parse(entitlements.expiresAt) : NaN;
  const expiryLabel = Number.isFinite(expiryMs) ? new Date(expiryMs).toLocaleDateString() : "";

  return (
    <ScreenShell
      data={safeData}
      pageId="settings"
      headerTitle="Abonnement"
      headerSubtitle="Plan et accès Premium"
      backgroundImage={backgroundImage}
    >
      <div className="liquidPageStack">
        <LiquidGlassSurface variant="card" density="solid">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">{premium ? "Premium actif" : "Version gratuite"}</div>
              <div className="liquidSurfaceSubtitle">Gère ton plan et tes achats.</div>
            </div>
          </div>

          <div className="liquidSurfaceBody">
            <div className="small2">
              Limites gratuites : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions}{" "}
              {LABELS.actionsLower}
            </div>
            {premium && expiryLabel ? <div className="small2">Expire le {expiryLabel}</div> : null}
            <div className="liquidActionsRow">
              <Button
                onClick={() => {
                  if (premium) return;
                  if (typeof onOpenPaywall === "function") onOpenPaywall("Abonnement");
                }}
                disabled={premium}
              >
                {premium ? "Premium activé" : "Passer Premium"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onRestorePurchases === "function") onRestorePurchases();
                }}
              >
                Restaurer
              </Button>
            </div>
          </div>
        </LiquidGlassSurface>
      </div>
    </ScreenShell>
  );
}
