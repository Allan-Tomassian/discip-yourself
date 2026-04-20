import React from "react";
import { PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

function resolveFirstRunGreetingName(data) {
  const profile = data && typeof data === "object" ? data.profile : null;
  const username = String(profile?.username || "").trim();
  if (username) return username;

  const fullName = String(profile?.full_name || "").trim();
  if (fullName) return fullName.split(/\s+/)[0];

  const name = String(profile?.name || "").trim();
  return name || "";
}

export default function FirstRunIntroScreen({ data, onStart }) {
  const greetingName = resolveFirstRunGreetingName(data);
  const title = greetingName ? `Bienvenue, ${greetingName}` : "Bienvenue";

  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-intro"
      title={title}
      subtitle="On pose l’essentiel pour préparer tes deux premiers plans."
      badge="1/5"
      footer={<PrimaryButton onClick={onStart}>Commencer</PrimaryButton>}
      bodyClassName="firstRunIntroBody"
      footerSurfaceClassName="firstRunFooterSurface--quiet"
    >
      <div className="firstRunIntroHero">
        <div className="firstRunIntroPoints">
          <div className="firstRunIntroPoint">
            <div className="firstRunIntroPointTitle">Ton pourquoi</div>
            <div className="firstRunIntroPointText">Ce qui compte pour toi maintenant.</div>
          </div>

          <div className="firstRunIntroPoint">
            <div className="firstRunIntroPointTitle">Tes signaux réels</div>
            <div className="firstRunIntroPointText">Objectif, capacité et contraintes utiles.</div>
          </div>

          <div className="firstRunIntroPoint">
            <div className="firstRunIntroPointTitle">Tes 2 plans</div>
            <div className="firstRunIntroPointText">Un plan tenable et un plan ambitieux à comparer.</div>
          </div>
        </div>
      </div>
    </FirstRunStepScreen>
  );
}
