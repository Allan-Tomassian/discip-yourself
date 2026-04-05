import React from "react";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { LABELS, MARKETING_COPY, UI_COPY } from "../ui/labels";
import {
  AppActionRow,
  AppCard,
  AppScreen,
  GhostButton,
  PrimaryButton,
  SectionHeader,
} from "../shared/ui/app";

export default function Subscription({ data, onOpenPaywall, onRestorePurchases }) {
  const safeData = data && typeof data === "object" ? data : {};
  const premium = isPremium(safeData);
  const limits = getPlanLimits();
  const entitlements =
    safeData?.profile?.entitlements && typeof safeData.profile.entitlements === "object"
      ? safeData.profile.entitlements
      : {};

  const expiryMs = entitlements?.expiresAt ? Date.parse(entitlements.expiresAt) : NaN;
  const expiryLabel = Number.isFinite(expiryMs) ? new Date(expiryMs).toLocaleDateString() : "";

  return (
    <AppScreen
      data={safeData}
      pageId="billing"
      headerTitle="Abonnement"
      headerSubtitle="Plan, achats et accès Premium"
    >
      <section className="mainPageSection">
        <SectionHeader
          title={premium ? MARKETING_COPY.premiumPlan : MARKETING_COPY.essentialPlan}
          subtitle="Gère ton plan, tes achats et tes accès."
        />
        <div className="mainPageSectionBody">
          <AppCard>
            <div className="col gap16">
              <div className="col gap6">
                <div className="small2 textMuted">Plan actif</div>
                <div className="appMetaText">
                  {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions}{" "}
                  {LABELS.actionsLower}
                </div>
              </div>
              <div className="col gap6">
                <div className="small2 textMuted">Accès Premium</div>
                <div className="appMetaText">
                  Les accès Premium sont vérifiés quand tu ouvres le Coach et les fonctions avancées.
                </div>
              </div>
              {premium && expiryLabel ? (
                <div className="col gap6">
                  <div className="small2 textMuted">Échéance</div>
                  <div className="appMetaText">Actif jusqu’au {expiryLabel}</div>
                </div>
              ) : null}
              <AppActionRow>
                <PrimaryButton
                  onClick={() => {
                    if (premium) return;
                    if (typeof onOpenPaywall === "function") onOpenPaywall("Abonnement");
                  }}
                  disabled={premium}
                >
                  {premium ? MARKETING_COPY.premiumPlan : UI_COPY.discoverPremium}
                </PrimaryButton>
                <GhostButton
                  size="sm"
                  onClick={() => {
                    if (typeof onRestorePurchases === "function") onRestorePurchases();
                  }}
                >
                  {UI_COPY.restorePurchases}
                </GhostButton>
              </AppActionRow>
            </div>
          </AppCard>
        </div>
      </section>
    </AppScreen>
  );
}
