import React from "react";
import { GateFooter, GateHeader, GatePanel } from "./Gate";
import { cx } from "./gateCx";
import "../overlays/overlays.css";
import "./gate-standalone.css";

function isDateLikeType(type) {
  return type === "date" || type === "datetime-local" || type === "time";
}

export function GateInput({ className = "", style, type = "text", ...props }) {
  const input = (
    <input
      type={type}
      className={cx("GateInputPremium", className)}
      style={{ maxWidth: "100%", minWidth: 0, ...(style || {}) }}
      {...props}
    />
  );
  return isDateLikeType(type) ? <div className="controlClip">{input}</div> : input;
}

export function GateTextarea({ className = "", style, ...props }) {
  return (
    <textarea
      className={cx("GateTextareaPremium", className)}
      style={{ maxWidth: "100%", minWidth: 0, ...(style || {}) }}
      {...props}
    />
  );
}

export function GateTextButton({ className = "", type = "button", ...props }) {
  return <button type={type} className={cx("gateTextButton", className)} {...props} />;
}

export const GateIconButton = React.forwardRef(function GateIconButton(
  { className = "", type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={cx("GateIconButtonPremium", className)} {...props} />;
});

export function GateStandaloneScreen({
  title,
  subtitle,
  footer = null,
  className = "",
  panelClassName = "",
  children,
  ...props
}) {
  return (
    <div className={cx("gateStandaloneShell", className)} {...props}>
      <div className="gateStandaloneInner">
        <GatePanel className={cx("gateStandalonePanel", "GateMainSection", "GateSurfacePremium", "GateCardPremium", panelClassName)}>
          {(title || subtitle) ? (
            <GateHeader
              title={title}
              subtitle={subtitle}
              className="gateStandaloneHeader"
            />
          ) : null}
          <div className="gateStandaloneContent">{children}</div>
          {footer ? <GateFooter className="gateStandaloneFooter">{footer}</GateFooter> : null}
        </GatePanel>
      </div>
    </div>
  );
}
