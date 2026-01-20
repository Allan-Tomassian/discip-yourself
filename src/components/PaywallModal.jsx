import React from "react";
import { Button, Card } from "./UI";
import { getPlanLimits } from "../logic/entitlements";

export default function PaywallModal({ open, reason = "", onClose, onUpgrade, onRestore }) {
  if (!open) return null;
  const limits = getPlanLimits();

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <Card
        accentBorder
        className="reminderCard"
        style={{ maxWidth: 520, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p18 col" style={{ gap: 12 }}>
          <div className="titleSm">Passer Premium</div>
          <div className="small2" style={{ opacity: 0.8 }}>
            {reason || "Débloque toutes les fonctionnalités et enlève les limites."}
          </div>
          <div className="col" style={{ gap: 6 }}>
            <div className="small">Inclus :</div>
            <div className="small2">• Catégories illimitées</div>
            <div className="small2">• Objectifs illimités</div>
            <div className="small2">• Actions illimitées</div>
            <div className="small2">• Planning & historique complets</div>
            <div className="small2">• Export des données</div>
          </div>
          <div className="small2" style={{ opacity: 0.6 }}>
            Limites gratuites : {limits.categories} catégories · {limits.outcomes} objectifs · {limits.actions} actions
          </div>
          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <Button variant="ghost" onClick={onRestore}>
              Restaurer
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Plus tard
            </Button>
            <Button onClick={onUpgrade}>Passer Premium</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
