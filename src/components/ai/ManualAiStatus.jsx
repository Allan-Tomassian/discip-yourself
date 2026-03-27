import React from "react";
import { ANALYSIS_COPY } from "../../ui/labels";
import "./manualAiStatus.css";

export default function ManualAiStatus({
  statusKind = "local",
  statusLabel = ANALYSIS_COPY.localDiagnostic,
  detailLabel = "",
  stageLabel = "",
}) {
  return (
    <div className="manualAiStatusBlock">
      <span className={`manualAiStatusChip is-${statusKind}`}>
        <span className="manualAiStatusDot" />
        <span>{statusLabel}</span>
      </span>
      {detailLabel ? <div className="manualAiStatusDetail">{detailLabel}</div> : null}
      {stageLabel ? <div className="manualAiStatusStage">{stageLabel}</div> : null}
    </div>
  );
}
