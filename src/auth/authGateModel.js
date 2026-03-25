import {
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SIGNUP_PATH,
  AUTH_VERIFY_EMAIL_PATH,
  getAuthScreenFromPath,
} from "./authPaths";

export function isUserEmailVerified(user) {
  if (!user || typeof user !== "object") return false;
  return Boolean(
    String(user.email_confirmed_at || "").trim() ||
      String(user.confirmed_at || "").trim()
  );
}

export function buildPostAuthPath(onboardingCompleted) {
  return onboardingCompleted === false ? "/onboarding" : "/";
}

export function resolveAuthGateState({
  loading,
  pathname,
  session,
  emailVerified,
  onboardingCompleted,
  recoveryMode,
} = {}) {
  if (loading) {
    return { kind: "loading" };
  }

  const authScreen = getAuthScreenFromPath(pathname);
  const hasSession = Boolean(session);
  const postAuthPath = buildPostAuthPath(onboardingCompleted);

  if (!hasSession) {
    if (authScreen === "reset-password") {
      return { kind: "screen", screen: "reset-password" };
    }
    if (authScreen) {
      return { kind: "screen", screen: authScreen };
    }
    return { kind: "redirect", to: AUTH_SIGNUP_PATH };
  }

  if (recoveryMode) {
    if (pathname !== AUTH_RESET_PASSWORD_PATH) {
      return { kind: "redirect", to: AUTH_RESET_PASSWORD_PATH };
    }
    return { kind: "screen", screen: "reset-password" };
  }

  if (!emailVerified) {
    if (pathname !== AUTH_VERIFY_EMAIL_PATH) {
      return { kind: "redirect", to: AUTH_VERIFY_EMAIL_PATH };
    }
    return { kind: "screen", screen: "verify-email" };
  }

  if (authScreen) {
    return { kind: "redirect", to: postAuthPath };
  }

  return { kind: "app" };
}
