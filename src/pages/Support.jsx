import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { SURFACE_LABELS, UI_COPY } from "../ui/labels";
import pkg from "../../package.json";

export default function Support({ data }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const version = pkg?.version || "0.0.0";

  return (
    <ScreenShell data={safeData} pageId="legal" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Support</span>}
        subtitle={<span className="GatePageSubtitle">Aide, contact et réponses rapides.</span>}
      >
        <GateSection
          title="Contact"
          description="Réponse par email"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">support@discip-yourself.app</div>
        </GateSection>

        <GateSection
          title="Questions fréquentes"
          description="Les réponses utiles les plus courantes"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">Comment récupérer un achat déjà payé ?</div>
          <div className="small2">Ouvre {SURFACE_LABELS.subscription} puis appuie sur « {UI_COPY.restorePurchases} ».</div>
          <div className="small">Comment sauvegarder tes données ?</div>
          <div className="small2">Ouvre Données puis exporte un fichier JSON.</div>
        </GateSection>

        <GateSection
          title="Version"
          description="Build actuelle"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">{version}</div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
