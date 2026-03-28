import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { LABELS, MARKETING_COPY, UI_COPY } from "../ui/labels";

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
        subtitle={<span className="GatePageSubtitle">Plan, achats et accès Premium</span>}
      >
        <GateSection
          title={premium ? MARKETING_COPY.premiumPlan : MARKETING_COPY.essentialPlan}
          description="Gère ton plan, tes achats et tes accès."
          collapsible={false}
          className="GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="gatePageInlineList">
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleCardTitle">Plan actif</div>
              <div className="GateRoleHelperText">
                {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions}{" "}
                {LABELS.actionsLower}
              </div>
            </div>
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleCardTitle">Accès Premium</div>
              <div className="GateRoleHelperText">
                Les accès Premium sont vérifiés quand tu ouvres le Coach et les fonctions avancées.
              </div>
            </div>
            {premium && expiryLabel ? (
              <div className="GateInlineMetaCard gatePageInlineText">
                <div className="GateRoleCardTitle">Échéance</div>
                <div className="GateRoleCardMeta">Actif jusqu’au {expiryLabel}</div>
              </div>
            ) : null}
          </div>
          <div className="GatePrimaryCtaRow">
            <GateButton
              className="GatePressable"
              onClick={() => {
                if (premium) return;
                if (typeof onOpenPaywall === "function") onOpenPaywall("Abonnement");
              }}
              disabled={premium}
            >
              {premium ? MARKETING_COPY.premiumPlan : UI_COPY.discoverPremium}
            </GateButton>
            <GateButton
              variant="ghost"
              className="GatePressable"
              onClick={() => {
                if (typeof onRestorePurchases === "function") onRestorePurchases();
              }}
            >
              {UI_COPY.restorePurchases}
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
