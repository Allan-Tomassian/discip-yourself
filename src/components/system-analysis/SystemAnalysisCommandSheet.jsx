import React from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  ClipboardList,
  Lock,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { AppSheet } from "../../shared/ui/app";
import { CommandCard, CommandCTA, CommandSectionHeader } from "../../shared/ui/command";
import SystemAnalysisCorrectionReview from "./SystemAnalysisCorrectionReview";

const READ_ITEMS = [
  { label: "Objectifs", description: "Tes objectifs et priorités", Icon: Target },
  { label: "Planning", description: "Tes blocs et créneaux", Icon: CalendarDays },
  { label: "Sessions", description: "Ton exécution et tes reports", Icon: ClipboardList },
  { label: "Frictions", description: "Interruptions et blocages", Icon: CircleDot },
  { label: "Progression", description: "Tes tendances et résultats", Icon: BrainCircuit },
];

const LIMITED_DETECTIONS = [
  "Structure du planning",
  "Créneaux libres",
  "Objectifs sans blocs",
  "Prochain bloc manquant",
];

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

function resolveErrorCopy({ state, errorCode, message }) {
  if (state === "premium_required" || errorCode === "PREMIUM_REQUIRED") {
    return {
      Icon: Lock,
      tone: "ai",
      title: "Analyse système premium",
      subtitle: "Cette analyse avancée est réservée au plan Premium.",
      actionLabel: "Fermer",
    };
  }
  if (
    state === "quota_exhausted" ||
    errorCode === "QUOTA_EXCEEDED" ||
    errorCode === "SYSTEM_ANALYSIS_QUOTA_EXCEEDED"
  ) {
    return {
      Icon: Sparkles,
      tone: "ai",
      title: "Analyse utilisée",
      subtitle: safeString(message) || "Tu as utilisé tes analyses système du mois.",
      actionLabel: "Fermer",
    };
  }
  if (state === "timeout" || errorCode === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT") {
    return {
      Icon: AlertTriangle,
      tone: "attention",
      title: "Analyse interrompue",
      subtitle: "L’analyse prend trop de temps. Réessaie plus tard.",
      actionLabel: "Réessayer",
    };
  }
  if (errorCode === "INVALID_SYSTEM_ANALYSIS_RESPONSE") {
    return {
      Icon: AlertTriangle,
      tone: "attention",
      title: "Analyse non validée",
      subtitle: "L’analyse n’a pas pu être validée.",
      actionLabel: "Réessayer",
    };
  }
  return {
    Icon: AlertTriangle,
    tone: "attention",
    title: "Analyse indisponible",
    subtitle: safeString(message) || "L’analyse n’a pas pu aboutir. Réessaie plus tard.",
    actionLabel: "Réessayer",
  };
}

function buildDiagnosticRows(result) {
  const flaw =
    firstText(safeArray(result?.invisibleFriction)[0]) ||
    firstText(safeArray(result?.systemWeaknesses)[0]) ||
    firstText(safeArray(result?.recommendedCorrections)[0]) ||
    "Structure à clarifier";
  const risk =
    firstText(safeArray(result?.systemWeaknesses)[0]) ||
    firstText(safeArray(result?.invisibleFriction)[1]) ||
    "Risque encore limité par les données disponibles";
  const opportunity =
    firstText(safeArray(result?.strongestPatterns)[0]) ||
    firstText(safeArray(result?.recommendedCorrections)[0]) ||
    firstText(safeArray(result?.next7DaysFocus)[0]) ||
    "Prochaine correction à valider";
  return [
    { label: "Faille principale", value: flaw, tone: "attention" },
    { label: "Risque", value: risk, tone: "attention" },
    { label: "Opportunité", value: opportunity, tone: "execution" },
  ];
}

function CloseButton({ onClick, label = "Fermer", back = false }) {
  const Icon = back ? ChevronLeft : X;
  return (
    <button type="button" className="systemAnalysisCommandSheet__close" onClick={onClick} aria-label={label}>
      <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

function SheetChrome({ children, onClose, state }) {
  return (
    <AppSheet
      open
      onClose={onClose}
      maxWidth={520}
      className="systemAnalysisCommandSheet"
    >
      <div className="systemAnalysisCommandSheet__shell" data-system-analysis-command-sheet-state={state}>
        <div className="systemAnalysisCommandSheet__grid" aria-hidden="true" />
        <header className="systemAnalysisCommandSheet__topbar">
          <CloseButton onClick={onClose} />
          <span className="systemAnalysisCommandSheet__glyph" aria-hidden="true">
            <Sparkles size={22} strokeWidth={2.1} />
          </span>
          <span className="systemAnalysisCommandSheet__topbarSpacer" aria-hidden="true" />
        </header>
        {children}
      </div>
    </AppSheet>
  );
}

function IntroView({ limited = false, onClose, onLaunchAnalysis }) {
  return (
    <>
      <main className="systemAnalysisCommandSheet__body systemAnalysisCommandSheet__body--intro">
        <CommandSectionHeader
          label="ANALYSE SYSTÈME"
          title="Analyse système"
          subtitle="Lis ton système. Trouve les failles. Propose une correction."
          tone="ai"
          className="systemAnalysisCommandSheet__heroHeader"
        />
        <p className="systemAnalysisCommandSheet__lead">
          L’IA analyse tes objectifs, ton planning, tes sessions et tes frictions pour proposer une correction complète.
        </p>

        <section className="systemAnalysisCommandSheet__readBlock" aria-labelledby="system-analysis-read-title">
          <span id="system-analysis-read-title">Ce que l’analyse va lire</span>
          <div className="systemAnalysisCommandSheet__readList">
            {READ_ITEMS.map((item) => (
              <div key={item.label} className="systemAnalysisCommandSheet__readItem">
                {React.createElement(item.Icon, { size: 15, strokeWidth: 2.1, "aria-hidden": "true" })}
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        {limited ? (
          <>
            <CommandCard tone="attention" density="compact" className="systemAnalysisCommandSheet__limitedNote">
              <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
              <p>
                L’analyse sera structurelle : elle vérifiera ton planning, tes objectifs et les blocs manquants. La précision augmentera après quelques jours d’exécution.
              </p>
            </CommandCard>
            <section className="systemAnalysisCommandSheet__detectBlock">
              <span>Ce que l’IA pourra déjà détecter</span>
              <ul>
                {LIMITED_DETECTIONS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </>
        ) : null}
      </main>
      <footer className="systemAnalysisCommandSheet__footer">
        <CommandCTA tone="ai" variant="primary" onClick={onLaunchAnalysis}>
          Lancer l’analyse
        </CommandCTA>
        <CommandCTA tone="neutral" variant="secondary" onClick={onClose}>
          Fermer
        </CommandCTA>
      </footer>
    </>
  );
}

function DataLimitedView({ onClose }) {
  return (
    <>
      <main className="systemAnalysisCommandSheet__body systemAnalysisCommandSheet__body--dataLimited">
        <CommandSectionHeader
          label="ANALYSE SYSTÈME"
          title="Analyse système"
          subtitle="Données encore limitées."
          tone="ai"
          className="systemAnalysisCommandSheet__heroHeader systemAnalysisCommandSheet__heroHeader--dataLimited"
        />
        <p className="systemAnalysisCommandSheet__lead systemAnalysisCommandSheet__lead--dataLimited">
          L’analyse sera plus précise après quelques jours d’exécution. Elle peut déjà vérifier la structure de ton système.
        </p>
        <CommandCard tone="attention" density="compact" className="systemAnalysisCommandSheet__limitedNote">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          <p>
            L’analyse sera structurelle : elle vérifiera ton planning, tes objectifs et les blocs manquants. La précision augmentera après quelques jours d’exécution.
          </p>
        </CommandCard>
        <section className="systemAnalysisCommandSheet__detectBlock">
          <span>Ce que l’analyse pourra vérifier en premier</span>
          <ul>
            {LIMITED_DETECTIONS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </main>
      <footer className="systemAnalysisCommandSheet__footer">
        <CommandCTA tone="ai" variant="secondary" onClick={onClose}>
          Compris
        </CommandCTA>
      </footer>
    </>
  );
}

function LoadingView() {
  const steps = [
    ["Lecture du système", "Collecte de tes données et structure du plan."],
    ["Détection des failles", "Analyse des frictions, charges et déséquilibres."],
    ["Préparation des corrections", "Construction des ajustements les plus importants."],
  ];
  return (
    <main className="systemAnalysisCommandSheet__body systemAnalysisCommandSheet__body--loading">
      <CommandSectionHeader
        label="LECTURE DU SYSTÈME"
        title="Analyse du système en cours…"
        subtitle="Lecture de tes blocs, frictions et progrès."
        tone="ai"
        className="systemAnalysisCommandSheet__heroHeader"
      />
      <div className="systemAnalysisCommandSheet__pulse" aria-hidden="true">
        <span />
      </div>
      <div className="systemAnalysisCommandSheet__steps">
        {steps.map(([title, text], index) => (
          <div key={title} className="systemAnalysisCommandSheet__step">
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <CommandCard tone="ai" density="compact" className="systemAnalysisCommandSheet__honestCard">
        <Lock size={15} strokeWidth={2} aria-hidden="true" />
        <p>Aucune modification ne sera appliquée sans validation.</p>
      </CommandCard>
    </main>
  );
}

function ResultReviewView({
  state,
  result,
  review,
  applicationPreview,
  applicationResult,
  staleNote = "",
  onSelectChange,
  onConfirmSelection,
}) {
  const rows = buildDiagnosticRows(result);
  const title = state === "latest_analysis" ? "Dernière analyse" : "Corrections proposées";
  const subtitle = state === "latest_analysis"
    ? "Ton dernier diagnostic reste disponible."
    : "L’IA a trouvé ce qui peut rendre ton système plus exécutable.";
  const limitation = visibleItems(result?.dataLimitations, 1)[0];
  return (
    <main className="systemAnalysisCommandSheet__body">
      <CommandSectionHeader
        label="DIAGNOSTIC & REVUE"
        title={title}
        subtitle={subtitle}
        tone="ai"
        className="systemAnalysisCommandSheet__heroHeader"
      />
      {safeString(result?.executiveSummary) ? (
        <p className="systemAnalysisCommandSheet__lead">{safeString(result.executiveSummary)}</p>
      ) : null}
      <section className="systemAnalysisCommandSheet__diagnosticPanel" aria-label="Diagnostic">
        <span>Diagnostic</span>
        {rows.map((row) => (
          <div key={row.label} className={`systemAnalysisCommandSheet__diagnosticRow is-${row.tone}`}>
            <small>{row.label}</small>
            <strong>{row.value}</strong>
          </div>
        ))}
      </section>
      {safeString(staleNote) ? <p className="systemAnalysisCommandSheet__mutedNote">{safeString(staleNote)}</p> : null}
      {limitation ? <p className="systemAnalysisCommandSheet__mutedNote">{limitation}</p> : null}
      <p className="systemAnalysisCommandSheet__honestLine">Rien n’est appliqué sans validation finale.</p>
      <SystemAnalysisCorrectionReview
        review={review}
        applicationPreview={applicationPreview}
        applicationResult={applicationResult}
        onSelectChange={onSelectChange}
        onConfirmSelection={onConfirmSelection}
        showHeader={false}
        honestNote="Rien n’est appliqué sans validation finale."
      />
    </main>
  );
}

function FinalConfirmationView({
  applicationPreview,
  applicationResult,
  onApplySelectedCorrections,
  onBackToCorrections,
}) {
  const previewItems = safeArray(applicationPreview?.selectedItems);
  const previewSummary = applicationPreview?.summary || {};
  const applyStatus = safeString(applicationResult?.status);
  const applyPending = applyStatus === "applying";
  const applyFailed = applyStatus === "error";
  return (
    <>
      <main className="systemAnalysisCommandSheet__body">
        <CommandSectionHeader
          label="CONFIRMATION"
          title="Validation finale"
          subtitle="Ces corrections vont modifier ton planning. Tu gardes le contrôle."
          tone="ai"
          className="systemAnalysisCommandSheet__heroHeader"
        />
        <section className="systemAnalysisCommandSheet__selectedPanel" aria-label="Corrections sélectionnées">
          <span>Corrections sélectionnées</span>
          {previewItems.length ? (
            previewItems.map((item) => (
              <div key={item.id} className="systemAnalysisCommandSheet__selectedItem">
                <CheckCircle2 size={16} strokeWidth={2.1} aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </div>
              </div>
            ))
          ) : (
            <p>Aucune correction prête sélectionnée.</p>
          )}
        </section>
        <CommandCard tone="attention" density="compact" className="systemAnalysisCommandSheet__limitedNote">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          <p>{previewSummary.willNotChange || "Les corrections à revoir ne seront pas appliquées."}</p>
        </CommandCard>
        <p className="systemAnalysisCommandSheet__honestLine">Aucune correction n’a encore été appliquée.</p>
        {applyFailed ? (
          <CommandCard tone="attention" density="compact" className="systemAnalysisCommandSheet__applyError" role="alert">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <p>{applicationResult?.message || "Les corrections n’ont pas pu être appliquées proprement."}</p>
          </CommandCard>
        ) : null}
      </main>
      <footer className="systemAnalysisCommandSheet__footer">
        <CommandCTA
          tone="execution"
          variant="primary"
          disabled={!applicationPreview?.ok || applyPending}
          onClick={onApplySelectedCorrections}
        >
          {applyPending ? "Application…" : "Appliquer les corrections"}
        </CommandCTA>
        <CommandCTA tone="neutral" variant="secondary" onClick={onBackToCorrections}>
          Retour aux corrections
        </CommandCTA>
      </footer>
    </>
  );
}

function AppliedSuccessView({ applicationResult, onClose }) {
  const appliedItems = safeArray(applicationResult?.result?.appliedItems);
  return (
    <>
      <main className="systemAnalysisCommandSheet__body">
        <CommandSectionHeader
          label="SYSTÈME AJUSTÉ"
          title="Corrections appliquées"
          subtitle="Ton système a été ajusté."
          tone="execution"
          className="systemAnalysisCommandSheet__heroHeader"
        />
        <div className="systemAnalysisCommandSheet__successMark" aria-hidden="true">
          <CheckCircle2 size={34} strokeWidth={2.1} />
        </div>
        <section className="systemAnalysisCommandSheet__selectedPanel systemAnalysisCommandSheet__selectedPanel--success">
          <span>Impact appliqué</span>
          <p>{applicationResult?.result?.summary?.message || "Les corrections sélectionnées ont été appliquées."}</p>
          {appliedItems.map((item) => (
            <div key={item.id} className="systemAnalysisCommandSheet__selectedItem">
              <CheckCircle2 size={16} strokeWidth={2.1} aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
            </div>
          ))}
        </section>
      </main>
      <footer className="systemAnalysisCommandSheet__footer">
        <CommandCTA tone="execution" variant="primary" onClick={onClose}>
          Retour à Ajuster
        </CommandCTA>
      </footer>
    </>
  );
}

function ErrorView({ state, errorCode, message, onClose, onRetry }) {
  const copy = resolveErrorCopy({ state, errorCode, message });
  const Icon = copy.Icon;
  const retryable = state === "timeout" || state === "error";
  return (
    <>
      <main className="systemAnalysisCommandSheet__body">
        <CommandSectionHeader
          label="ANALYSE SYSTÈME"
          title={copy.title}
          subtitle={copy.subtitle}
          tone={copy.tone}
          className="systemAnalysisCommandSheet__heroHeader"
        />
        <CommandCard tone={copy.tone} density="compact" className="systemAnalysisCommandSheet__statusCard">
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
          <p>{copy.subtitle}</p>
        </CommandCard>
      </main>
      <footer className="systemAnalysisCommandSheet__footer">
        <CommandCTA tone={copy.tone} variant="primary" onClick={retryable ? onRetry : onClose}>
          {copy.actionLabel}
        </CommandCTA>
        {retryable ? (
          <CommandCTA tone="neutral" variant="secondary" onClick={onClose}>
            Fermer
          </CommandCTA>
        ) : null}
      </footer>
    </>
  );
}

export default function SystemAnalysisCommandSheet({
  open = false,
  state = "intro",
  result = null,
  errorCode = "",
  message = "",
  staleNote = "",
  review = null,
  applicationPreview = null,
  applicationResult = null,
  onClose,
  onLaunchAnalysis,
  onSelectChange,
  onConfirmSelection,
  onBackToCorrections,
  onApplySelectedCorrections,
  limited = false,
} = {}) {
  if (!open) return null;

  let content;
  if (state === "data_limited") {
    content = <DataLimitedView onClose={onClose} />;
  } else if (state === "loading") {
    content = <LoadingView />;
  } else if (state === "result_review" || state === "latest_analysis") {
    content = (
      <ResultReviewView
        state={state}
        result={result}
        review={review}
        applicationPreview={applicationPreview}
        applicationResult={applicationResult}
        staleNote={staleNote}
        onSelectChange={onSelectChange}
        onConfirmSelection={onConfirmSelection}
      />
    );
  } else if (state === "final_confirmation") {
    content = (
      <FinalConfirmationView
        applicationPreview={applicationPreview}
        applicationResult={applicationResult}
        onApplySelectedCorrections={onApplySelectedCorrections}
        onBackToCorrections={onBackToCorrections}
      />
    );
  } else if (state === "applied_success") {
    content = <AppliedSuccessView applicationResult={applicationResult} onClose={onClose} />;
  } else if (
    state === "premium_required" ||
    state === "quota_exhausted" ||
    state === "timeout" ||
    state === "error"
  ) {
    content = (
      <ErrorView
        state={state}
        errorCode={errorCode}
        message={message}
        onClose={onClose}
        onRetry={onLaunchAnalysis}
      />
    );
  } else {
    content = <IntroView limited={limited} onClose={onClose} onLaunchAnalysis={onLaunchAnalysis} />;
  }

  return (
    <SheetChrome onClose={onClose} state={state}>
      {content}
    </SheetChrome>
  );
}
