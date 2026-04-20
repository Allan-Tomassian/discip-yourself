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
      title="Pourquoi maintenant ?"
      subtitle="Quelques mots suffisent pour dire ce qui compte vraiment pour toi."
      badge="2/5"
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!isFirstRunWhyReady(value)} onClick={onContinue}>
            Continuer
          </PrimaryButton>
        </>
      }
      bodyClassName="firstRunWhyBody"
      footerSurfaceClassName="firstRunFooterSurface--quiet"
    >
      <div className="firstRunWhyPanel">
        <FieldGroup label="Ton pourquoi" className="firstRunWhyField">
          <AppTextarea
            className="firstRunWhyInput"
            aria-invalid={Boolean(error)}
            data-testid="first-run-why-input"
            value={value}
            rows={8}
            placeholder="Ex. reprendre le contrôle de mes semaines et relancer mon projet"
            onChange={(event) => onChange(event.target.value)}
          />
        </FieldGroup>

        <div className={`firstRunWhyHelper${error ? " is-error" : ""}`} role={error ? "alert" : undefined}>
          {error || "Pas besoin d’écrire beaucoup. Sois simplement honnête."}
        </div>
      </div>
    </FirstRunStepScreen>
  );
}
