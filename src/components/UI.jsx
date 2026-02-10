import React, { useCallback, useEffect, useRef } from "react";
import AccentContext from "./AccentContext";
import SelectBase from "../ui/select/Select";
import "../shared/ui/overlays/overlays.css";

export { default as Select } from "../ui/select/Select";

function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const expanded = `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    return /^[0-9a-fA-F]{6}$/.test(expanded) ? expanded.toUpperCase() : null;
  }
  if (raw.length === 6) {
    return /^[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : null;
  }
  return null;
}

function hexToRgba(hex, alpha = 0.12) {
  const clean = normalizeHex(hex);
  if (!clean) return "";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "";
  const a = typeof alpha === "number" ? Math.max(0, Math.min(1, alpha)) : 0.12;
  return `rgba(${r},${g},${b},${a})`;
}

function isDesktopLikeInput() {
  try {
    return Boolean(window?.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches);
  } catch {
    return false;
  }
}

export { default as AccentItem } from "./AccentItem";

export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

export function Card({ children, accentBorder = false, style, className = "", ...props }) {
  const { accent } = React.useContext(AccentContext);
  const accentTint = accentBorder ? hexToRgba(accent, 0.12) : "";
  const accentStyle = accentBorder
    ? {
        "--accent": accent,
        ...(accentTint ? { "--accentTint": accentTint } : null),
        "--accentRailInset": "12px",
      }
    : {};
  return (
    <div
      className={`card${accentBorder ? " accentSurface accentRail" : ""}${className ? ` ${className}` : ""}`}
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
  const iconMap = { gear: "⚙︎", close: "×", back: "←", plus: "+" };
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

export function SelectMenu({
  children,
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
  const isDev = typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";

  useEffect(() => {
    if (!isDev) return;
    console.warn(
      "[SelectMenu] Legacy wrapper in use. Prefer importing `Select` from `src/ui/select/Select.jsx`."
    );
  }, [isDev]);

  const handleChange = useCallback(
    (event) => {
      if (typeof onChange !== "function") return;
      if (event && typeof event === "object" && "target" in event) {
        onChange(event.target?.value);
        return;
      }
      onChange(event);
    },
    [onChange]
  );

  return (
    <SelectBase
      value={value}
      options={options}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      menuClassName={menuClassName}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </SelectBase>
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

export function Modal({ open, onClose, children, className = "", backdropClassName = "" }) {
  const panelRef = useRef(null);
  const prevOverflowRef = useRef("");

  useEffect(() => {
    if (!open) return;
    if (!isDesktopLikeInput()) return;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (typeof onClose === "function") onClose({ reason: "escape", event: e });
      }
    }
    window.addEventListener("keydown", onKeyDown, true);

    // Focus first focusable element inside the panel (desktop only)
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelector(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      if (focusable && typeof focusable.focus === "function") focusable.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    const body = document.body;
    prevOverflowRef.current = body.style.overflow || "";
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflowRef.current;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={`modalBackdrop${backdropClassName ? ` ${backdropClassName}` : ""}`}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (typeof onClose === "function") onClose({ reason: "backdrop", event: e });
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`modalPanel${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
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
      <svg
        viewBox="0 0 40 40"
        style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 6px 18px rgba(0,0,0,.35))" }}
      >
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="var(--border, rgba(255,255,255,0.14))"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="var(--accent, rgba(255,255,255,0.92))"
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

// --- Premium UI primitives (chips / toggles / hints) ---

export function Chip({
  children,
  active = false,
  as = "button",
  className = "",
  type = "button",
  ...props
}) {
  const Tag = as;
  const cls = `chip${active ? " isActive" : ""}${className ? ` ${className}` : ""}`;
  return (
    <Tag className={cls} type={Tag === "button" ? type : undefined} {...props}>
      {children}
    </Tag>
  );
}

export function ChipRow({ children, className = "", ...props }) {
  return (
    <div className={`chipRow${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </div>
  );
}

export function ToggleChip({ children, value, selected, onSelect, disabled = false, className = "" }) {
  const isActive = value === selected;
  return (
    <Chip
      active={isActive}
      disabled={disabled}
      className={className}
      onClick={() => (!disabled && typeof onSelect === "function" ? onSelect(value) : null)}
      aria-pressed={isActive}
    >
      {children}
    </Chip>
  );
}

export function Hint({ children, tone = "muted", className = "", ...props }) {
  const cls =
    tone === "danger"
      ? "hint hintDanger"
      : tone === "accent"
        ? "hint hintAccent"
        : "hint";
  return (
    <div className={`${cls}${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </div>
  );
}

export function CheckboxRow({ checked, onChange, label, description = "", disabled = false, className = "" }) {
  return (
    <label className={`checkRow${disabled ? " isDisabled" : ""}${className ? ` ${className}` : ""}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => (typeof onChange === "function" ? onChange(e) : null)}
      />
      <div className="checkRowText">
        <div className="checkRowLabel">{label}</div>
        {description ? <div className="checkRowDesc">{description}</div> : null}
      </div>
    </label>
  );
}

export function Divider({ className = "", ...props }) {
  return <div className={`divider${className ? ` ${className}` : ""}`} {...props} />;
}
