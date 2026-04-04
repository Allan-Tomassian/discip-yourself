import React from "react";
import { UI_COPY } from "../ui/labels";
import { AppActionRow, AppInlineMetaCard, AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";

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
        <div className="mainPageSectionBody">
          <div className="col gap12">
            <AppInlineMetaCard title="Cadre produit">
              <div className="appMetaText">
                Discip Yourself t’aide à structurer, planifier et exécuter ce qui compte.
              </div>
            </AppInlineMetaCard>
            <AppInlineMetaCard title="Responsabilité">
              <div className="appMetaText">
                Tu restes responsable des décisions prises et de l’usage des recommandations proposées.
              </div>
            </AppInlineMetaCard>
          </div>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Compte et données" subtitle="Accès, abonnement et stockage." />
        <div className="mainPageSectionBody">
          <div className="col gap12">
            <AppInlineMetaCard title="Accès">
              <div className="appMetaText">
                Certaines fonctions nécessitent un compte actif ou un abonnement Premium.
              </div>
            </AppInlineMetaCard>
            <AppInlineMetaCard title="Stockage">
              <div className="appMetaText">
                Les données utiles au fonctionnement sont stockées sur ton compte et dans le cache local de l’app.
              </div>
            </AppInlineMetaCard>
          </div>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Support" subtitle="Besoin d’aide produit ou juridique ?" />
        <div className="mainPageSectionBody">
          <AppActionRow>
            <GhostButton
              size="sm"
              onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
            >
              {UI_COPY.openSupport}
            </GhostButton>
          </AppActionRow>
        </div>
      </section>
    </AppScreen>
  );
}
