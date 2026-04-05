import React, { forwardRef } from "react";

function Icon({ path, active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
      <path d={path} stroke={active ? "currentColor" : "currentColor"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TABS = [
  {
    id: "today",
    label: "Today",
    path: "M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-10v3l2 2",
  },
  {
    id: "objectives",
    label: "Objectives",
    path: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5m0-5-5 5",
  },
  {
    id: "timeline",
    label: "Timeline",
    path: "M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  },
  {
    id: "insights",
    label: "Insights",
    path: "M5 18V9m7 9V5m7 13v-7M3 21h18",
  },
  {
    id: "coach",
    label: "Coach",
    path: "M7 16.5c-1.2-.8-2-2.2-2-3.8C5 10 8.1 7 12 7s7 3 7 5.7c0 2.7-3.1 5.8-7 5.8-.8 0-1.5-.1-2.2-.3L6 19l1-2.5Z",
  },
];

const LovableTabBar = forwardRef(function LovableTabBar({ activeTab = "today", onSelect }, ref) {
  return (
    <div ref={ref} className="lovableTabBarWrap">
      <nav className="lovableTabBar" aria-label="Primary">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`lovableTabButton${active ? " is-active" : ""}`}
              onClick={() => onSelect?.(tab.id)}
              aria-current={active ? "page" : undefined}
            >
              <Icon path={tab.path} active={active} />
              <span className="lovableTabButtonLabel">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default LovableTabBar;
