import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { useProfile } from "../profile/useProfile";
import { normalizeUsername, validateOptionalUsername } from "../profile/username";
import { PLACEHOLDER_COPY, STATUS_COPY, SURFACE_LABELS } from "../ui/labels";
import {
  AppActionRow,
  AppCard,
  AppInput,
  AppScreen,
  FeedbackMessage,
  FieldGroup,
  GhostButton,
  PrimaryButton,
  SectionHeader,
} from "../shared/ui/app";
import "../features/account/accountGate.css";

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
    // Invalid avatar URL should not block profile save.
  }
  return { include: false, value: "" };
}

function getErrorMessage(error) {
  if (error?.code === "USERNAME_TAKEN") return "Cet identifiant est déjà pris.";
  if (error?.code === "PROFILE_SCHEMA") return "Le profil n’est pas encore prêt. Réessaie dans un instant.";
  if (error?.code === "PROFILE_RLS") return "Ta session a expiré. Reconnecte-toi puis réessaie.";
  if (error?.code === "PROFILE_NETWORK") return "Connexion indisponible. Vérifie ton réseau puis réessaie.";
  return String(error?.message || "").trim() || "Impossible d’enregistrer ton profil.";
}

export default function Account({ data }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const { user, signOut } = useAuth();
  const { profile, loading, loadError, refreshProfile, checkUsernameAvailability, saveProfile } = useProfile();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [availability, setAvailability] = useState({ state: "idle", message: "", normalized: "" });

  useEffect(() => {
    setUsername(String(profile?.username || "").trim());
    setFullName(String(profile?.full_name || "").trim());
    setAvatarUrl(String(profile?.avatar_url || "").trim());
  }, [profile?.avatar_url, profile?.full_name, profile?.username]);

  const usernameValidation = useMemo(() => validateOptionalUsername(username), [username]);

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

    setAvailability({
      state: "checking",
      message: STATUS_COPY.checking,
      normalized: usernameValidation.normalized,
    });

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
          return;
        }

        setAvailability({
          state: "taken",
          message: result.reason || "Cet identifiant est déjà pris.",
          normalized: result.normalized,
        });
      } catch {
        if (!active) return;
        setAvailability({
          state: "error",
          message: "Impossible de vérifier cet identifiant.",
          normalized: usernameValidation.normalized,
        });
      }
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [checkUsernameAvailability, username, usernameValidation]);

  const initialUsername = String(profile?.username || "").trim();
  const initialFullName = String(profile?.full_name || "").trim();
  const initialAvatarUrl = String(profile?.avatar_url || "").trim();

  const isDirty =
    normalizeUsername(username) !== normalizeUsername(initialUsername)
    || fullName.trim() !== initialFullName
    || avatarUrl.trim() !== initialAvatarUrl;

  const canSave =
    !loading
    && !saving
    && isDirty
    && usernameValidation.ok
    && availability.state !== "taken"
    && availability.state !== "checking";

  async function handleSave(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    if (!usernameValidation.ok) {
      setStatus({ type: "error", message: usernameValidation.reason });
      return;
    }

    if (availability.state === "taken") {
      setStatus({ type: "error", message: "Cet identifiant est déjà pris." });
      return;
    }

    setSaving(true);
    try {
      const avatarUpdate = getOptionalAvatarUpdate(avatarUrl);
      const payload = { username: usernameValidation.normalized, full_name: fullName };
      if (avatarUpdate.include) payload.avatar_url = avatarUpdate.value;
      await saveProfile(payload);
      setStatus({ type: "success", message: "Compte mis à jour." });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen
      data={safeData}
      pageId="settings"
      backgroundImage={backgroundImage}
      headerTitle={<span>{SURFACE_LABELS.account}</span>}
      headerSubtitle="Identité, accès et profil visible."
    >
      <section className="mainPageSection">
        <SectionHeader
          title="Profil"
          subtitle={profile?.username ? "Ton profil est prêt." : "Identifiant optionnel. Tu peux le définir plus tard."}
        />
        <div className="mainPageSectionBody">
          <AppCard className="accountGateCard">
            {loadError ? (
              <FeedbackMessage tone="error" className="accountGateNote accountGateNoteError" role="alert">
                {loadError}
              </FeedbackMessage>
            ) : null}
            <form className="accountGateForm" onSubmit={handleSave}>
              <div className="accountGateSummary">
                <FieldGroup label="Email" htmlFor="account-email">
                  <AppInput
                    id="account-email"
                    className="accountGateInput isReadonly"
                    value={String(user?.email || profile?.email || "")}
                    readOnly
                    disabled
                  />
                </FieldGroup>

                <FieldGroup label="Identifiant" htmlFor="account-username">
                  <AppInput
                    id="account-username"
                    className="accountGateInput"
                    data-testid="account-username-input"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={PLACEHOLDER_COPY.accountHandle}
                    autoComplete="username"
                  />
                </FieldGroup>

                <FieldGroup label="Nom complet" htmlFor="account-full-name">
                  <AppInput
                    id="account-full-name"
                    className="accountGateInput"
                    data-testid="account-full-name-input"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={PLACEHOLDER_COPY.fullName}
                    autoComplete="name"
                  />
                </FieldGroup>

                <FieldGroup label="Photo de profil (URL)" htmlFor="account-avatar-url">
                  <AppInput
                    id="account-avatar-url"
                    className="accountGateInput"
                    data-testid="account-avatar-url-input"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder={PLACEHOLDER_COPY.avatarUrl}
                    autoComplete="url"
                  />
                </FieldGroup>
              </div>

              {availability.message ? (
                <FeedbackMessage
                  data-testid="account-username-feedback"
                  tone={availability.state === "available" ? "success" : "error"}
                  className={`accountGateNote ${availability.state === "available" ? "accountGateNoteSuccess" : "accountGateNoteError"}`}
                >
                  {availability.message}
                </FeedbackMessage>
              ) : null}

              {status.message ? (
                <FeedbackMessage
                  data-testid="account-save-status"
                  className={`accountGateNote ${status.type === "error" ? "accountGateNoteError" : "accountGateNoteSuccess"}`}
                  role={status.type === "error" ? "alert" : "status"}
                  tone={status.type === "error" ? "error" : "success"}
                >
                  {status.message}
                </FeedbackMessage>
              ) : null}

              <AppActionRow className="accountGateActions">
                <PrimaryButton
                  type="submit"
                  disabled={!canSave}
                  data-testid="account-save-button"
                >
                  {saving ? STATUS_COPY.saving : "Enregistrer"}
                </PrimaryButton>
                <GhostButton
                  type="button"
                  size="sm"
                  onClick={() => {
                    refreshProfile().catch(() => {});
                  }}
                >
                  Actualiser
                </GhostButton>
              </AppActionRow>
            </form>
          </AppCard>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Session"
          subtitle="Actions liées à ton compte."
        />
        <div className="mainPageSectionBody">
          <AppActionRow className="accountGateActions">
            <GhostButton
              type="button"
              size="sm"
              className="accountGateDangerButton"
              onClick={() => {
                signOut().catch(() => {});
              }}
            >
              Déconnexion
            </GhostButton>
            <GhostButton type="button" size="sm" disabled>
              Supprimer mon compte via le support
            </GhostButton>
          </AppActionRow>
        </div>
      </section>
    </AppScreen>
  );
}
