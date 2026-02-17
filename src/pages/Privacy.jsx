import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";

export default function Privacy({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell data={safeData} pageId="legal" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Confidentialité</span>}
        subtitle={<span className="GatePageSubtitle">Politique de confidentialité</span>}
      >
        <GateSection
          title="Données collectées"
          description="Version simplifiée (placeholder)"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">Les données de planification et préférences sont utilisées pour faire fonctionner l’app.</div>
          <div className="small">Stockage principal côté utilisateur authentifié (Supabase + cache local).</div>
        </GateSection>

        <GateSection
          title="Contact"
          description="Questions RGPD / données"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">support@discip-yourself.app</div>
          <div className="GatePrimaryCtaRow">
            <GateButton
              variant="ghost"
              className="GatePressable"
              onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
            >
              Contacter le support
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
