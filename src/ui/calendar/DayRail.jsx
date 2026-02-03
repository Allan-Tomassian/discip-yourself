import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildDateWindow } from "../../utils/dates";
import { toLocalDateKey, fromLocalDateKey } from "../../utils/dateKey";
import { computeTargetScrollLeftFromRects, indexAtCenter, targetScrollLeft } from "./railMath";

const SCROLL_END_DEBOUNCE_MS = 150;
const CENTER_THRESHOLD_PX = 2;

function getStrideMeasurements(container, sampleEl) {
  if (!container || !sampleEl) return null;
  const style = window.getComputedStyle(container);
  const gapRaw = style.columnGap || style.gap || "0";
  const gap = Number.parseFloat(gapRaw) || 0;
  const padL = Number.parseFloat(style.paddingLeft) || 0;
  const padR = Number.parseFloat(style.paddingRight) || 0;
  const railWidth = container.clientWidth || 0;
  const itemWidth = sampleEl.offsetWidth || 0;
  const stride = itemWidth + gap;
  const firstCenter = sampleEl.offsetLeft + itemWidth / 2;
  const effectiveWidth = Math.max(0, railWidth - padL - padR);
  const spacerWidth = Math.max(0, Math.round(effectiveWidth / 2 - itemWidth / 2));
  return {
    gap,
    itemWidth,
    stride,
    firstCenter,
    paddingLeft: padL,
    paddingRight: padR,
    railWidth,
    spacerWidth,
  };
}

function DayRail(
  {
    selectedDateKey,
    localTodayKey,
    plannedByDate,
    doneByDate,
    goalAccentByDate,
    goalAccent,
    accent,
    getDayDots,
    onDayOpen,
    onCommitDateKey,
    isActive = true,
    windowBefore = 15,
    windowAfter = 15,
  },
  ref
) {
  const railRef = useRef(null);
  const railItemRefs = useRef(new Map());
  const isUserScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollRafRef = useRef(0);
  const layoutRafRef = useRef(0);
  const scrollEndTimerRef = useRef(null);
  const programmaticTimerRef = useRef(null);
  const measurementsRef = useRef({
    stride: 0,
    itemWidth: 0,
    gap: 0,
    firstCenter: 0,
    paddingLeft: 0,
    paddingRight: 0,
    railWidth: 0,
    spacerWidth: 0,
  });

  const [liveDateKey, setLiveDateKey] = useState(selectedDateKey);
  const [isPositioned, setIsPositioned] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [spacerWidth, setSpacerWidth] = useState(0);

  const liveDateKeyRef = useRef(liveDateKey);
  useEffect(() => {
    liveDateKeyRef.current = liveDateKey;
  }, [liveDateKey]);

  const railWindow = useMemo(() => {
    const anchor = fromLocalDateKey(selectedDateKey);
    if (!anchor) return [];
    return buildDateWindow(anchor, windowBefore, windowAfter);
  }, [selectedDateKey, windowBefore, windowAfter]);

  const railItems = useMemo(() => {
    return railWindow.map((d) => {
      const key = toLocalDateKey(d);
      const parts = key.split("-");
      return {
        key,
        date: d,
        day: parts[2] || "",
        month: parts[1] || "",
        status: key === localTodayKey ? "today" : key < localTodayKey ? "past" : "future",
      };
    });
  }, [railWindow, localTodayKey]);

  const keyToIndex = useMemo(() => {
    const map = new Map();
    railItems.forEach((item, idx) => map.set(item.key, idx));
    return map;
  }, [railItems]);

  const updateMeasurements = useCallback(() => {
    const container = railRef.current;
    if (!container) return null;
    const sampleKey = railItems[0]?.key;
    if (!sampleKey) return null;
    const sampleEl =
      railItemRefs.current.get(sampleKey) || container.querySelector(`[data-datekey="${sampleKey}"]`);
    if (!sampleEl) return null;
    const next = getStrideMeasurements(container, sampleEl);
    if (!next || !next.stride) return null;
    const prevSpacer = measurementsRef.current.spacerWidth;
    if (prevSpacer !== next.spacerWidth) {
      setSpacerWidth(next.spacerWidth);
    }
    measurementsRef.current = { ...next };
    return { ...measurementsRef.current, needsReflow: prevSpacer !== next.spacerWidth };
  }, [railItems]);

  const getIndexAtCenter = useCallback(() => {
    const container = railRef.current;
    const { stride, firstCenter, paddingLeft, paddingRight } = measurementsRef.current;
    if (!container || !stride) return null;
    return indexAtCenter({
      scrollLeft: container.scrollLeft,
      containerWidth: container.clientWidth,
      paddingLeft,
      paddingRight,
      firstCenter,
      stride,
      count: railItems.length,
    });
  }, [railItems.length]);

  const getTargetScrollLeftForIndex = useCallback((index) => {
    const container = railRef.current;
    const { stride, firstCenter, paddingLeft, paddingRight } = measurementsRef.current;
    if (!container || !stride) return null;
    return targetScrollLeft({
      containerWidth: container.clientWidth,
      paddingLeft,
      paddingRight,
      firstCenter,
      stride,
      index,
    });
  }, []);

  const setProgrammaticScrolling = useCallback((value) => {
    isProgrammaticScrollRef.current = value;
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
    if (value) {
      programmaticTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 120);
    }
  }, []);

  const centerOnKey = useCallback(
    (key, { force = false } = {}) => {
      const container = railRef.current;
      if (!container || !key) return;
      const item =
        railItemRefs.current.get(key) || container.querySelector(`[data-datekey="${key}"]`);
      if (item) {
        const itemRect = item.getBoundingClientRect();
        const scrollerRect = container.getBoundingClientRect();
        const targetLeft = computeTargetScrollLeftFromRects({
          scrollLeft: container.scrollLeft,
          scrollerLeft: scrollerRect.left,
          scrollerWidth: container.clientWidth,
          itemLeft: itemRect.left,
          itemWidth: itemRect.width,
        });
        if (!Number.isFinite(targetLeft)) return;
        if (!force && Math.abs(container.scrollLeft - targetLeft) <= CENTER_THRESHOLD_PX) return;
        setProgrammaticScrolling(true);
        container.scrollTo({ left: targetLeft, behavior: "auto" });
        return;
      }
      const index = keyToIndex.get(key);
      if (typeof index !== "number") return;
      const fallbackLeft = getTargetScrollLeftForIndex(index);
      if (!Number.isFinite(fallbackLeft)) return;
      if (!force && Math.abs(container.scrollLeft - fallbackLeft) <= CENTER_THRESHOLD_PX) return;
      setProgrammaticScrolling(true);
      container.scrollTo({ left: fallbackLeft, behavior: "auto" });
    },
    [getTargetScrollLeftForIndex, keyToIndex, setProgrammaticScrolling]
  );

  const updateLiveFromScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const index = getIndexAtCenter();
    if (typeof index !== "number") return;
    const nextKey = railItems[index]?.key;
    if (!nextKey || nextKey === liveDateKeyRef.current) return;
    liveDateKeyRef.current = nextKey;
    setLiveDateKey(nextKey);
  }, [getIndexAtCenter, railItems]);

  const finalizeScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    isUserScrollingRef.current = false;
    setIsScrolling(false);
    const nextKey = liveDateKeyRef.current;
    if (nextKey && nextKey !== selectedDateKey && typeof onCommitDateKey === "function") {
      onCommitDateKey(nextKey);
    }
    centerOnKey(nextKey);
  }, [centerOnKey, onCommitDateKey, selectedDateKey]);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    isUserScrollingRef.current = true;
    if (!isScrolling) setIsScrolling(true);
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(finalizeScroll, SCROLL_END_DEBOUNCE_MS);
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      updateLiveFromScroll();
    });
  }, [finalizeScroll, isScrolling, updateLiveFromScroll]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToKey: centerOnKey,
    }),
    [centerOnKey]
  );

  useEffect(() => {
    if (isUserScrollingRef.current || isProgrammaticScrollRef.current) return;
    setLiveDateKey(selectedDateKey);
  }, [selectedDateKey]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.ready) return undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const measured = updateMeasurements();
      if (measured && measured.stride && !measured.needsReflow) {
        centerOnKey(selectedDateKey);
      } else {
        requestAnimationFrame(() => centerOnKey(selectedDateKey));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [centerOnKey, selectedDateKey, updateMeasurements]);

  useLayoutEffect(() => {
    if (!isActive) return undefined;
    setIsPositioned(false);
    let attempts = 0;
    const attempt = () => {
      attempts += 1;
      const measured = updateMeasurements();
      if (measured && measured.stride && !measured.needsReflow) {
        centerOnKey(selectedDateKey, { force: true });
        setIsPositioned(true);
        return;
      }
      if (attempts < 4) {
        layoutRafRef.current = requestAnimationFrame(attempt);
      } else {
        setIsPositioned(true);
      }
    };
    const r1 = requestAnimationFrame(() => {
      layoutRafRef.current = requestAnimationFrame(attempt);
    });
    return () => {
      cancelAnimationFrame(r1);
      if (layoutRafRef.current) cancelAnimationFrame(layoutRafRef.current);
    };
  }, [centerOnKey, isActive, selectedDateKey, updateMeasurements]);

  useEffect(() => {
    const container = railRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      const measured = updateMeasurements();
      if (measured && measured.stride && !measured.needsReflow) {
        centerOnKey(selectedDateKey);
      } else {
        requestAnimationFrame(() => centerOnKey(selectedDateKey));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [centerOnKey, selectedDateKey, updateMeasurements]);

  useEffect(() => {
    const handleViewportChange = () => {
      const measured = updateMeasurements();
      if (measured && measured.stride && !measured.needsReflow) {
        centerOnKey(selectedDateKey);
      } else {
        requestAnimationFrame(() => centerOnKey(selectedDateKey));
      }
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleViewportChange);
      vv.addEventListener("scroll", handleViewportChange);
    }
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      if (vv) {
        vv.removeEventListener("resize", handleViewportChange);
        vv.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, [centerOnKey, selectedDateKey, updateMeasurements]);

  useEffect(() => {
    const container = railRef.current;
    if (!container) return undefined;
    const handleScrollEnd = () => finalizeScroll();
    container.addEventListener("scrollend", handleScrollEnd);
    return () => container.removeEventListener("scrollend", handleScrollEnd);
  }, [finalizeScroll]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (layoutRafRef.current) cancelAnimationFrame(layoutRafRef.current);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
    };
  }, []);

  const selectedKeyForVisual = liveDateKey || selectedDateKey;

  return (
    <div className="calendarRailWrap">
      <div
        className={`calendarRail scrollNoBar${isScrolling ? " is-scrolling" : ""}`}
        ref={railRef}
        onScroll={handleScroll}
        onPointerDown={() => {
          isUserScrollingRef.current = true;
          setIsScrolling(true);
        }}
        onPointerUp={() => {
          isUserScrollingRef.current = false;
        }}
        onPointerCancel={() => {
          isUserScrollingRef.current = false;
        }}
        onMouseUp={() => {
          isUserScrollingRef.current = false;
        }}
        onTouchStart={() => {
          isUserScrollingRef.current = true;
          setIsScrolling(true);
        }}
        onTouchEnd={() => {
          isUserScrollingRef.current = false;
        }}
        data-tour-id="today-calendar-rail"
        role="listbox"
        aria-label="Sélecteur de jour"
        style={{
          visibility: isPositioned ? "visible" : "hidden",
          pointerEvents: isPositioned ? "auto" : "none",
        }}
      >
        <div className="railSpacer" aria-hidden="true" style={{ width: spacerWidth }} />
        {railItems.map((item) => {
          const plannedCount = plannedByDate.get(item.key) || 0;
          const doneCount = doneByDate.get(item.key) || 0;
          const isToday = item.key === localTodayKey;
          const plannedLabel = plannedCount
            ? `${plannedCount} planifié${plannedCount > 1 ? "s" : ""}`
            : "0 planifié";
          const doneLabel = doneCount ? `${doneCount} fait${doneCount > 1 ? "s" : ""}` : "0 fait";
          const ariaLabel = `${item.key} · ${plannedLabel} · ${doneLabel}${isToday ? " · Aujourd’hui" : ""}`;
          const isSelected = item.key === selectedKeyForVisual;
          const accentForItem = goalAccentByDate.get(item.key) || goalAccent || accent;
          return (
            <button
              key={item.key}
              ref={(el) => {
                if (el) railItemRefs.current.set(item.key, el);
                else railItemRefs.current.delete(item.key);
              }}
              className={`calendarDayPill calendarItem ${
                isSelected ? "is-current" : item.key < selectedKeyForVisual ? "is-past" : "is-future"
              }`}
              data-datekey={item.key}
              data-status={item.status}
              data-planned={plannedCount}
              data-done={doneCount}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
              aria-current={isSelected ? "date" : undefined}
              role="option"
              onClick={() => {
                setLiveDateKey(item.key);
                liveDateKeyRef.current = item.key;
                if (typeof onDayOpen === "function") onDayOpen(item.key);
                centerOnKey(item.key, { force: true });
              }}
              type="button"
              style={{
                borderColor:
                  isSelected ? accentForItem : goalAccentByDate.get(item.key) || "rgba(255,255,255,.14)",
                boxShadow: isSelected ? `0 0 0 2px ${accentForItem}33` : undefined,
              }}
            >
              <div className="calendarPillDay">{item.day}</div>
              <div className="calendarPillMonth">/{item.month}</div>
              {isToday ? <div className="calendarPillBadge">Aujourd’hui</div> : null}
              {(() => {
                const { dots, extra } = getDayDots(item.key, 3);
                if (!dots.length) return null;
                return (
                  <div className="calendarDots" aria-hidden="true">
                    {dots.map((d) => (
                      <span
                        key={d.categoryId}
                        className="calendarItemDot"
                        style={{ background: d.color || "rgba(255,255,255,.45)" }}
                      />
                    ))}
                    {extra > 0 ? <span className="calendarDotsMore">+{extra}</span> : null}
                  </div>
                );
              })()}
              {isSelected ? (
                <span
                  className="calendarSelectionDot"
                  aria-hidden="true"
                  style={{ background: accentForItem || "var(--accent, #ff8a3d)" }}
                />
              ) : null}
            </button>
          );
        })}
        <div className="railSpacer" aria-hidden="true" style={{ width: spacerWidth }} />
      </div>
    </div>
  );
}

export default forwardRef(DayRail);
