import React from "react";

export default function TopNav({ active, setActive }) {
  const items = [
    { id: "home", label: "Accueil" },
    { id: "categories", label: "Catégories" },
    { id: "why", label: "Mon pourquoi" },
    { id: "stats", label: "Stats" },
    { id: "settings", label: "Réglages" },
  ];

  return (
    <div className="navTop">
      <div className="navWrap">
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
      </div>
    </div>
  );
}