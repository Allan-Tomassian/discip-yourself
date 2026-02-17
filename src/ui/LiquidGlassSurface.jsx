import React from "react";
import "./liquidGlassSurface.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const LiquidGlassSurface = React.forwardRef(function LiquidGlassSurface(
  {
    as: Component = "section",
    variant = "panel",
    density = "medium",
    noisy = false,
    className = "",
    children,
    ...props
  },
  ref
) {
  return (
    <Component
      ref={ref}
      className={cx(
        "liquidGlassSurface",
        `liquidGlass--${variant}`,
        `liquidGlass--${density}`,
        noisy && "isNoisy",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
});

export default LiquidGlassSurface;
