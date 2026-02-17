import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";

export default function Terms({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell data={safeData} pageId="legal" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Conditions</span>}
        subtitle={<span className="GatePageSubtitle">Conditions d’utilisation</span>}
      >
        <GateSection
          title="Utilisation"
          description="Version simplifiée (placeholder)"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">L’application fournit des outils de planification et de suivi personnel.</div>
          <div className="small">L’utilisateur reste responsable de l’usage et des décisions prises.</div>
        </GateSection>

        <GateSection
          title="Support"
          description="Besoin d’aide juridique ou produit ?"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="GatePrimaryCtaRow">
            <GateButton
              variant="ghost"
              className="GatePressable"
              onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
            >
              Ouvrir le support
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
