import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";

// TOUR MAP:
// - primary_action: choose a creation step (category/goal/action)
// - key_elements: back button, step cards, open buttons
// - optional_elements: none
export default function Create({ data, onBack, onOpenCategory, onOpenGoal, onOpenHabit, onUseNewFlow }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle={<span className="textAccent" data-tour-id="create-title">Créer</span>}
      headerSubtitle="Bibliothèque"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        {onBack ? (
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="create-back">
            ← Retour
          </Button>
        ) : null}
        <Card
          accentBorder
          style={{ cursor: "pointer" }}
          onClick={() => (typeof onOpenCategory === "function" ? onOpenCategory() : null)}
          role="button"
          tabIndex={0}
          data-tour-id="create-step-category"
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
                <span className="textAccent" style={{ opacity: 0.9 }}>
                  1.
                </span>{" "}
                Catégorie
              </div>
              <div className="small2">Créer une nouvelle catégorie.</div>
            </div>
            <Button
              variant="ghost"
              onClick={() => (typeof onOpenCategory === "function" ? onOpenCategory() : null)}
              data-tour-id="create-open-category"
            >
              Ouvrir
            </Button>
          </div>
        </Card>

        <Card
          accentBorder
          style={{ cursor: "pointer" }}
          onClick={() => (typeof onOpenGoal === "function" ? onOpenGoal() : null)}
          role="button"
          tabIndex={0}
          data-tour-id="create-step-goal"
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
                <span className="textAccent" style={{ opacity: 0.9 }}>
                  2.
                </span>{" "}
                Objectif
              </div>
              <div className="small2">Créer un objectif lié à une catégorie.</div>
            </div>
            <Button
              variant="ghost"
              onClick={() => (typeof onOpenGoal === "function" ? onOpenGoal() : null)}
              data-tour-id="create-open-goal"
            >
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
          data-tour-id="create-step-action"
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
                <span className="textAccent" style={{ opacity: 0.9 }}>
                  3.
                </span>{" "}
                Action
              </div>
              <div className="small2">Créer une action liée à un objectif.</div>
            </div>
            <Button
              variant="ghost"
              onClick={() => (typeof onOpenHabit === "function" ? onOpenHabit() : null)}
              data-tour-id="create-open-action"
            >
              Ouvrir
            </Button>
          </div>
        </Card>
        {typeof onUseNewFlow === "function" ? (
          <Card accentBorder>
            <div className="p18 row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="titleSm">Nouveau parcours</div>
                <div className="small2">Tester le nouveau flow guidé.</div>
              </div>
              <Button variant="ghost" onClick={onUseNewFlow}>
                Essayer
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </ScreenShell>
  );
}
