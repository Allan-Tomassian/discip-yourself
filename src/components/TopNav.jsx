import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TopMenuPopover from "./TopMenuPopover";
import { GatePanel } from "../shared/ui/gate/Gate";
import "../features/navigation/topMenuGate.css";
// TOUR MAP:
// - primary_action: top navigation tabs
// - key_elements: top navigation tabs, hamburger menu
// - optional_elements: none
const NAV_ITEMS = [
  { id: "today", label: "Aujourd’hui" },
  { id: "library", label: "Bibliothèque" },
  { id: "pilotage", label: "Pilotage" },
];
const Z_INDEX = {
  topbar: 900,
  scrim: 1200,
  popover: 1210,
};

export default function TopNav({
  active,
  setActive,
  onMenuNavigate,
}) {
  const navTopRef = useRef(null);
  const navBarRef = useRef(null);
  const topbarRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState({ top: 72, left: 180, width: 336, maxHeight: 420 });

  const computeMenuLayout = useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = menuButtonRef.current || topbarRef.current || navBarRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth || 0;
    const vh = vv?.height || window.innerHeight || 0;
    const styles = window.getComputedStyle(document.documentElement);
    const safeTop = Number.parseFloat(styles.getPropertyValue("--safe-top")) || 0;
    const safeLeft = Number.parseFloat(styles.getPropertyValue("--safe-left")) || 0;
    const safeRight = Number.parseFloat(styles.getPropertyValue("--safe-right")) || 0;
    const safeBottom = Number.parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const viewportPadding = 16;
    const gap = 10;
    const desiredTop = rect.bottom + gap;
    const desiredLeft = rect.left + rect.width / 2;
    const width = Math.min(520, Math.max(280, vw - (viewportPadding * 2) - safeLeft - safeRight));
    const minLeft = viewportPadding + safeLeft + width / 2;
    const maxLeft = vw - viewportPadding - safeRight - width / 2;
    const left = minLeft <= maxLeft ? clamp(desiredLeft, minLeft, maxLeft) : vw / 2;
    const top = Math.max(desiredTop, viewportPadding + safeTop);
    const maxHeight = Math.max(180, vh - top - (16 + safeBottom));

    setMenuLayout((prev) => {
      if (
        prev.top === top
        && prev.left === left
        && prev.width === width
        && prev.maxHeight === maxHeight
      ) {
        return prev;
      }
      return { top, left, width, maxHeight };
    });
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const updateOffset = () => {
      const topEl = navTopRef.current;
      if (topEl) {
        const h = Math.ceil(topEl.getBoundingClientRect().height);
        document.documentElement.style.setProperty("--navOffset", `${h}px`);
      } else {
        document.documentElement.style.setProperty("--navOffset", "0px");
      }
    };
    updateOffset();
    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(updateOffset);
      if (navTopRef.current) ro.observe(navTopRef.current);
      if (navBarRef.current && navBarRef.current !== navTopRef.current) {
        ro.observe(navBarRef.current);
      }
    } else {
      window.addEventListener("resize", updateOffset);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (menuButtonRef.current && menuButtonRef.current.contains(target)) return;
      setMenuOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("touchstart", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("touchstart", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const update = () => computeMenuLayout();
    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [menuOpen, computeMenuLayout]);

  const menuPortal = menuOpen && typeof document !== "undefined"
    ? createPortal(
      <>
        <div
          className="topMenuScrim GateOverlayBackdrop"
          style={{ position: "fixed", inset: 0, zIndex: Z_INDEX.scrim }}
          aria-hidden="true"
          onClick={() => {
            setMenuOpen(false);
          }}
        />
        <div
          ref={menuRef}
          className="topMenuPopoverLayer"
          style={{
            position: "fixed",
            zIndex: Z_INDEX.popover,
            top: `${menuLayout.top}px`,
            left: `${menuLayout.left}px`,
            width: `${menuLayout.width}px`,
            transform: "translateX(-50%)",
            opacity: 1,
            visibility: "visible",
            pointerEvents: "auto",
            "--topMenuMaxH": `${menuLayout.maxHeight}px`,
          }}
        >
          <TopMenuPopover
            onNavigate={onMenuNavigate}
            onClose={() => {
              setMenuOpen(false);
            }}
          />
        </div>
      </>,
      document.body
    )
    : null;

  return (
    <div className="navTop stickyStack TopNavShell" ref={navTopRef} data-tour-id="topnav">
      <div
        className="navWrap topNavGateWrap"
        ref={navBarRef}
        style={{ zIndex: Z_INDEX.topbar }}
      >
        <div className="TopNavSurfaceOuter GateGlassOuter">
          <div className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop">
            <GatePanel className="topNavGateBar GateGlassContent" data-tour-id="topnav-row">
              <div ref={topbarRef} className="navRow">
                <div className="navGrid" data-tour-id="topnav-tabs">
                  {NAV_ITEMS.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setActive(it.id)}
                      className={`navBtn ${active === it.id ? "navBtnActive" : ""}`}
                      aria-current={active === it.id ? "page" : undefined}
                      data-tour-id={`topnav-tab-${it.id}`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
                <div className="navActions">
                  <button
                    ref={menuButtonRef}
                    className={`navMenuTrigger${menuOpen ? " navMenuTriggerOpen" : ""}`}
                    type="button"
                    onClick={() => {
                      setMenuOpen((prev) => !prev);
                    }}
                    aria-label="Menu"
                    title="Menu"
                    aria-expanded={menuOpen}
                    data-tour-id="topnav-settings"
                    >
                      <span className="navMenuBars" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </button>
                </div>
              </div>
            </GatePanel>
          </div>
        </div>
      </div>
      {menuPortal}
    </div>
  );
}
