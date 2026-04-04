import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  GateStandaloneScreen,
  GateTextButton,
  GateTextarea,
} from "../gate/GateForm";
import GateDialog from "../gate/GateDialog";
import Select from "../../../ui/select/Select";
import DatePicker from "../../../ui/date/DatePicker";
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

export function AppStandaloneScreen({ className = "", panelClassName = "", ...props }) {
  return (
    <GateStandaloneScreen
      className={cx("appStandaloneScreen", className)}
      panelClassName={cx("appStandaloneScreenPanel", panelClassName)}
      {...props}
    />
  );
}

export function AppSurface({ className = "", children, ...props }) {
  return (
    <GatePanel
      className={cx("appSurface", "GateSurfacePremium", "GateCardPremium", className)}
      {...props}
    >
      {children}
    </GatePanel>
  );
}

export function AppToast({ className = "", children, ...props }) {
  return (
    <GatePanel
      className={cx("appToast", "GateSurfacePremium", "GateCardPremium", className)}
      {...props}
    >
      {children}
    </GatePanel>
  );
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

export function AppHeader({ className = "", ...props }) {
  return <GateHeader className={cx("appHeader", className)} {...props} />;
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

export const AppIconButton = React.forwardRef(function AppIconButton(
  { className = "", ...props },
  ref
) {
  return <GateIconButton ref={ref} className={cx("GatePressable", className)} {...props} />;
});

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

export function AppDateField({ className = "", ...props }) {
  return <DatePicker className={cx("AppDateField", className)} {...props} />;
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

export function AppActionRow({
  align = "end",
  className = "",
  children,
  ...props
}) {
  return (
    <div
      className={cx("appActionRow", align !== "end" && `appActionRow--${align}`, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppSettingRow({
  label,
  meta = "",
  right = null,
  className = "",
  withSound = true,
  ...props
}) {
  return (
    <GateRow
      label={label}
      meta={meta}
      right={right}
      withSound={withSound}
      className={cx("appSettingRow", "GatePressable", className)}
      {...props}
    />
  );
}

export function AppFormSection({
  title,
  description = "",
  main = false,
  collapsible = false,
  defaultOpen = true,
  className = "",
  bodyClassName = "",
  children,
  ...props
}) {
  const cardClassName = cx(
    "appFormSection",
    main ? "GateMainSection GateMainSectionCard" : "GateSecondarySectionCard",
    "GateSurfacePremium",
    "GateCardPremium",
    className
  );
  return (
    <GateSection
      title={title}
      description={description}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      className={cardClassName}
      {...props}
    >
      <div className={cx("appFormSectionBody", bodyClassName)}>
        {children}
      </div>
    </GateSection>
  );
}

export function AppInlineMetaCard({
  title = "",
  text = "",
  meta = "",
  action = null,
  className = "",
  bodyClassName = "",
  titleClassName = "",
  textClassName = "",
  metaClassName = "",
  actionClassName = "",
  children = null,
  ...props
}) {
  return (
    <div className={cx("appInlineMetaCard", "GateInlineMetaCard", className)} {...props}>
      <div className={cx("appInlineMetaCardBody", bodyClassName)}>
        {title ? <div className={cx("appInlineMetaCardTitle", titleClassName)}>{title}</div> : null}
        {text ? <div className={cx("appInlineMetaCardText", textClassName)}>{text}</div> : null}
        {meta ? <div className={cx("appInlineMetaCardMeta", metaClassName)}>{meta}</div> : null}
        {children}
      </div>
      {action ? <div className={cx("appInlineMetaCardAction", actionClassName)}>{action}</div> : null}
    </div>
  );
}

export function AppStickyFooter({
  error = "",
  className = "",
  surfaceClassName = "",
  stackClassName = "",
  actionsClassName = "",
  children,
}) {
  return (
    <div className={cx("appStickyFooterDock", className)}>
      <div className={cx("appStickyFooterSurface", surfaceClassName)}>
        <div className={cx("appStickyFooterStack", stackClassName)}>
          {error ? (
            <FeedbackMessage tone="error" role="alert">
              {error}
            </FeedbackMessage>
          ) : null}
          <div className={cx("appStickyFooterActions", actionsClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AppToggleRow({
  checked = false,
  onChange,
  label,
  description = "",
  disabled = false,
  className = "",
}) {
  return (
    <label className={cx("appToggleRow", disabled && "is-disabled", className)}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(event) => onChange?.(event)}
      />
      <div className="appToggleRowText">
        <div className="appToggleRowLabel">{label}</div>
        {description ? <div className="appToggleRowDescription">{description}</div> : null}
      </div>
    </label>
  );
}

export function AppChip({
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
      className={cx("appChip", active && "is-active", className)}
      type={Tag === "button" ? type : undefined}
      {...props}
    >
      {children}
    </Tag>
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

export function AppSheetContent({
  title = "",
  subtitle = "",
  actions = null,
  footer = null,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
  children,
}) {
  return (
    <div className={cx("appSheetContent", className)}>
      {title || subtitle || actions ? (
        <GateHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          className={cx("appSheetContentHeader", headerClassName)}
        />
      ) : null}
      <div className={cx("appSheetContentBody", bodyClassName)}>{children}</div>
      {footer ? <div className={cx("appSheetContentFooter", footerClassName)}>{footer}</div> : null}
    </div>
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

export function AppDialog({ className = "", ...props }) {
  return <GateDialog className={cx("appDialog", className)} {...props} />;
}

function toAnchorRect(rect) {
  if (!rect) return null;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function resolvePopoverPosition({ anchorRect, panelRect, viewportW, viewportH, minMargin, gap = 10 }) {
  const menuW = panelRect?.width || 220;
  const menuH = panelRect?.height || 180;
  const anchor = anchorRect || {
    top: minMargin,
    left: viewportW - menuW - minMargin,
    right: viewportW - minMargin,
    bottom: minMargin,
  };
  const shouldDropUp = anchor.bottom + menuH + gap > viewportH && anchor.top - menuH - gap > minMargin;
  const top = shouldDropUp
    ? Math.max(minMargin, anchor.top - menuH - gap)
    : Math.min(viewportH - menuH - minMargin, anchor.bottom + gap);
  let left = anchor.right - menuW;
  left = Math.max(minMargin, Math.min(left, viewportW - menuW - minMargin));
  return {
    left,
    top,
    transformOrigin: shouldDropUp ? "bottom right" : "top right",
  };
}

export function AppPopoverMenu({
  open = false,
  anchorRect = null,
  anchorEl = null,
  onClose,
  ariaLabel = "Menu",
  className = "",
  panelClassName = "",
  children,
}) {
  const panelRef = useRef(null);
  const [panelRect, setPanelRect] = useState(null);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    setPanelRect(toAnchorRect(panelRef.current.getBoundingClientRect()));
  }, [open, children]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (anchorEl?.contains?.(event.target)) return;
      onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [anchorEl, onClose, open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const firstButton = panelRef.current.querySelector(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );
    firstButton?.focus?.();
  }, [children, open]);

  if (!open) return null;

  const styles = typeof document !== "undefined" && typeof window !== "undefined"
    ? window.getComputedStyle(document.documentElement)
    : null;
  const pagePad = Number.parseFloat(styles?.getPropertyValue("--page-pad") || "") || 16;
  const safeLeft = Number.parseFloat(styles?.getPropertyValue("--safe-left") || "") || 0;
  const safeRight = Number.parseFloat(styles?.getPropertyValue("--safe-right") || "") || 0;
  const minMargin = Math.max(8, pagePad + Math.max(safeLeft, safeRight));
  const viewportW = typeof window !== "undefined" ? window.visualViewport?.width || window.innerWidth || 0 : 0;
  const viewportH = typeof window !== "undefined" ? window.visualViewport?.height || window.innerHeight || 0 : 0;
  const position = typeof window !== "undefined"
    ? resolvePopoverPosition({
        anchorRect,
        panelRect,
        viewportW,
        viewportH,
        minMargin,
      })
    : { left: 16, top: 72, transformOrigin: "top right" };

  const content = (
    <div
      className={cx("appPopoverMenu", className)}
      style={{ left: position.left, top: position.top, transformOrigin: position.transformOrigin }}
    >
      <div
        ref={panelRef}
        className={cx("appPopoverMenuPanel", panelClassName)}
        role="menu"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;

  return createPortal(content, document.body);
}

export { GateFooter, GateHeader, GatePanel, GateRow };
