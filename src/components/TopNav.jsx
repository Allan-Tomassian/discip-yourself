import React from "react";

export default function TopNav({ active, setActive, onOpenAdvanced }) {
  const items = [
    { id: "today", label: "Today" },
    { id: "plan", label: "Plan" },
    { id: "library", label: "Library" },
    { id: "stats", label: "Stats" },
    { id: "settings", label: "Settings" },
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
            aria-label="Advanced"
            title="Advanced"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
}
