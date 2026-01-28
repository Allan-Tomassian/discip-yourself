import React, { useEffect, useMemo, useRef, useState } from "react";
import AccentContext from "./AccentContext";

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
    options.find((opt) => opt.disabled && (opt.value === "" || opt.value == null))?.label ||
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
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selected = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;

    function getOptionButtons() {
      const root = menuRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll("button.selectOption:not([disabled])"));
    }

    function focusSelectedOrFirst() {
      const root = menuRef.current;
      if (!root) return;
      const selectedBtn = root.querySelector("button.selectOption[aria-selected='true']:not([disabled])");
      if (selectedBtn) {
        selectedBtn.focus();
        return;
      }
      const first = root.querySelector("button.selectOption:not([disabled])");
      if (first) first.focus();
    }

    // Move focus into the menu on open
    const t = window.setTimeout(focusSelectedOrFirst, 0);

    function handleKeyDown(event) {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      const buttons = getOptionButtons();
      if (!buttons.length) return;

      const active = document.activeElement;
      const idx = buttons.indexOf(active);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = idx >= 0 ? buttons[(idx + 1) % buttons.length] : buttons[0];
        next.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = idx >= 0 ? buttons[(idx - 1 + buttons.length) % buttons.length] : buttons[buttons.length - 1];
        next.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        buttons[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (event.key === "Enter") {
        // Let the focused button's onClick handle selection
        if (active && active.classList?.contains("selectOption")) {
          event.preventDefault();
          active.click();
        }
      } else if (event.key === "Tab") {
        // Keep focus within the menu when open (simple trap)
        event.preventDefault();
        const dir = event.shiftKey ? -1 : 1;
        const next = idx >= 0 ? buttons[(idx + dir + buttons.length) % buttons.length] : buttons[0];
        next.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      const wrap = e.target?.closest?.(".selectMenuWrap");
      if (!wrap) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  function handleSelect(opt) {
    if (!opt || opt.disabled) return;
    if (typeof onChange === "function") onChange(opt.value);
    setOpen(false);
    window.setTimeout(() => {
      if (triggerRef.current) triggerRef.current.focus();
    }, 0);
  }

  return (
    <div className="selectMenuWrap" style={{ maxWidth: "100%", ...(style || {}) }}>
      <button
        ref={triggerRef}
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
          <div ref={menuRef} className={`selectMenu${menuClassName ? ` ${menuClassName}` : ""}`} role="listbox">
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
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (typeof onClose === "function") onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);

    // Focus first focusable element inside the panel
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

  if (!open) return null;
  return (
    <div className="modalBackdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className={`modalPanel${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
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
