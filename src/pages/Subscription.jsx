import React from "react";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { LABELS, MARKETING_COPY, UI_COPY } from "../ui/labels";
import {
  AppActionRow,
  AppCard,
  AppInlineMetaCard,
  AppScreen,
  GhostButton,
  PrimaryButton,
  SectionHeader,
} from "../shared/ui/app";

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
    <AppScreen
      data={safeData}
      pageId="billing"
      backgroundImage={backgroundImage}
      headerTitle="Abonnement"
      headerSubtitle="Plan, achats et accès Premium"
    >
      <section className="mainPageSection">
        <SectionHeader
          title={premium ? MARKETING_COPY.premiumPlan : MARKETING_COPY.essentialPlan}
          subtitle="Gère ton plan, tes achats et tes accès."
        />
        <AppCard>
          <div className="col gap12">
            <AppInlineMetaCard title="Plan actif">
              <div className="appMetaText">
                {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions}{" "}
                {LABELS.actionsLower}
              </div>
            </AppInlineMetaCard>
            <AppInlineMetaCard title="Accès Premium">
              <div className="appMetaText">
                Les accès Premium sont vérifiés quand tu ouvres le Coach et les fonctions avancées.
              </div>
            </AppInlineMetaCard>
            {premium && expiryLabel ? (
              <AppInlineMetaCard title="Échéance" meta={`Actif jusqu’au ${expiryLabel}`} />
            ) : null}
          </div>
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
        </AppCard>
      </section>
    </AppScreen>
  );
}
