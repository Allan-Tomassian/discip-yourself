import React, { useMemo } from "react";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import "./categoryPill.css";

export default function CategoryPill({
  category = null,
  color = "",
  label = "",
  className = "",
  title = "",
}) {
  const accentVars = useMemo(
    () => getCategoryAccentVars(category || color || "#5B8CFF"),
    [category, color]
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
