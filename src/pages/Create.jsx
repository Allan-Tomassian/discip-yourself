import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";

export default function Create({ data, onBack, onOpenCategory, onOpenGoal, onOpenHabit }) {
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
        <Card
          accentBorder
          style={{ marginBottom: 12, cursor: "pointer" }}
          onClick={() => (typeof onOpenCategory === "function" ? onOpenCategory() : null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (typeof onOpenCategory === "function") onOpenCategory();
            }
          }}
        >
          <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="titleSm">
                <span style={{ opacity: 0.6 }}>1.</span> Catégorie
              </div>
              <div className="small2">Créer une nouvelle catégorie.</div>
            </div>
            <Button variant="ghost" onClick={() => (typeof onOpenCategory === "function" ? onOpenCategory() : null)}>
              Ouvrir
            </Button>
          </div>
        </Card>

        <Card
          accentBorder
          style={{ marginBottom: 12, cursor: "pointer" }}
          onClick={() => (typeof onOpenGoal === "function" ? onOpenGoal() : null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (typeof onOpenGoal === "function") onOpenGoal();
            }
          }}
        >
          <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="titleSm">
                <span style={{ opacity: 0.6 }}>2.</span> Objectif
              </div>
              <div className="small2">Créer un objectif lié à une catégorie.</div>
            </div>
            <Button variant="ghost" onClick={() => (typeof onOpenGoal === "function" ? onOpenGoal() : null)}>
              Ouvrir
            </Button>
          </div>
        </Card>

        <Card
          accentBorder
          style={{ cursor: "pointer" }}
          onClick={() => (typeof onOpenHabit === "function" ? onOpenHabit() : null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (typeof onOpenHabit === "function") onOpenHabit();
            }
          }}
        >
          <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="titleSm">
                <span style={{ opacity: 0.6 }}>3.</span> Habitude
              </div>
              <div className="small2">Créer une habitude liée à un objectif.</div>
            </div>
            <Button variant="ghost" onClick={() => (typeof onOpenHabit === "function" ? onOpenHabit() : null)}>
              Ouvrir
            </Button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
