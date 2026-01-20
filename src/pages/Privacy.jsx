import React from "react";
import ScreenShell from "./_ScreenShell";
import { Card } from "../components/UI";

export default function Privacy({ data, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      headerTitle="Confidentialité"
      headerSubtitle="Politique de confidentialité"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <div className="titleSm">Données collectées</div>
            <div className="small">
              Les données de planification, sessions, notes et paramètres sont stockées localement sur l’appareil.
            </div>
            <div className="titleSm">Utilisation des données</div>
            <div className="small">
              Les données servent uniquement à l’expérience utilisateur (planning, rappels, statistiques).
            </div>
            <div className="titleSm">Stockage</div>
            <div className="small">
              Stockage local (aucun envoi automatique vers un serveur).
            </div>
            <div className="titleSm">Notifications</div>
            <div className="small">
              Les notifications sont optionnelles et peuvent être désactivées à tout moment.
            </div>
            <div className="titleSm">Contact</div>
            <div className="small">support@discip-yourself.app</div>
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
