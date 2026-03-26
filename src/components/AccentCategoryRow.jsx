import React from "react";
import { GateRow } from "../shared/ui/gate/Gate";
import { getCategoryAccentVars } from "../utils/categoryAccent";

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
        ...getCategoryAccentVars(category || color || "#6EE7FF"),
        "--libraryAccent": color || category?.color || "#6EE7FF",
        ...style,
      }}
      {...props}
    >
      <div className="libraryAccentItemBody">{children}</div>
    </GateRow>
  );
}
