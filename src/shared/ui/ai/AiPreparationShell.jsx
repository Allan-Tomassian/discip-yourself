import React from "react";
import "./aiPreparationShell.css";

function PreparationStep({ children }) {
  if (!children) return null;
  return (
    <div className="aiPreparationStep">
      <span className="aiPreparationStepDot" aria-hidden="true" />
      <span className="aiPreparationStepText">{children}</span>
    </div>
  );
}

export default function AiPreparationShell({
  dataTestId = "",
  title = "Preparation en cours",
  meta = "",
  detail = "",
  icon = null,
  steps = [],
  ...props
}) {
  const safeSteps = Array.isArray(steps) ? steps.filter(Boolean).slice(0, 4) : [];
  const resolvedTestId = dataTestId || props["data-testid"] || "";

  return (
    <div className="aiPreparationShell" role="status" aria-live="polite" data-testid={resolvedTestId || undefined}>
      <div className="aiPreparationOrb" aria-hidden="true">
        <span className="aiPreparationHalo aiPreparationHalo--outer" />
        <span className="aiPreparationHalo aiPreparationHalo--inner" />
        <span className="aiPreparationCore">
          <span className="aiPreparationIconBadge">{icon}</span>
        </span>
      </div>

      <div className="aiPreparationTitle">{title}</div>
      {meta ? <div className="aiPreparationMeta">{meta}</div> : null}
      {detail ? <div className="aiPreparationDetail">{detail}</div> : null}

      {safeSteps.length ? (
        <div className="aiPreparationCard">
          <div className="aiPreparationEyebrow">En cours</div>
          <div className="aiPreparationStepList">
            {safeSteps.map((step, index) => (
              <PreparationStep key={`${step}_${index}`}>{step}</PreparationStep>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
