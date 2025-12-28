import React from "react";

export default function TopNav({ active, setActive, onOpenSettings }) {
  const items = [
    { id: "today", label: "Aujourd’hui" },
    { id: "plan", label: "Plan" },
    { id: "library", label: "Bibliothèque" },
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
    </div>
  );
}
