import React from "react";
import { GhostButton, PrimaryButton } from "../../shared/ui/app";
import CoachAssistIcon from "../../shared/ui/icons/CoachAssistIcon";

function TimingChip({ children }) {
  if (!children) return null;
  return <span className="sessionLaunchChip">{children}</span>;
}

function readStepPreview(step) {
  if (!step || typeof step !== "object") return "";
  if (typeof step.purpose === "string" && step.purpose.trim()) return step.purpose.trim();
  if (typeof step.successCue === "string" && step.successCue.trim()) return step.successCue.trim();
  const firstItem = Array.isArray(step.items) ? step.items.find((item) => item?.guidance) : null;
  return typeof firstItem?.guidance === "string" ? firstItem.guidance.trim() : "";
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
          <span className="sessionLaunchPreparingIcon">
            <CoachAssistIcon size={26} />
          </span>
        </div>
        <div className="sessionLaunchPreparingTitle">Préparation en cours</div>
        <div className="sessionLaunchPreparingMeta">{title}</div>
      </div>
    );
  }

  if (phase === "plan_ready") {
    return (
      <div className="sessionLaunchViewStack sessionLaunchViewStack--plan" data-testid="session-launch-plan-ready">
        <div className="sessionLaunchHero sessionLaunchHero--plan">
          <div className="sessionLaunchSectionEyebrow sessionLaunchSectionEyebrow--withIcon">
            <CoachAssistIcon className="sessionLaunchEyebrowIcon" size={14} />
            <span>Plan prêt</span>
          </div>
          <div className="sessionLaunchHeroMeta">{title}</div>
        </div>
        <div className="sessionLaunchCard sessionLaunchCard--plan">
          <div className="sessionLaunchPlanList">
            {steps.map((step, index) => (
              <div key={step.id || `${step.label}-${index}`} className="sessionLaunchPlanStep">
                <div className="sessionLaunchPlanIndex">{String(index + 1).padStart(2, "0")}</div>
                <div className="sessionLaunchPlanBody">
                  <div className="sessionLaunchPlanRow">
                    <div className="sessionLaunchPlanLabel">{step.label}</div>
                    <div className="sessionLaunchPlanMinutes">{step.minutes} min</div>
                  </div>
                  <div className="sessionLaunchPlanGuidance">{readStepPreview(step)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
    <div className="sessionLaunchViewStack sessionLaunchViewStack--ready" data-testid="session-launch-ready">
      <div className="sessionLaunchHero sessionLaunchHero--ready">
        <div className="sessionLaunchSectionEyebrow">Séance prête</div>
        <div className="sessionLaunchCategory">{categoryName || "Catégorie"}</div>
        <div className="sessionLaunchTitle">{title}</div>
        <div className="sessionLaunchChips">
          <TimingChip>{timingLabel}</TimingChip>
          <TimingChip>{durationLabel}</TimingChip>
        </div>
      </div>
      <div className="sessionLaunchCard sessionLaunchCard--ready">
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
            Session standard
          </PrimaryButton>
          <GhostButton type="button" className="sessionLaunchSecondary" onClick={onPrepareGuided}>
            <span className="sessionLaunchSecondaryInner">
              <CoachAssistIcon className="sessionLaunchSecondaryIcon" size={16} />
              <span>Aller plus loin</span>
            </span>
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
