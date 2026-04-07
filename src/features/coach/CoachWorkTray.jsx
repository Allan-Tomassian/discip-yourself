import React from "react";
import { GhostButton, StatusBadge } from "../../shared/ui/app";
import { COACH_SCREEN_COPY } from "../../ui/labels";

export default function CoachWorkTray({
  visible = false,
  modeLabel = "",
  intentLabel = "",
  intentText = "",
  canViewDraft = false,
  canReenterStructuring = false,
  onViewDraft,
  onReenterStructuring,
  onDismiss,
}) {
  if (!visible) return null;

  return (
    <div className="coachWorkTray">
      <div className="coachWorkTrayMain">
        {modeLabel ? <StatusBadge className="coachWorkTrayBadge">{modeLabel}</StatusBadge> : null}
        {intentLabel ? <StatusBadge className="coachWorkTrayBadge coachWorkTrayBadge--intent">{intentLabel}</StatusBadge> : null}
        {intentText ? <div className="coachWorkTrayText">{intentText}</div> : null}
      </div>
      <div className="coachWorkTrayActions">
        {canViewDraft ? (
          <GhostButton size="sm" onClick={onViewDraft}>
            {COACH_SCREEN_COPY.workTrayViewDraft}
          </GhostButton>
        ) : null}
        {canReenterStructuring ? (
          <GhostButton size="sm" onClick={onReenterStructuring}>
            {COACH_SCREEN_COPY.workTrayReenter}
          </GhostButton>
        ) : null}
        <GhostButton size="sm" onClick={onDismiss}>
          {COACH_SCREEN_COPY.workTrayDismiss}
        </GhostButton>
      </div>
    </div>
  );
}
