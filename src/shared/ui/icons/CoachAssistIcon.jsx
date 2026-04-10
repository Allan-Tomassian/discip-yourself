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
        <path
          d="M10 2.75C6.824 2.75 4.25 5.324 4.25 8.5C4.25 11.676 6.824 14.25 10 14.25C13.176 14.25 15.75 11.676 15.75 8.5C15.75 5.324 13.176 2.75 10 2.75Z"
          stroke="currentColor"
          strokeOpacity="0.82"
          strokeWidth="1.25"
        />
        <path
          d="M7.5 17.25L9.25 13.8H10.75L12.5 17.25"
          stroke="currentColor"
          strokeOpacity="0.76"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M10 5.35V6.8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M7.8 7.6L8.8 8.15"
          stroke="currentColor"
          strokeOpacity="0.92"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M12.2 7.6L11.2 8.15"
          stroke="currentColor"
          strokeOpacity="0.92"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M6.1 2.6L6.45 3.9"
          stroke="currentColor"
          strokeOpacity="0.64"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M13.9 2.6L13.55 3.9"
          stroke="currentColor"
          strokeOpacity="0.64"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
