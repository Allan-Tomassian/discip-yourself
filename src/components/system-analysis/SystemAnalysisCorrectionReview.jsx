import React from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { CommandBadge, CommandCard, CommandCTA, CommandSectionHeader } from "../../shared/ui/command";
import { SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS } from "../../features/system-analysis/systemAnalysisCorrectionReviewModel";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatConfidence(confidence) {
  const value = Number(confidence);
  if (!Number.isFinite(value)) return "";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function statusCopy(status, selected) {
  if (status === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID) {
    return { label: selected ? "Sélectionnée" : "Applicable", tone: "execution", Icon: CheckCircle2 };
  }
  if (status === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW) {
    return { label: "À revoir", tone: "attention", Icon: AlertTriangle };
  }
  return { label: "À revoir", tone: "attention", Icon: AlertTriangle };
}

function formatReadyCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  return `${safeCount} correction${safeCount > 1 ? "s" : ""} prête${safeCount > 1 ? "s" : ""}`;
}

function issueText(issues) {
  return safeArray(issues)
    .map((issue) => safeString(issue?.message) || safeString(issue?.code))
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
}

function CorrectionItem({ item, onSelectChange }) {
  const status = statusCopy(item.status, item.selected);
  const confidence = formatConfidence(item.confidence);
  return (
    <article
      className={`systemAnalysisCorrectionItem systemAnalysisCorrectionItem--${item.status}`}
      data-system-analysis-correction-id={item.id}
      data-system-analysis-correction-status={item.status}
    >
      <div className="systemAnalysisCorrectionItem__main">
        <div className="systemAnalysisCorrectionItem__titleRow">
          <strong>{item.label}</strong>
          <CommandBadge tone={status.tone} className="systemAnalysisCorrectionItem__badge">
            <status.Icon size={12} strokeWidth={2} aria-hidden="true" />
            {status.label}
          </CommandBadge>
        </div>
        {item.description ? <p>{item.description}</p> : null}
        {item.reason ? <small>{item.reason}</small> : null}
        {(item.expectedImpact || confidence) ? (
          <div className="systemAnalysisCorrectionItem__meta">
            {item.expectedImpact ? <span>{item.expectedImpact}</span> : null}
            {confidence ? <span>Confiance {confidence}</span> : null}
          </div>
        ) : null}
        {item.validationIssues?.length ? (
          <p className="systemAnalysisCorrectionItem__issues">{issueText(item.validationIssues)}</p>
        ) : null}
      </div>

      {item.selectable ? (
        <div className="systemAnalysisCorrectionItem__actions">
          <button
            type="button"
            className="systemAnalysisCorrectionAction systemAnalysisCorrectionAction--accept"
            data-review-action="accept"
            disabled={item.selected}
            onClick={() => onSelectChange?.(item.id, true)}
          >
            {item.selected ? "Sélectionnée" : "Sélectionner"}
          </button>
          <button
            type="button"
            className="systemAnalysisCorrectionAction systemAnalysisCorrectionAction--ignore"
            data-review-action="ignore"
            disabled={!item.selected}
            onClick={() => onSelectChange?.(item.id, false)}
          >
            Ignorer
          </button>
        </div>
      ) : (
        <span className="systemAnalysisCorrectionItem__disabledNote">
          Revue manuelle requise
        </span>
      )}
    </article>
  );
}

export default function SystemAnalysisCorrectionReview({
  review,
  onSelectChange,
  onConfirmSelection,
  confirmationOpen = false,
}) {
  if (!review || !safeArray(review.items).length) return null;
  const selectedCount = Number(review.validSelectedCount || 0);
  return (
    <CommandCard
      tone="ai"
      className="systemAnalysisCorrectionReview"
      density="compact"
      data-system-analysis-correction-review="true"
    >
      <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
      <div className="systemAnalysisCorrectionReview__body">
        <CommandSectionHeader
          label="ANALYSE SYSTÈME"
          title="Corrections proposées"
          subtitle="Inspecte les changements proposés avant toute validation."
          tone="ai"
        />
        <p className="systemAnalysisCorrectionReview__honestNote">
          Aucune modification n’est appliquée sans validation.
        </p>

        <div className="systemAnalysisCorrectionReview__groups">
          {review.groups.map((group) => (
            <section key={group.id} className="systemAnalysisCorrectionGroup" data-review-group={group.id}>
              <div className="systemAnalysisCorrectionGroup__header">
                <span>{group.label}</span>
                <small>{formatReadyCount(group.validCount)}</small>
              </div>
              <div className="systemAnalysisCorrectionGroup__items">
                {group.items.map((item) => (
                  <CorrectionItem key={item.id} item={item} onSelectChange={onSelectChange} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="systemAnalysisCorrectionReview__footer">
          <CommandCTA
            tone="execution"
            variant="secondary"
            disabled={!review.hasValidSelection}
            onClick={onConfirmSelection}
            data-system-analysis-confirm="true"
          >
            Préparer la validation
          </CommandCTA>
          <span>{selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}</span>
        </div>

        {confirmationOpen ? (
          <div className="systemAnalysisCorrectionReview__confirmation" role="status">
            <strong>Prochaine étape : validation finale</strong>
            <p>{review.confirmationSummary?.description}</p>
            {safeArray(review.confirmationSummary?.items).length ? (
              <ul>
                {review.confirmationSummary.items.map((item) => (
                  <li key={item.id}>{item.label} · {item.description}</li>
                ))}
              </ul>
            ) : null}
            <small>Aucune correction n’a encore été appliquée.</small>
          </div>
        ) : null}
      </div>
    </CommandCard>
  );
}
