import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection, GateSectionIntro } from "../shared/ui/gate/Gate";
import { UI_COPY } from "../ui/labels";

export default function Legal({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      backgroundImage={backgroundImage}
      headerTitle="Conditions"
      headerSubtitle="Conditions d’utilisation"
    >
      <section className="mainPageSection">
        <GateSectionIntro title="Utilisation" subtitle="Cadre général de l’app." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Cadre produit</div>
              <div className="GateRoleHelperText">
                Discip Yourself t’aide à structurer, planifier et exécuter ce qui compte.
              </div>
            </div>
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Responsabilité</div>
              <div className="GateRoleHelperText">
                Tu restes responsable des décisions prises et de l’usage des recommandations proposées.
              </div>
            </div>
          </div>
        </GateSection>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro title="Compte et données" subtitle="Accès, abonnement et stockage." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Accès</div>
              <div className="GateRoleHelperText">
                Certaines fonctions nécessitent un compte actif ou un abonnement Premium.
              </div>
            </div>
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Stockage</div>
              <div className="GateRoleHelperText">
                Les données utiles au fonctionnement sont stockées sur ton compte et dans le cache local de l’app.
              </div>
            </div>
          </div>
        </GateSection>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro title="Support" subtitle="Besoin d’aide produit ou juridique ?" />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
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
        </GateSection>
      </section>
    </ScreenShell>
  );
}
