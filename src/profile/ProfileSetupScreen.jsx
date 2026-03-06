import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input } from "../components/UI";
import { useAuth } from "../auth/useAuth";
import { useProfile } from "./useProfile";
import { normalizeUsername, validateUsername } from "./username";

const AVAILABILITY_DEBOUNCE_MS = 450;

function getOptionalAvatarUpdate(value) {
  const raw = String(value || "").trim();
  if (!raw) return { include: true, value: "" };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { include: true, value: parsed.toString() };
    }
  } catch {
    // Invalid avatar URL should not block profile creation.
  }
  return { include: false, value: "" };
}

export default function ProfileSetupScreen() {
  const { user } = useAuth();
  const { profile, createProfile, checkUsernameAvailability } = useProfile();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [availability, setAvailability] = useState({
    state: "idle",
    message: "",
    normalized: "",
  });

  const usernameValidation = useMemo(() => validateUsername(username), [username]);

  useEffect(() => {
    if (!profile) return;
    if (!username) setUsername(String(profile.username || "").trim());
    if (!fullName) setFullName(String(profile.full_name || "").trim());
    if (!avatarUrl) setAvatarUrl(String(profile.avatar_url || "").trim());
  }, [avatarUrl, fullName, profile, username]);

  useEffect(() => {
    if (!username.trim()) {
      setAvailability({ state: "idle", message: "", normalized: "" });
      return undefined;
    }

    if (!usernameValidation.ok) {
      setAvailability({
        state: "invalid",
        message: usernameValidation.reason,
        normalized: usernameValidation.normalized,
      });
      return undefined;
    }

    setAvailability({ state: "checking", message: "Vérification...", normalized: usernameValidation.normalized });

    let active = true;
    const id = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(usernameValidation.normalized);
        if (!active) return;
        if (result.available) {
          setAvailability({
            state: "available",
            message: `@${result.normalized} est disponible.`,
            normalized: result.normalized,
          });
        } else {
          setAvailability({
            state: "taken",
            message: result.reason || "Nom d'utilisateur déjà pris.",
            normalized: result.normalized,
          });
        }
      } catch {
        if (!active) return;
        setAvailability({
          state: "error",
          message: "Impossible de vérifier le nom d'utilisateur.",
          normalized: usernameValidation.normalized,
        });
      }
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [checkUsernameAvailability, username, usernameValidation]);

  async function submitProfile() {
    setStatus({ type: "", message: "" });

    if (!usernameValidation.ok) {
      setStatus({ type: "error", message: usernameValidation.reason });
      return;
    }

    if (availability.state === "taken") {
      setStatus({ type: "error", message: "Nom d'utilisateur déjà pris." });
      return;
    }

    setSubmitting(true);
    try {
      const avatarUpdate = getOptionalAvatarUpdate(avatarUrl);
      const payload = {
        email: user?.email || "",
        username: normalizeUsername(username),
        full_name: fullName,
      };
      if (avatarUpdate.include) payload.avatar_url = avatarUpdate.value;
      await createProfile(payload);
      setStatus({ type: "success", message: "Profil créé." });
    } catch (error) {
      if (error?.code === "USERNAME_TAKEN") {
        setStatus({ type: "error", message: "Nom d'utilisateur déjà pris." });
      } else if (error?.code === "PROFILE_RLS") {
        setStatus({ type: "error", message: "Accès refusé (RLS). Reconnecte-toi puis réessaie." });
      } else if (error?.code === "PROFILE_NETWORK") {
        setStatus({ type: "error", message: "Réseau indisponible. Vérifie ta connexion puis réessaie." });
      } else {
        setStatus({ type: "error", message: error?.message || "Impossible de créer le profil." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    await submitProfile();
  }

  const canSubmit =
    !submitting &&
    usernameValidation.ok &&
    availability.state !== "taken" &&
    availability.state !== "checking";

  return (
    <div
      data-testid="profile-setup-screen"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <Card style={{ width: "100%", maxWidth: 460, padding: 20 }}>
        <h1 style={{ margin: "0 0 12px" }}>Complète ton profil</h1>
        <p style={{ margin: "0 0 16px", opacity: 0.8 }}>
          Connecté en tant que {user?.email || "utilisateur"}. Choisis un nom d'utilisateur unique.
        </p>

        <form onSubmit={onSubmit}>
          <Input
            data-testid="profile-username-input"
            placeholder="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
          <div style={{ height: 10 }} />
          <Input
            data-testid="profile-full-name-input"
            placeholder="Nom complet (optionnel)"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
          />
          <div style={{ height: 10 }} />
          <Input
            data-testid="profile-avatar-url-input"
            placeholder="URL avatar (optionnel)"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            autoComplete="url"
          />
          <div style={{ height: 12 }} />
          <Button data-testid="profile-submit-button" type="submit" disabled={!canSubmit}>
            {submitting ? "Création..." : "Créer mon profil"}
          </Button>
        </form>

        {availability.message ? (
          <p
            data-testid="profile-username-feedback"
            style={{
              margin: "12px 0 0",
              color: availability.state === "available" ? "#10B981" : "#EF4444",
            }}
          >
            {availability.message}
          </p>
        ) : null}

        {status.message ? (
          <p
            data-testid="profile-status"
            role={status.type === "error" ? "alert" : "status"}
            style={{
              margin: "12px 0 0",
              color: status.type === "error" ? "#EF4444" : "#10B981",
            }}
          >
            {status.message}
          </p>
        ) : null}
        {status.type === "error" && !submitting ? (
          <Button
            type="button"
            variant="ghost"
            data-testid="profile-submit-retry-button"
            onClick={() => {
              submitProfile();
            }}
            style={{ marginTop: 10 }}
          >
            Réessayer
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
