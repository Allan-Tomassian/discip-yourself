import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AuthProvider from "./auth/AuthProvider.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import ProfileProvider from "./profile/ProfileProvider.jsx";
import ProfileGate from "./profile/ProfileGate.jsx";
import "./index.css";

// Theme bootstrap: apply the single canonical design system before first paint.
import { applyThemeTokens, BRAND_ACCENT, DEFAULT_THEME } from "./theme/themeTokens";

function applyThemeEarly() {
  try {
    applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);
  } catch {
    // Never block app boot on theme errors.
  }
}

applyThemeEarly();

const RootWrapper = import.meta.env.DEV ? React.Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById("root")).render(
  <RootWrapper>
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate>
          <ProfileProvider>
            <ProfileGate>
              <App />
            </ProfileGate>
          </ProfileProvider>
        </AuthGate>
      </AuthProvider>
    </ErrorBoundary>
  </RootWrapper>
);
