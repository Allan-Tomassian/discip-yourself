import React from "react";
import { AppSheet, AppSheetContent } from "../../shared/ui/app";

export default function TodayAdjustmentSheet({
  open = false,
  onClose,
  onSimplify,
  onReorganize,
  onReduce,
  onAskCoach,
}) {
  return (
    <AppSheet open={open} onClose={onClose} maxWidth={440}>
      <AppSheetContent title="Ajuster" subtitle="Adapter la journée sans recréer un plan à la main.">
        <div className="todayAdjustmentSheetActions">
          <button type="button" className="todaySheetActionButton" onClick={() => onSimplify?.()}>
            Simplifier la journée
          </button>
          <button type="button" className="todaySheetActionButton" onClick={() => onReorganize?.()}>
            Réorganiser les horaires
          </button>
          <button type="button" className="todaySheetActionButton" onClick={() => onReduce?.()}>
            Réduire la charge
          </button>
          <button type="button" className="todaySheetActionButton is-ai" onClick={() => onAskCoach?.()}>
            Demander au Coach IA
          </button>
        </div>
      </AppSheetContent>
    </AppSheet>
  );
}
