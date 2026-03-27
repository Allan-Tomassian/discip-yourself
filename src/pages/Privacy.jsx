import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { UI_COPY } from "../ui/labels";

export default function Privacy({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell data={safeData} pageId="legal" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Confidentialité</span>}
        subtitle={<span className="GatePageSubtitle">Comment tes données sont utilisées dans l’app.</span>}
      >
        <GateSection
          title="Données collectées"
          description="Données utiles au fonctionnement"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="small">Tes données de planification et de préférence servent uniquement à faire fonctionner l’app et à conserver ton contexte.</div>
          <div className="small">Elles sont stockées sur ton compte authentifié, avec un cache local pour garder l’expérience fluide.</div>
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
              {UI_COPY.openSupport}
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
