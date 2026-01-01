import React from "react";

export const AccentContext = React.createContext({ accent: "#FFFFFF" });

export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

export function Card({ children, accentBorder = false, style, className = "", ...props }) {
  const { accent } = React.useContext(AccentContext);
  const borderStyle = accentBorder ? { borderColor: accent } : {};
  return (
    <div
      className={`card${className ? ` ${className}` : ""}`}
      style={{
        ...borderStyle,
        ...(style || {}),
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const cls =
    variant === "ghost"
      ? "btn btnGhost"
      : variant === "danger"
        ? "btn btnDanger"
        : "btn";
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Textarea(props) {
  return <textarea className="textarea" {...props} />;
}

export function Select(props) {
  return <select className="select" {...props} />;
}

export function ProgressRing({ value, size = 44 }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = c * v;
  const gap = c - dash;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg viewBox="0 0 40 40" style={{ position: "absolute", inset: 0 }}>
        <circle cx="20" cy="20" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {Math.round(v * 100)}%
      </div>
    </div>
  );
}
