import React, { useLayoutEffect, useRef } from "react";
import CategoryRail from "./CategoryRail";

export default function TopNav({
  active,
  setActive,
  onOpenSettings,
  onCreateCategory,
  categories = [],
  selectedCategoryId = null,
  onSelectCategory,
}) {
  const navTopRef = useRef(null);
  const navBarRef = useRef(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const topEl = navTopRef.current;
      if (topEl) {
        const h = Math.ceil(topEl.getBoundingClientRect().height);
        document.documentElement.style.setProperty("--navOffset", `${h}px`);
      } else {
        document.documentElement.style.setProperty("--navOffset", "0px");
      }
    };
    update();
    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(update);
      if (navTopRef.current) ro.observe(navTopRef.current);
      if (navBarRef.current && navBarRef.current !== navTopRef.current) {
        ro.observe(navBarRef.current);
      }
    } else {
      window.addEventListener("resize", update);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", update);
    };
  }, [categories.length]);

  const items = [
    { id: "today", label: "Aujourd’hui" },
    { id: "library", label: "Bibliothèque" },
    { id: "plan", label: "Outils" },
  ];

  return (
    <div className="navTop stickyStack" ref={navTopRef}>
      <div className="navWrap" ref={navBarRef}>
        <div className="navRow">
          <div className="navGrid">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setActive(it.id)}
                className={`navBtn ${active === it.id ? "navBtnActive" : ""}`}
              >
                {it.label}
              </button>
            ))}
          </div>
          <button
            className="navGear"
            type="button"
            onClick={() => (typeof onOpenSettings === "function" ? onOpenSettings() : null)}
            aria-label="Réglages"
            title="Réglages"
          >
            ⚙
          </button>
        </div>
      </div>
      {categories.length ? (
        <div className="navRailWrap">
          <div className="categoryRailRow">
            <CategoryRail
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelect={onSelectCategory}
            />
            {typeof onCreateCategory === "function" ? (
              <button
                type="button"
                className="categoryRailAdd"
                onClick={onCreateCategory}
                aria-label="Créer une catégorie"
                title="Créer une catégorie"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
