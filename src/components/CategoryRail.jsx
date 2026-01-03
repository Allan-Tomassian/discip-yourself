import React, { useMemo } from "react";
import { getCategoryAccentVars } from "../utils/categoryAccent";

export default function CategoryRail({ categories = [], selectedCategoryId = null, onSelect }) {
  const items = useMemo(() => categories, [categories]);

  return (
    <div className="categoryRailScroll scrollNoBar">
      {items.map((c) => {
        const isActive = c.id === selectedCategoryId;
        const accentVars = getCategoryAccentVars(c.color);
        return (
          <button
            key={c.id}
            type="button"
            className={`listItem${isActive ? " catAccentRow" : ""}`}
            style={{
              ...(isActive ? accentVars : null),
              minWidth: "max-content",
              padding: "8px 12px",
              borderRadius: 14,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => {
              if (typeof onSelect === "function") onSelect(c.id);
            }}
          >
            <span className="itemTitle">{c.name || "Catégorie"}</span>
          </button>
        );
      })}
    </div>
  );
}
