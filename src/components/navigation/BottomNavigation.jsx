import React, { forwardRef } from "react";
import {
  CalendarDays,
  House,
  SlidersHorizontal,
  Target,
} from "lucide-react";

function CoachNavIcon({ size = 22, strokeWidth = 1.8 }) {
  const safeSize = Number.isFinite(size) ? size : 22;
  return (
    <svg
      className="lovableCoachNavIcon"
      width={safeSize}
      height={safeSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6.2" stroke="currentColor" strokeWidth={strokeWidth} strokeOpacity="0.72" />
      <circle cx="12" cy="12" r="2.15" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth={strokeWidth * 0.72} />
      <path d="M12 5.8V2.9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M12 21.1v-2.9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M18.2 12h2.9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M2.9 12h2.9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M16.38 7.62l2.05-2.05" stroke="currentColor" strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
      <path d="M5.57 18.43l2.05-2.05" stroke="currentColor" strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
      <path d="M16.38 16.38l2.05 2.05" stroke="currentColor" strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
      <path d="M5.57 5.57l2.05 2.05" stroke="currentColor" strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
      <circle cx="12" cy="2.9" r="1.15" fill="currentColor" />
      <circle cx="21.1" cy="12" r="1.15" fill="currentColor" />
      <circle cx="12" cy="21.1" r="1.15" fill="currentColor" />
      <circle cx="2.9" cy="12" r="1.15" fill="currentColor" />
      <circle cx="18.43" cy="5.57" r="0.9" fill="currentColor" fillOpacity="0.86" />
      <circle cx="18.43" cy="18.43" r="0.9" fill="currentColor" fillOpacity="0.86" />
      <circle cx="5.57" cy="5.57" r="0.9" fill="currentColor" fillOpacity="0.86" />
      <circle cx="5.57" cy="18.43" r="0.9" fill="currentColor" fillOpacity="0.86" />
    </svg>
  );
}

const TABS = [
  { id: "objectives", label: "Objectifs", Icon: Target },
  { id: "timeline", label: "Planning", Icon: CalendarDays },
  { id: "today", label: "Home", Icon: House, home: true },
  { id: "coach", label: "Coach IA", Icon: CoachNavIcon, ai: true },
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
              className={`lovableTabButton CommandBottomNavigation__item${active ? " is-active" : ""}${tab.home ? " is-home" : ""}${tab.ai ? " is-ai" : ""}${badge ? " has-signal" : ""}`}
              onClick={() => onSelect?.(tab.id)}
              aria-current={active ? "page" : undefined}
              aria-label={badge?.label ? `${tab.label} — ${badge.label}` : tab.label}
              data-nav-tab={tab.id}
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
