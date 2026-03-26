import React, { useMemo } from "react";
import { getCategoryUiVars } from "../utils/categoryAccent";
import "./categoryPill.css";

export default function CategoryPill({
  category = null,
  color = "",
  label = "",
  className = "",
  title = "",
  stateTone = "default",
}) {
  const accentVars = useMemo(
    () => getCategoryUiVars(category || color || "#5B8CFF", { level: "pill", stateTone }),
    [category, color, stateTone]
  );
  const displayLabel = label || category?.name || "Catégorie";

  return (
    <span
      className={["categoryPill", className].filter(Boolean).join(" ")}
      style={accentVars}
      title={title || displayLabel}
    >
      {displayLabel}
    </span>
  );
}
