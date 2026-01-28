import React, { useEffect, useMemo, useState } from "react";
import AccentContext from "./AccentContext";

function hexToRgba(hex, alpha) {
  if (typeof hex !== "string") return "";
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return "";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "";
  const a = typeof alpha === "number" ? alpha : 0.12;
  return `rgba(${r},${g},${b},${a})`;
}

export { default as AccentItem } from "./AccentItem";

export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

export function Card({ children, accentBorder = false, style, className = "", ...props }) {
  const { accent } = React.useContext(AccentContext);
  const accentTint = accentBorder ? hexToRgba(accent, 0.12) : "";
  const accentStyle = accentBorder
    ? { "--accent": accent, "--accentTint": accentTint || "rgba(255,255,255,.06)" }
    : {};
  return (
    <div
      className={`card${accentBorder ? " accentFrame" : ""}${className ? ` ${className}` : ""}`}
      style={{
        ...accentStyle,
        ...(style || {}),
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", type = "button", ...props }) {
  const cls =
    variant === "ghost"
      ? "btn btnGhost"
      : variant === "secondary"
        ? "btn btnSecondary"
      : variant === "danger"
        ? "btn btnDanger"
        : "btn";
  const mergedClassName = className ? `${cls} ${className}` : cls;
  return (
    <button className={mergedClassName} type={type} {...props}>
      {children}
    </button>
  );
}

export function IconButton({ icon, children, className = "", type = "button", ...props }) {
  const iconMap = { gear: "⚙︎", close: "×" };
  const content = children || iconMap[icon] || icon;
  const mergedClassName = className ? `iconBtn ${className}` : "iconBtn";
  return (
    <button className={mergedClassName} type={type} {...props}>
      {content}
    </button>
  );
}

export function Input({ className = "", style, ...props }) {
  const type = props?.type;
  const isDateLike = type === "date" || type === "datetime-local" || type === "time";
  const input = (
    <input
      className={`input${className ? ` ${className}` : ""}`}
      style={{ maxWidth: "100%", minWidth: 0, ...(style || {}) }}
      {...props}
    />
  );
  // iOS/Safari date/time controls can visually bleed outside rounded containers.
  return isDateLike ? <div className="controlClip">{input}</div> : input;
}

export function Textarea({ className = "", style, ...props }) {
  return (
    <textarea
      className={`textarea${className ? ` ${className}` : ""}`}
      style={{ maxWidth: "100%", minWidth: 0, ...(style || {}) }}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  value,
  onChange,
  disabled,
  placeholder,
  style,
  "aria-label": ariaLabel,
}) {
  const options = useMemo(() => {
    const list = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const optValue = child.props?.value;
      const optLabel = child.props?.children;
      if (optValue === undefined) return;
      list.push({
        value: optValue,
        label: optLabel || String(optValue),
        disabled: Boolean(child.props?.disabled),
      });
    });
    return list;
  }, [children]);

  const derivedPlaceholder =
    placeholder ||
    options.find((opt) => opt.disabled && !opt.value)?.label ||
    "Sélectionner";

  return (
    <SelectMenu
      value={value}
      onChange={(next) => (typeof onChange === "function" ? onChange({ target: { value: next } }) : null)}
      disabled={disabled}
      placeholder={derivedPlaceholder}
      options={options.filter((opt) => opt.value !== "" || !opt.disabled)}
      className={className}
      style={style}
      ariaLabel={ariaLabel}
    />
  );
}

export function SelectMenu({
  value,
  options = [],
  onChange,
  placeholder = "Sélectionner",
  disabled = false,
  className = "",
  menuClassName = "",
  style,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleSelect(opt) {
    if (!opt || opt.disabled) return;
    if (typeof onChange === "function") onChange(opt.value);
    setOpen(false);
  }

  return (
    <div className="selectMenuWrap" style={{ maxWidth: "100%", ...(style || {}) }}>
      <button
        type="button"
        className={`selectTrigger${className ? ` ${className}` : ""}`}
        style={{ maxWidth: "100%", minWidth: 0 }}
        onClick={() => (!disabled ? setOpen((prev) => !prev) : null)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`selectTriggerValue${selected ? "" : " isPlaceholder"}`}>
          {selected?.label || placeholder}
        </span>
        <span className="selectChevron" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="selectMenuOverlay"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          />
          <div className={`selectMenu${menuClassName ? ` ${menuClassName}` : ""}`} role="listbox">
            {options.length ? (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    className={`selectOption${isSelected ? " isSelected" : ""}${opt.disabled ? " isDisabled" : ""}`}
                    onClick={() => handleSelect(opt)}
                  >
                    {opt.label}
                  </button>
                );
              })
            ) : (
              <div className="selectEmpty">Aucune option</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CardSectionHeader({ title, action = null, className = "" }) {
  return (
    <div className={`cardSectionTitleRow${className ? ` ${className}` : ""}`}>
      <div className="cardSectionTitle">{title}</div>
      <div className="flex1" />
      {action}
    </div>
  );
}

export function Modal({ open, onClose, children, className = "" }) {
  if (!open) return null;
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className={`modalPanel${className ? ` ${className}` : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 44 }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = c * v;
  const gap = c - dash;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg viewBox="0 0 40 40" style={{ position: "absolute", inset: 0 }}>
        <circle cx="20" cy="20" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {Math.round(v * 100)}%
      </div>
    </div>
  );
}
