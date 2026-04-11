import React from "react";
import { AppSheet, GhostButton } from "../../shared/ui/app";

function SessionToolOption({ tool, disabled = false, onClick }) {
  if (!tool) return null;
  return (
    <button
      type="button"
      className={`sessionToolsOption${disabled ? " is-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="sessionToolsOptionText">
        <div className="sessionToolsOptionTitle">{tool.label}</div>
        <div className="sessionToolsOptionPromise">{tool.promise}</div>
      </div>
      {tool.recommendationReason ? (
        <div className="sessionToolsOptionReason">{tool.recommendationReason}</div>
      ) : null}
    </button>
  );
}

export default function SessionToolsSheet({
  open = false,
  tools = [],
  loading = false,
  activeStepLabel = "",
  viewedStepIsActive = true,
  onClose,
  onSelectTool,
}) {
  const subtitle =
    viewedStepIsActive || !activeStepLabel
      ? "Aides utiles pour cette étape."
      : `Aides utiles pour l’étape active : ${activeStepLabel}.`;

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      className="sessionToolsSheet"
      placement="bottom"
      maxWidth={560}
    >
      <div className="sessionToolsSheetContent" data-testid="session-tools-sheet">
        <div className="sessionToolsSheetHeader">
          <div className="sessionToolsSheetHeaderText">
            <div className="sessionToolsSheetTitle">Outils</div>
            <div className="sessionToolsSheetSubtitle">{subtitle}</div>
          </div>
          <GhostButton type="button" size="sm" onClick={onClose}>
            Fermer
          </GhostButton>
        </div>
        <div className="sessionToolsSheetList" data-testid="session-tools-list">
          {tools.map((tool) => (
            <SessionToolOption
              key={tool.toolId}
              tool={tool}
              disabled={loading}
              onClick={() => onSelectTool?.(tool)}
            />
          ))}
          {!tools.length ? (
            <div className="sessionToolsSheetEmpty">
              Aucun outil crédible pour l’étape en cours.
            </div>
          ) : null}
        </div>
      </div>
    </AppSheet>
  );
}
