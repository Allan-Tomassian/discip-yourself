import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../infra/supabaseClient";
import AuthContext from "./AuthContext";
import { E2E_AUTH_SESSION_KEY } from "./constants";
import {
  AUTH_RESET_PASSWORD_PATH,
  AUTH_VERIFY_EMAIL_PATH,
  buildAuthRedirectUrl,
  normalizePathname,
  parseAuthCallbackParams,
} from "./authPaths";
import { isUserEmailVerified } from "./authGateModel";

const RECOVERY_MODE_STORAGE_KEY = "discip.auth.recovery_mode";

function readE2ESession() {
  if (typeof window === "undefined") return null;
  if (!import.meta.env.DEV) return null;
  const raw = window.localStorage.getItem(E2E_AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readPersistedRecoveryMode() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(RECOVERY_MODE_STORAGE_KEY) === "1";
}

function writePersistedRecoveryMode(enabled) {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.sessionStorage.setItem(RECOVERY_MODE_STORAGE_KEY, "1");
    return;
  }
  window.sessionStorage.removeItem(RECOVERY_MODE_STORAGE_KEY);
}

function isInitialRecoveryRoute() {
  if (typeof window === "undefined") return false;
  if (normalizePathname(window.location.pathname) !== AUTH_RESET_PASSWORD_PATH) return false;
  const params = parseAuthCallbackParams(window.location.href);
  return String(params.type || "").trim() === "recovery";
}

function isResetPasswordRoute() {
  if (typeof window === "undefined") return false;
  return normalizePathname(window.location.pathname) === AUTH_RESET_PASSWORD_PATH;
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastAuthEvent, setLastAuthEvent] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(() => readPersistedRecoveryMode() || isInitialRecoveryRoute());

  useEffect(() => {
    let active = true;

    const mockedSession = readE2ESession();
    if (mockedSession) {
      setSession(mockedSession);
      setUser(mockedSession?.user || null);
      setLastAuthEvent("INITIAL_SESSION");
      if (isResetPasswordRoute()) {
        setRecoveryMode(true);
        writePersistedRecoveryMode(true);
      }
      setLoading(false);
      return undefined;
    }

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setLastAuthEvent(event || "");
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      if (event === "PASSWORD_RECOVERY" || (nextSession && isResetPasswordRoute())) {
        setRecoveryMode(true);
        writePersistedRecoveryMode(true);
      } else if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
        writePersistedRecoveryMode(false);
      }
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setSession(null);
          setUser(null);
          setRecoveryMode(false);
          writePersistedRecoveryMode(false);
        } else {
          const nextSession = data?.session || null;
          setSession(nextSession);
          setUser(nextSession?.user || null);
          if (nextSession && (readPersistedRecoveryMode() || isInitialRecoveryRoute() || isResetPasswordRoute())) {
            setRecoveryMode(true);
            writePersistedRecoveryMode(true);
          } else if (!nextSession) {
            setRecoveryMode(false);
            writePersistedRecoveryMode(false);
          }
        }
        setLastAuthEvent("INITIAL_SESSION");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
        setRecoveryMode(false);
        writePersistedRecoveryMode(false);
        setLastAuthEvent("INITIAL_SESSION");
        setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUpWithPassword = useCallback(async (email, password, redirectTo = AUTH_VERIFY_EMAIL_PATH) => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) throw new Error("Adresse email requise.");
    const normalizedPassword = String(password || "");
    if (!normalizedPassword.trim()) throw new Error("Mot de passe requis.");
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(redirectTo),
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signInWithPassword = useCallback(async (email, password) => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) throw new Error("Adresse email requise.");
    const normalizedPassword = String(password || "");
    if (!normalizedPassword.trim()) throw new Error("Mot de passe requis.");
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });
    if (error) throw error;
    return data;
  }, []);

  const resendSignupVerification = useCallback(async (email, redirectTo = AUTH_VERIFY_EMAIL_PATH) => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) throw new Error("Adresse email requise.");
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(redirectTo),
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const sendPasswordReset = useCallback(async (email, redirectTo = AUTH_RESET_PASSWORD_PATH) => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) throw new Error("Adresse email requise.");
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: buildAuthRedirectUrl(redirectTo),
    });
    if (error) throw error;
    return data;
  }, []);

  const updatePassword = useCallback(async (password, options = {}) => {
    const normalizedPassword = String(password || "");
    if (!normalizedPassword.trim()) throw new Error("Mot de passe requis.");
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { data, error } = await supabase.auth.updateUser({ password: normalizedPassword });
    if (error) throw error;
    if (options?.signOutAfter) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
      setUser(null);
      setLastAuthEvent("SIGNED_OUT");
    }
    setRecoveryMode(false);
    writePersistedRecoveryMode(false);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (typeof window !== "undefined" && import.meta.env.DEV) {
      window.localStorage.removeItem(E2E_AUTH_SESSION_KEY);
    }
    writePersistedRecoveryMode(false);
    setRecoveryMode(false);
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    setUser(null);
  }, []);

  const isEmailVerified = isUserEmailVerified(user);

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      isEmailVerified,
      lastAuthEvent,
      recoveryMode,
      signUpWithPassword,
      signInWithPassword,
      resendSignupVerification,
      sendPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      isEmailVerified,
      lastAuthEvent,
      loading,
      recoveryMode,
      resendSignupVerification,
      sendPasswordReset,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      updatePassword,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
