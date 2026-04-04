import React from "react";
import { SURFACE_LABELS, UI_COPY } from "../ui/labels";
import { AppInlineMetaCard, AppScreen, SectionHeader } from "../shared/ui/app";
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
        <div className="mainPageSectionBody">
          <AppInlineMetaCard title="Email" text="support@discip-yourself.app" />
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Questions fréquentes" subtitle="Les réponses utiles les plus courantes." />
        <div className="mainPageSectionBody">
          <div className="col gap12">
            <AppInlineMetaCard title="Comment récupérer un achat déjà payé ?">
              <div className="appMetaText">
                Ouvre {SURFACE_LABELS.subscription} puis appuie sur « {UI_COPY.restorePurchases} ».
              </div>
            </AppInlineMetaCard>
            <AppInlineMetaCard title="Comment sauvegarder tes données ?" text="Ouvre Données puis exporte un fichier JSON." />
          </div>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Version" subtitle="Build actuelle." />
        <div className="mainPageSectionBody">
          <AppInlineMetaCard title="Version installée" text={version} />
        </div>
      </section>
    </AppScreen>
  );
}
