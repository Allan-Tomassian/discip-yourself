import React from "react";
import { AppCard, GhostButton, PrimaryButton } from "../../shared/ui/app";

function TimingChip({ children }) {
  if (!children) return null;
  return <span className="sessionLaunchChip">{children}</span>;
}

export default function SessionLaunchView({
  phase = "ready",
  categoryName = "",
  title = "Session",
  timingLabel = "",
  durationLabel = "",
  why = "",
  firstStep = "",
  steps = [],
  onStartStandard,
  onPrepareGuided,
  onLaunchGuided,
  onRevertToStandard,
}) {
  if (phase === "preparing") {
    return (
      <div
        className="sessionLaunchPreparing"
        role="status"
        aria-live="polite"
        data-testid="session-launch-preparing"
      >
        <div className="sessionLaunchPreparingOrb" aria-hidden="true">
          <span className="sessionLaunchPreparingRing" />
          <span className="sessionLaunchPreparingRing sessionLaunchPreparingRing--inner" />
        </div>
        <div className="sessionLaunchPreparingTitle">Préparation en cours</div>
        <div className="sessionLaunchPreparingMeta">{title}</div>
      </div>
    );
  }

  if (phase === "plan_ready") {
    return (
      <div className="sessionLaunchViewStack" data-testid="session-launch-plan-ready">
        <div className="sessionLaunchSectionEyebrow">Plan prêt</div>
        <AppCard className="sessionLaunchPlanCard" variant="elevated">
          <div className="sessionLaunchPlanList">
            {steps.map((step, index) => (
              <div key={step.id || `${step.label}-${index}`} className="sessionLaunchPlanStep">
                <div className="sessionLaunchPlanIndex">{String(index + 1).padStart(2, "0")}</div>
                <div className="sessionLaunchPlanBody">
                  <div className="sessionLaunchPlanRow">
                    <div className="sessionLaunchPlanLabel">{step.label}</div>
                    <div className="sessionLaunchPlanMinutes">{step.minutes} min</div>
                  </div>
                  <div className="sessionLaunchPlanGuidance">{step.guidance}</div>
                </div>
              </div>
            ))}
          </div>
        </AppCard>
        <div className="sessionLaunchFooter">
          <PrimaryButton type="button" className="sessionLaunchPrimary" onClick={onLaunchGuided}>
            Lancer la session
          </PrimaryButton>
          <button type="button" className="sessionLaunchTextAction" onClick={onRevertToStandard}>
            Revenir au standard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sessionLaunchViewStack" data-testid="session-launch-ready">
      <div className="sessionLaunchSectionEyebrow">Séance prête</div>
      <AppCard className="sessionLaunchReadyCard" variant="elevated">
        <div className="sessionLaunchCategory">{categoryName || "Catégorie"}</div>
        <div className="sessionLaunchTitle">{title}</div>
        <div className="sessionLaunchChips">
          <TimingChip>{timingLabel}</TimingChip>
          <TimingChip>{durationLabel}</TimingChip>
        </div>
        <div className="sessionLaunchBrief">
          {why ? (
            <div className="sessionLaunchBriefRow">
              <div className="sessionLaunchBriefLabel">Cap</div>
              <div className="sessionLaunchBriefText">{why}</div>
            </div>
          ) : null}
          {firstStep ? (
            <div className="sessionLaunchBriefRow">
              <div className="sessionLaunchBriefLabel">Départ</div>
              <div className="sessionLaunchBriefText">{firstStep}</div>
            </div>
          ) : null}
        </div>
        <div className="sessionLaunchActions">
          <PrimaryButton type="button" className="sessionLaunchPrimary" onClick={onStartStandard}>
            Commencer maintenant
          </PrimaryButton>
          <GhostButton type="button" className="sessionLaunchSecondary" onClick={onPrepareGuided}>
            Aller plus loin
          </GhostButton>
        </div>
      </AppCard>
    </div>
  );
}
