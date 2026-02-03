import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Portal from "../portal/Portal";
import { Z } from "../layer/zIndex";

const DEFAULT_MENU_WIDTH = 280;
const DEFAULT_MENU_HEIGHT = 240;
const MAX_MENU_WIDTH = 360;
const VIEWPORT_MARGIN = 8;

export function computeSelectPosition({ rect, menuRect, viewport, minMargin = VIEWPORT_MARGIN }) {
  const safeRect = rect || {};
  const safeMenuRect = menuRect || {};
  const viewportW = Math.round(viewport?.width || 0);
  const viewportH = Math.round(viewport?.height || 0);
  const anchorWidth = Math.round(safeRect.width || 0);
  const measuredWidth = Math.round(safeMenuRect.width || 0);
  const popoverHeight = Math.round(safeMenuRect.height || 0);

  const viewportMaxWidth = Math.max(0, viewportW - minMargin * 2);
  const maxWidth = Math.min(MAX_MENU_WIDTH, viewportMaxWidth || MAX_MENU_WIDTH);
  const baseWidth = anchorWidth || measuredWidth || maxWidth || 0;
  const minWidth = Math.min(baseWidth, maxWidth || baseWidth);

  let left = Math.round(safeRect.left || 0);
  const rectRight = Number.isFinite(safeRect.right) ? safeRect.right : left + minWidth;
  if (left + minWidth > viewportW - minMargin) {
    left = Math.round(rectRight - minWidth);
  }
  left = Math.max(minMargin, Math.min(left, viewportW - minWidth - minMargin));

  let top = Math.round(safeRect.bottom || 0);
  if (popoverHeight && top + popoverHeight > viewportH - minMargin) {
    const rectTop = Number.isFinite(safeRect.top) ? safeRect.top : top;
    const flipped = Math.round(rectTop - popoverHeight);
    if (flipped >= minMargin) top = flipped;
  }
  top = Math.max(minMargin, Math.min(top, viewportH - popoverHeight - minMargin));

  return { top, left, width: minWidth, minWidth, maxWidth };
}

function buildOptions(children, optionsProp) {
  if (Array.isArray(optionsProp)) return optionsProp;
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
}

export default function Select({
  children,
  value,
  onChange,
  disabled = false,
  placeholder,
  className = "",
  menuClassName = "",
  style,
  "aria-label": ariaLabel,
  options,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const [menuLayerZ, setMenuLayerZ] = useState(Z.dropdown);
  const [isPositioned, setIsPositioned] = useState(false);
  const lastSigRef = useRef("");
  const raf1Ref = useRef(0);
  const raf2Ref = useRef(0);
  const scrollParentsRef = useRef([]);

  const rawOptions = useMemo(() => buildOptions(children, options), [children, options]);
  const optionsList = useMemo(
    () => rawOptions.filter((opt) => opt.value !== "" || !opt.disabled),
    [rawOptions]
  );

  const derivedPlaceholder =
    placeholder ||
    rawOptions.find((opt) => opt.disabled && (opt.value === "" || opt.value == null))?.label ||
    "Sélectionner";

  const selected = useMemo(
    () => optionsList.find((opt) => opt.value === value) || null,
    [optionsList, value]
  );

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return false;

    const anchorRect = triggerEl.getBoundingClientRect();
    const rawMenuRect = menuEl.getBoundingClientRect();
    let menuWidth = rawMenuRect.width;
    let menuHeight = rawMenuRect.height;
    let hasMeasured = menuWidth > 0 && menuHeight > 0;
    if (!hasMeasured) {
      menuWidth = menuEl.offsetWidth || 0;
      menuHeight = menuEl.offsetHeight || 0;
      hasMeasured = menuWidth > 0 && menuHeight > 0;
    }
    if (!menuWidth || !menuHeight) {
      menuWidth = DEFAULT_MENU_WIDTH;
      menuHeight = DEFAULT_MENU_HEIGHT;
    }

    const viewport = {
      width: window.visualViewport?.width || window.innerWidth || 0,
      height: window.visualViewport?.height || window.innerHeight || 0,
    };

    const next = computeSelectPosition({
      rect: anchorRect,
      menuRect: { width: menuWidth, height: menuHeight },
      viewport,
    });

    const nextStyle = {
      position: "fixed",
      top: next.top,
      left: next.left,
      width: next.width,
      minWidth: next.minWidth,
      maxWidth: next.maxWidth,
      right: "auto",
    };

    const sig = `${nextStyle.top}|${nextStyle.left}|${nextStyle.width}|${nextStyle.minWidth}|${nextStyle.maxWidth}`;
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setMenuStyle(nextStyle);
    }

    const isDev = typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";
    if (isDev) {
      console.debug("[Select] anchor rect + position", {
        rect: {
          top: Math.round(anchorRect.top),
          left: Math.round(anchorRect.left),
          right: Math.round(anchorRect.right),
          bottom: Math.round(anchorRect.bottom),
          width: Math.round(anchorRect.width),
          height: Math.round(anchorRect.height),
        },
        pos: nextStyle,
        popover: { width: Math.round(menuWidth), height: Math.round(menuHeight) },
        viewport: { width: Math.round(viewport.width), height: Math.round(viewport.height) },
      });
    }
    return hasMeasured;
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      setMenuLayerZ(Z.dropdown);
      setIsPositioned(false);
      lastSigRef.current = "";
      return;
    }
    if (typeof window === "undefined") return;

    const trigger = triggerRef.current;
    const inModal = trigger?.closest?.(".modalBackdrop");
    setMenuLayerZ(inModal ? Z.modal + 1 : Z.dropdown);
    setIsPositioned(false);

    const attempt = () => {
      const ok = updatePosition();
      if (ok) {
        setIsPositioned(true);
        return;
      }
      raf2Ref.current = window.requestAnimationFrame(attempt);
    };

    raf1Ref.current = window.requestAnimationFrame(() => {
      updatePosition();
      raf2Ref.current = window.requestAnimationFrame(attempt);
    });

    return () => {
      if (raf1Ref.current) window.cancelAnimationFrame(raf1Ref.current);
      if (raf2Ref.current) window.cancelAnimationFrame(raf2Ref.current);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    const schedule = () => {
      if (raf1Ref.current) window.cancelAnimationFrame(raf1Ref.current);
      raf1Ref.current = window.requestAnimationFrame(updatePosition);
    };

    function getScrollParents(node) {
      const parents = [];
      let current = node?.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const overflowY = style?.overflowY || "";
        const overflowX = style?.overflowX || "";
        const overflow = style?.overflow || "";
        const isScrollable = /(auto|scroll|overlay)/.test(`${overflow} ${overflowY} ${overflowX}`);
        if (isScrollable) parents.push(current);
        current = current.parentElement;
      }
      return parents;
    }

    const scrollParents = getScrollParents(triggerRef.current);
    scrollParentsRef.current = scrollParents;

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    scrollParents.forEach((parent) => {
      parent.addEventListener("scroll", schedule, { passive: true, capture: true });
    });

    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      scrollParents.forEach((parent) => {
        parent.removeEventListener("scroll", schedule, { capture: true });
      });
      scrollParentsRef.current = [];
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = menuRef.current;
      if (!root) return;
      const selectedBtn = root.querySelector("button.selectOption[aria-selected='true']:not([disabled])");
      if (selectedBtn) {
        selectedBtn.focus();
        return;
      }
      const first = root.querySelector("button.selectOption:not([disabled])");
      if (first) first.focus();
    }, 0);

    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      const target = e.target;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      const root = menuRef.current;
      if (!root) return;
      const buttons = Array.from(root.querySelectorAll("button.selectOption:not([disabled])"));
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
      } else if (event.key === "Enter") {
        if (active && active.classList?.contains("selectOption")) {
          event.preventDefault();
          active.click();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

  function handleSelect(opt) {
    if (!opt || opt.disabled) return;
    if (typeof onChange === "function") onChange({ target: { value: opt.value } });
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
          {selected?.label || derivedPlaceholder}
        </span>
        <span className="selectChevron" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <Portal>
          <>
            <button
              type="button"
              className="selectMenuOverlay"
              style={{ zIndex: menuLayerZ }}
              onClick={() => setOpen(false)}
              aria-label="Fermer"
            />
            <div
              ref={menuRef}
              className={`selectMenu${menuClassName ? ` ${menuClassName}` : ""}`}
              style={{
                ...(isPositioned ? {} : { position: "fixed", left: 0, top: 0 }),
                ...(menuStyle || {}),
                zIndex: menuLayerZ + 1,
                opacity: isPositioned ? 1 : 0,
                pointerEvents: isPositioned ? "auto" : "none",
                visibility: isPositioned ? "visible" : "hidden",
              }}
              role="listbox"
            >
              {optionsList.length ? (
                optionsList.map((opt) => {
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
        </Portal>
      ) : null}
    </div>
  );
}
