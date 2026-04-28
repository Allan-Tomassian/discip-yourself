import React, { forwardRef } from "react";
import {
  BrainCircuit,
  CalendarDays,
  House,
  SlidersHorizontal,
  Target,
} from "lucide-react";

const TABS = [
  { id: "objectives", label: "Objectifs", Icon: Target },
  { id: "timeline", label: "Planning", Icon: CalendarDays },
  { id: "today", label: "Home", Icon: House, home: true },
  { id: "coach", label: "Coach IA", Icon: BrainCircuit, ai: true },
  { id: "adjust", label: "Ajuster", Icon: SlidersHorizontal },
];

const BottomNavigation = forwardRef(function BottomNavigation({ activeTab = "today", onSelect }, ref) {
  return (
    <div ref={ref} className="lovableTabBarWrap">
      <nav className="lovableTabBar" aria-label="Navigation principale" data-tour-id="topnav-tabs">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const { Icon } = tab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`lovableTabButton${active ? " is-active" : ""}${tab.home ? " is-home" : ""}${tab.ai ? " is-ai" : ""}`}
              onClick={() => onSelect?.(tab.id)}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <span className="lovableTabButtonLabel">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default BottomNavigation;
