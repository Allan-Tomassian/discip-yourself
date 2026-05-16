import React from "react";
import { AppTextarea, FieldGroup, GhostButton, PrimaryButton } from "../../shared/ui/app";
import { isFirstRunWhyReady } from "./firstRunModel";
import FirstRunCommandSurface from "./FirstRunCommandSurface";

const WHY_MAX_LENGTH = 1200;

export default function FirstRunWhyScreen({
  data,
  value,
  error = "",
  onChange,
  onBack,
  onContinue,
}) {
  const safeValue = String(value || "");

  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-why"
      activeStep="why"
      eyebrow="Ta raison"
      title="Pourquoi veux-tu créer ton système ?"
      subtitle={
        <>
          Rappelle-toi ce que tu veux reprendre en main.
          <br />
          C’est cette raison qui tiendra quand la motivation disparaît.
        </>
      }
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!isFirstRunWhyReady(value)} onClick={onContinue}>
            Continuer
          </PrimaryButton>
        </>
      }
      bodyClassName="firstRunWhyBody"
      className="firstRunCommandSurface--why"
    >
      <div className="firstRunWhyPanel">
        <FieldGroup label="TA RAISON PROFONDE" className="firstRunWhyField">
          <AppTextarea
            className="firstRunWhyInput"
            aria-invalid={Boolean(error)}
            data-testid="first-run-why-input"
            value={safeValue}
            rows={8}
            maxLength={WHY_MAX_LENGTH}
            placeholder="Écris pourquoi tu veux construire ce système..."
            onChange={(event) => onChange(event.target.value)}
          />
        </FieldGroup>

        <div className={`firstRunWhyMetaRow${error ? "" : " is-count-only"}`}>
          {error ? (
            <span className="firstRunWhyHelper is-error" role="alert">
              {error}
            </span>
          ) : null}
          <span className="firstRunCharacterCount">
            {safeValue.length} / {WHY_MAX_LENGTH}
          </span>
        </div>

        <div className="firstRunCommandInsight">
          <div className="firstRunCommandInsightIcon firstRunCommandInsightIcon--target" aria-hidden="true" />
          <div>
            <strong>Ton système doit servir une vraie raison.</strong>
            <span>La motivation baisse. Une raison claire reste.</span>
          </div>
        </div>
      </div>
    </FirstRunCommandSurface>
  );
}
