import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";
import { resolveCategoryColor } from "../../utils/categoryPalette";

function buildMetaParts(item, fallbackCategory = null) {
  const parts = [];
  const startLabel =
    (typeof item?.occurrence?.start === "string" && item.occurrence.start.trim()) ||
    (typeof item?.occurrence?.slotKey === "string" && item.occurrence.slotKey.trim()) ||
    "";
  const durationLabel = Number.isFinite(item?.occurrence?.durationMinutes)
    ? `${item.occurrence.durationMinutes} min`
    : "";
  const categoryLabel = item?.category?.name || fallbackCategory?.name || "";
  const fallbackCategoryLabel = fallbackCategory?.name || "";

  if (startLabel) parts.push(startLabel);
  if (durationLabel) parts.push(durationLabel);
  if (categoryLabel && categoryLabel !== fallbackCategoryLabel) parts.push(categoryLabel);
  return parts;
}

export default function TodayNextActions({ actions = [], onOpenOccurrence, activeCategory = null }) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 2) : [];

  if (!safeActions.length) return null;

  return (
    <div className="lovableActionList todayNextActionsList" data-testid="today-secondary-actions">
      {safeActions.map((item) => {
        const metaParts = buildMetaParts(item, activeCategory);
        return (
          <button
            key={item.id}
            type="button"
            className="lovableTodayActionRow todayNextActionRow"
            onClick={() => onOpenOccurrence?.(item)}
          >
            <span className="lovableTodayActionCircle" />
            <span className="todayNextActionBody">
              <span className="lovableTodayActionTitle">{item.title || TODAY_SCREEN_COPY.actionFallback}</span>
              {metaParts.length ? (
                <span className="todayNextActionMeta">{metaParts.join(" • ")}</span>
              ) : null}
            </span>
            <span
              className="lovableTodayActionDot"
              style={{ background: resolveCategoryColor(item.category || activeCategory, "#8b78ff") }}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
