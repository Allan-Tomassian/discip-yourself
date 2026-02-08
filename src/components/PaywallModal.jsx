import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card } from "./UI";
import { getPlanLimits, getTrialDays } from "../logic/entitlements";
import { loadProducts, PRODUCT_IDS } from "../logic/purchases";
import { LABELS } from "../ui/labels";

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
      <Card
        accentBorder
        className="reminderCard paywallPanel"
        style={{ maxWidth: 520, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="p18 col" style={{ gap: 12 }}>
          <div className="titleSm">Passer Premium</div>
          {showTrial ? (
            <div className="small2" style={{ opacity: 0.8 }}>
              Essai 14 jours
            </div>
          ) : null}
          <div className="small2" style={{ opacity: 0.8 }}>
            {reason || "Débloque toutes les fonctionnalités et enlève les limites."}
          </div>
          <div className="col" style={{ gap: 6 }}>
            <div className="small">Inclus :</div>
            <div className="small2">• Catégories illimitées</div>
            <div className="small2">• {LABELS.goals} illimités</div>
            <div className="small2">• Actions illimitées</div>
            <div className="small2">• Planning & historique complets</div>
            <div className="small2">• Export des données</div>
          </div>
          <div className="small2" style={{ opacity: 0.6 }}>
            Limites gratuites : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions} {LABELS.actionsLower}
          </div>
          <div className="col" style={{ gap: 8 }}>
            <Button
              onClick={() => {
                if (typeof onSubscribeMonthly === "function") onSubscribeMonthly(PRODUCT_IDS.monthly);
              }}
            >
              S’abonner (Mensuel) · {monthlyLabel}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (typeof onSubscribeYearly === "function") onSubscribeYearly(PRODUCT_IDS.yearly);
              }}
            >
              S’abonner (Annuel) · {yearlyLabel} {yearlyBadge}
            </Button>
          </div>
          {!products.available ? (
            <div className="small2" style={{ opacity: 0.6 }}>
              Offres StoreKit indisponibles sur cet appareil.
            </div>
          ) : null}
          <div className="small2" style={{ opacity: 0.7 }}>
            Abonnement auto-renouvelable. Annulable à tout moment dans les réglages iOS. Le paiement est débité via
            l’Apple ID.
          </div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="row" style={{ gap: 8 }}>
              <button className="linkBtn" type="button" onClick={() => (onOpenTerms ? onOpenTerms() : null)}>
                Conditions
              </button>
              <button className="linkBtn" type="button" onClick={() => (onOpenPrivacy ? onOpenPrivacy() : null)}>
                Confidentialité
              </button>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button variant="ghost" onClick={onRestore}>
                Restaurer
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
