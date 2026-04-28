import React from "react";

export default function CommandSurface({
  as = "section",
  tone = "execution",
  className = "",
  children,
  ...props
}) {
  return React.createElement(
    as,
    {
      className: `todayCommandSurface is-${tone}${className ? ` ${className}` : ""}`,
      ...props,
    },
    children
  );
}
