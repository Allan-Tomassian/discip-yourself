import React from "react";
import { getPlanLimits } from "../logic/entitlements";
import { LABELS, MARKETING_COPY, UI_COPY } from "../ui/labels";
import {
  AppActionRow,
  AppCard,
  AppScreen,
  FeedbackMessage,
  GhostButton,
  PrimaryButton,
  SectionHeader,
} from "../shared/ui/app";

export default function Subscription({
  data,
  entitlementAccess = null,
  onOpenPaywall,
  onRefreshEntitlement,
  onRestorePurchases,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const limits = getPlanLimits();
  const entitlements =
    safeData?.profile?.entitlements && typeof safeData.profile.entitlements === "object"
      ? safeData.profile.entitlements
      : {};
  const access = entitlementAccess && typeof entitlementAccess === "object" ? entitlementAccess : null;
  const status = access?.status || "unknown";
  const isChecking = status === "unknown";
  const isError = status === "error";
  const isFounder = status === "founder";
  const hasResolvedPremiumAccess = status === "premium" || status === "founder";

  const expiryMs = entitlements?.expiresAt ? Date.parse(entitlements.expiresAt) : NaN;
  const expiryLabel = Number.isFinite(expiryMs) ? new Date(expiryMs).toLocaleDateString() : "";
  const sectionTitle =
    hasResolvedPremiumAccess
      ? MARKETING_COPY.premiumPlan
      : isChecking || isError
        ? "Vérification des accès"
        : MARKETING_COPY.essentialPlan;
  const planLabel =
    status === "founder"
      ? "Founder"
      : hasResolvedPremiumAccess
        ? MARKETING_COPY.premiumPlan
        : isChecking
          ? "Vérification en cours"
          : isError
            ? "Accès à vérifier"
            : MARKETING_COPY.essentialPlan;
  const accessDescription =
    isChecking
      ? "Les accès Premium sont en cours de vérification."
      : isError
        ? "Impossible de vérifier les accès pour le moment."
        : "Les accès Premium sont vérifiés quand tu ouvres le Coach et les fonctions avancées.";

  return (
    <AppScreen
      data={safeData}
      pageId="billing"
      headerTitle="Abonnement"
      headerSubtitle="Plan, achats et accès Premium"
    >
      <section className="mainPageSection">
        <SectionHeader
          title={sectionTitle}
          subtitle="Gère ton plan, tes achats et tes accès."
        />
        <div className="mainPageSectionBody">
          <AppCard>
            <div className="col gap16">
              <div className="col gap6">
                <div className="small2 textMuted">Plan actif</div>
                <div className="appMetaText">{planLabel}</div>
                {!hasResolvedPremiumAccess ? (
                  <div className="appMetaText">
                    {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions}{" "}
                    {LABELS.actionsLower}
                  </div>
                ) : null}
              </div>
              <div className="col gap6">
                <div className="small2 textMuted">Accès Premium</div>
                <div className="appMetaText">{accessDescription}</div>
              </div>
              {isFounder ? (
                <div className="col gap6">
                  <div className="small2 textMuted">Accès</div>
                  <div className="appMetaText">Override founder actif</div>
                </div>
              ) : null}
              {hasResolvedPremiumAccess && expiryLabel ? (
                <div className="col gap6">
                  <div className="small2 textMuted">Échéance</div>
                  <div className="appMetaText">Actif jusqu’au {expiryLabel}</div>
                </div>
              ) : null}
              {isError ? (
                <FeedbackMessage tone="warning">
                  Impossible de confirmer les accès Premium pour l’instant.
                </FeedbackMessage>
              ) : null}
              <AppActionRow>
                <PrimaryButton
                  onClick={() => {
                    if (hasResolvedPremiumAccess || isChecking) return;
                    if (isError) {
                      if (typeof onRefreshEntitlement === "function") onRefreshEntitlement({ force: true });
                      return;
                    }
                    if (typeof onOpenPaywall === "function") onOpenPaywall("Abonnement");
                  }}
                  disabled={hasResolvedPremiumAccess || isChecking}
                >
                  {hasResolvedPremiumAccess
                    ? MARKETING_COPY.premiumPlan
                    : isChecking
                      ? "Vérification…"
                      : isError
                        ? "Réessayer"
                        : UI_COPY.discoverPremium}
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
