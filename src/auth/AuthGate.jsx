import React from "react";
import { useAuth } from "./useAuth";
import Signup from "./Signup";
import Login from "./Login";
import VerifyEmail from "./VerifyEmail";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import { buildLocalUserDataKey } from "../data/userDataApi";
import { resolveAuthGateState } from "./authGateModel";
import {
  AUTH_SIGNUP_PATH,
  AUTH_VERIFY_EMAIL_PATH,
  getSearchParam,
  normalizePathname,
} from "./authPaths";

function readLocation() {
  if (typeof window === "undefined") {
    return { pathname: AUTH_SIGNUP_PATH, search: "" };
  }
  return {
    pathname: normalizePathname(window.location.pathname),
    search: window.location.search || "",
  };
}

function safeParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readCachedOnboardingCompleted(userId) {
  if (typeof window === "undefined") return null;
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;
  const cached = safeParse(window.localStorage.getItem(buildLocalUserDataKey(normalizedUserId)));
  if (!cached || typeof cached !== "object") return null;
  return cached?.ui && typeof cached.ui === "object"
    ? Boolean(cached.ui.onboardingCompleted)
    : null;
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
    const target = String(path || AUTH_SIGNUP_PATH).trim() || AUTH_SIGNUP_PATH;
    if (options.replace) {
      window.history.replaceState({}, "", target);
    } else {
      window.history.pushState({}, "", target);
    }
    setLocation(readLocation());
  }, []);

  const onboardingCompleted = readCachedOnboardingCompleted(user?.id);
  const resolved = resolveAuthGateState({
    loading,
    pathname: location.pathname,
    session,
    emailVerified: isEmailVerified,
    onboardingCompleted,
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
      <div
        data-testid="auth-loading-screen"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
      >
        <p>Chargement...</p>
      </div>
    );
  }

  if (resolved.kind === "redirect") {
    return (
      <div
        data-testid="auth-redirecting-screen"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
      >
        <p>Redirection...</p>
      </div>
    );
  }

  if (resolved.kind === "screen") {
    const queryEmail = getSearchParam(location.search, "email");
    const queryMessage = getSearchParam(location.search, "message");
    const queryMode = getSearchParam(location.search, "mode") || "signup";
    const targetEmail = queryEmail || String(user?.email || "").trim();

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
