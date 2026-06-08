import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { AppSheet } from "../../shared/ui/app";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "../../features/day-analysis/dayAnalysisTypes";
import {
  DAY_ANALYSIS_SHEET_STATE,
  buildDayAnalysisPreviewRows,
  getDayAnalysisActionBadge,
  getDayAnalysisActionIntent,
  getDayAnalysisActionTone,
  getDayAnalysisErrorCopy,
  getDayAnalysisPrimaryCta,
  isNoChangeDayAnalysisAction,
  normalizeDayAnalysisSheetState,
  resolveDayAnalysisSelectedAction,
} from "../../features/day-analysis/dayAnalysisSheetModel";
import heroBgUrl from "../../assets/ai/day-analysis-sheet-hero-bg.webp";
import "./dayAnalysis.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return "";
  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

function iconForAction(action) {
  const props = { size: 18, strokeWidth: 2.1, "aria-hidden": "true" };
  if (action?.type === DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH) return <BrainCircuit {...props} />;
  if (action?.type === DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING) return <CalendarDays {...props} />;
  if (action?.type === DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE) return <CheckCircle2 {...props} />;
  if (action?.targetType === DAY_ANALYSIS_TARGET_TYPE.PLANNING) return <CalendarDays {...props} />;
  if (action?.targetType === DAY_ANALYSIS_TARGET_TYPE.COACH) return <BrainCircuit {...props} />;
  if (action?.type === DAY_ANALYSIS_ACTION_TYPE.MOVE_LATER_TODAY) return <Clock3 {...props} />;
  if (action?.type === DAY_ANALYSIS_ACTION_TYPE.MOVE_TOMORROW) return <CalendarDays {...props} />;
  return <Sparkles {...props} />;
}

function closeWithCallback(onClose) {
  onClose?.();
}

export function DayAnalysisCloseButton({ onClose, disabled = false }) {
  return (
    <button
      type="button"
      className="dayAnalysisSheet__close"
      onClick={() => closeWithCallback(onClose)}
      disabled={disabled}
      aria-label="Fermer l’analyse IA du jour"
    >
      <X size={17} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

function SheetHero({ eyebrow = "Analyse IA", title, subtitle, copy, onClose, pending = false }) {
  return (
    <header
      className="dayAnalysisSheet__hero"
      style={{ "--day-analysis-hero-bg": `url(${heroBgUrl})` }}
      data-hero-asset="day-analysis-sheet-hero-bg.webp"
    >
      <div className="dayAnalysisSheet__heroMedia" aria-hidden="true" />
      <div className="dayAnalysisSheet__heroOverlay" aria-hidden="true" />
      <div className="dayAnalysisSheet__topbar">
        <span className="dayAnalysisSheet__glyph" aria-hidden="true">
          <Sparkles size={20} strokeWidth={2.1} />
        </span>
        <DayAnalysisCloseButton onClose={onClose} disabled={pending} />
      </div>
      <div className="dayAnalysisSheet__heroCopy">
        <p className="dayAnalysisSheet__eyebrow">{eyebrow}</p>
        <h2 id="day-analysis-sheet-title">{title}</h2>
        {subtitle ? <p className="dayAnalysisSheet__subtitle">{subtitle}</p> : null}
        {copy ? <p className="dayAnalysisSheet__heroText">{copy}</p> : null}
      </div>
    </header>
  );
}

function SheetFrame({ state, pending, onClose, children, hero }) {
  return (
    <AppSheet
      open
      onClose={pending ? undefined : onClose}
      maxWidth={540}
      placement="bottom"
      className="dayAnalysisSheet"
    >
      <div
        className="dayAnalysisSheet__shell"
        data-day-analysis-sheet-state={state}
        data-testid="day-analysis-sheet"
        aria-labelledby="day-analysis-sheet-title"
      >
        {hero}
        {children}
      </div>
    </AppSheet>
  );
}

function IntroView({ pending, onLaunch, onClose }) {
  const scopeRows = [
    ["Planning du jour", "Blocs et ordre prévu"],
    ["Prochain bloc", "Action immédiate"],
    ["Retards / blocs manqués", "Points à récupérer"],
    ["Temps restant", "Marge réelle aujourd’hui"],
    ["Objectif prioritaire", "Cap du système"],
  ];

  return (
    <>
      <main className="dayAnalysisSheet__body">
        <section className="dayAnalysisSheet__scopeGrid" aria-label="Ce que l’analyse lit">
          {scopeRows.map(([label, description]) => (
            <div key={label} className="dayAnalysisSheet__scopeRow">
              <span aria-hidden="true">
                {label === "Temps restant" ? <Clock3 size={17} strokeWidth={2.1} /> :
                  label === "Objectif prioritaire" ? <Target size={17} strokeWidth={2.1} /> :
                  <ClipboardList size={17} strokeWidth={2.1} />}
              </span>
              <div>
                <strong>{label}</strong>
                <small>{description}</small>
              </div>
            </div>
          ))}
        </section>
      </main>
      <footer className="dayAnalysisSheet__footer">
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--primary"
          onClick={() => onLaunch?.()}
          disabled={pending}
        >
          <Sparkles size={16} strokeWidth={2.1} aria-hidden="true" />
          Lancer l’analyse
        </button>
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--ghost"
          onClick={() => closeWithCallback(onClose)}
          disabled={pending}
        >
          Fermer
        </button>
      </footer>
    </>
  );
}

function LoadingView() {
  const steps = [
    "Lecture du jour",
    "Détection du point à corriger",
    "Préparation de l’action",
  ];
  return (
    <main className="dayAnalysisSheet__body dayAnalysisSheet__body--loading" role="status" aria-live="polite">
      <div className="dayAnalysisSheet__signal" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="dayAnalysisSheet__steps" aria-label="Progression de l’analyse">
        {steps.map((step, index) => (
          <div key={step} className="dayAnalysisSheet__step">
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>
      <p className="dayAnalysisSheet__safeNote">Aucune modification ne sera appliquée sans validation.</p>
    </main>
  );
}

function ActionBadge({ action }) {
  return (
    <span className={cx("dayAnalysisSheet__badge", `is-${getDayAnalysisActionTone(action)}`)}>
      {getDayAnalysisActionBadge(action)}
    </span>
  );
}

function TargetSummary({ action }) {
  const preview = action?.preview && typeof action.preview === "object" ? action.preview : {};
  const summary =
    safeString(preview.targetTitle) ||
    safeString(preview.occurrenceTitle) ||
    safeString(preview.actionTitle) ||
    safeString(preview.title) ||
    safeString(action?.targetId);
  if (!summary) return null;
  return <p className="dayAnalysisSheet__target">Cible : {summary}</p>;
}

export function DayAnalysisActionCard({ action, compact = false, onClick, selected = false, disabled = false }) {
  if (!action) return null;
  const clickable = typeof onClick === "function";
  const Tag = clickable ? "button" : "article";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      className={cx(
        "dayAnalysisSheet__actionCard",
        compact && "dayAnalysisSheet__actionCard--compact",
        selected && "is-selected",
        `is-${getDayAnalysisActionTone(action)}`
      )}
      onClick={clickable ? () => onClick(action) : undefined}
      disabled={clickable ? disabled : undefined}
      data-day-analysis-action-id={action.id}
    >
      <span className="dayAnalysisSheet__actionIcon" aria-hidden="true">
        {iconForAction(action)}
      </span>
      <span className="dayAnalysisSheet__actionText">
        <span className="dayAnalysisSheet__actionHeader">
          <strong>{action.label}</strong>
          <ActionBadge action={action} />
        </span>
        <span>{action.description}</span>
        {!compact ? <TargetSummary action={action} /> : null}
      </span>
      {clickable ? <ArrowRight size={17} strokeWidth={2.1} aria-hidden="true" /> : null}
    </Tag>
  );
}

function EvidenceList({ diagnosis }) {
  const evidence = safeArray(diagnosis?.evidence).slice(0, 3).filter(Boolean);
  if (!evidence.length) return null;
  return (
    <ul className="dayAnalysisSheet__evidence" aria-label="Éléments observés">
      {evidence.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function ResultView({
  result,
  pending,
  onClose,
  onSelectAction,
  onPrepareValidation,
  onOpenCoach,
  onOpenPlanning,
}) {
  const recommended = result?.recommendedAction || null;
  const alternatives = safeArray(result?.alternatives).slice(0, 2);
  const diagnosis = result?.diagnosis || {};
  const confidence = formatConfidence(diagnosis.confidence);
  const cta = getDayAnalysisPrimaryCta(recommended);

  const handlePrimary = () => {
    const intent = getDayAnalysisActionIntent(recommended);
    if (intent === "close") return closeWithCallback(onClose);
    if (intent === "open_coach") return onOpenCoach?.(recommended);
    if (intent === "open_planning") return onOpenPlanning?.(recommended);
    return onPrepareValidation?.(recommended);
  };

  return (
    <>
      <main className="dayAnalysisSheet__body">
        <section className="dayAnalysisSheet__diagnosis" aria-labelledby="day-analysis-diagnosis-title">
          <div className="dayAnalysisSheet__sectionTitle">
            <span>Aujourd’hui, le point à corriger</span>
            {confidence ? <small>Confiance {confidence}</small> : null}
          </div>
          <h3 id="day-analysis-diagnosis-title">{diagnosis.title}</h3>
          <p>{diagnosis.explanation}</p>
          <EvidenceList diagnosis={diagnosis} />
        </section>

        <section className="dayAnalysisSheet__actionBlock" aria-labelledby="day-analysis-action-title">
          <div className="dayAnalysisSheet__sectionTitle">
            <span id="day-analysis-action-title">Action recommandée</span>
          </div>
          <DayAnalysisActionCard action={recommended} />
        </section>

        {alternatives.length ? (
          <section className="dayAnalysisSheet__alternatives" aria-label="Options secondaires">
            <div className="dayAnalysisSheet__sectionTitle">
              <span>Options secondaires</span>
            </div>
            {alternatives.map((action) => (
              <DayAnalysisActionCard
                key={action.id}
                action={action}
                compact
                onClick={onSelectAction}
                disabled={pending}
              />
            ))}
          </section>
        ) : null}

        <p className="dayAnalysisSheet__safeNote">Rien n’est appliqué sans validation.</p>
      </main>
      <footer className="dayAnalysisSheet__footer">
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--primary"
          onClick={handlePrimary}
          disabled={pending || !recommended}
        >
          {cta}
        </button>
      </footer>
    </>
  );
}

function NoChangeView({ result, onClose }) {
  const evidence = safeArray(result?.diagnosis?.evidence).slice(0, 2);
  return (
    <>
      <main className="dayAnalysisSheet__body">
        <section className="dayAnalysisSheet__diagnosis dayAnalysisSheet__diagnosis--calm">
          <h3>Rien à corriger maintenant</h3>
          <p>Ta journée est assez claire pour continuer.</p>
          {evidence.length ? (
            <ul className="dayAnalysisSheet__evidence" aria-label="Éléments observés">
              {evidence.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          ) : null}
        </section>
      </main>
      <footer className="dayAnalysisSheet__footer">
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--primary"
          onClick={() => closeWithCallback(onClose)}
        >
          Retour à Home
        </button>
      </footer>
    </>
  );
}

function ConfirmationView({ action, pending, onBackToResult, onConfirmApply }) {
  const previewRows = buildDayAnalysisPreviewRows(action);
  return (
    <>
      <main className="dayAnalysisSheet__body">
        <section className="dayAnalysisSheet__confirmPanel" aria-labelledby="day-analysis-confirm-title">
          <span className="dayAnalysisSheet__confirmIcon" aria-hidden="true">
            <AlertTriangle size={21} strokeWidth={2.1} />
          </span>
          <div>
            <h3 id="day-analysis-confirm-title">Validation finale</h3>
            <p>Cette correction modifiera ta journée. Tu gardes le contrôle.</p>
          </div>
        </section>
        <section className="dayAnalysisSheet__previewPanel" aria-label="Aperçu du changement">
          {previewRows.length ? previewRows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="dayAnalysisSheet__previewRow">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          )) : (
            <div className="dayAnalysisSheet__previewRow">
              <span>Changement</span>
              <strong>{safeString(action?.description) || "Correction à confirmer"}</strong>
            </div>
          )}
        </section>
      </main>
      <footer className="dayAnalysisSheet__footer">
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--primary"
          onClick={() => onConfirmApply?.(action)}
          disabled={pending || !action}
        >
          Appliquer
        </button>
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--ghost"
          onClick={() => onBackToResult?.()}
          disabled={pending}
        >
          Retour à l’analyse
        </button>
      </footer>
    </>
  );
}

function SuccessView({ summary, onClose }) {
  return (
    <>
      <main className="dayAnalysisSheet__body" role="status" aria-live="polite">
        <section className="dayAnalysisSheet__successPanel">
          <span aria-hidden="true">
            <CheckCircle2 size={28} strokeWidth={2.1} />
          </span>
          <h3>Journée ajustée</h3>
          <p>La correction a été appliquée.</p>
          {safeString(summary) ? <strong>{summary}</strong> : null}
        </section>
      </main>
      <footer className="dayAnalysisSheet__footer">
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--success"
          onClick={() => closeWithCallback(onClose)}
        >
          Retour à Home
        </button>
      </footer>
    </>
  );
}

function ErrorView({ error, pending, onRetry, onClose }) {
  const copy = getDayAnalysisErrorCopy(error);
  return (
    <>
      <main className="dayAnalysisSheet__body" role="alert">
        <section className="dayAnalysisSheet__errorPanel">
          <span aria-hidden="true">
            <AlertTriangle size={22} strokeWidth={2.1} />
          </span>
          <p>{copy.copy}</p>
        </section>
      </main>
      <footer className="dayAnalysisSheet__footer">
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--primary"
          onClick={() => onRetry?.()}
          disabled={pending}
        >
          <RotateCcw size={16} strokeWidth={2.1} aria-hidden="true" />
          Réessayer
        </button>
        <button
          type="button"
          className="dayAnalysisSheet__button dayAnalysisSheet__button--ghost"
          onClick={() => closeWithCallback(onClose)}
          disabled={pending}
        >
          Fermer
        </button>
      </footer>
    </>
  );
}

function buildHeroProps({ state, result, error }) {
  if (state === DAY_ANALYSIS_SHEET_STATE.LOADING) {
    return {
      title: "Analyse de ta journée…",
      subtitle: "",
      copy: "Lecture des blocs, retards et options possibles.",
    };
  }
  if (state === DAY_ANALYSIS_SHEET_STATE.RESULT && isNoChangeDayAnalysisAction(result?.recommendedAction)) {
    return {
      title: "Analyse terminée",
      subtitle: "Aucune correction urgente.",
      copy: "Le jour reste assez clair pour avancer.",
    };
  }
  if (state === DAY_ANALYSIS_SHEET_STATE.RESULT) {
    return {
      title: "Analyse terminée",
      subtitle: "Une correction ciblée.",
      copy: "L’action proposée reste sous ton contrôle.",
    };
  }
  if (state === DAY_ANALYSIS_SHEET_STATE.CONFIRMATION) {
    return {
      title: "Validation finale",
      subtitle: "Tu gardes la main.",
      copy: "La correction ne sera appliquée qu’après confirmation.",
    };
  }
  if (state === DAY_ANALYSIS_SHEET_STATE.SUCCESS) {
    return {
      title: "Journée ajustée",
      subtitle: "Correction appliquée.",
      copy: "Ton planning peut reprendre avec une journée plus claire.",
    };
  }
  if (state === DAY_ANALYSIS_SHEET_STATE.ERROR) {
    const copy = getDayAnalysisErrorCopy(error);
    return {
      title: copy.title,
      subtitle: "Aucune modification appliquée.",
      copy: "",
    };
  }
  return {
    title: "Analyse IA du jour",
    subtitle: "Optimise uniquement ta journée.",
    copy: "L’IA lit ta journée et propose une correction ciblée.",
  };
}

export function DayAnalysisSheetContent({
  state,
  result,
  selectedActionId,
  pending = false,
  error = null,
  successSummary = "",
  onClose,
  onLaunch,
  onRetry,
  onSelectAction,
  onPrepareValidation,
  onConfirmApply,
  onBackToResult,
  onOpenCoach,
  onOpenPlanning,
}) {
  const resolvedState = normalizeDayAnalysisSheetState(state);
  const selectedAction = resolveDayAnalysisSelectedAction({ result, selectedActionId });

  if (resolvedState === DAY_ANALYSIS_SHEET_STATE.LOADING) return <LoadingView />;
  if (resolvedState === DAY_ANALYSIS_SHEET_STATE.RESULT && isNoChangeDayAnalysisAction(result?.recommendedAction)) {
    return <NoChangeView result={result} onClose={onClose} />;
  }
  if (resolvedState === DAY_ANALYSIS_SHEET_STATE.RESULT) {
    return (
      <ResultView
        result={result}
        pending={pending}
        onClose={onClose}
        onSelectAction={onSelectAction}
        onPrepareValidation={onPrepareValidation}
        onOpenCoach={onOpenCoach}
        onOpenPlanning={onOpenPlanning}
      />
    );
  }
  if (resolvedState === DAY_ANALYSIS_SHEET_STATE.CONFIRMATION) {
    return (
      <ConfirmationView
        action={selectedAction}
        pending={pending}
        onBackToResult={onBackToResult}
        onConfirmApply={onConfirmApply}
      />
    );
  }
  if (resolvedState === DAY_ANALYSIS_SHEET_STATE.SUCCESS) {
    return <SuccessView summary={successSummary} onClose={onClose} />;
  }
  if (resolvedState === DAY_ANALYSIS_SHEET_STATE.ERROR) {
    return <ErrorView error={error} pending={pending} onRetry={onRetry} onClose={onClose} />;
  }
  return <IntroView pending={pending} onLaunch={onLaunch} onClose={onClose} />;
}

export default function DayAnalysisSheet({
  open = false,
  state = DAY_ANALYSIS_SHEET_STATE.INTRO,
  result = null,
  selectedActionId = "",
  pending = false,
  error = null,
  successSummary = "",
  onClose,
  onLaunch,
  onRetry,
  onSelectAction,
  onPrepareValidation,
  onConfirmApply,
  onBackToResult,
  onOpenCoach,
  onOpenPlanning,
}) {
  if (!open) return null;
  const resolvedState = normalizeDayAnalysisSheetState(state);
  const heroProps = buildHeroProps({ state: resolvedState, result, error });
  return (
    <SheetFrame
      state={resolvedState}
      pending={pending}
      onClose={onClose}
      hero={<SheetHero {...heroProps} pending={pending} onClose={onClose} />}
    >
      <DayAnalysisSheetContent
        state={resolvedState}
        result={result}
        selectedActionId={selectedActionId}
        pending={pending}
        error={error}
        successSummary={successSummary}
        onClose={onClose}
        onLaunch={onLaunch}
        onRetry={onRetry}
        onSelectAction={onSelectAction}
        onPrepareValidation={onPrepareValidation}
        onConfirmApply={onConfirmApply}
        onBackToResult={onBackToResult}
        onOpenCoach={onOpenCoach}
        onOpenPlanning={onOpenPlanning}
      />
    </SheetFrame>
  );
}
