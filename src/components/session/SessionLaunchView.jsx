import React from "react";
import { GhostButton, PrimaryButton } from "../../shared/ui/app";
import AiPreparationShell from "../../shared/ui/ai/AiPreparationShell";
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
  lockedPreview = null,
  onStartStandard,
  onPrepareGuided,
  onRetryGuided,
  onOpenLockedPaywall,
}) {
  if (phase === "preparing" || phase === "checking_access") {
    return (
      <AiPreparationShell
        data-testid={phase === "checking_access" ? "session-launch-checking" : "session-launch-preparing"}
        title={phase === "checking_access" ? "Vérification en cours" : "Préparation en cours"}
        meta={title}
        icon={<CoachAssistIcon className="sessionLaunchPreparingIcon" size={20} />}
      />
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

  if (phase === "access_error") {
    return (
      <div className="sessionLaunchViewStack sessionLaunchViewStack--ready" data-testid="session-launch-access-error">
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
              <div className="sessionLaunchBriefLabel">Accès</div>
              <div className="sessionLaunchBriefText">
                {degradedMessage || "Impossible de vérifier l’accès premium pour le moment."}
              </div>
            </div>
          </div>
          <div className="sessionLaunchActions">
            <PrimaryButton type="button" className="sessionLaunchPrimary" onClick={onRetryGuided || onPrepareGuided}>
              Réessayer
            </PrimaryButton>
            <button type="button" className="sessionLaunchTextAction" onClick={onStartStandard}>
              Session standard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "guided_locked") {
    const previewSteps = Array.isArray(lockedPreview?.steps) ? lockedPreview.steps : [];
    return (
      <div className="sessionLaunchViewStack sessionLaunchViewStack--ready" data-testid="session-launch-locked">
        <div className="sessionLaunchHero sessionLaunchHero--ready">
          <div className="sessionLaunchSectionEyebrow">Aperçu Premium</div>
          <div className="sessionLaunchCategory">{categoryName || "Catégorie"}</div>
          <div className="sessionLaunchTitle">{title}</div>
          <div className="sessionLaunchChips">
            <TimingChip>{timingLabel}</TimingChip>
            <TimingChip>{durationLabel || (Number.isFinite(lockedPreview?.totalDuration) ? `${lockedPreview.totalDuration} min` : "")}</TimingChip>
          </div>
        </div>
        <div className="sessionLaunchCard sessionLaunchCard--ready">
          <div className="sessionLaunchBrief">
            {lockedPreview?.objectiveWhy ? (
              <div className="sessionLaunchBriefRow">
                <div className="sessionLaunchBriefLabel">Objectif</div>
                <div className="sessionLaunchBriefText">{lockedPreview.objectiveWhy}</div>
              </div>
            ) : null}
            {lockedPreview?.premiumBenefit ? (
              <div className="sessionLaunchBriefRow">
                <div className="sessionLaunchBriefLabel">Avec Premium</div>
                <div className="sessionLaunchBriefText">{lockedPreview.premiumBenefit}</div>
              </div>
            ) : null}
            {previewSteps.length ? (
              <div className="sessionLaunchBriefRow">
                <div className="sessionLaunchBriefLabel">Phases</div>
                <div className="sessionLaunchBriefText">
                  {previewSteps
                    .map((step) => step?.label)
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            ) : null}
            {previewSteps[0]?.example ? (
              <div className="sessionLaunchBriefRow">
                <div className="sessionLaunchBriefLabel">Exemple</div>
                <div className="sessionLaunchBriefText">{previewSteps[0].example}</div>
              </div>
            ) : null}
          </div>
          <div className="sessionLaunchActions">
            <PrimaryButton type="button" className="sessionLaunchPrimary" onClick={onOpenLockedPaywall}>
              Découvrir Premium
            </PrimaryButton>
            <button type="button" className="sessionLaunchTextAction" onClick={onStartStandard}>
              Session standard
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
