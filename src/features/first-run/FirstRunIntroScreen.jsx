import React from "react";
import { PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

export default function FirstRunIntroScreen({ data, onStart }) {
  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-intro"
      title="On prépare ta première vraie semaine"
      subtitle="Deux minutes pour poser ton pourquoi, quelques signaux réels, puis deux plans comparables."
      badge="1/7"
      footer={<PrimaryButton onClick={onStart}>Commencer</PrimaryButton>}
      bodyClassName="firstRunIntroBody"
    >
      <div className="firstRunIntroHero">
        <p className="firstRunIntroLead">
          L&apos;app ne démarre pas par une liste vide. Elle prépare un vrai point de départ à partir de ton contexte.
        </p>

        <div className="firstRunSupportList">
          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Ton pourquoi lance le cadre</div>
            <div className="firstRunSupportItemText">
              On commence par ce qui compte maintenant, puis on le traduit en semaine crédible.
            </div>
          </div>

          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Tes vraies contraintes sont prises en compte</div>
            <div className="firstRunSupportItemText">
              Objectif, capacité, moments indisponibles et créneaux favorables cadrent les deux plans.
            </div>
          </div>

          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Tu compares avant d’entrer</div>
            <div className="firstRunSupportItemText">
              Le flow prépare un plan tenable et un plan ambitieux avant l’arrivée dans l’app.
            </div>
          </div>
        </div>
      </div>
    </FirstRunStepScreen>
  );
}
