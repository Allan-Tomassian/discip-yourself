import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Portal from "../portal/Portal";
import { Z } from "../layer/zIndex";
import { computeSelectPosition } from "../select/Select";
import { fromLocalDateKey, normalizeLocalDateKey, todayLocalKey } from "../../utils/dateKey";
import { addMonths, buildMonthGrid, getMonthLabelFR, startOfMonth, WEEKDAY_LABELS_FR } from "../../utils/dates";

const DEFAULT_MENU_WIDTH = 320;
const DEFAULT_MENU_HEIGHT = 360;

export function formatDisplayValue(value) {
  const normalized = normalizeLocalDateKey(value);
  if (!normalized) return "";
  const [y, m, d] = normalized.split("-");
  return `${d}/${m}/${y}`;
}

function toMonthStart(dateLike) {
  const base = dateLike instanceof Date ? dateLike : new Date();
  return startOfMonth(base);
}

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "jj/mm/aaaa",
  className = "",
  menuClassName = "",
  style,
  "aria-label": ariaLabel,
  allowClear = true,
  showToday = true,
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

  const normalizedValue = useMemo(() => normalizeLocalDateKey(value), [value]);
  const displayValue = useMemo(() => formatDisplayValue(normalizedValue), [normalizedValue]);
  const todayKey = useMemo(() => todayLocalKey(), []);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = normalizedValue ? fromLocalDateKey(normalizedValue) : new Date();
    return toMonthStart(base);
  });

  useEffect(() => {
    if (!open) return;
    const base = normalizedValue ? fromLocalDateKey(normalizedValue) : new Date();
    setCurrentMonth(toMonthStart(base));
  }, [open, normalizedValue]);

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
    };
  }, [open, updatePosition]);

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
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

  const emitChange = useCallback(
    (nextValue) => {
      if (typeof onChange !== "function") return;
      onChange({ target: { value: nextValue } });
    },
    [onChange]
  );

  const handleSelectDate = useCallback(
    (nextKey) => {
      emitChange(nextKey);
      setOpen(false);
      window.setTimeout(() => {
        if (triggerRef.current) triggerRef.current.focus();
      }, 0);
    },
    [emitChange]
  );

  const monthLabel = useMemo(() => getMonthLabelFR(currentMonth), [currentMonth]);
  const gridCells = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  return (
    <div className="selectMenuWrap" style={{ maxWidth: "100%", ...(style || {}) }}>
      <button
        ref={triggerRef}
        type="button"
        className={`selectTrigger${className ? ` ${className}` : ""}`}
        style={{ maxWidth: "100%", minWidth: 0 }}
        onClick={() => (!disabled ? setOpen((prev) => !prev) : null)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`selectTriggerValue${displayValue ? "" : " isPlaceholder"}`}>
          {displayValue || placeholder}
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
              className={`selectMenu datePickerMenu${menuClassName ? ` ${menuClassName}` : ""}`}
              style={{
                ...(isPositioned ? {} : { position: "fixed", left: 0, top: 0 }),
                ...(menuStyle || {}),
                zIndex: menuLayerZ + 1,
                opacity: isPositioned ? 1 : 0,
                pointerEvents: isPositioned ? "auto" : "none",
                visibility: isPositioned ? "visible" : "hidden",
              }}
              role="dialog"
            >
              <div className="datePickerHeader">
                <button
                  type="button"
                  className="datePickerNavBtn"
                  aria-label="Mois précédent"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                >
                  ←
                </button>
                <div className="datePickerMonth">{monthLabel}</div>
                <button
                  type="button"
                  className="datePickerNavBtn"
                  aria-label="Mois suivant"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                >
                  →
                </button>
              </div>

              <div className="datePickerWeekdays">
                {WEEKDAY_LABELS_FR.map((label, idx) => (
                  <div key={`${label}-${idx}`} className="datePickerWeekday">
                    {label}
                  </div>
                ))}
              </div>

              <div className="datePickerGrid" role="grid">
                {gridCells.map((cell) => {
                  const isSelected = normalizedValue && cell.key === normalizedValue;
                  const isToday = cell.key === todayKey;
                  const dayClass = [
                    "datePickerDay",
                    cell.inMonth ? "" : "isOutside",
                    isSelected ? "isSelected" : "",
                    isToday ? "isToday" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={dayClass}
                      onClick={() => handleSelectDate(cell.key)}
                      aria-pressed={isSelected}
                    >
                      {cell.dayNumber}
                    </button>
                  );
                })}
              </div>

              <div className="datePickerFooter">
                {showToday ? (
                  <button
                    type="button"
                    className="datePickerAction"
                    onClick={() => handleSelectDate(todayKey)}
                  >
                    Aujourd&apos;hui
                  </button>
                ) : null}
                {allowClear && normalizedValue ? (
                  <button
                    type="button"
                    className="datePickerAction"
                    onClick={() => {
                      emitChange("");
                      setOpen(false);
                    }}
                  >
                    Effacer
                  </button>
                ) : null}
              </div>
            </div>
          </>
        </Portal>
      ) : null}
    </div>
  );
}
