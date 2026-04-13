import React from "react";
import { GhostButton, PrimaryButton } from "../../shared/ui/app";
import CoachAssistIcon from "../../shared/ui/icons/CoachAssistIcon";

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
  degradedMessage = "",
  onStartStandard,
  onPrepareGuided,
  onRetryGuided,
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
          <span className="sessionLaunchPreparingHalo sessionLaunchPreparingHalo--outer" />
          <span className="sessionLaunchPreparingHalo sessionLaunchPreparingHalo--inner" />
          <span className="sessionLaunchPreparingCore">
            <span className="sessionAssistBadge sessionAssistBadge--orb">
              <CoachAssistIcon className="sessionLaunchPreparingIcon" size={20} />
            </span>
          </span>
        </div>
        <div className="sessionLaunchPreparingTitle">Préparation en cours</div>
        <div className="sessionLaunchPreparingMeta">{title}</div>
      </div>
    );
  }

  if (phase === "guided_degraded") {
    return (
      <div className="sessionLaunchViewStack sessionLaunchViewStack--ready" data-testid="session-launch-degraded">
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
            <div className="sessionLaunchBriefRow">
              <div className="sessionLaunchBriefLabel">Détail</div>
              <div className="sessionLaunchBriefText">
                {degradedMessage || "Impossible de préparer un plan détaillé pour le moment."}
              </div>
            </div>
          </div>
          <div className="sessionLaunchActions">
            <PrimaryButton type="button" className="sessionLaunchPrimary" onClick={onRetryGuided || onPrepareGuided}>
              Réessayer
            </PrimaryButton>
            <button type="button" className="sessionLaunchTextAction" onClick={onStartStandard}>
              Passer en standard
            </button>
          </div>
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
              <span className="sessionAssistBadge sessionAssistBadge--cta">
                <CoachAssistIcon className="sessionLaunchSecondaryIcon" size={13} />
              </span>
              <span>Aller plus loin</span>
            </span>
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
