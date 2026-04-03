import React from "react";
import { UI_COPY } from "../ui/labels";
import { AppCard, AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";

export default function Legal({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <AppScreen
      data={safeData}
      pageId="legal"
      backgroundImage={backgroundImage}
      headerTitle="Conditions"
      headerSubtitle="Conditions d’utilisation"
    >
      <section className="mainPageSection">
        <SectionHeader title="Utilisation" subtitle="Cadre général de l’app." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
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
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Compte et données" subtitle="Accès, abonnement et stockage." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
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
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Support" subtitle="Besoin d’aide produit ou juridique ?" />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="GatePrimaryCtaRow">
            <GhostButton
              size="sm"
              onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
            >
              {UI_COPY.openSupport}
            </GhostButton>
          </div>
        </AppCard>
      </section>
    </AppScreen>
  );
}
