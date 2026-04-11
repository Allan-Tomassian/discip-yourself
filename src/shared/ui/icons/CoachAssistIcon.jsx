import React from "react";

export default function CoachAssistIcon({ className = "", size = 18, title = "" }) {
  const safeSize = Number.isFinite(size) ? Math.max(12, Math.round(size)) : 18;
  return (
    <span
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      title={title || undefined}
      style={{ display: "inline-flex", width: safeSize, height: safeSize }}
    >
      <svg
        width={safeSize}
        height={safeSize}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="8.5" r="5.75" stroke="currentColor" strokeOpacity="0.84" strokeWidth="1.2" />
        <circle cx="10" cy="8.5" r="3.2" stroke="currentColor" strokeOpacity="0.42" strokeWidth="1.1" />
        <path
          d="M10 6.45C10.635 6.45 11.15 6.965 11.15 7.6C11.15 8.06 10.88 8.457 10.49 8.642C10.2 8.78 10 9.068 10 9.39V10.45"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="12.15" r="0.75" fill="currentColor" fillOpacity="0.9" />
        <path
          d="M7.85 16.75H12.15"
          stroke="currentColor"
          strokeOpacity="0.72"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M8.95 14.55L8.2 16.75"
          stroke="currentColor"
          strokeOpacity="0.72"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M11.05 14.55L11.8 16.75"
          stroke="currentColor"
          strokeOpacity="0.72"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M7 3.3L7.35 4.2"
          stroke="currentColor"
          strokeOpacity="0.48"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M13 3.3L12.65 4.2"
          stroke="currentColor"
          strokeOpacity="0.48"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
