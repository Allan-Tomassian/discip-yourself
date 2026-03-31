import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection, GateSectionIntro } from "../shared/ui/gate/Gate";
import { UI_COPY } from "../ui/labels";

export default function Privacy({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      backgroundImage={backgroundImage}
      headerTitle="Confidentialité"
      headerSubtitle="Comment tes données sont utilisées dans l’app."
    >
      <section className="mainPageSection">
        <GateSectionIntro title="Données collectées" subtitle="Données utiles au fonctionnement." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Utilisation produit</div>
              <div className="GateRoleHelperText">
                Tes données de planification et de préférence servent uniquement à faire fonctionner l’app et à conserver ton contexte.
              </div>
            </div>
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Stockage</div>
              <div className="GateRoleHelperText">
                Elles sont stockées sur ton compte authentifié, avec un cache local pour garder l’expérience fluide.
              </div>
            </div>
          </div>
        </GateSection>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro title="Contact" subtitle="Questions RGPD ou données." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Email</div>
              <div className="GateRoleHelperText">support@discip-yourself.app</div>
            </div>
            <div className="GatePrimaryCtaRow">
              <GateButton
                variant="ghost"
                size="sm"
                className="GatePressable"
                onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
              >
                {UI_COPY.openSupport}
              </GateButton>
            </div>
          </div>
        </GateSection>
      </section>
    </ScreenShell>
  );
}
