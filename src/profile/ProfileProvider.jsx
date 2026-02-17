import React, { useCallback, useEffect, useMemo, useState } from "react";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import { useAuth } from "../auth/useAuth";
import { createProfile, isUsernameAvailable, loadProfile, upsertProfile } from "./profileApi";
import ProfileContext from "./ProfileContext";

function isE2EMockedSession(userId) {
  if (!userId || typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;
  try {
    const raw = window.localStorage.getItem(E2E_AUTH_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id === userId;
  } catch {
    return false;
  }
}

export default function ProfileProvider({ children }) {
  const { user, session } = useAuth();
  const userId = user?.id || null;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refreshProfile = useCallback(async () => {
    if (!userId) return null;
    setLoadError("");
    try {
      const next = await loadProfile(userId, {
        preferLocal: isE2EMockedSession(userId),
        throwOnRemoteError: true,
        ensureOnMissing: true,
        email: user?.email || "",
      });
      setProfile(next);
      return next;
    } catch (error) {
      const message = String(error?.message || "").trim() || "Impossible de charger le profil.";
      setLoadError(message);
      throw error;
    }
  }, [user?.email, userId]);

  useEffect(() => {
    if (!session || !userId) {
      setProfile(null);
      setLoading(false);
      setLoadError("");
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError("");

    loadProfile(userId, {
      preferLocal: isE2EMockedSession(userId),
      throwOnRemoteError: true,
      ensureOnMissing: true,
      email: user?.email || "",
    })
      .then((next) => {
        if (!active) return;
        setProfile(next);
      })
      .catch((error) => {
        if (!active) return;
        setProfile(null);
        const message = String(error?.message || "").trim() || "Impossible de charger le profil.";
        setLoadError(message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session, user?.email, userId]);

  const handleCheckUsernameAvailability = useCallback(
    async (username) => {
      if (!userId) return { available: false, normalized: "", reason: "Utilisateur non authentifié." };
      return isUsernameAvailable(username, {
        currentUserId: userId,
        preferLocal: isE2EMockedSession(userId),
      });
    },
    [userId]
  );

  const handleCreateProfile = useCallback(
    async (input) => {
      if (!userId) throw new Error("Utilisateur non authentifié.");
      const next = await createProfile(userId, input, {
        preferLocal: isE2EMockedSession(userId),
      });
      setProfile(next);
      return next;
    },
    [userId]
  );

  const handleSaveProfile = useCallback(
    async (input) => {
      if (!userId) throw new Error("Utilisateur non authentifié.");
      const next = await upsertProfile(
        userId,
        {
          email: user?.email || "",
          ...input,
        },
        {
          preferLocal: isE2EMockedSession(userId),
        }
      );
      setProfile(next);
      return next;
    },
    [user?.email, userId]
  );

  const value = useMemo(
    () => ({
      profile,
      loading,
      loadError,
      createProfile: handleCreateProfile,
      saveProfile: handleSaveProfile,
      checkUsernameAvailability: handleCheckUsernameAvailability,
      refreshProfile,
    }),
    [
      handleCheckUsernameAvailability,
      handleCreateProfile,
      handleSaveProfile,
      loadError,
      loading,
      profile,
      refreshProfile,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
