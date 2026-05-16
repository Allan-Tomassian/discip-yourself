import React, { useRef } from "react";
import { AppTextarea, GhostButton, PrimaryButton } from "../../shared/ui/app";
import { isFirstRunWhyReady } from "./firstRunModel";
import FirstRunCommandSurface from "./FirstRunCommandSurface";
import FirstRunWhyAiAssistant from "./FirstRunWhyAiAssistant";

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
  const textareaRef = useRef(null);

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
        <div className="firstRunWhyField">
          <div className="firstRunWhyFieldTop">
            <label className="appFieldLabel" htmlFor="first-run-why-input">
              TA RAISON PROFONDE
            </label>
            <FirstRunWhyAiAssistant
              value={safeValue}
              onChange={onChange}
              onFocusTextarea={() => textareaRef.current?.focus?.()}
            />
          </div>
          <AppTextarea
            ref={textareaRef}
            id="first-run-why-input"
            className="firstRunWhyInput"
            aria-invalid={Boolean(error)}
            data-testid="first-run-why-input"
            value={safeValue}
            rows={8}
            maxLength={WHY_MAX_LENGTH}
            placeholder="Écris pourquoi tu veux construire ce système..."
            onChange={(event) => onChange(event.target.value)}
          />
        </div>

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
