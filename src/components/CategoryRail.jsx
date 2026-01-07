import React, { useEffect, useRef } from "react";
import { getCategoryAccentVars } from "../utils/categoryAccent";

export default function CategoryRail({
  categories = [],
  selectedCategoryId = null,
  onSelect,
}) {
  // Keep a ref per category button so we can center it on selection.
  const itemRefs = useRef({});

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

  return (
    <div
      className="categoryRailScroll scrollNoBar"
      style={{
        scrollBehavior: "smooth",
        scrollSnapType: "x mandatory",
      }}
    >
      {categories.map((c) => {
        const isSelected = c.id === selectedCategoryId;
        const accentVars = getCategoryAccentVars(c.color);

        return (
          <button
            key={c.id}
            ref={(node) => {
              if (node) itemRefs.current[c.id] = node;
            }}
            type="button"
            className={`listItem categoryRailItem${isSelected ? " catAccentRow isSelected" : ""}`}
            aria-pressed={isSelected}
            style={{
              ...(isSelected ? accentVars : null),
              minWidth: "max-content",
              padding: "6px 10px",
              borderRadius: 12,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
              scrollSnapAlign: "center",
              transform: isSelected ? "scale(1.06)" : "scale(1)",
              opacity: isSelected ? 1 : 0.65,
              transition: "transform 220ms ease, opacity 220ms ease",
            }}
            onClick={() => {
              if (typeof onSelect === "function") onSelect(c.id);
            }}
          >
            <span className="itemTitle" style={{ fontSize: 13, lineHeight: 1 }}>
              {c.name || "Catégorie"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
