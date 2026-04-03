import React from "react";
import { UI_COPY } from "../ui/labels";
import { AppCard, AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";

export default function Privacy({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <AppScreen
      data={safeData}
      pageId="privacy"
      backgroundImage={backgroundImage}
      headerTitle="Confidentialité"
      headerSubtitle="Comment tes données sont utilisées dans l’app."
    >
      <section className="mainPageSection">
        <SectionHeader title="Données collectées" subtitle="Données utiles au fonctionnement." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
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
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Contact" subtitle="Questions RGPD ou données." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Email</div>
              <div className="GateRoleHelperText">support@discip-yourself.app</div>
            </div>
            <div className="GatePrimaryCtaRow">
              <GhostButton
                size="sm"
                onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
              >
                {UI_COPY.openSupport}
              </GhostButton>
            </div>
          </div>
        </AppCard>
      </section>
    </AppScreen>
  );
}
