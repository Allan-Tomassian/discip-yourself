import React from "react";
import { GateButton } from "../../shared/ui/gate/Gate";
import Select from "../select/Select";
import "../../features/create-flow/createFlow.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function wrapDateLikeControl(type, node) {
  const isDateLike = type === "date" || type === "datetime-local" || type === "time";
  return isDateLike ? <div className="controlClip">{node}</div> : node;
}

export function CreateButton({
  children,
  variant = "primary",
  className = "",
  withSound = true,
  ...props
}) {
  return (
    <GateButton
      variant={variant}
      className={cx("GatePressable", "createActionButton", className)}
      withSound={withSound}
      {...props}
    >
      {children}
    </GateButton>
  );
}

export function CreateInput({ className = "", style, ...props }) {
  const input = (
    <input
      className={cx("GateInputPremium", "createInputControl", className)}
      style={{ maxWidth: "100%", minWidth: 0, ...(style || {}) }}
      {...props}
    />
  );
  return wrapDateLikeControl(props?.type, input);
}

export function CreateTextarea({ className = "", style, ...props }) {
  return (
    <textarea
      className={cx("GateTextareaPremium", "createTextareaControl", className)}
      style={{ maxWidth: "100%", minWidth: 0, ...(style || {}) }}
      {...props}
    />
  );
}

export function CreateSelect({ className = "", ...props }) {
  return <Select className={cx("GateSelectPremium", "createSelectControl", className)} {...props} />;
}

export function CreateChip({
  children,
  active = false,
  as = "button",
  className = "",
  type = "button",
  ...props
}) {
  const Tag = as;
  return (
    <Tag
      className={cx("chip", "createChip", active && "isActive", className)}
      type={Tag === "button" ? type : undefined}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CreateChipRow({ children, className = "", ...props }) {
  return (
    <div className={cx("chipRow", "createChipRow", className)} {...props}>
      {children}
    </div>
  );
}

export function CreateToggleChip({
  children,
  value,
  selected,
  onSelect,
  disabled = false,
  className = "",
}) {
  const isActive = value === selected;
  return (
    <CreateChip
      active={isActive}
      disabled={disabled}
      className={className}
      onClick={() => (!disabled && typeof onSelect === "function" ? onSelect(value) : null)}
      aria-pressed={isActive}
    >
      {children}
    </CreateChip>
  );
}

export function CreateHint({ children, tone = "muted", className = "", ...props }) {
  const toneClass =
    tone === "danger" ? "hintDanger" : tone === "accent" ? "hintAccent" : "";
  return (
    <div className={cx("hint", toneClass, "createHint", className)} {...props}>
      {children}
    </div>
  );
}

export function CreateCheckboxRow({
  checked,
  onChange,
  label,
  description = "",
  disabled = false,
  className = "",
}) {
  return (
    <label className={cx("checkRow", "createCheckRow", disabled && "isDisabled", className)}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(event) => (typeof onChange === "function" ? onChange(event) : null)}
      />
      <div className="checkRowText">
        <div className="checkRowLabel">{label}</div>
        {description ? <div className="checkRowDesc">{description}</div> : null}
      </div>
    </label>
  );
}
