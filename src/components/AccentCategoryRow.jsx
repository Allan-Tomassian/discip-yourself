import React from "react";
import { GateRow } from "../shared/ui/gate/Gate";
import { getCategoryUiVars } from "../utils/categoryAccent";
import "./categorySurface.css";

export default function AccentCategoryRow({
  category = null,
  color = "#6EE7FF",
  selected = false,
  onClick,
  children,
  rightSlot = null,
  style = {},
  className = "",
  onKeyDown,
  ...props
}) {
  const mergedClassName = [
    "accentItem",
    "libraryAccentItem",
    "categorySurface",
    "categorySurface--surface",
    "GateRowPremium",
    onClick ? "GatePressable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <GateRow
      className={mergedClassName}
      selected={selected}
      onClick={onClick}
      onKeyDown={onKeyDown}
      right={rightSlot}
      style={{
        ...getCategoryUiVars(category || color || "#6EE7FF", { level: "surface" }),
        "--libraryAccent": color || category?.color || "#6EE7FF",
        ...style,
      }}
      {...props}
    >
      <div className="libraryAccentItemBody categorySurfaceBody">{children}</div>
    </GateRow>
  );
}
