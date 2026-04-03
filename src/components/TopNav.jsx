import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Calendar, Compass, Home, Menu } from "lucide-react";
import WalletBadge from "./WalletBadge";
import { GatePanel } from "../shared/ui/gate/Gate";
import { SURFACE_LABELS } from "../ui/labels";
import "../features/navigation/topMenuGate.css";

const NAV_ITEMS = [
  { id: "today", label: SURFACE_LABELS.today, icon: Home },
  { id: "planning", label: SURFACE_LABELS.planning, icon: Calendar },
  { id: "library", label: SURFACE_LABELS.library, icon: BookOpen },
  { id: "pilotage", label: SURFACE_LABELS.pilotage, icon: Compass },
];

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
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 767px)").matches
      : false
  );

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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncLayout = (matches) => setIsMobileLayout(matches);
    syncLayout(mediaQuery.matches);
    const handleChange = (event) => syncLayout(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const rootStyle = document.documentElement.style;
    const clearTopbarBottom = () => {
      rootStyle.removeProperty("--topbar-bottom");
    };

    const updateTopbarBottom = () => {
      const measureNode =
        navTopRef.current || topbarSurfaceRef.current || navBarRef.current || topbarRef.current;
      if (!measureNode || typeof measureNode.getBoundingClientRect !== "function") {
        clearTopbarBottom();
        return;
      }
      const rect = measureNode.getBoundingClientRect();
      if (!Number.isFinite(rect.bottom)) {
        clearTopbarBottom();
        return;
      }
      rootStyle.setProperty("--topbar-bottom", `${Math.max(0, Math.round(rect.bottom))}px`);
    };

    clearTopbarBottom();
    updateTopbarBottom();
    const raf = window.requestAnimationFrame(updateTopbarBottom);

    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(updateTopbarBottom);
      if (navTopRef.current) ro.observe(navTopRef.current);
      if (topbarSurfaceRef.current) ro.observe(topbarSurfaceRef.current);
      if (
        navBarRef.current &&
        navBarRef.current !== topbarSurfaceRef.current &&
        navBarRef.current !== navTopRef.current
      ) {
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
      clearTopbarBottom();
    };
  }, []);

  return (
    <div className="navTop stickyStack TopNavShell" ref={navTopRef} data-tour-id="topnav">
      <div className="navWrap topNavGateWrap" ref={navBarRef}>
        <div className="TopNavSurfaceOuter" ref={topbarSurfaceRef}>
          <div className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop">
            <GatePanel className="topNavGateBar GateGlassContent GateSurfacePremium GateCardPremium" data-tour-id="topnav-row">
              <div ref={topbarRef} className={`navRow${isMobileLayout ? " is-mobile-layout" : ""}`}>
                <div className="navActions topNavMenuSlot topNavMenuActions">
                  <button
                    type="button"
                    className="navBtn NavPillUnified NavPillUnified--iconOnly GatePressable"
                    aria-label="Ouvrir le menu"
                    title="Menu"
                    onClick={() => onMenuOpen?.()}
                    data-tour-id="topnav-settings"
                  >
                    <Menu className="NavPillUnifiedIcon" aria-hidden="true" />
                  </button>
                </div>
                <div className="navGrid topNavTabsGrid" data-tour-id="topnav-tabs">
                  {NAV_ITEMS.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setActive(it.id)}
                        className={`navBtn NavPillUnified ${isMobileLayout ? "NavPillUnified--iconOnly" : ""} ${active === it.id ? "navBtnActive" : ""}`}
                        aria-label={it.label}
                        aria-current={active === it.id ? "page" : undefined}
                        data-tour-id={`topnav-tab-${it.id}`}
                      >
                        <Icon className="NavPillUnifiedIcon" aria-hidden="true" />
                        {!isMobileLayout ? <span className="NavPillUnifiedLabel">{it.label}</span> : null}
                      </button>
                    );
                  })}
                </div>
                {!isMobileLayout ? (
                  <div className="navActions topNavWalletSlot">
                    <WalletBadge
                      className="topNavWalletBadge"
                      balance={coinsBalance}
                      deltaAmount={coinDeltaAmount}
                      deltaKey={coinDeltaKey}
                      dataTestId="topnav-coins-balance"
                      showDelta
                    />
                  </div>
                ) : null}
              </div>
            </GatePanel>
          </div>
        </div>
      </div>
    </div>
  );
}
