import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { UI_COPY } from "../ui/labels";

export default function Legal({ data, onOpenSupport }) {
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
          description="Cadre général de l’app"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="gatePageInlineList">
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleCardTitle">Cadre produit</div>
              <div className="GateRoleHelperText">Discip Yourself t’aide à structurer, planifier et exécuter ce qui compte.</div>
            </div>
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleCardTitle">Responsabilité</div>
              <div className="GateRoleHelperText">Tu restes responsable des décisions prises et de l’usage des recommandations proposées.</div>
            </div>
          </div>
        </GateSection>

        <GateSection
          title="Compte et données"
          description="Accès, abonnement et stockage"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="gatePageInlineList">
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleCardTitle">Accès</div>
              <div className="GateRoleHelperText">Certaines fonctions nécessitent un compte actif ou un abonnement Premium.</div>
            </div>
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleCardTitle">Stockage</div>
              <div className="GateRoleHelperText">Les données utiles au fonctionnement sont stockées sur ton compte et dans le cache local de l’app.</div>
            </div>
          </div>
        </GateSection>

        <GateSection
          title="Support"
          description="Besoin d’aide produit ou juridique ?"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
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
