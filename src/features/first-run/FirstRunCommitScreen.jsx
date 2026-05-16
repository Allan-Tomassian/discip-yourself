import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Circle,
  FolderCheck,
  LifeBuoy,
  ListChecks,
  RefreshCcw,
  ShieldCheck,
  Target,
  Wifi,
} from "lucide-react";
import { FeedbackMessage, GhostButton, PrimaryButton } from "../../shared/ui/app";
import FirstRunCommandSurface from "./FirstRunCommandSurface";

function renderPreviewLine(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  const prefix = [item.dayLabel, item.slotLabel].filter(Boolean).join(" • ");
  const suffix = [item.categoryLabel, Number(item.minutes) > 0 ? `${item.minutes} min` : ""]
    .filter(Boolean)
    .join(" • ");
  return [prefix, item.title, suffix].filter(Boolean).join(" — ");
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function countUniqueDates(occurrences) {
  if (!Array.isArray(occurrences)) return 0;
  return new Set(occurrences.map((occurrence) => String(occurrence?.date || "").trim()).filter(Boolean)).size;
}

function isRecommendedPlan(selectedPlan) {
  return selectedPlan?.id === "recommended" || selectedPlan?.variant === "recommended";
}

function buildCommitSummary(selectedPlan) {
  const draft = selectedPlan?.commitDraft || {};
  const categoryCount = countItems(draft.categories);
  const goalCount = countItems(draft.goals);
  const actionCount = countItems(draft.actions);
  const occurrenceCount = countItems(draft.occurrences);
  const dateCount = countUniqueDates(draft.occurrences);

  if (isRecommendedPlan(selectedPlan)) {
    return [
      {
        icon: Target,
        label: "Objectif",
        value: goalCount ? "1 objectif" : "À créer",
      },
      {
        icon: ListChecks,
        label: "Actions",
        value: actionCount ? `${actionCount} actions` : "Actions prêtes",
      },
      {
        icon: CalendarDays,
        label: "7 jours préparés",
        value: occurrenceCount ? `${occurrenceCount} blocs` : "Structure prête",
      },
      {
        icon: ShieldCheck,
        label: "Today prêt",
        value: "Premier bloc planifié",
      },
    ];
  }

  return [
    {
      icon: FolderCheck,
      label: "Catégories",
      value: categoryCount ? `${categoryCount}` : "À créer",
    },
    {
      icon: Target,
      label: "Objectifs / actions",
      value: goalCount || actionCount ? `${goalCount} / ${actionCount}` : "À configurer",
    },
    {
      icon: CalendarDays,
      label: "Planning 7 jours",
      value: occurrenceCount ? `${occurrenceCount} blocs · ${dateCount || 1} j` : "Structure prête",
    },
    {
      icon: ListChecks,
      label: "Suivi système",
      value: "Activé",
    },
  ];
}

const APPLYING_STEPS = Object.freeze([
  "Création des actions",
  "Organisation des 7 jours",
  "Préparation de Today",
  "Synchronisation",
]);

function CommitActivationSteps({ activeIndex = 2 }) {
  return (
    <div className="firstRunActivationStatusList firstRunActivationStatusList--commit">
      {APPLYING_STEPS.map((step, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "idle";
        const Icon = state === "done" ? Check : Circle;
        return (
          <div key={step} className={`firstRunActivationStatusStep is-${state}`}>
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            <span>{step}</span>
            <em>{state === "done" ? "Terminé" : state === "active" ? "En cours" : "En attente"}</em>
          </div>
        );
      })}
    </div>
  );
}

export default function FirstRunCommitScreen({
  data,
  selectedPlan,
  isApplying = false,
  errorCode = null,
  onBack,
  onContinue,
}) {
  const isFailed = Boolean(errorCode);
  const recommendedPlan = isRecommendedPlan(selectedPlan);
  const summary = buildCommitSummary(selectedPlan);
  const previewItems = Array.isArray(selectedPlan?.preview) ? selectedPlan.preview : [];

  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-commit"
      activeStep="commit"
      progressMode="activation"
      tone={isFailed ? "critical" : "execution"}
      className={[
        "firstRunCommandSurface--commit",
        isApplying ? "firstRunCommandSurface--commitApplying" : "",
        isFailed ? "firstRunCommandSurface--commitFailed" : "",
      ].filter(Boolean).join(" ")}
      bodyClassName="firstRunCommitBody firstRunActivationBody"
      eyebrow={isFailed ? "Activation échouée" : isApplying ? "Activation en cours" : "Active ton système"}
      title={
        isFailed ? "Échec de l’activation"
        : isApplying ? "Activation de ton système…"
        : recommendedPlan ? "Prêt à activer ton système"
        : "Prêt à activer ton plan"
      }
      subtitle={
        isFailed
          ? "Ton système n’a pas pu être activé. Tu peux relancer sans perdre tes réponses."
          : "Ce choix va créer ton vrai système d’exécution."
      }
      securityTitle={isFailed ? "Reprise possible" : "Activation sécurisée"}
      securityText={
        isFailed
          ? "Aucun statut terminé n’est marqué tant que l’activation échoue."
          : "Activation sécurisée. Tu pourras ajuster ton système après."
      }
      footer={
        <>
          <GhostButton disabled={isApplying} onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!selectedPlan || isApplying} onClick={onContinue}>
            {isApplying ? "Activation..." : isFailed ? "Réessayer" : "Activer mon plan"}
          </PrimaryButton>
        </>
      }
    >
      {isApplying ? (
        <div className="firstRunCommitApplyingPanel" data-testid="first-run-commit-applying">
          <div className="firstRunCommitValidationOrb" aria-hidden="true">
            <span />
            <Check size={42} strokeWidth={1.9} />
          </div>
          <CommitActivationSteps />
          <div className="firstRunActivationNote">Ne ferme pas l’app.</div>
        </div>
      ) : isFailed ? (
        <div className="firstRunCommitFailurePanel" data-testid="first-run-commit-failed">
          <div className="firstRunCriticalSignal" aria-hidden="true">
            <AlertTriangle size={36} strokeWidth={1.8} />
          </div>
          <div className="firstRunRecoveryCopy">
            <strong>Activation non appliquée.</strong>
            <span>Ton système n’a pas pu être activé. Tu peux relancer sans perdre tes réponses.</span>
            {errorCode ? <em>Code: {errorCode}</em> : null}
          </div>
          <div className="firstRunRecoveryActionRows">
            <div className="firstRunRecoveryActionRow">
              <RefreshCcw size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Réessayer</span>
            </div>
            <div className="firstRunRecoveryActionRow">
              <Wifi size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Vérifier la connexion</span>
            </div>
            <div className="firstRunRecoveryActionRow">
              <LifeBuoy size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Contacter le support</span>
            </div>
          </div>
        </div>
      ) : selectedPlan ? (
        <>
          <div className="firstRunSelectedPlanPanel firstRunCommitSelectedPanel">
            <div className="firstRunSelectedPlanHeader">
              <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>
                <strong>{selectedPlan.title}</strong>
                <span>{selectedPlan.summary || "Plan prêt à être activé dans ton vrai système."}</span>
              </span>
            </div>
          </div>

          <div className="firstRunCommitSummaryGrid">
            {summary.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="firstRunCommitSummaryTile">
                  <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>

          {previewItems.length ? (
            <div className="firstRunPlanPreviewList firstRunPlanPreviewList--compact">
              {previewItems.slice(0, 4).map((previewItem, index) => (
                <div key={`${selectedPlan.id}_${index}`} className="firstRunPlanPreviewItem">
                  {renderPreviewLine(previewItem)}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <FeedbackMessage tone="error">Choisis un plan avant de continuer.</FeedbackMessage>
      )}
    </FirstRunCommandSurface>
  );
}
