import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GateBadge, GateButton, GateHeader, GatePanel, GateSection } from "../shared/ui/gate/Gate";
import { getPlanLimits, getTrialDays } from "../logic/entitlements";
import { loadProducts, PRODUCT_IDS } from "../logic/purchases";
import { LABELS } from "../ui/labels";
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
      className="modalBackdrop paywallBackdrop"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (typeof onClose === "function") onClose();
      }}
    >
      <GatePanel
        className="card paywallPanel"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="paywallBody">
          <GateHeader
            title="Passer Premium"
            subtitle={reason || "Débloque toutes les fonctionnalités et enlève les limites."}
            actions={showTrial ? <GateBadge>Essai 14 jours</GateBadge> : null}
          />
          <GateSection title="Inclus" collapsible={false}>
            <div className="paywallFeatures">
              <div className="small2">• Catégories illimitées</div>
              <div className="small2">• {LABELS.goals} illimités</div>
              <div className="small2">• Actions illimitées</div>
              <div className="small2">• Planning & historique complets</div>
              <div className="small2">• Export des données</div>
            </div>
          </GateSection>
          <div className="small2 paywallLimits">
            Limites gratuites : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} ·{" "}
            {limits.actions} {LABELS.actionsLower}
          </div>
          <div className="paywallActions">
            <GateButton
              onClick={() => {
                if (typeof onSubscribeMonthly === "function") onSubscribeMonthly(PRODUCT_IDS.monthly);
              }}
            >
              S’abonner (Mensuel) · {monthlyLabel}
            </GateButton>
            <GateButton
              variant="ghost"
              onClick={() => {
                if (typeof onSubscribeYearly === "function") onSubscribeYearly(PRODUCT_IDS.yearly);
              }}
            >
              S’abonner (Annuel) · {yearlyLabel} {yearlyBadge}
            </GateButton>
          </div>
          {!products.available ? (
            <div className="small2 paywallStoreNote">
              Offres StoreKit indisponibles sur cet appareil.
            </div>
          ) : null}
          <div className="small2 paywallLegal">
            Abonnement auto-renouvelable. Annulable à tout moment dans les réglages iOS. Le paiement est débité via
            l’Apple ID.
          </div>
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
              <GateButton variant="ghost" onClick={onRestore}>
                Restaurer
              </GateButton>
              <GateButton variant="ghost" onClick={onClose}>
                Plus tard
              </GateButton>
            </div>
          </div>
        </div>
      </GatePanel>
    </div>
  );
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
