import React from "react";
import { AlertTriangle, Check, Circle, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { GhostButton, PrimaryButton } from "../../shared/ui/app";
import FirstRunCommandSurface from "./FirstRunCommandSurface";

function resolveErrorMessage(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const probableCause = String(error?.probableCause || "").trim().toLowerCase();
  if (probableCause === "backend_waking") {
    return "La préparation a été interrompue. Réessaie dans quelques secondes.";
  }
  if (code === "DISABLED" || code === "BACKEND_UNAVAILABLE" || code === "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE") {
    return "Le service de préparation n'est pas disponible pour le moment.";
  }
  if (code === "TIMEOUT") {
    return "La préparation a pris trop de temps. Réessaie.";
  }
  if (code === "INVALID_RESPONSE") {
    return "Le plan préparé n'a pas pu être validé. Réessaie.";
  }
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") {
    return "La génération est temporairement limitée. Réessaie dans un instant.";
  }
  if (code === "AUTH_MISSING" || code === "AUTH_INVALID" || code === "UNAUTHORIZED") {
    return "La session a expiré. Recharge l'application puis relance la génération.";
  }
  if (code) {
    return "La préparation a rencontré une erreur. Réessaie.";
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return "Impossible de préparer les plans pour le moment.";
}

const LOADING_STEPS = Object.freeze([
  "Analyse de tes signaux",
  "Construction des blocs",
  "Organisation des 7 jours",
  "Préparation de Today",
]);

function GenerateStatusList({ tone = "system", activeIndex = 1 }) {
  return (
    <div className={`firstRunActivationStatusList firstRunActivationStatusList--${tone}`}>
      {LOADING_STEPS.map((step, index) => {
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

export default function FirstRunGenerateScreen({ data, isLoading, error, onBack, onRetry, goalLabel = "", isAiRefining = false }) {
  const hasError = !isLoading && Boolean(error);

  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-generate"
      activeStep="generate"
      progressMode="activation"
      tone={hasError ? "critical" : "execution"}
      className={hasError ? "firstRunCommandSurface--generateError" : "firstRunCommandSurface--generate"}
      bodyClassName="firstRunGenerateBody firstRunActivationBody"
      eyebrow={hasError ? "Récupération" : "PRÉPARATION"}
      title={hasError ? "Préparation interrompue" : "Préparation de ton système"}
      subtitle={
        hasError
          ? "On garde le contrôle. Relance la génération quand le service répond."
          : isAiRefining ? "On affine ton plan à partir de tes signaux."
          : goalLabel
            ? `On construit ton plan de 7 jours à partir de tes signaux : ${goalLabel}`
            : "On construit ton plan de 7 jours à partir de tes signaux."
      }
      securityTitle={hasError ? "Reprise contrôlée" : "Système en préparation"}
      securityText={hasError ? "Tes réponses restent en place. Tu peux relancer sans les perdre." : "Ne ferme pas l’app. Le système prépare ta structure."}
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          {hasError ? <PrimaryButton onClick={onRetry}>Réessayer</PrimaryButton> : null}
        </>
      }
    >
      {hasError ? (
        <div className="firstRunGenerateRecovery" data-testid="first-run-generate-error">
          <div className="firstRunCriticalSignal" aria-hidden="true">
            <AlertTriangle size={34} strokeWidth={1.8} />
          </div>
          <div className="firstRunRecoveryCopy">
            <strong>Impossible de finaliser le plan.</strong>
            <span>{resolveErrorMessage(error)}</span>
          </div>
          <div className="firstRunRecoveryActionRows">
            <div className="firstRunRecoveryActionRow">
              <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Réessayer avec les mêmes signaux</span>
            </div>
            <div className="firstRunRecoveryActionRow">
              <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Tes réponses restent conservées pendant la reprise.</span>
            </div>
          </div>
          {error?.requestId ? (
            <div className="firstRunGenerateMeta" data-testid="first-run-generate-error-request-id">
              Référence: {error.requestId}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="firstRunGenerateChamber" data-testid="first-run-generate-loading" role="status" aria-live="polite">
          <div className="firstRunSystemChamber" aria-hidden="true">
            <span className="firstRunAiRing firstRunAiRing--outer" />
            <span className="firstRunAiRing firstRunAiRing--inner" />
            <span className="firstRunAiWave" />
            <span className="firstRunAiCore">
              <ShieldCheck size={44} strokeWidth={1.4} />
            </span>
          </div>
          <GenerateStatusList />
          <div className="firstRunActivationNote">Ne ferme pas l’app.</div>
        </div>
      )}
    </FirstRunCommandSurface>
  );
}
