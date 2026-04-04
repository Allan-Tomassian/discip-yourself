import React from "react";
import { AppCard } from "../shared/ui/app";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
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
  const interactive = typeof onClick === "function";
  const mergedClassName = [
    "accentItem",
    "libraryAccentItem",
    "categorySurface",
    "categorySurface--surface",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AppCard
      interactive={interactive}
      className={mergedClassName}
      selected={selected}
      onClick={onClick}
      style={{
        ...getCategoryUiVars(category || color || "#6EE7FF", { level: "surface" }),
        "--libraryAccent": resolveCategoryColor(category || color || "#6EE7FF"),
        ...style,
      }}
      onKeyDown={onKeyDown}
      {...props}
    >
      <div className="libraryAccentItemFrame">
        <div className="libraryAccentItemBody categorySurfaceBody">{children}</div>
        {rightSlot ? <div className="libraryAccentItemRight">{rightSlot}</div> : null}
      </div>
    </AppCard>
  );
}
