import React, { useMemo, useState } from "react";

export default function DiagnosticOverlay({ data, tab }) {
  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);
  const [open, setOpen] = useState(true);
  if (!debugEnabled) return null;

  const safeData = data && typeof data === "object" ? data : {};
  const ui = safeData.ui && typeof safeData.ui === "object" ? safeData.ui : {};
  const selectedByView = ui.selectedCategoryByView || {};
  const counts = {
    categories: Array.isArray(safeData.categories) ? safeData.categories.length : 0,
    goals: Array.isArray(safeData.goals) ? safeData.goals.length : 0,
    occurrences: Array.isArray(safeData.occurrences) ? safeData.occurrences.length : 0,
    sessions: Array.isArray(safeData.sessions) ? safeData.sessions.length : 0,
    reminders: Array.isArray(safeData.reminders) ? safeData.reminders.length : 0,
  };
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 9999,
        pointerEvents: "none",
        fontFamily: "inherit",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          pointerEvents: "auto",
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          background: "rgba(255,255,255,0.92)",
          cursor: "pointer",
          boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
        }}
      >
        {open ? "Fermer" : "Ouvrir"} debug
      </button>
      {open ? (
        <div
          style={{
            marginTop: 8,
            minWidth: 220,
            maxWidth: 320,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
            pointerEvents: "none",
          }}
          className="small2"
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Diagnostic</div>
          <div>tab: {tab || "—"}</div>
          <div>home: {selectedByView.home || "—"}</div>
          <div>library: {selectedByView.library || "—"}</div>
          <div>pilotage: {selectedByView.pilotage || "—"}</div>
          <div>selectedDate: {ui.selectedDate || "—"}</div>
          <div>
            counts: c{counts.categories} g{counts.goals} o{counts.occurrences} s{counts.sessions} r
            {counts.reminders}
          </div>
          <div>route: {pathname || "—"}</div>
        </div>
      ) : null}
    </div>
  );
}
