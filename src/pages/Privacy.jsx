import React from "react";
import { UI_COPY } from "../ui/labels";
import { AppActionRow, AppInlineMetaCard, AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";

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
        <div className="mainPageSectionBody">
          <div className="col gap12">
            <AppInlineMetaCard title="Utilisation produit">
              <div className="appMetaText">
                Tes données de planification et de préférence servent uniquement à faire fonctionner l’app et à conserver ton contexte.
              </div>
            </AppInlineMetaCard>
            <AppInlineMetaCard title="Stockage">
              <div className="appMetaText">
                Elles sont stockées sur ton compte authentifié, avec un cache local pour garder l’expérience fluide.
              </div>
            </AppInlineMetaCard>
          </div>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Contact" subtitle="Questions RGPD ou données." />
        <div className="mainPageSectionBody">
          <div className="col gap12">
            <AppInlineMetaCard title="Email" text="support@discip-yourself.app" />
            <AppActionRow align="start">
              <GhostButton
                size="sm"
                onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
              >
                {UI_COPY.openSupport}
              </GhostButton>
            </AppActionRow>
          </div>
        </div>
      </section>
    </AppScreen>
  );
}
