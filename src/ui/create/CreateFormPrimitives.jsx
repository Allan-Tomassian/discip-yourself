import React from "react";
import {
  AppInput,
  AppSelect,
  AppTextarea,
  ChoiceCard,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
} from "../../shared/ui/app";
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
  const ButtonComponent =
    variant === "ghost" ? GhostButton : variant === "secondary" ? SecondaryButton : PrimaryButton;
  return (
    <ButtonComponent
      className={cx("createActionButton", className)}
      withSound={withSound}
      {...props}
    >
      {children}
    </ButtonComponent>
  );
}

export function CreateChoiceCard({
  title,
  description = "",
  badge = "",
  selected = false,
  disabled = false,
  className = "",
  onClick,
  children = null,
  ...props
}) {
  return (
    <ChoiceCard
      title={title}
      description={description}
      badge={badge ? <StatusBadge className="createChoiceBadge">{badge}</StatusBadge> : null}
      className={cx(
        "createChoiceCard",
        disabled && "isDisabled",
        className
      )}
      selected={selected}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...props}
    >
      <div className="createChoiceText">
        {children}
      </div>
    </ChoiceCard>
  );
}

export function CreateInput({ className = "", style, ...props }) {
  const input = <AppInput className={cx("createInputControl", className)} style={style} {...props} />;
  return wrapDateLikeControl(props?.type, input);
}

export function CreateTextarea({ className = "", style, ...props }) {
  return (
    <AppTextarea className={cx("createTextareaControl", className)} style={style} {...props} />
  );
}

export function CreateSelect({ className = "", ...props }) {
  return <AppSelect className={cx("createSelectControl", className)} {...props} />;
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
