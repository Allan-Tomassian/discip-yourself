import React from "react";
import { BriefcaseBusiness, Clock3, Flag } from "lucide-react";
import CommandSurface from "./CommandSurface";

function MetaItem({ icon, children }) {
  if (!children) return null;
  return (
    <span className="todayPrimaryMetaItem">
      {icon}
      {children}
    </span>
  );
}

export default function PrimaryActionCard({
  state = "neutral",
  tone = "neutral",
  motionIntensity = "normal",
  durationLabel = "30 min",
  title = "Bloc prioritaire",
  description = "Avancer sur ton objectif principal.",
  categoryLabel = "Travail",
  timingLabel = "",
  priorityLabel = "Priorité haute",
  reason = "C’est le bloc qui débloque ta journée.",
  label = "Action critique",
  primaryLabel = "Verrouiller 30 min",
  secondaryLabel = "Reporter",
  detailLabel = "Voir détail",
  onPrimary,
  onSecondary,
  onDetail,
  canPrimary = true,
  canSecondary = true,
  canDetail = true,
  status = "ready",
}) {
  const statusClass = status ? ` is-action-${String(status).replace(/_/g, "-")}` : "";
  const stateClass = state ? ` today-state-${state}` : "";
  const toneClass = tone ? ` today-tone-${tone}` : "";
  const motionClass = motionIntensity ? ` today-motion-${motionIntensity}` : "";

  return (
    <CommandSurface className={`todayPrimaryActionCard${statusClass}${stateClass}${toneClass}${motionClass}`} tone="execution" data-testid="today-primary-action-card">
      <div className="todayPrimaryBeam" aria-hidden="true" />
      <div className="todaySurfaceTopline">
        <span className="todaySurfaceEyebrow">
          <span className="todaySurfaceDot" aria-hidden="true" />
          {label}
        </span>
        {durationLabel ? <span className="todaySurfaceMeta">{durationLabel}</span> : null}
      </div>

      <div className="todayPrimaryActionBody">
        <div className="todayPrimaryActionTitleBlock">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>

        <div className="todayPrimaryMetaRow">
          <MetaItem icon={<BriefcaseBusiness size={16} strokeWidth={1.8} aria-hidden="true" />}>{categoryLabel}</MetaItem>
          <MetaItem icon={<Clock3 size={16} strokeWidth={1.8} aria-hidden="true" />}>{timingLabel}</MetaItem>
          <MetaItem icon={<Flag size={16} strokeWidth={1.8} aria-hidden="true" />}>{priorityLabel}</MetaItem>
        </div>

        {reason ? <p className="todayPrimaryReason">{reason}</p> : null}

        <button
          type="button"
          className="todayCommitmentButton"
          onClick={() => onPrimary?.()}
          disabled={!canPrimary}
        >
          {primaryLabel}
        </button>

        <div className="todayPrimarySecondaryRow">
          <button type="button" onClick={() => onSecondary?.()} disabled={!canSecondary}>
            {secondaryLabel}
          </button>
          <span aria-hidden="true" />
          <button type="button" onClick={() => onDetail?.()} disabled={!canDetail}>
            {detailLabel}
          </button>
        </div>
      </div>
    </CommandSurface>
  );
}
