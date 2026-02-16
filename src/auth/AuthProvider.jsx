import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../infra/supabaseClient";
import AuthContext from "./AuthContext";
import { E2E_AUTH_SESSION_KEY } from "./constants";

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

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const mockedSession = readE2ESession();
    if (mockedSession) {
      setSession(mockedSession);
      setUser(mockedSession?.user || null);
      setLoading(false);
      return undefined;
    }

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setSession(null);
          setUser(null);
        } else {
          const nextSession = data?.session || null;
          setSession(nextSession);
          setUser(nextSession?.user || null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email) => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) throw new Error("Adresse email requise.");
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (typeof window !== "undefined" && import.meta.env.DEV) {
      window.localStorage.removeItem(E2E_AUTH_SESSION_KEY);
    }
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      signInWithEmail,
      signOut,
    }),
    [loading, session, signInWithEmail, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
