import React, { useLayoutEffect, useRef } from "react";
import WalletBadge from "./WalletBadge";
import { GatePanel } from "../shared/ui/gate/Gate";
import "../features/navigation/topMenuGate.css";

const NAV_ITEMS = [
  { id: "today", label: "Aujourd’hui" },
  { id: "planning", label: "Planning" },
  { id: "library", label: "Bibliothèque" },
  { id: "pilotage", label: "Pilotage" },
];

const Z_INDEX = {
  topbar: 900,
};

export default function TopNav({
  active,
  setActive,
  onMenuOpen,
  coinsBalance = 0,
  coinDeltaAmount = 0,
  coinDeltaKey = "",
}) {
  const navTopRef = useRef(null);
  const navBarRef = useRef(null);
  const topbarSurfaceRef = useRef(null);
  const topbarRef = useRef(null);

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
                <div className="navActions" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className="navBtn NavPillUnified GatePressable"
                    aria-label="Ouvrir le menu"
                    title="Menu"
                    onClick={() => onMenuOpen?.()}
                    data-tour-id="topnav-settings"
                  >
                    ☰
                  </button>
                </div>
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
                  <WalletBadge
                    className="topNavWalletBadge"
                    balance={coinsBalance}
                    deltaAmount={coinDeltaAmount}
                    deltaKey={coinDeltaKey}
                    dataTestId="topnav-coins-balance"
                    showDelta
                  />
                </div>
              </div>
            </GatePanel>
          </div>
        </div>
      </div>
    </div>
  );
}
