import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TopMenuPopover from "./TopMenuPopover";
import WalletBadge from "./WalletBadge";
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
  coinsBalance = 0,
  coinDeltaAmount = 0,
  coinDeltaKey = "",
}) {
  const navTopRef = useRef(null);
  const navBarRef = useRef(null);
  const topbarSurfaceRef = useRef(null);
  const topbarRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialView, setMenuInitialView] = useState("root");
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

    const viewportPadding = 12;
    const gap = 10;
    const maxAvailableWidth = Math.max(220, vw - (viewportPadding * 2) - safeLeft - safeRight);
    const desktopIdealWidth = Math.max(320, Math.min(420, maxAvailableWidth));
    const mobileIdealWidth = Math.min(420, maxAvailableWidth);
    const width = vw <= 640 ? mobileIdealWidth : desktopIdealWidth;

    const desiredTop = rect.bottom + gap;
    const desiredLeft = rect.right - width;
    const minLeft = viewportPadding + safeLeft;
    const maxLeft = vw - viewportPadding - safeRight - width;
    const left = minLeft <= maxLeft ? clamp(desiredLeft, minLeft, maxLeft) : minLeft;

    const top = Math.max(desiredTop, viewportPadding + safeTop);
    const maxHeight = Math.max(180, vh - top - (12 + safeBottom));

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

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuInitialView("root");
  }, []);

  const openMenuTo = useCallback((viewId) => {
    const safeView = typeof viewId === "string" && viewId.trim() ? viewId.trim() : "root";
    setMenuInitialView(safeView);
    setMenuOpen(true);
  }, []);

  const handleMenuTriggerClick = useCallback(() => {
    if (menuOpen) {
      handleCloseMenu();
      return;
    }
    openMenuTo("root");
  }, [menuOpen, handleCloseMenu, openMenuTo]);

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

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const rootStyle = document.documentElement.style;
    const fallbackTopbarBottom = "calc(env(safe-area-inset-top) + 74px)";

    const setFallback = () => {
      rootStyle.setProperty("--topbar-bottom", fallbackTopbarBottom);
    };

    const updateTopbarBottom = () => {
      const measureNode = topbarSurfaceRef.current || navBarRef.current || topbarRef.current;
      if (!measureNode || typeof measureNode.getBoundingClientRect !== "function") {
        setFallback();
        return;
      }
      const rect = measureNode.getBoundingClientRect();
      if (!Number.isFinite(rect.bottom)) {
        setFallback();
        return;
      }
      rootStyle.setProperty("--topbar-bottom", `${Math.max(0, Math.round(rect.bottom))}px`);
    };

    setFallback();
    updateTopbarBottom();
    const raf = window.requestAnimationFrame(updateTopbarBottom);

    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(updateTopbarBottom);
      if (topbarSurfaceRef.current) ro.observe(topbarSurfaceRef.current);
      if (navBarRef.current && navBarRef.current !== topbarSurfaceRef.current) {
        ro.observe(navBarRef.current);
      }
    }

    window.addEventListener("resize", updateTopbarBottom);
    window.addEventListener("orientationchange", updateTopbarBottom);
    window.visualViewport?.addEventListener("resize", updateTopbarBottom);
    window.visualViewport?.addEventListener("scroll", updateTopbarBottom);

    return () => {
      window.cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateTopbarBottom);
      window.removeEventListener("orientationchange", updateTopbarBottom);
      window.visualViewport?.removeEventListener("resize", updateTopbarBottom);
      window.visualViewport?.removeEventListener("scroll", updateTopbarBottom);
      setFallback();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (menuButtonRef.current && menuButtonRef.current.contains(target)) return;
      handleCloseMenu();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        handleCloseMenu();
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
  }, [menuOpen, handleCloseMenu]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.getElementById("root");
    if (!root) return undefined;

    if (menuOpen) {
      root.setAttribute("aria-hidden", "true");
      root.setAttribute("data-menu-modal-open", "true");
    } else {
      root.removeAttribute("aria-hidden");
      root.removeAttribute("data-menu-modal-open");
    }

    return () => {
      root.removeAttribute("aria-hidden");
      root.removeAttribute("data-menu-modal-open");
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
          className="topMenuScrim"
          style={{ position: "fixed", inset: 0, zIndex: Z_INDEX.scrim }}
          aria-hidden="true"
          onClick={handleCloseMenu}
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
            opacity: 1,
            visibility: "visible",
            pointerEvents: "auto",
            "--topMenuMaxH": `${menuLayout.maxHeight}px`,
          }}
        >
          <TopMenuPopover
            onNavigate={onMenuNavigate}
            initialView={menuInitialView}
            onClose={handleCloseMenu}
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
        <div className="TopNavSurfaceOuter" ref={topbarSurfaceRef}>
          <div className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop">
            <GatePanel className="topNavGateBar GateGlassContent GateSurfacePremium GateCardPremium" data-tour-id="topnav-row">
              <div ref={topbarRef} className="navRow">
                <div className="navGrid" data-tour-id="topnav-tabs">
                  {NAV_ITEMS.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setActive(it.id)}
                      className={`navBtn NavPillUnified ${active === it.id ? "navBtnActive" : ""}`}
                      aria-current={active === it.id ? "page" : undefined}
                      data-tour-id={`topnav-tab-${it.id}`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
                <div className="navActions">
                  <div ref={menuButtonRef} className="topNavWalletTrigger">
                    <WalletBadge
                      className="topNavWalletBadge"
                      balance={coinsBalance}
                      deltaAmount={coinDeltaAmount}
                      deltaKey={coinDeltaKey}
                      dataTestId="topnav-coins-balance"
                      dataTourId="topnav-settings"
                      onOpenWallet={handleMenuTriggerClick}
                    />
                  </div>
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
