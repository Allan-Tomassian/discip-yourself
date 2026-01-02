import React from "react";
import CategoryRail from "./CategoryRail";

export default function TopNav({
  active,
  setActive,
  onOpenSettings,
  categories = [],
  categoryOrder = [],
  selectedCategoryId = null,
  onSelectCategory,
  onOpenCategoryDetail,
  onReorderCategory,
}) {
  const items = [
    { id: "today", label: "Aujourd’hui" },
    { id: "library", label: "Bibliothèque" },
    { id: "plan", label: "Outils" },
  ];

  return (
    <div className="navTop">
      <div className="navWrap">
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
        <div className="navWrap navWrapRail" style={{ marginTop: 8 }}>
          <CategoryRail
            categories={categories}
            order={categoryOrder}
            selectedId={selectedCategoryId}
            onSelect={onSelectCategory}
            onOpenDetail={onOpenCategoryDetail}
            onReorder={onReorderCategory}
          />
        </div>
      ) : null}
    </div>
  );
}
