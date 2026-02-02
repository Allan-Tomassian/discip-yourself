import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// Theme bootstrap: ensure the selected theme is applied BEFORE first paint.
// This prevents refresh on non-Settings pages from snapping back to a default theme.
import { applyThemeTokens, getThemeAccent, getThemeName } from "./theme/themeTokens";
import { LS_KEY } from "./utils/storage";

function readStoredState() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLegacyThemeId() {
  const keys = ["discip_theme", "discipTheme", "themeId", "theme", "appTheme", "selectedTheme", "dy_theme"];
  for (const k of keys) {
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const id = parsed?.themeId ?? parsed?.id ?? parsed?.theme;
      if (typeof id === "string" && id.trim()) return id.trim();
    } catch {
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
  }
  return null;
}

function applyThemeEarly() {
  try {
    const storedState = readStoredState();
    const themeId = storedState ? getThemeName(storedState, "home") : readLegacyThemeId();
    const accent = storedState ? getThemeAccent(storedState, "home") : null;
    applyThemeTokens(themeId, accent);
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
