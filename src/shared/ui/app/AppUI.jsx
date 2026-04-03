import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import ScreenShell from "../../../pages/_ScreenShell";
import {
  GateBadge,
  GateButton,
  GateCard,
  GateFooter,
  GateHeader,
  GatePanel,
  GateSection,
  GateSectionIntro,
  GateRow,
  cx,
} from "../gate/Gate";
import {
  GateIconButton,
  GateInput,
  GateTextButton,
  GateTextarea,
} from "../gate/GateForm";
import GateDialog from "../gate/GateDialog";
import Select from "../../../ui/select/Select";
import "../overlays/overlays.css";
import "./app.css";

function coerceVariant(variant) {
  if (variant === "metric") return "metric";
  if (variant === "elevated") return "elevated";
  return "standard";
}

function cardClassName({ variant = "standard", interactive = false, className = "" } = {}) {
  return cx(
    "AppCard",
    `AppCard--${coerceVariant(variant)}`,
    interactive && "AppCard--interactive",
    variant === "standard" ? "GateSecondarySectionCard" : "GateMainSection GateMainSectionCard",
    "GateSurfacePremium",
    "GateCardPremium",
    interactive && "GateRowPremium GateInlineMetaCard GatePressable",
    className
  );
}

export function AppScreen(props) {
  return <ScreenShell {...props} />;
}

export function ScreenHeader({ title, subtitle, actions = null, className = "", ...props }) {
  return (
    <GateSectionIntro
      title={title}
      subtitle={subtitle}
      actions={actions}
      className={cx("AppSectionHeader", className)}
      {...props}
    />
  );
}

export function SectionHeader(props) {
  return <ScreenHeader {...props} />;
}

export function AppCard({
  variant = "standard",
  interactive = false,
  selected = false,
  onClick,
  className = "",
  children,
  ...props
}) {
  const resolvedInteractive = interactive || typeof onClick === "function";
  if (resolvedInteractive) {
    return (
      <GateCard
        className={cardClassName({ variant, interactive: true, className })}
        selected={selected}
        onClick={onClick}
        {...props}
      >
        {children}
      </GateCard>
    );
  }

  return (
    <GateSection
      collapsible={false}
      className={cardClassName({ variant, interactive: false, className })}
      {...props}
    >
      {children}
    </GateSection>
  );
}

export function PrimaryButton({ className = "", withSound = true, ...props }) {
  return <GateButton className={cx("GatePressable", className)} withSound={withSound} {...props} />;
}

export function SecondaryButton({ className = "", withSound = true, ...props }) {
  return (
    <GateButton
      variant="secondary"
      className={cx("GatePressable", className)}
      withSound={withSound}
      {...props}
    />
  );
}

export function GhostButton({ className = "", withSound = true, ...props }) {
  return (
    <GateButton
      variant="ghost"
      className={cx("GatePressable", className)}
      withSound={withSound}
      {...props}
    />
  );
}

export function AppTextButton(props) {
  return <GateTextButton {...props} />;
}

export function AppIconButton({ className = "", ...props }) {
  return <GateIconButton className={cx("GatePressable", className)} {...props} />;
}

export function StatusBadge({ tone = "info", className = "", children, ...props }) {
  return (
    <GateBadge className={cx("appStatusBadge", `is-${tone}`, className)} {...props}>
      {children}
    </GateBadge>
  );
}

export function AppInput({ className = "", ...props }) {
  return <GateInput className={cx("AppInput", className)} {...props} />;
}

export function AppTextarea({ className = "", ...props }) {
  return <GateTextarea className={cx("AppTextarea", className)} {...props} />;
}

export function AppSelect({ className = "", ...props }) {
  return <Select className={cx("GateSelectPremium", "AppSelect", className)} {...props} />;
}

export function FieldGroup({
  label = "",
  helper = "",
  error = "",
  htmlFor,
  className = "",
  children,
}) {
  return (
    <label className={cx("appFieldGroup", className)} htmlFor={htmlFor}>
      {label ? <span className="appFieldLabel">{label}</span> : null}
      {children}
      {error ? (
        <span className="appFieldMessage is-error" role="alert">
          {error}
        </span>
      ) : helper ? (
        <span className="appFieldMessage">{helper}</span>
      ) : null}
    </label>
  );
}

export function ChoiceCard({
  title,
  description = "",
  badge = null,
  selected = false,
  disabled = false,
  className = "",
  onClick,
  children = null,
  ...props
}) {
  return (
    <AppCard
      interactive
      selected={selected}
      onClick={disabled ? undefined : onClick}
      className={cx("appChoiceCard", disabled && "is-disabled", className)}
      {...props}
    >
      <div className="appChoiceCardText">
        {title ? <div className="appChoiceCardTitle">{title}</div> : null}
        {description ? <div className="appChoiceCardDescription">{description}</div> : null}
        {children}
      </div>
      {badge ? <StatusBadge className="appChoiceCardBadge">{badge}</StatusBadge> : null}
    </AppCard>
  );
}

export function EmptyState({ title, subtitle = "", actions = null, className = "" }) {
  return (
    <AppCard className={cx("appEmptyState", className)}>
      {title ? <div className="appEmptyStateTitle">{title}</div> : null}
      {subtitle ? <div className="appEmptyStateSubtitle">{subtitle}</div> : null}
      {actions ? <div className="appEmptyStateActions">{actions}</div> : null}
    </AppCard>
  );
}

export function MetricRow({ label, value, meta = null, right = null, className = "" }) {
  return (
    <div className={cx("appMetricRow", className)}>
      <div className="appMetricRowText">
        <div className="appMetricRowLabel">{label}</div>
        {meta ? <div className="appMetricRowMeta">{meta}</div> : null}
      </div>
      <div className="appMetricRowValueCluster">
        {right}
        <div className="appMetricRowValue">{value}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value01 = 0, tone = "info", className = "", label = "" }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value01) ? value01 : 0));
  return (
    <div className={cx("appProgressBar", className)}>
      {label ? <div className="appProgressBarLabel">{label}</div> : null}
      <div className="appProgressBarTrack" aria-hidden="true">
        <div
          className={cx("appProgressBarFill", `is-${tone}`)}
          style={{ width: `${Math.round(clamped * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function FeedbackMessage({ tone = "info", className = "", children, ...props }) {
  return (
    <div className={cx("appFeedbackMessage", `is-${tone}`, className)} {...props}>
      {children}
    </div>
  );
}

export function AppDrawer({
  open = false,
  onClose,
  ariaLabel = "Drawer",
  className = "",
  panelClassName = "",
  children,
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const { body, documentElement } = document;
    const scrollY = typeof window !== "undefined" ? window.scrollY || 0 : 0;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousHtmlOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      documentElement.style.overflow = previousHtmlOverflow;
      if (typeof window !== "undefined") window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={cx("modalBackdrop", "appDrawerBackdrop", className)} onClick={() => onClose?.()} role="presentation">
      <div className="appDrawerOuter GateGlassOuter" onClick={(event) => event.stopPropagation()}>
        <div className="appDrawerClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            className={cx(
              "appDrawerPanel",
              "GateGlassContent",
              "GateMainSection",
              "GateMainSectionCard",
              "GateSurfacePremium",
              "GateCardPremium",
              panelClassName
            )}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
          >
            {children}
          </GatePanel>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AppSheet({ className = "", ...props }) {
  return <GateDialog className={cx("appSheet", className)} {...props} />;
}

export { GateFooter, GateHeader, GatePanel, GateRow };
