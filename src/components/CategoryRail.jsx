import React from "react";
import { getCategoryAccentVars } from "../utils/categoryAccent";

export default function CategoryRail({ categories = [], selectedCategoryId = null, onSelect }) {
  return (
    <div className="categoryRailScroll scrollNoBar">
      {categories.map((c) => {
        const isSelected = c.id === selectedCategoryId;
        const accentVars = getCategoryAccentVars(c.color);
        return (
          <button
            key={c.id}
            type="button"
            className={`listItem${isSelected ? " catAccentRow" : ""}`}
            style={{
              ...(isSelected ? accentVars : null),
              minWidth: "max-content",
              padding: "6px 10px",
              borderRadius: 12,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
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
