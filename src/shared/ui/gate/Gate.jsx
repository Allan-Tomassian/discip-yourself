import React, { useId, useState } from "react";
import "./gate.css";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function GatePanel({ children, className = "", ...props }) {
  return (
    <div className={cx("gatePanel", className)} {...props}>
      {children}
    </div>
  );
}

export function GateHeader({ title, subtitle, actions = null, className = "", ...props }) {
  return (
    <header className={cx("gateHeader", className)} {...props}>
      <div className="gateHeaderText">
        {title ? <div className="gateHeaderTitle">{title}</div> : null}
        {subtitle ? <div className="gateHeaderSubtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="gateHeaderActions">{actions}</div> : null}
    </header>
  );
}

export function GateSection({
  title,
  description,
  children,
  className = "",
  collapsible = false,
  defaultOpen = true,
  ...props
}) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const body = (
    <div id={contentId} className="gateSectionBody">
      {children}
    </div>
  );
  return (
    <section className={cx("gateSection", open ? "isOpen" : "isClosed", className)} {...props}>
      {title || description ? (
        <div className="gateSectionHeader">
          {collapsible ? (
            <button
              type="button"
              className="gateSectionToggle"
              aria-controls={contentId}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <div className="gateSectionHeaderText">
                {title ? <div className="gateSectionTitle">{title}</div> : null}
                {description ? <div className="gateSectionDescription">{description}</div> : null}
              </div>
              <span className="gateSectionChevron" aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
            </button>
          ) : (
            <div className="gateSectionHeaderText">
              {title ? <div className="gateSectionTitle">{title}</div> : null}
              {description ? <div className="gateSectionDescription">{description}</div> : null}
            </div>
          )}
        </div>
      ) : null}
      {!collapsible || open ? body : null}
    </section>
  );
}

export function GateRow({
  icon = null,
  label = null,
  meta = null,
  right = null,
  selected = false,
  className = "",
  children,
  onClick,
  ...props
}) {
  const interactive = typeof onClick === "function";
  return (
    <div
      className={cx("gateRow", selected && "isSelected", interactive && "isInteractive", className)}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.(event);
        }
      }}
      {...props}
    >
      <div className="gateRowBody">
        {icon ? <div className="gateRowIcon">{icon}</div> : null}
        {label || meta ? (
          <div className="gateRowText">
            {label ? <div className="gateRowLabel">{label}</div> : null}
            {meta ? <div className="gateRowMeta">{meta}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
      {right ? <div className="gateRowRight">{right}</div> : null}
    </div>
  );
}

export function GateCard({ children, className = "", selected = false, onClick, ...props }) {
  return (
    <GateRow
      className={cx("gateCard", className)}
      selected={selected}
      onClick={onClick}
      {...props}
    >
      {children}
    </GateRow>
  );
}

export function GateBadge({ children, color = "", className = "", ...props }) {
  const style = color ? { "--gateBadgeColor": color } : undefined;
  return (
    <span className={cx("gateBadge", className)} style={style} {...props}>
      {children}
    </span>
  );
}

export function GateButton({ children, variant = "primary", className = "", type = "button", ...props }) {
  const gateVariant = variant === "ghost" ? "gateButton--ghost" : "gateButton--primary";
  return (
    <button className={cx("gateButton", gateVariant, className)} type={type} {...props}>
      {children}
    </button>
  );
}

export function GateFooter({ children, className = "", ...props }) {
  return (
    <div className={cx("gateFooter", className)} {...props}>
      {children}
    </div>
  );
}

