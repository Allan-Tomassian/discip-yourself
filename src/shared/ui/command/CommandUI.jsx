import React from "react";
import { AppDialog, AppPopoverMenu, AppSheet } from "../app";
import { cx } from "../gate/gateCx";
import { commandToneClassName, normalizeCommandTone } from "./commandTone";
import "./command.css";

export function CommandSurface({
  as = "section",
  tone = "neutral",
  density = "standard",
  interactive = false,
  className = "",
  children,
  ...props
}) {
  const resolvedTone = normalizeCommandTone(tone);
  return React.createElement(
    as,
    {
      className: cx(
        "CommandSurface",
        commandToneClassName("CommandSurface", resolvedTone),
        density === "compact" && "CommandSurface--compact",
        interactive && "CommandSurface--interactive",
        className
      ),
      "data-command-tone": resolvedTone,
      ...props,
    },
    children
  );
}

export function CommandCard({ className = "", children, ...props }) {
  return (
    <CommandSurface className={cx("CommandCard", className)} {...props}>
      {children}
    </CommandSurface>
  );
}

export function CommandSectionHeader({
  label = "",
  title = "",
  subtitle = "",
  actions = null,
  tone = "neutral",
  className = "",
  ...props
}) {
  const resolvedTone = normalizeCommandTone(tone);
  return (
    <header
      className={cx("CommandSectionHeader", commandToneClassName("CommandSectionHeader", resolvedTone), className)}
      data-command-tone={resolvedTone}
      {...props}
    >
      <div className="CommandSectionHeader__text">
        {label ? <div className="CommandSectionHeader__label">{label}</div> : null}
        {title ? <div className="CommandSectionHeader__title">{title}</div> : null}
        {subtitle ? <div className="CommandSectionHeader__subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="CommandSectionHeader__actions">{actions}</div> : null}
    </header>
  );
}

function normalizeStep(step, index) {
  if (typeof step === "string") {
    return { id: `step-${index}`, label: step, status: index === 0 ? "active" : "pending" };
  }
  if (!step || typeof step !== "object") {
    return { id: `step-${index}`, label: "", status: "pending" };
  }
  return {
    id: step.id || `step-${index}`,
    label: step.label || "",
    status: step.status === "complete" || step.status === "active" ? step.status : "pending",
  };
}

export function CommandStatusSurface({
  label = "",
  title = "",
  subtitle = "",
  steps = [],
  tone = "execution",
  icon = null,
  actions = null,
  footer = null,
  className = "",
  children = null,
  ...props
}) {
  const resolvedTone = normalizeCommandTone(tone);
  const normalizedSteps = Array.isArray(steps) ? steps.map(normalizeStep).filter((step) => step.label) : [];
  return (
    <CommandCard
      tone={resolvedTone}
      className={cx("CommandStatusSurface", className)}
      {...props}
    >
      <CommandSectionHeader label={label} title={title} subtitle={subtitle} tone={resolvedTone} />
      {icon ? <div className="CommandStatusSurface__icon" aria-hidden="true">{icon}</div> : null}
      {normalizedSteps.length ? (
        <div className="CommandStatusSurface__steps">
          {normalizedSteps.map((step) => (
            <div
              key={step.id}
              className={cx("CommandStatusStep", `CommandStatusStep--${step.status}`)}
            >
              <span className="CommandStatusStep__dot" aria-hidden="true" />
              <span className="CommandStatusStep__label">{step.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {children}
      {actions ? <div className="CommandStatusSurface__actions">{actions}</div> : null}
      {footer ? <div className="CommandStatusSurface__footer">{footer}</div> : null}
    </CommandCard>
  );
}

export function CommandLoadingState({
  label = "SYSTÈME",
  title = "Chargement de ton système…",
  subtitle = "",
  steps = [],
  tone = "execution",
  className = "",
  surfaceClassName = "",
  ...props
}) {
  return (
    <div className={cx("CommandStateScreen", className)} {...props}>
      <CommandStatusSurface
        label={label}
        title={title}
        subtitle={subtitle}
        steps={steps}
        tone={tone}
        className={surfaceClassName}
        role="status"
        aria-live="polite"
      />
    </div>
  );
}

export function CommandEmptyState({
  label = "SYSTÈME",
  title = "",
  subtitle = "",
  actions = null,
  tone = "neutral",
  className = "",
  ...props
}) {
  return (
    <CommandStatusSurface
      label={label}
      title={title}
      subtitle={subtitle}
      actions={actions}
      tone={tone}
      className={cx("CommandEmptyState", className)}
      {...props}
    />
  );
}

export function CommandErrorState({
  label = "ERREUR",
  title = "Une erreur est survenue",
  subtitle = "",
  actions = null,
  className = "",
  children = null,
  ...props
}) {
  return (
    <CommandStatusSurface
      label={label}
      title={title}
      subtitle={subtitle}
      actions={actions}
      tone="critical"
      className={cx("CommandErrorState", className)}
      role="alert"
      {...props}
    >
      {children}
    </CommandStatusSurface>
  );
}

export function CommandCTA({
  as: Tag = "button",
  variant = "primary",
  tone = "neutral",
  className = "",
  type = "button",
  children,
  ...props
}) {
  const resolvedTone = normalizeCommandTone(tone);
  const resolvedVariant = variant === "secondary" || variant === "ghost" ? variant : "primary";
  return (
    <Tag
      className={cx(
        "CommandCTA",
        `CommandCTA--${resolvedVariant}`,
        commandToneClassName("CommandCTA", resolvedTone),
        className
      )}
      data-command-tone={resolvedTone}
      type={Tag === "button" ? type : undefined}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CommandBadge({ tone = "neutral", className = "", children, ...props }) {
  const resolvedTone = normalizeCommandTone(tone);
  return (
    <span
      className={cx("CommandBadge", commandToneClassName("CommandBadge", resolvedTone), className)}
      data-command-tone={resolvedTone}
      {...props}
    >
      {children}
    </span>
  );
}

export function CommandAIBlock({ label = "IA", title = "", subtitle = "", children = null, className = "", ...props }) {
  return (
    <CommandCard tone="ai" className={cx("CommandAIBlock", className)} {...props}>
      <CommandSectionHeader label={label} title={title} subtitle={subtitle} tone="ai" />
      {children}
    </CommandCard>
  );
}

export function CommandSheet({ tone = "neutral", className = "", ...props }) {
  const resolvedTone = normalizeCommandTone(tone);
  return (
    <AppSheet
      className={cx("CommandSheet", commandToneClassName("CommandSheet", resolvedTone), className)}
      {...props}
    />
  );
}

export function CommandDialog({ tone = "neutral", className = "", ...props }) {
  const resolvedTone = normalizeCommandTone(tone);
  return (
    <AppDialog
      className={cx("CommandDialog", commandToneClassName("CommandDialog", resolvedTone), className)}
      {...props}
    />
  );
}

export function CommandPopoverMenu({ tone = "neutral", panelClassName = "", ...props }) {
  const resolvedTone = normalizeCommandTone(tone);
  return (
    <AppPopoverMenu
      panelClassName={cx("CommandPopoverMenu", commandToneClassName("CommandPopoverMenu", resolvedTone), panelClassName)}
      {...props}
    />
  );
}

export function CommandTimelineRow({
  time = "",
  title = "",
  meta = "",
  tone = "neutral",
  right = null,
  className = "",
  ...props
}) {
  const resolvedTone = normalizeCommandTone(tone);
  return (
    <div
      className={cx("CommandTimelineRow", commandToneClassName("CommandTimelineRow", resolvedTone), className)}
      data-command-tone={resolvedTone}
      {...props}
    >
      {time ? <div className="CommandTimelineRow__time">{time}</div> : null}
      <div className="CommandTimelineRow__body">
        {title ? <div className="CommandTimelineRow__title">{title}</div> : null}
        {meta ? <div className="CommandTimelineRow__meta">{meta}</div> : null}
      </div>
      {right ? <div className="CommandTimelineRow__right">{right}</div> : null}
    </div>
  );
}
