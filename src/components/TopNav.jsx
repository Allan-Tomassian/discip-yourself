import React, { useLayoutEffect, useRef } from "react";
// TOUR MAP:
// - primary_action: top navigation tabs
// - key_elements: settings gear, category rail, add category
// - optional_elements: none
const NAV_ITEMS = [
  { id: "today", label: "Aujourd’hui" },
  { id: "library", label: "Bibliothèque" },
  { id: "pilotage", label: "Pilotage" },
];

export default function TopNav({
  active,
  setActive,
  onOpenSettings,
}) {
  const navTopRef = useRef(null);
  const navBarRef = useRef(null);

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

  return (
    <div className="navTop stickyStack" ref={navTopRef} data-tour-id="topnav">
      <div className="navWrap" ref={navBarRef}>
        <div className="navRow" data-tour-id="topnav-row">
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
          <button
            className={`navGear${active === "settings" ? " navGearActive" : ""}`}
            type="button"
            onClick={() => (typeof onOpenSettings === "function" ? onOpenSettings() : null)}
            aria-label="Réglages"
            title="Réglages"
            data-tour-id="topnav-settings"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
}
