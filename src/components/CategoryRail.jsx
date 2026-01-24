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
            className={`listItem navBtn categoryRailItem${isSelected ? " navBtnActive" : ""}`}
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
