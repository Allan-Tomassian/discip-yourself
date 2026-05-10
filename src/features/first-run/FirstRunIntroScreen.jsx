import React from "react";
import { PrimaryButton } from "../../shared/ui/app";
import FirstRunCommandSurface from "./FirstRunCommandSurface";

export default function FirstRunIntroScreen({ data, onStart }) {
  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-intro"
      activeStep="intro"
      eyebrow="Bienvenue dans ton système"
      title={
        <>
          Tu es ici pour <strong>reprendre le contrôle.</strong>
        </>
      }
      subtitle={
        <>
          Pas pour être motivé.
          <br />
          Pour construire une discipline qui tient.
        </>
      }
      footer={<PrimaryButton onClick={onStart}>Commencer</PrimaryButton>}
      bodyClassName="firstRunIntroBody"
    >
      <div className="firstRunIntroTransition" aria-hidden="true">
        <span>Chaos</span>
        <i />
        <span>Contrôle</span>
      </div>

      <div className="firstRunIntroContrastGrid">
        <div className="firstRunContrastPanel is-chaos">
          <div className="firstRunContrastTitle">Chaos</div>
          <ul>
            <li>Procrastination</li>
            <li>Manque d’énergie</li>
            <li>Zéro constance</li>
            <li>Objectifs flous</li>
          </ul>
        </div>

        <div className="firstRunContrastPanel is-control">
          <div className="firstRunContrastTitle">Contrôle</div>
          <ul>
            <li>Clarté</li>
            <li>Discipline</li>
            <li>Exécution</li>
            <li>Résultats</li>
          </ul>
        </div>
      </div>

      <div className="firstRunCommandInsight">
        <div className="firstRunCommandInsightIcon" aria-hidden="true" />
        <div>
          <strong>
            Ce <span className="firstRunAccentWord">système</span> devient ton avantage injuste.
          </strong>
          <span>Chaque décision que tu prends ici construit ta structure d’exécution.</span>
        </div>
      </div>
    </FirstRunCommandSurface>
  );
}
