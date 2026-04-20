import React from "react";
import { AppTextarea, FieldGroup, GhostButton, PrimaryButton } from "../../shared/ui/app";
import { isFirstRunWhyReady } from "./firstRunModel";
import FirstRunStepScreen from "./FirstRunStepScreen";

export default function FirstRunWhyScreen({
  data,
  value,
  error = "",
  onChange,
  onBack,
  onContinue,
}) {
  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-why"
      title="Pourquoi veux-tu te discipliner maintenant ?"
      subtitle="Une réponse courte mais honnête suffit. Elle servira à contextualiser la suite du flow."
      badge="2/7"
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!isFirstRunWhyReady(value)} onClick={onContinue}>
            Continuer
          </PrimaryButton>
        </>
      }
      bodyClassName="firstRunWhyBody"
    >
      <div className="firstRunWhyPanel">
        <p className="firstRunBodyLead">
          Ce texte sert de point de départ. Il n&apos;a pas besoin d&apos;être parfait, seulement vrai.
        </p>

        <FieldGroup label="Ton pourquoi" className="firstRunWhyField">
          <AppTextarea
            className="firstRunWhyInput"
            aria-invalid={Boolean(error)}
            data-testid="first-run-why-input"
            value={value}
            rows={8}
            placeholder="Pourquoi ce changement compte maintenant ?"
            onChange={(event) => onChange(event.target.value)}
          />
        </FieldGroup>

        <div className={`firstRunWhyHelper${error ? " is-error" : ""}`} role={error ? "alert" : undefined}>
          {error || "Exemple : reprendre le contrôle de mes semaines et arrêter de repousser mon projet."}
        </div>
      </div>
    </FirstRunStepScreen>
  );
}
