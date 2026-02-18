import React from "react";
import { GateRow } from "../shared/ui/gate/Gate";

export default function AccentCategoryRow({
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
      style={{ "--libraryAccent": color || "#6EE7FF", ...style }}
      {...props}
    >
      <div className="libraryAccentItemBody">{children}</div>
    </GateRow>
  );
}
