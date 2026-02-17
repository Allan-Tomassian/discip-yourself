import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export default function TopNav({
  active,
  setActive,
  onMenuNavigate,
}) {
  const navTopRef = useRef(null);
  const navBarRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <div className="navTop stickyStack" ref={navTopRef} data-tour-id="topnav">
      {menuOpen ? (
        <div
          className="topMenuScrim"
          aria-hidden="true"
          onClick={() => {
            setMenuOpen(false);
          }}
        />
      ) : null}
      <div className="navWrap topNavGateWrap" ref={navBarRef}>
        <GatePanel className="topNavGateBar" data-tour-id="topnav-row">
          <div className="navRow">
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

              {menuOpen ? (
                <div ref={menuRef} className="topMenuPopoverLayer">
                  <TopMenuPopover
                    onNavigate={onMenuNavigate}
                    onClose={() => {
                      setMenuOpen(false);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </GatePanel>
      </div>
    </div>
  );
}
