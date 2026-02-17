import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
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
    <ScreenShell data={safeData} pageId="settings" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Abonnement</span>}
        subtitle={<span className="GatePageSubtitle">Plan et accès Premium</span>}
      >
        <GateSection
          title={premium ? "Premium actif" : "Version gratuite"}
          description="Gère ton plan et tes achats."
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small2">
            Limites gratuites : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions}{" "}
            {LABELS.actionsLower}
          </div>
          {premium && expiryLabel ? <div className="small2">Expire le {expiryLabel}</div> : null}
          <div className="GatePrimaryCtaRow">
            <GateButton
              className="GatePressable"
              onClick={() => {
                if (premium) return;
                if (typeof onOpenPaywall === "function") onOpenPaywall("Abonnement");
              }}
              disabled={premium}
            >
              {premium ? "Premium activé" : "Passer Premium"}
            </GateButton>
            <GateButton
              variant="ghost"
              className="GatePressable"
              onClick={() => {
                if (typeof onRestorePurchases === "function") onRestorePurchases();
              }}
            >
              Restaurer
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
