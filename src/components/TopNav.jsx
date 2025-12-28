import React from "react";

export default function TopNav({ active, setActive, onOpenAdvanced }) {
  const items = [
    { id: "today", label: "Aujourd’hui" },
    { id: "plan", label: "Plan" },
    { id: "library", label: "Bibliothèque" },
    { id: "stats", label: "Statistiques" },
    { id: "settings", label: "Réglages" },
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
            onClick={() => (typeof onOpenAdvanced === "function" ? onOpenAdvanced() : null)}
            aria-label="Avancé"
            title="Avancé"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
}
