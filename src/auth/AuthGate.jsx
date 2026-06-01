import React from "react";
import { useAuth } from "./useAuth";
import Welcome from "./Welcome";
import Signup from "./Signup";
import Login from "./Login";
import VerifyEmail from "./VerifyEmail";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import FirstAccessShell from "../features/first-access/FirstAccessShell";
import AuthCommandSurface, { AuthSecureNote } from "../features/first-access/AuthCommandSurface";
import { resolveAuthGateState } from "./authGateModel";
import { readCachedFirstRunSummary } from "./authGateCache";
import {
  AUTH_WELCOME_PATH,
  AUTH_VERIFY_EMAIL_PATH,
  getSearchParam,
  normalizePathname,
} from "./authPaths";

function readLocation() {
  if (typeof window === "undefined") {
    return { pathname: AUTH_WELCOME_PATH, search: "" };
  }
  return {
    pathname: normalizePathname(window.location.pathname),
    search: window.location.search || "",
  };
}

export function AuthStatusScreen({ testId, title, subtitle, steps = [] }) {
  return (
    <FirstAccessShell variant="status">
      <AuthCommandSurface
        data-testid={testId}
        tone="status"
        eyebrow="Connexion au système"
        title={title}
        subtitle={subtitle}
        showIcon={false}
        className="authCommandSurface--statusCompact"
        bodyClassName="authStatusStack"
      >
        <div className="authStatusModule" aria-hidden="true">
          <div className="authStatusRadar">
            <span className="authStatusCore" />
            <span className="authStatusScanLine" />
          </div>
        </div>

        {steps.length ? (
          <div className="authStatusList">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`authStatusStep${index >= steps.length - 1 ? " is-pending" : " is-complete"}`}
              >
                <span className="authStatusStepDot" aria-hidden="true" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        ) : null}

        <AuthSecureNote>Connexion sécurisée</AuthSecureNote>
      </AuthCommandSurface>
    </FirstAccessShell>
  );
}

export default function AuthGate({ children }) {
  const {
    loading,
    session,
    user,
    isEmailVerified,
    recoveryMode,
    signUpWithPassword,
    signInWithPassword,
    resendSignupVerification,
    sendPasswordReset,
    updatePassword,
  } = useAuth();
  const [location, setLocation] = React.useState(() => readLocation());

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleLocationChange = () => {
      setLocation(readLocation());
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const navigate = React.useCallback((path, options = {}) => {
    if (typeof window === "undefined") return;
    const target = String(path || AUTH_WELCOME_PATH).trim() || AUTH_WELCOME_PATH;
    if (options.replace) {
      window.history.replaceState({}, "", target);
    } else {
      window.history.pushState({}, "", target);
    }
    setLocation(readLocation());
  }, []);

  const cachedFirstRun = readCachedFirstRunSummary(user?.id);
  const resolved = resolveAuthGateState({
    loading,
    pathname: location.pathname,
    session,
    emailVerified: isEmailVerified,
    firstRunDone: cachedFirstRun?.firstRunDone ?? null,
    onboardingCompleted: cachedFirstRun?.onboardingCompleted ?? null,
    recoveryMode,
  });

  React.useEffect(() => {
    if (resolved.kind !== "redirect") return;
    const currentPath = `${location.pathname}${location.search}`;
    if (currentPath === resolved.to) return;
    navigate(resolved.to, { replace: true });
  }, [location.pathname, location.search, navigate, resolved]);

  if (loading) {
    return (
      <AuthStatusScreen
        testId="auth-loading-screen"
        title="Vérification de ton accès…"
        subtitle="Préparation de ton cockpit personnel."
        steps={[
          "Vérification des identifiants",
          "Sécurisation de la connexion",
          "Chargement de ton système",
          "Redirection vers ton cockpit",
        ]}
      />
    );
  }

  if (resolved.kind === "redirect") {
    return (
      <AuthStatusScreen
        testId="auth-redirecting-screen"
        title="Vérification de ton accès…"
        subtitle="Préparation de ton cockpit personnel."
        steps={[
          "Vérification des identifiants",
          "Sécurisation de la connexion",
          "Chargement de ton système",
          "Redirection vers ton cockpit",
        ]}
      />
    );
  }

  if (resolved.kind === "screen") {
    const queryEmail = getSearchParam(location.search, "email");
    const queryMessage = getSearchParam(location.search, "message");
    const queryMode = getSearchParam(location.search, "mode") || "signup";
    const targetEmail = queryEmail || String(user?.email || "").trim();

    if (resolved.screen === "welcome") {
      return <Welcome onNavigate={navigate} />;
    }

    if (resolved.screen === "signup") {
      return (
        <Signup
          initialEmail={queryEmail}
          onNavigate={navigate}
          onSignedUp={async (email, password) => {
            await signUpWithPassword(email, password);
            navigate(
              `${AUTH_VERIFY_EMAIL_PATH}?email=${encodeURIComponent(email)}&mode=signup`,
              { replace: true }
            );
          }}
        />
      );
    }

    if (resolved.screen === "login") {
      return (
        <Login
          initialEmail={queryEmail}
          notice={queryMessage === "password-updated" ? "Mot de passe mis a jour" : ""}
          onNavigate={navigate}
          onLoggedIn={signInWithPassword}
          onNeedsVerification={(email) => {
            navigate(
              `${AUTH_VERIFY_EMAIL_PATH}?email=${encodeURIComponent(email)}&mode=login`,
              { replace: true }
            );
          }}
        />
      );
    }

    if (resolved.screen === "verify-email") {
      return (
        <VerifyEmail
          email={targetEmail}
          mode={queryMode}
          onNavigate={navigate}
          onResend={(email) => resendSignupVerification(email)}
        />
      );
    }

    if (resolved.screen === "forgot-password") {
      return (
        <ForgotPassword
          initialEmail={queryEmail}
          onNavigate={navigate}
          onSendReset={sendPasswordReset}
        />
      );
    }

    if (resolved.screen === "reset-password") {
      return (
        <ResetPassword
          recoveryMode={recoveryMode}
          onNavigate={navigate}
          onUpdatePassword={async (password) => {
            await updatePassword(password, { signOutAfter: true });
            navigate("/auth/login?message=password-updated", { replace: true });
          }}
        />
      );
    }

    return null;
  }

  return children;
}
