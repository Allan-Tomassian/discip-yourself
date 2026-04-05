import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";
import { resolveCategoryColor } from "../../utils/categoryPalette";

export default function TodayNextActions({ actions = [], onOpenOccurrence }) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 3) : [];

  if (!safeActions.length) {
    return (
      <div className="lovableCard lovableEmptyCard">
        <div className="lovableEmptyTitle">{TODAY_SCREEN_COPY.emptyActionsTitle}</div>
        <p className="lovableEmptyCopy">{TODAY_SCREEN_COPY.emptyActionsCopy}</p>
      </div>
    );
  }

  return (
    <div className="lovableActionList">
      {safeActions.map((item) => (
        <button
          key={item.id}
          type="button"
          className="lovableTodayActionRow"
          onClick={() => onOpenOccurrence?.(item)}
        >
          <span className="lovableTodayActionCircle" />
          <span className="lovableTodayActionTitle">{item.title || TODAY_SCREEN_COPY.actionFallback}</span>
          <span
            className="lovableTodayActionDot"
            style={{ background: resolveCategoryColor(item.category, "#8b78ff") }}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
