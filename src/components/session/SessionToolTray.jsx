import React from "react";
import { GhostButton, PrimaryButton, ProgressBar } from "../../shared/ui/app";

export default function SessionToolTray({
  utility = null,
  onStart,
  onPause,
  onReset,
  onClose,
  onToggleCollapse,
}) {
  if (!utility) return null;
  const isCollapsed = utility.collapsed === true;
  const isRunning = utility.state === "running";
  const startLabel =
    utility.state === "paused" ? "Reprendre" : utility.state === "done" ? "Rejouer" : "Lancer";

  if (isCollapsed) {
    return (
      <div className="sessionToolTray sessionToolTray--collapsed" data-testid="session-tool-tray">
        <div className="sessionToolTrayCollapsedMeta">
          <span className="sessionToolTrayCollapsedTitle">{utility.title}</span>
          <span className="sessionToolTrayCollapsedTime">{utility.remainingLabel}</span>
        </div>
        <div className="sessionToolTrayCollapsedActions">
          <GhostButton type="button" className="sessionToolTrayAction" onClick={onToggleCollapse}>
            Ouvrir
          </GhostButton>
          <GhostButton type="button" className="sessionToolTrayAction" onClick={onClose}>
            Fermer
          </GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="sessionToolTray" data-testid="session-tool-tray">
      <div className="sessionToolTrayHeader">
        <div className="sessionToolTrayHeaderText">
          <div className="sessionToolTrayTitle">{utility.title}</div>
          {utility.subtitle ? <div className="sessionToolTraySubtitle">{utility.subtitle}</div> : null}
        </div>
        <div className="sessionToolTrayHeaderActions">
          <GhostButton type="button" size="sm" onClick={onToggleCollapse}>
            Réduire
          </GhostButton>
          <GhostButton type="button" size="sm" onClick={onClose}>
            Fermer
          </GhostButton>
        </div>
      </div>
      <div className="sessionToolTrayBody">
        <div className="sessionToolTrayTimeRow">
          <div className="sessionToolTrayRemaining">{utility.remainingLabel}</div>
          {utility.currentCue ? <div className="sessionToolTrayCue">{utility.currentCue}</div> : null}
        </div>
        {utility.description ? <div className="sessionToolTrayDescription">{utility.description}</div> : null}
        <ProgressBar
          className="sessionToolTrayProgress"
          value01={utility.progress01 || 0}
          tone="info"
          label={utility.remainingLabel}
        />
      </div>
      <div className="sessionToolTrayActions">
        {isRunning ? (
          <GhostButton type="button" className="sessionToolTrayAction" onClick={onPause}>
            Pause
          </GhostButton>
        ) : (
          <PrimaryButton type="button" className="sessionToolTrayAction sessionToolTrayAction--primary" onClick={onStart}>
            {startLabel}
          </PrimaryButton>
        )}
        <GhostButton type="button" className="sessionToolTrayAction" onClick={onReset}>
          Réinitialiser
        </GhostButton>
      </div>
    </div>
  );
}

