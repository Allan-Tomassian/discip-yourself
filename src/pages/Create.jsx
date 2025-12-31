import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";

export default function Create({ data, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle="Bibliothèque"
      backgroundImage={backgroundImage}
    >
      {onBack ? (
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
          <Button variant="ghost" onClick={onBack}>
            Retour
          </Button>
        </div>
      ) : null}

      <div className="col">
        <Card accentBorder style={{ marginBottom: 12 }}>
          <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="titleSm">Catégorie</div>
              <div className="small2">Bientôt disponible.</div>
            </div>
            <Button variant="ghost" disabled>
              Bientôt
            </Button>
          </div>
        </Card>

        <Card accentBorder style={{ marginBottom: 12 }}>
          <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="titleSm">Objectif</div>
              <div className="small2">Bientôt disponible.</div>
            </div>
            <Button variant="ghost" disabled>
              Bientôt
            </Button>
          </div>
        </Card>

        <Card accentBorder>
          <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="titleSm">Habitude</div>
              <div className="small2">Bientôt disponible.</div>
            </div>
            <Button variant="ghost" disabled>
              Bientôt
            </Button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
