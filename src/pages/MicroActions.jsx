import React from "react";
import { AppBackButton, AppCard, AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";

export default function MicroActions({ onBack }) {
  return (
    <AppScreen
      pageId="micro-actions"
      headerTitle="Surface indisponible"
      headerSubtitle="Cette page n’est pas incluse dans la version TestFlight."
      headerRight={typeof onBack === "function" ? <AppBackButton onClick={onBack} /> : null}
    >
      <div className="mainPageStack microActionsPage">
        <section className="mainPageSection">
          <SectionHeader
            title="Retour à l’exécution"
            subtitle="Utilise Home, Planning, Objectifs ou Ajuster pour continuer ton système."
          />
          <div className="mainPageSectionBody">
            <AppCard>
              <div className="col gap12">
                <p className="appMetaText">
                  Cette surface est mise de côté pour garder l’app centrée sur les blocs, la récupération et les objectifs.
                </p>
                {typeof onBack === "function" ? (
                  <GhostButton type="button" onClick={onBack}>
                    Revenir
                  </GhostButton>
                ) : null}
              </div>
            </AppCard>
          </div>
        </section>
      </div>
    </AppScreen>
  );
}
