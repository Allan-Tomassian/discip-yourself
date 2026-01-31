import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// Theme bootstrap: ensure the selected theme is applied BEFORE first paint.
// This prevents refresh on non-Settings pages from snapping back to a default theme.
import * as Theme from "./utils/_theme.js";

function readStoredThemeId() {
  // Support legacy keys to avoid breaking existing users.
  const keys = [
    "discip_theme",
    "discipTheme",
    "themeId",
    "theme",
    "appTheme",
    "selectedTheme",
    "dy_theme",
  ];

  for (const k of keys) {
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;

    // Try JSON first (e.g. { id: "Midnight" } / { themeId: "Midnight" }).
    try {
      const parsed = JSON.parse(raw);
      const id = parsed?.themeId ?? parsed?.id ?? parsed?.theme;
      if (typeof id === "string" && id.trim()) return id.trim();
    } catch {
      // Not JSON -> treat as plain string.
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
  }

  return null;
}

function applyThemeEarly() {
  try {
    const themeId = readStoredThemeId();
    if (!themeId) return;

    // Prefer the project's theme engine if present.
    if (typeof Theme?.applyTheme === "function") {
      Theme.applyTheme(themeId);
      return;
    }

    if (typeof Theme?.setTheme === "function") {
      Theme.setTheme(themeId);
      return;
    }

    // Fallback: set a data attribute for CSS-token based theming.
    document.documentElement.dataset.theme = themeId;
  } catch {
    // Never block app boot on theme errors.
  }
}

applyThemeEarly();

const RootWrapper = import.meta.env.DEV ? React.Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById("root")).render(
  <RootWrapper>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </RootWrapper>
);
