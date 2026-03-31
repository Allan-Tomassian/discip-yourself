import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GateBadge, GateButton, GateHeader, GatePanel, GateSectionIntro } from "../shared/ui/gate/Gate";
import { getPlanLimits, getTrialDays } from "../logic/entitlements";
import { loadProducts, PRODUCT_IDS } from "../logic/purchases";
import { LABELS, MARKETING_COPY, UI_COPY } from "../ui/labels";
import "../features/paywall/paywall.css";

export default function PaywallModal({
  open,
  reason = "",
  onClose,
  onSubscribeMonthly,
  onSubscribeYearly,
  onRestore,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const limits = getPlanLimits();
  const [products, setProducts] = useState({ monthly: null, yearly: null, available: false });
  const trialDays = getTrialDays(products);
  const showTrial = trialDays === 14;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadProducts()
      .then((next) => {
        if (cancelled) return;
        setProducts(next || { monthly: null, yearly: null, available: false });
      })
      .catch((err) => {
        void err;
        if (cancelled) return;
        setProducts({ monthly: null, yearly: null, available: false });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const monthlyPrice = products.monthly?.price;
  const yearlyPrice = products.yearly?.price;
  const hasDiscount =
    Number.isFinite(monthlyPrice) &&
    Number.isFinite(yearlyPrice) &&
    monthlyPrice > 0 &&
    yearlyPrice > 0;
  const yearlyDiscount = hasDiscount
    ? Math.max(0, Math.round(100 - (yearlyPrice / (monthlyPrice * 12)) * 100))
    : null;
  const yearlyBadge = yearlyDiscount ? `≈ -${yearlyDiscount}%` : "≈ -40%";
  const monthlyLabel = products.monthly?.priceString || "—";
  const yearlyLabel = products.yearly?.priceString || "—";

  const content = (
    <div
      className="modalBackdrop paywallBackdrop GateOverlayBackdrop"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (typeof onClose === "function") onClose();
      }}
    >
      <div
        className="paywallPanelOuter GateGlassOuter"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="paywallPanelClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            className="card paywallPanel GateGlassContent"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="paywallBody">
              <GateHeader
                title={UI_COPY.discoverPremium}
                subtitle={reason || MARKETING_COPY.premiumSubtitle}
                actions={showTrial ? <GateBadge>Essai 14 jours</GateBadge> : null}
              />

              <div className="GateInlineMetaCard paywallSummaryCard">
                <div className="GateRoleCardTitle">Version complète</div>
                <div className="GateRoleHelperText paywallLimits">
                  {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} ·{" "}
                  {limits.actions} {LABELS.actionsLower}
                </div>
              </div>

              <section className="paywallSection">
                <GateSectionIntro title="Inclus" subtitle="Tout le système complet, sans limites basses." />
                <div className="paywallFeatures">
                  <div className="GateInlineMetaCard paywallFeatureCard">Catégories illimitées</div>
                  <div className="GateInlineMetaCard paywallFeatureCard">{LABELS.goals} illimités</div>
                  <div className="GateInlineMetaCard paywallFeatureCard">Actions illimitées</div>
                  <div className="GateInlineMetaCard paywallFeatureCard">Planification et historique complets</div>
                  <div className="GateInlineMetaCard paywallFeatureCard">Export des données</div>
                </div>
              </section>

              <section className="paywallSection">
                <GateSectionIntro title="Choisir une offre" subtitle="Mensuel pour démarrer, annuel pour réduire le coût." />
                <div className="paywallActions">
                  <GateButton
                    onClick={() => {
                      if (typeof onSubscribeMonthly === "function") onSubscribeMonthly(PRODUCT_IDS.monthly);
                    }}
                  >
                    Choisir le mensuel · {monthlyLabel}
                  </GateButton>
                  <GateButton
                    variant="secondary"
                    onClick={() => {
                      if (typeof onSubscribeYearly === "function") onSubscribeYearly(PRODUCT_IDS.yearly);
                    }}
                  >
                    Choisir l’annuel · {yearlyLabel} {yearlyBadge}
                  </GateButton>
                </div>
                {!products.available ? (
                  <div className="GateInlineMetaCard paywallStoreNote">
                    Les offres d’achat sont indisponibles sur cet appareil.
                  </div>
                ) : null}
              </section>

              <section className="paywallSection paywallSectionTight">
                <GateSectionIntro title="Restauration et mentions" subtitle="Paiement Apple ID, renouvellement automatique, annulation à tout moment." />
                <div className="paywallFooter">
                  <div className="paywallLinks">
                    <button className="linkBtn" type="button" onClick={() => (onOpenTerms ? onOpenTerms() : null)}>
                      Conditions
                    </button>
                    <button className="linkBtn" type="button" onClick={() => (onOpenPrivacy ? onOpenPrivacy() : null)}>
                      Confidentialité
                    </button>
                  </div>
                  <div className="paywallFooterActions">
                    <GateButton variant="ghost" size="sm" onClick={onRestore}>
                      {UI_COPY.restorePurchases}
                    </GateButton>
                    <GateButton variant="ghost" size="sm" onClick={onClose}>
                      Plus tard
                    </GateButton>
                  </div>
                </div>
                <div className="paywallLegal">
                  L’abonnement se renouvelle automatiquement. Tu peux l’annuler à tout moment dans les réglages iOS. Le paiement passe par ton Apple ID.
                </div>
              </section>
            </div>
          </GatePanel>
        </div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
