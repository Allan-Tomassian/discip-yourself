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
        "liquidGlassSurface GateGlassOuter",
        `liquidGlass--${variant}`,
        `liquidGlass--${density}`,
        noisy && "isNoisy",
        className
      )}
      {...props}
    >
      <div className="liquidGlassSurfaceClip GateGlassClip GateGlassBackdrop">
        <div className="liquidGlassSurfaceContent GateGlassContent">{children}</div>
      </div>
    </Component>
  );
});

export default LiquidGlassSurface;
