import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";
import { resolveCategoryColor } from "../../utils/categoryPalette";

export default function TodayNextActions({ actions = [], onOpenOccurrence }) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 2) : [];

  if (!safeActions.length) return null;

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
