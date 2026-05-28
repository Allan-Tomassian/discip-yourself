import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Scissors,
  SkipForward,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AppSheet } from "../../shared/ui/app";
import { RECOVERY_OPTION_TYPE } from "../../features/recovery/recoveryTypes";
import {
  RECOVERY_OPTION_ACTION,
  RECOVERY_SHEET_STATE,
  buildRecoverySheetViewModel,
  getRecoveryOptionKind,
  getRecoveryOptionSelectionAction,
  getRecoveryOptionTone,
} from "../../features/recovery/recoverySheetViewModel";
import "./recovery.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function RecoveryOptionIcon({ type }) {
  const iconProps = { size: 18, strokeWidth: 2.1, "aria-hidden": "true" };
  if (type === RECOVERY_OPTION_TYPE.REDUCE_DURATION) return <Scissors {...iconProps} />;
  if (type === RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY) return <Clock3 {...iconProps} />;
  if (type === RECOVERY_OPTION_TYPE.MOVE_TOMORROW) return <CalendarDays {...iconProps} />;
  if (type === RECOVERY_OPTION_TYPE.CHOOSE_TIME) return <SlidersHorizontal {...iconProps} />;
  if (type === RECOVERY_OPTION_TYPE.SKIP_ONCE) return <SkipForward {...iconProps} />;
  if (type === RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP) return <BrainCircuit {...iconProps} />;
  if (type === RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL) return <CalendarDays {...iconProps} />;
  return <ArrowRight {...iconProps} />;
}

function optionPreviewText(option) {
  const description = safeString(option?.description);
  const preview = safeString(option?.preview?.summary);
  if (!preview || preview === description) return "";
  return preview;
}

export function RecoverySheetCloseButton({ disabled = false, onClose }) {
  return (
    <button
      type="button"
      className="unifiedRecoverySheet__close"
      onClick={() => onClose?.()}
      disabled={disabled}
      aria-label="Fermer la récupération"
    >
      <X size={17} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

function SheetChrome({ children, onClose, pending = false, state }) {
  return (
    <AppSheet
      open
      onClose={pending ? undefined : onClose}
      maxWidth={520}
      placement="bottom"
      className="unifiedRecoverySheet"
    >
      <div className="unifiedRecoverySheet__shell" data-recovery-sheet-state={state} data-testid="unified-recovery-sheet">
        <div className="unifiedRecoverySheet__grid" aria-hidden="true" />
        <header className="unifiedRecoverySheet__topbar">
          <RecoverySheetCloseButton disabled={pending} onClose={onClose} />
          <span className="unifiedRecoverySheet__glyph" aria-hidden="true">
            <CheckCircle2 size={22} strokeWidth={2.1} />
          </span>
          <span aria-hidden="true" />
        </header>
        {children}
      </div>
    </AppSheet>
  );
}

function ProblemHeader({ problem }) {
  return (
    <section className="unifiedRecoverySheet__intro" aria-labelledby="unified-recovery-title">
      <div className="unifiedRecoverySheet__eyebrow">Récupération</div>
      <h2 className="unifiedRecoverySheet__title" id="unified-recovery-title">
        {problem.title}
      </h2>
      <p className="unifiedRecoverySheet__description">{problem.description}</p>
    </section>
  );
}

export function RecoveryOptionButton({ option, pending = false, onSelect }) {
  const tone = getRecoveryOptionTone(option);
  const kind = getRecoveryOptionKind(option);
  const preview = optionPreviewText(option);
  const disabled = pending || Boolean(option?.disabled);
  const ariaLabel = [
    safeString(option?.label),
    safeString(option?.description),
    preview,
  ].filter(Boolean).join(". ");

  return (
    <button
      type="button"
      className={cx(
        "unifiedRecoverySheet__option",
        `unifiedRecoverySheet__option--tone-${tone}`,
        `unifiedRecoverySheet__option--${kind}`
      )}
      onClick={() => onSelect?.(option)}
      disabled={disabled}
      aria-label={ariaLabel || "Option de récupération"}
      data-recovery-option-type={option?.type}
    >
      <span className="unifiedRecoverySheet__optionIcon" aria-hidden="true">
        <RecoveryOptionIcon type={option?.type} />
      </span>
      <span className="unifiedRecoverySheet__optionText">
        <span className="unifiedRecoverySheet__optionTitle">{option?.label}</span>
        {option?.description ? (
          <span className="unifiedRecoverySheet__optionDescription">{option.description}</span>
        ) : null}
        {preview ? <span className="unifiedRecoverySheet__optionPreview">{preview}</span> : null}
      </span>
      <ArrowRight className="unifiedRecoverySheet__optionChevron" size={18} strokeWidth={2.1} aria-hidden="true" />
    </button>
  );
}

function ReadyView({ viewModel, pending, onSelectOption }) {
  return (
    <main className="unifiedRecoverySheet__body">
      <ProblemHeader problem={viewModel.problem} />
      <div className="unifiedRecoverySheet__options" aria-label="Options de récupération">
        {viewModel.options.map((option) => (
          <RecoveryOptionButton
            key={option.id}
            option={option}
            pending={pending}
            onSelect={onSelectOption}
          />
        ))}
        {!viewModel.options.length ? (
          <p className="unifiedRecoverySheet__empty">Aucune option directe disponible pour ce bloc.</p>
        ) : null}
      </div>
    </main>
  );
}

function ConfirmationView({ option, summary, pending, onCancel, onConfirm }) {
  const tone = getRecoveryOptionTone(option);
  const critical = tone === "critical";
  return (
    <>
      <main className="unifiedRecoverySheet__body">
        <section className="unifiedRecoverySheet__panel" aria-labelledby="unified-recovery-confirm-title">
          <span className="unifiedRecoverySheet__panelIcon" aria-hidden="true">
            <AlertTriangle size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h2 className="unifiedRecoverySheet__panelTitle" id="unified-recovery-confirm-title">
              Confirmer cet ajustement
            </h2>
            <p className="unifiedRecoverySheet__copy">{safeString(option?.label)}</p>
          </div>
          <p className="unifiedRecoverySheet__preview">{summary || safeString(option?.description)}</p>
          {option?.destructive ? (
            <p className="unifiedRecoverySheet__meta">Ce bloc sera passé seulement pour cette occurrence.</p>
          ) : null}
        </section>
      </main>
      <footer className="unifiedRecoverySheet__footer">
        <button
          type="button"
          className="unifiedRecoverySheet__footerButton"
          onClick={onCancel}
          disabled={pending}
        >
          Annuler
        </button>
        <button
          type="button"
          className={cx(
            "unifiedRecoverySheet__footerButton",
            critical ? "unifiedRecoverySheet__footerButton--critical" : "unifiedRecoverySheet__footerButton--attention"
          )}
          onClick={() => onConfirm?.(option)}
          disabled={pending}
          aria-label={`Confirmer ${safeString(option?.label) || "l’ajustement"}`}
        >
          Confirmer
        </button>
      </footer>
    </>
  );
}

function ApplyingView() {
  return (
    <main className="unifiedRecoverySheet__body" role="status" aria-live="polite">
      <section className="unifiedRecoverySheet__panel">
        <span className="unifiedRecoverySheet__loadingLine">
          <Loader2 size={18} strokeWidth={2.1} aria-hidden="true" />
          Application de l’ajustement…
        </span>
        <p className="unifiedRecoverySheet__copy">Le bloc est mis à jour sans autre changement caché.</p>
      </section>
    </main>
  );
}

function SuccessView({ summary, onClose, ctaLabel = "Retour à Home" }) {
  return (
    <>
      <main className="unifiedRecoverySheet__body" role="status" aria-live="polite">
        <section className="unifiedRecoverySheet__panel unifiedRecoverySheet__panel--success">
          <span className="unifiedRecoverySheet__panelIcon" aria-hidden="true">
            <CheckCircle2 size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h2 className="unifiedRecoverySheet__panelTitle">Bloc ajusté</h2>
            <p className="unifiedRecoverySheet__copy">{summary || "Le bloc a été récupéré."}</p>
          </div>
        </section>
      </main>
      <footer className="unifiedRecoverySheet__footer">
        <button
          type="button"
          className="unifiedRecoverySheet__footerButton unifiedRecoverySheet__footerButton--primary"
          onClick={() => onClose?.()}
        >
          {ctaLabel}
        </button>
      </footer>
    </>
  );
}

function ErrorView({ errorCode, onClose }) {
  return (
    <>
      <main className="unifiedRecoverySheet__body" role="alert">
        <section className="unifiedRecoverySheet__panel unifiedRecoverySheet__panel--error">
          <span className="unifiedRecoverySheet__panelIcon" aria-hidden="true">
            <AlertTriangle size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h2 className="unifiedRecoverySheet__panelTitle">
              La récupération n’a pas pu être appliquée.
            </h2>
            <p className="unifiedRecoverySheet__copy">
              Aucun changement n’a été appliqué. Tu peux fermer et choisir une autre option.
            </p>
          </div>
          {errorCode ? <p className="unifiedRecoverySheet__meta">Code : {errorCode}</p> : null}
        </section>
      </main>
      <footer className="unifiedRecoverySheet__footer">
        <button type="button" className="unifiedRecoverySheet__footerButton" onClick={() => onClose?.()}>
          Fermer
        </button>
      </footer>
    </>
  );
}

export function RecoverySheetContent({
  viewModel,
  pending = false,
  onClose,
  onSelectOption,
  onConfirmOption,
  onOpenCoach,
  onOpenPlanning,
  successCtaLabel = "Retour à Home",
  onRequestConfirmation,
  onCancelConfirmation,
}) {
  const handleSelectOption = (option) => {
    const action = getRecoveryOptionSelectionAction(option);
    if (action === RECOVERY_OPTION_ACTION.IGNORE) return;
    if (action === RECOVERY_OPTION_ACTION.OPEN_COACH) {
      onOpenCoach?.(option);
      return;
    }
    if (action === RECOVERY_OPTION_ACTION.OPEN_PLANNING) {
      onOpenPlanning?.(option);
      return;
    }
    if (action === RECOVERY_OPTION_ACTION.CONFIRM) {
      onRequestConfirmation?.(option);
      return;
    }
    onSelectOption?.(option);
  };

  if (!viewModel || viewModel.state === RECOVERY_SHEET_STATE.CLOSED) return null;

  if (viewModel.state === RECOVERY_SHEET_STATE.APPLYING) {
    return <ApplyingView />;
  }

  if (viewModel.state === RECOVERY_SHEET_STATE.SUCCESS) {
    return <SuccessView summary={viewModel.summary} onClose={onClose} ctaLabel={successCtaLabel} />;
  }

  if (viewModel.state === RECOVERY_SHEET_STATE.ERROR) {
    return <ErrorView errorCode={viewModel.errorCode} onClose={onClose} />;
  }

  if (viewModel.state === RECOVERY_SHEET_STATE.CONFIRMATION) {
    return (
      <ConfirmationView
        option={viewModel.confirmingOption}
        summary={viewModel.summary}
        pending={pending}
        onCancel={onCancelConfirmation}
        onConfirm={onConfirmOption}
      />
    );
  }

  return <ReadyView viewModel={viewModel} pending={pending} onSelectOption={handleSelectOption} />;
}

export default function UnifiedRecoverySheet({
  open = false,
  recoveryContext = null,
  problem = null,
  options = [],
  pending = false,
  result = null,
  error = null,
  onClose,
  onSelectOption,
  onConfirmOption,
  onOpenCoach,
  onOpenPlanning,
  successCtaLabel = "Retour à Home",
}) {
  const [confirmingOptionId, setConfirmingOptionId] = useState("");

  useEffect(() => {
    if (!open || result || error) setConfirmingOptionId("");
  }, [error, open, result]);

  const viewModel = useMemo(
    () => buildRecoverySheetViewModel({
      open,
      recoveryContext,
      problem,
      options,
      pending,
      result,
      error,
      confirmingOptionId,
    }),
    [confirmingOptionId, error, open, options, pending, problem, recoveryContext, result]
  );

  if (viewModel.state === RECOVERY_SHEET_STATE.CLOSED) return null;

  return (
    <SheetChrome
      onClose={onClose}
      pending={pending}
      state={viewModel.state}
    >
      <RecoverySheetContent
        viewModel={viewModel}
        pending={pending}
        onClose={onClose}
        onSelectOption={onSelectOption}
        onConfirmOption={onConfirmOption}
        onOpenCoach={onOpenCoach}
        onOpenPlanning={onOpenPlanning}
        successCtaLabel={successCtaLabel}
        onRequestConfirmation={(option) => setConfirmingOptionId(option?.id || "")}
        onCancelConfirmation={() => setConfirmingOptionId("")}
      />
    </SheetChrome>
  );
}
