import React from "react";
import { FeedbackMessage, GhostButton, PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

function resolveErrorMessage(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  if (code === "DISABLED" || code === "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE") {
    return "Le moteur de génération n'est pas disponible pour le moment.";
  }
  if (code === "TIMEOUT") {
    return "La génération a pris trop de temps. Réessaie.";
  }
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") {
    return "La génération est temporairement limitée. Réessaie dans un instant.";
  }
  if (code === "UNAUTHORIZED") {
    return "La session a expiré. Recharge l'application puis relance la génération.";
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return "Impossible de préparer les plans pour le moment.";
}

export default function FirstRunGenerateScreen({ data, isLoading, error, onBack, onRetry }) {
  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-generate"
      title="Préparation des plans"
      subtitle=""
      badge="4/7"
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          {!isLoading && error ? <PrimaryButton onClick={onRetry}>Réessayer</PrimaryButton> : null}
        </>
      }
    >
      <div className="firstRunSectionStack">
        <FeedbackMessage tone={isLoading ? "info" : "error"}>
          {isLoading ? "Le coach prépare tes deux plans hebdomadaires." : resolveErrorMessage(error)}
        </FeedbackMessage>

        {error?.requestId ? (
          <div className="firstRunGenerateMeta" data-testid="first-run-generate-error-request-id">
            Référence: {error.requestId}
          </div>
        ) : null}
      </div>
    </FirstRunStepScreen>
  );
}
