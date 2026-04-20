import React from "react";
import { FeedbackMessage, GhostButton, PrimaryButton } from "../../shared/ui/app";
import AiPreparationShell from "../../shared/ui/ai/AiPreparationShell";
import CoachAssistIcon from "../../shared/ui/icons/CoachAssistIcon";
import FirstRunStepScreen from "./FirstRunStepScreen";

function resolveErrorMessage(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const probableCause = String(error?.probableCause || "").trim().toLowerCase();
  if (probableCause === "backend_waking") {
    return "Le service IA se réveille. Réessaie dans quelques secondes.";
  }
  if (code === "DISABLED" || code === "BACKEND_UNAVAILABLE" || code === "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE") {
    return "Le service IA n'est pas disponible pour le moment.";
  }
  if (code === "TIMEOUT") {
    return "La génération IA a pris trop de temps. Réessaie.";
  }
  if (code === "INVALID_RESPONSE") {
    return "Les plans générés n'ont pas pu être validés. Réessaie.";
  }
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") {
    return "La génération est temporairement limitée. Réessaie dans un instant.";
  }
  if (code === "AUTH_MISSING" || code === "AUTH_INVALID" || code === "UNAUTHORIZED") {
    return "La session a expiré. Recharge l'application puis relance la génération.";
  }
  if (code) {
    return "Le service IA a rencontré une erreur. Réessaie.";
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return "Impossible de préparer les plans pour le moment.";
}

const LOADING_STEPS = Object.freeze([
  "Synthèse de tes signaux utiles.",
  "Construction d'un plan tenable et d'un plan ambitieux.",
  "Préparation du comparatif avant l'ouverture automatique.",
]);

export default function FirstRunGenerateScreen({ data, isLoading, error, onBack, onRetry, goalLabel = "" }) {
  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-generate"
      title="Préparation des plans"
      subtitle=""
      badge="4/5"
      bodyClassName="firstRunGenerateBody"
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          {!isLoading && error ? <PrimaryButton onClick={onRetry}>Réessayer</PrimaryButton> : null}
        </>
      }
    >
      <div className="firstRunSectionStack firstRunGenerateStack">
        {isLoading ? (
          <AiPreparationShell
            dataTestId="first-run-generate-loading"
            title="Préparation premium en cours"
            meta={goalLabel ? `Cap: ${goalLabel}` : "Deux plans hebdomadaires sont en cours de préparation."}
            detail="Le comparatif s'ouvrira automatiquement dès que les deux plans sont prêts."
            icon={<CoachAssistIcon size={20} />}
            steps={LOADING_STEPS}
          />
        ) : (
          <div className="firstRunGenerateErrorCard" data-testid="first-run-generate-error">
            <div className="firstRunGenerateErrorTitle">Préparation interrompue</div>
            <FeedbackMessage tone="error">{resolveErrorMessage(error)}</FeedbackMessage>
          </div>
        )}

        {error?.requestId ? (
          <div className="firstRunGenerateMeta" data-testid="first-run-generate-error-request-id">
            Référence: {error.requestId}
          </div>
        ) : null}
      </div>
    </FirstRunStepScreen>
  );
}
