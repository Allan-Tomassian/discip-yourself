import React from "react";
import { PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

export default function FirstRunDiscoveryScreen({ data, onComplete }) {
  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-discovery"
      title="Dernière étape avant l'app"
      subtitle="La découverte guidée finale arrivera dans le lot suivant. Ici on valide simplement la fin du first-run."
      badge="7/7"
      footer={<PrimaryButton onClick={onComplete}>Entrer dans l'app</PrimaryButton>}
      bodyClassName="firstRunDiscoveryBody"
    >
      <div className="firstRunDiscoveryHero">
        <p className="firstRunDiscoveryLead">
          Le flow est prêt. L&apos;entrée dans l&apos;app active basculera ensuite sur le peuplement produit des lots suivants.
        </p>

        <div className="firstRunSupportList">
          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Today sera la destination</div>
            <div className="firstRunSupportItemText">
              La sortie du flow bascule ensuite vers l&apos;app active. Le peuplement final arrive dans le prochain lot.
            </div>
          </div>

          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Reprise et routing déjà en place</div>
            <div className="firstRunSupportItemText">
              La state machine reste persistée, reprise après refresh et prise en compte par AuthGate et App.
            </div>
          </div>
        </div>
      </div>
    </FirstRunStepScreen>
  );
}
