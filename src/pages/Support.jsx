import React from "react";
import { SURFACE_LABELS, UI_COPY } from "../ui/labels";
import { AppCard, AppScreen, SectionHeader } from "../shared/ui/app";
import pkg from "../../package.json";

export default function Support({ data }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const version = pkg?.version || "0.0.0";

  return (
    <AppScreen
      data={safeData}
      pageId="support"
      backgroundImage={backgroundImage}
      headerTitle="Support"
      headerSubtitle="Aide, contact et réponses rapides."
    >
      <section className="mainPageSection">
        <SectionHeader title="Contact" subtitle="Réponse par email." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="GateInlineMetaCard col gap8">
            <div className="GateRoleCardTitle">Email</div>
            <div className="GateRoleHelperText">support@discip-yourself.app</div>
          </div>
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Questions fréquentes" subtitle="Les réponses utiles les plus courantes." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Comment récupérer un achat déjà payé ?</div>
              <div className="GateRoleHelperText">
                Ouvre {SURFACE_LABELS.subscription} puis appuie sur « {UI_COPY.restorePurchases} ».
              </div>
            </div>
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleCardTitle">Comment sauvegarder tes données ?</div>
              <div className="GateRoleHelperText">Ouvre Données puis exporte un fichier JSON.</div>
            </div>
          </div>
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Version" subtitle="Build actuelle." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="GateInlineMetaCard col gap8">
            <div className="GateRoleCardTitle">Version installée</div>
            <div className="GateRoleHelperText">{version}</div>
          </div>
        </AppCard>
      </section>
    </AppScreen>
  );
}
