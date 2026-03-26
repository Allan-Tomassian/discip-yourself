import React, { useEffect, useRef } from "react";
import { getCategoryAccentVars } from "../utils/categoryAccent";

const SWIPE_THRESHOLD_PX = 36;

export default function CategoryRail({
  categories = [],
  selectedCategoryId = null,
  onSelect,
}) {
  // Keep a ref per category button so we can center it on selection.
  const itemRefs = useRef({});
  const touchStartXRef = useRef(null);
  const touchDeltaXRef = useRef(0);

  useEffect(() => {
    if (!selectedCategoryId) return;

    const el = itemRefs.current[selectedCategoryId];
    if (!el) return;

    // rAF avoids measuring/scrolling before React has painted selection styles.
    requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });
  }, [selectedCategoryId]);

  const commitSwipeSelection = () => {
    const delta = touchDeltaXRef.current;
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    const index = categories.findIndex((category) => category?.id === selectedCategoryId);
    if (index < 0) return;
    const direction = delta < 0 ? 1 : -1;
    const nextCategory = categories[index + direction] || null;
    if (!nextCategory?.id || typeof onSelect !== "function") return;
    onSelect(nextCategory.id);
  };

  return (
    <div
      className="categoryRailScroll bottomCategoryRailScroll scrollNoBar"
      data-totem-target="categoryRail"
      onTouchStart={(event) => {
        const point = event.touches?.[0];
        touchStartXRef.current = point?.clientX ?? null;
        touchDeltaXRef.current = 0;
      }}
      onTouchMove={(event) => {
        if (touchStartXRef.current == null) return;
        const point = event.touches?.[0];
        if (!point) return;
        touchDeltaXRef.current = point.clientX - touchStartXRef.current;
      }}
      onTouchEnd={commitSwipeSelection}
      onTouchCancel={commitSwipeSelection}
    >
      {categories.map((c) => {
        const isSelected = c.id === selectedCategoryId;
        const accentVars = getCategoryAccentVars(c);

        return (
          <button
            key={c.id}
            ref={(node) => {
              if (node) itemRefs.current[c.id] = node;
            }}
            type="button"
            className={`categoryRailItem bottomCategoryChip NavPillUnified GatePressable${isSelected ? " navBtnActive bottomCategoryChipActive" : ""}`}
            aria-pressed={isSelected}
            style={isSelected ? accentVars : undefined}
            onClick={() => {
              if (typeof onSelect === "function") onSelect(c.id);
            }}
          >
            <span className="itemTitle">
              {c.name || "Catégorie"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
