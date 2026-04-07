import React from "react";
import { StatusBadge } from "../../shared/ui/app";
import { COACH_SCREEN_COPY } from "../../ui/labels";

export default function CoachWorkTray({
  visible = false,
  intentLabel = "",
  intentText = "",
  onDismiss,
}) {
  if (!visible) return null;

  return (
    <div className="coachWorkTray" role="status" aria-live="polite">
      <div className="coachWorkTrayMain">
        {intentLabel ? <StatusBadge className="coachWorkTrayBadge">{intentLabel}</StatusBadge> : null}
        {intentText ? (
          <div className="coachWorkTrayText" title={intentText}>
            {intentText}
          </div>
        ) : null}
      </div>
      <div className="coachWorkTrayActions">
        <button type="button" className="coachWorkTrayDismiss" onClick={onDismiss}>
          {COACH_SCREEN_COPY.workTrayDismiss}
        </button>
      </div>
    </div>
  );
}
