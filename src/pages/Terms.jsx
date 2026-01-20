import React from "react";
import ScreenShell from "./_ScreenShell";
import { Card } from "../components/UI";

export default function Terms({ data, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      headerTitle="Conditions"
      headerSubtitle="Conditions d’utilisation"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <div className="titleSm">Utilisation</div>
            <div className="small">
              L’app fournit des outils de planification et de suivi. L’utilisateur reste responsable de son usage.
            </div>
            <div className="titleSm">Abonnement</div>
            <div className="small">
              Les fonctionnalités Premium débloquent des limites. L’abonnement peut être annulé à tout moment.
            </div>
            <div className="titleSm">Résiliation</div>
            <div className="small">
              La résiliation prend effet à la fin de la période de facturation en cours.
            </div>
            <div className="titleSm">Responsabilité</div>
            <div className="small">
              Discip-Yourself ne garantit pas de résultats. Les données sont conservées localement.
            </div>
          </div>
        </Card>
        {typeof onBack === "function" ? (
          <button className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </button>
        ) : null}
      </div>
    </ScreenShell>
  );
}
