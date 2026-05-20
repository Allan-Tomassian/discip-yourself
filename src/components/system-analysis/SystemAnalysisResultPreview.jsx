import React from "react";
import { AlertTriangle, BrainCircuit, Clock3, Lock, Sparkles } from "lucide-react";
import { CommandCard, CommandCTA, CommandSectionHeader } from "../../shared/ui/command";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return safeString(value.title) || safeString(value.message) || safeString(value.reason) || safeString(value.focus);
  }
  return "";
}

function visibleItems(items, max = 2) {
  return safeArray(items).map(firstText).filter(Boolean).slice(0, max);
}

function resolveErrorCopy({ status, errorCode, message }) {
  if (status === "premium_required" || errorCode === "PREMIUM_REQUIRED") {
    return {
      tone: "ai",
      icon: Lock,
      label: "ANALYSE SYSTÈME",
      title: "Analyse système premium",
      subtitle: "Cette analyse avancée est réservée au plan Premium.",
    };
  }

  if (status === "ineligible" || errorCode === "SYSTEM_ANALYSIS_INELIGIBLE") {
    return {
      tone: "ai",
      icon: Sparkles,
      label: "ANALYSE SYSTÈME",
      title: "Analyse système",
      subtitle:
        safeString(message) ||
        "Continue à exécuter tes blocs pendant quelques jours. L’analyse devient utile quand elle peut lire ton vrai comportement.",
    };
  }

  if (errorCode === "QUOTA_EXCEEDED" || status === "quota_exhausted") {
    return {
      tone: "ai",
      icon: Sparkles,
      label: "ANALYSE SYSTÈME",
      title: "Analyse utilisée",
      subtitle: safeString(message) || "Quota mensuel utilisé.",
    };
  }

  if (status === "timeout" || errorCode === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT") {
    return {
      tone: "attention",
      icon: AlertTriangle,
      label: "ANALYSE SYSTÈME",
      title: "Analyse interrompue",
      subtitle: "L’analyse prend trop de temps. Réessaie plus tard.",
    };
  }

  if (errorCode === "INVALID_SYSTEM_ANALYSIS_RESPONSE") {
    return {
      tone: "attention",
      icon: AlertTriangle,
      label: "ANALYSE SYSTÈME",
      title: "Analyse non validée",
      subtitle: "L’analyse n’a pas pu être validée.",
    };
  }

  return {
    tone: "attention",
    icon: AlertTriangle,
    label: "ANALYSE SYSTÈME",
    title: "Analyse indisponible",
    subtitle: safeString(message) || "L’analyse n’a pas pu aboutir. Réessaie plus tard.",
  };
}

export default function SystemAnalysisResultPreview({
  status = "idle",
  result = null,
  errorCode = "",
  message = "",
  title = "",
  staleNote = "",
  onRetry,
  onOpenCorrections,
}) {
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <CommandCard
        tone="ai"
        className="systemAnalysisResultPreview systemAnalysisResultPreview--loading"
        density="compact"
        role="status"
        aria-live="polite"
        data-system-analysis-preview-state="loading"
      >
        <BrainCircuit size={18} strokeWidth={2} aria-hidden="true" />
        <CommandSectionHeader
          label="ANALYSE SYSTÈME"
          title="Analyse du système en cours…"
          subtitle="Lecture de tes blocs, frictions et progrès."
          tone="ai"
        />
      </CommandCard>
    );
  }

  if (status === "success" && result) {
    const invisibleFriction = visibleItems(result.invisibleFriction, 2);
    const recommendedCorrections = visibleItems(result.recommendedCorrections, 2);
    const next7DaysFocus = visibleItems(result.next7DaysFocus, 1);
    const dataLimitations = visibleItems(result.dataLimitations, 1);

    return (
      <CommandCard
        tone="ai"
        className="systemAnalysisResultPreview systemAnalysisResultPreview--success"
        density="compact"
        data-system-analysis-preview-state="success"
      >
        <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
        <div className="systemAnalysisResultPreview__body">
          <CommandSectionHeader
            label="ANALYSE SYSTÈME"
            title={safeString(title) || "Diagnostic profond terminé"}
            subtitle={safeString(result.executiveSummary)}
            tone="ai"
          />
          <div className="systemAnalysisResultPreview__compactSections">
            {invisibleFriction.length ? (
              <div className="systemAnalysisResultPreview__section">
                <span>Friction</span>
                <p>{invisibleFriction.join(" · ")}</p>
              </div>
            ) : null}
            {recommendedCorrections.length ? (
              <div className="systemAnalysisResultPreview__section">
                <span>Corrections</span>
                <p>{recommendedCorrections.join(" · ")}</p>
              </div>
            ) : null}
            {next7DaysFocus.length ? (
              <div className="systemAnalysisResultPreview__section systemAnalysisResultPreview__section--focus">
                <span>7 jours</span>
                <p>{next7DaysFocus[0]}</p>
              </div>
            ) : null}
          </div>
          {dataLimitations.length ? (
            <p className="systemAnalysisResultPreview__limitation">{dataLimitations[0]}</p>
          ) : null}
          {safeString(staleNote) ? (
            <p className="systemAnalysisResultPreview__staleNote">{safeString(staleNote)}</p>
          ) : null}
          <p className="systemAnalysisResultPreview__honestNote">
            Aucune modification n’a été appliquée.
          </p>
          {result.correctionDraft && typeof onOpenCorrections === "function" ? (
            <CommandCTA
              tone="ai"
              variant="secondary"
              className="systemAnalysisResultPreview__openCorrections"
              onClick={onOpenCorrections}
            >
              Voir les corrections proposées
            </CommandCTA>
          ) : (
            <span className="systemAnalysisResultPreview__disabledCta" aria-disabled="true">
              Corrections à valider bientôt
            </span>
          )}
        </div>
      </CommandCard>
    );
  }

  const copy = resolveErrorCopy({ status, errorCode, message });
  const Icon = copy.icon || AlertTriangle;
  return (
    <CommandCard
      tone={copy.tone}
      className={`systemAnalysisResultPreview systemAnalysisResultPreview--${status || "error"}`}
      density="compact"
      role={copy.tone === "attention" ? "alert" : "status"}
      data-system-analysis-preview-state={status || "error"}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      <div className="systemAnalysisResultPreview__body">
        <CommandSectionHeader
          label={copy.label}
          title={copy.title}
          subtitle={copy.subtitle}
          tone={copy.tone}
        />
        {typeof onRetry === "function" && status !== "ineligible" && status !== "premium_required" ? (
          <CommandCTA tone={copy.tone} variant="secondary" onClick={onRetry}>
            Réessayer
          </CommandCTA>
        ) : null}
      </div>
    </CommandCard>
  );
}
