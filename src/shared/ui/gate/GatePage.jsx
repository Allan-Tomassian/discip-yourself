import React from "react";
import { GateHeader, GatePanel } from "./Gate";
import "./gatePage.css";

export default function GatePage({ title, subtitle, actions = null, className = "", children }) {
  return (
    <div className={`gatePageRoot${className ? ` ${className}` : ""}`}>
      <GatePanel className="gatePagePanel GateMainSection GateSurfacePremium GateCardPremium">
        <GateHeader title={title} subtitle={subtitle} actions={actions} className="gatePageHeader" />
        <div className="gatePageContent">{children}</div>
      </GatePanel>
    </div>
  );
}
