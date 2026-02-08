import React from "react";
import "./gatePanel.css";

export function GatePanel({ children, className = "", ...props }) {
  return (
    <div className={`gatePanel${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </div>
  );
}

export function GateHeader({ title, subtitle, right = null, ...props }) {
  return (
    <div className="gateHeader" {...props}>
      <div className="gateHeaderText">
        {title ? <div className="cardSectionTitle">{title}</div> : null}
        {subtitle ? <div className="titleSm">{subtitle}</div> : null}
      </div>
      {right ? <div className="gateHeaderRight">{right}</div> : null}
    </div>
  );
}

export function GateSection({ title, description, children, className = "", ...props }) {
  return (
    <section className={`gateSection${className ? ` ${className}` : ""}`} {...props}>
      {title || description ? (
        <div className="gateSectionHeader">
          <div className="gateSectionTitle">{title}</div>
          {description ? <div className="gateSectionDesc">{description}</div> : null}
        </div>
      ) : null}
      <div className="gateSectionBody">{children}</div>
    </section>
  );
}

export function GateRow({ children, selected = false, onClick, className = "", right = null, ...props }) {
  const interactive = typeof onClick === "function";
  return (
    <div
      className={`gateRow${selected ? " isSelected" : ""}${className ? ` ${className}` : ""}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      {...props}
    >
      <div className="gateRowBody">{children}</div>
      {right ? <div className="gateRowRight">{right}</div> : null}
    </div>
  );
}

export function GateFooter({ children, className = "", ...props }) {
  return (
    <div className={`gateFooter${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </div>
  );
}
