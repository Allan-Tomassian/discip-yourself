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

const BottomNavigation = forwardRef(function BottomNavigation({ activeTab = "today", onSelect, signalBadges = {} }, ref) {
  return (
    <div ref={ref} className="lovableTabBarWrap CommandBottomNavigation">
      <nav className="lovableTabBar CommandBottomNavigation__bar" aria-label="Navigation principale" data-tour-id="topnav-tabs">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const { Icon } = tab;
          const badge = signalBadges?.[tab.id] || null;
          const badgeTone = badge?.severity === "critical" ? "critical" : "attention";
          return (
            <button
              key={tab.id}
              type="button"
              className={`lovableTabButton CommandBottomNavigation__item${active ? " is-active" : ""}${tab.home ? " is-home" : ""}${tab.ai ? " is-ai" : ""}`}
              onClick={() => onSelect?.(tab.id)}
              aria-current={active ? "page" : undefined}
              aria-label={badge?.label ? `${tab.label} — ${badge.label}` : tab.label}
            >
              <span className="lovableTabIconWrap">
                <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                {badge ? (
                  <span
                    className={`lovableTabSignalDot is-${badgeTone}`}
                    aria-hidden="true"
                    data-signal-type={badge.signalType || undefined}
                  />
                ) : null}
              </span>
              <span className="lovableTabButtonLabel">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default BottomNavigation;
