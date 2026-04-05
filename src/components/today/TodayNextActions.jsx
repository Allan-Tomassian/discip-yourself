import React from "react";
import { resolveCategoryColor } from "../../utils/categoryPalette";

export default function TodayNextActions({ actions = [], onOpenOccurrence }) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 3) : [];

  if (!safeActions.length) {
    return (
      <div className="lovableCard lovableEmptyCard">
        <div className="lovableEmptyTitle">No more recommended actions today.</div>
        <p className="lovableEmptyCopy">The rest of the day is intentionally clear so the rhythm stays readable.</p>
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
          <span className="lovableTodayActionTitle">{item.title || "Action"}</span>
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
