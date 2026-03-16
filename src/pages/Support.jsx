import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import pkg from "../../package.json";

export default function Support({ data }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const version = pkg?.version || "0.0.0";

  return (
    <ScreenShell data={safeData} pageId="legal" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Support</span>}
        subtitle={<span className="GatePageSubtitle">Aide & contact</span>}
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
          title="FAQ"
          description="Questions fréquentes"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">Q: Comment restaurer mon achat ?</div>
          <div className="small2">R: Ouvre Abonnement puis clique sur “Restaurer”.</div>
          <div className="small">Q: Comment sauvegarder mes données ?</div>
          <div className="small2">R: Ouvre Données puis exporte en JSON.</div>
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
