import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AuthProvider from "./auth/AuthProvider.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import ProfileProvider from "./profile/ProfileProvider.jsx";
import ProfileGate from "./profile/ProfileGate.jsx";
import "@fontsource-variable/geist";
import "./index.css";

// Theme bootstrap: apply the single canonical design system before first paint.
import { applyThemeTokens, BRAND_ACCENT, DEFAULT_THEME } from "./theme/themeTokens";
import { logFrontendRuntimeEnvIssues } from "./infra/frontendEnv";

function applyThemeEarly() {
  try {
    applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);
  } catch {
    // Never block app boot on theme errors.
  }
}

applyThemeEarly();
logFrontendRuntimeEnvIssues();

const RootWrapper = import.meta.env.DEV ? React.Fragment : React.StrictMode;
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Bootstrap failed: missing #root element.");
}

try {
  ReactDOM.createRoot(rootElement).render(
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
} catch (error) {
  // eslint-disable-next-line no-console
  console.error("[bootstrap] React mount failed.", error);
  throw error;
}
