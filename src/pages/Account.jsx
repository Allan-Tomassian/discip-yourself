import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { useAuth } from "../auth/useAuth";
import { useProfile } from "../profile/useProfile";
import { normalizeUsername, validateUsername } from "../profile/username";
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
  if (error?.code === "USERNAME_TAKEN") return "Nom d'utilisateur déjà pris.";
  if (error?.code === "PROFILE_RLS") return "Accès refusé (RLS). Reconnecte-toi puis réessaie.";
  if (error?.code === "PROFILE_NETWORK") return "Réseau indisponible. Vérifie ta connexion puis réessaie.";
  return String(error?.message || "").trim() || "Impossible d'enregistrer le profil.";
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

  const usernameValidation = useMemo(() => validateUsername(username), [username]);

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
          return;
        }

        setAvailability({
          state: "taken",
          message: result.reason || "Nom d'utilisateur déjà pris.",
          normalized: result.normalized,
        });
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
      setStatus({ type: "error", message: "Nom d'utilisateur déjà pris." });
      return;
    }

    setSaving(true);
    try {
      const avatarUpdate = getOptionalAvatarUpdate(avatarUrl);
      const payload = {
        username: normalizeUsername(username),
        full_name: fullName,
      };
      if (avatarUpdate.include) payload.avatar_url = avatarUpdate.value;
      await saveProfile(payload);
      setStatus({ type: "success", message: "Profil enregistré." });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenShell data={safeData} pageId="settings" backgroundImage={backgroundImage}>
      <GatePage
        className="accountGatePage"
        title={<span className="GatePageTitle">Compte / Profil</span>}
        subtitle={<span className="GatePageSubtitle">Identité et accès</span>}
      >
        <GateSection
          title="Profil"
          description={profile?.username ? "Ton profil est actif." : "Complète ton profil pour continuer."}
          className="accountGateCard GateSurfacePremium GateCardPremium"
          collapsible={false}
        >
          {loadError ? <p className="accountGateNote accountGateNoteError" role="alert">{loadError}</p> : null}
          <form className="accountGateForm" onSubmit={handleSave}>
            <label className="accountGateField GateFormField" htmlFor="account-email">
              <span className="accountGateFieldLabel GateFormLabel">Email</span>
              <input id="account-email" className="accountGateInput GateInputPremium isReadonly" value={String(user?.email || profile?.email || "")} readOnly disabled />
            </label>

            <label className="accountGateField GateFormField" htmlFor="account-username">
              <span className="accountGateFieldLabel GateFormLabel">Username</span>
              <input
                id="account-username"
                className="accountGateInput GateInputPremium"
                data-testid="account-username-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="username"
                autoComplete="username"
                required
              />
            </label>

            <label className="accountGateField GateFormField" htmlFor="account-full-name">
              <span className="accountGateFieldLabel GateFormLabel">Nom complet</span>
              <input
                id="account-full-name"
                className="accountGateInput GateInputPremium"
                data-testid="account-full-name-input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nom complet (optionnel)"
                autoComplete="name"
              />
            </label>

            <label className="accountGateField GateFormField" htmlFor="account-avatar-url">
              <span className="accountGateFieldLabel GateFormLabel">Avatar URL (optionnel)</span>
              <input
                id="account-avatar-url"
                className="accountGateInput GateInputPremium"
                data-testid="account-avatar-url-input"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://..."
                autoComplete="url"
              />
            </label>

            {availability.message ? (
              <p
                data-testid="account-username-feedback"
                className={`accountGateNote ${availability.state === "available" ? "accountGateNoteSuccess" : "accountGateNoteError"}`}
              >
                {availability.message}
              </p>
            ) : null}

            {status.message ? (
              <p
                data-testid="account-save-status"
                className={`accountGateNote ${status.type === "error" ? "accountGateNoteError" : "accountGateNoteSuccess"}`}
                role={status.type === "error" ? "alert" : "status"}
              >
                {status.message}
              </p>
            ) : null}

            <div className="accountGateActions GatePrimaryCtaRow">
              <GateButton type="submit" className="GatePressable" withSound disabled={!canSave} data-testid="account-save-button">
                {saving ? "Enregistrement..." : "Enregistrer"}
              </GateButton>
              <GateButton
                type="button"
                variant="ghost"
                className="GatePressable"
                withSound
                onClick={() => {
                  refreshProfile().catch(() => {});
                }}
              >
                Recharger
              </GateButton>
            </div>
          </form>
        </GateSection>

        <GateSection
          title="Session"
          description="Actions liées à ton compte"
          className="accountGateCard GateSurfacePremium GateCardPremium"
          collapsible={false}
        >
          <div className="accountGateActions GatePrimaryCtaRow">
            <GateButton
              type="button"
              variant="ghost"
              className="accountGateDangerButton GatePressable"
              withSound
              onClick={() => {
                signOut().catch(() => {});
              }}
            >
              Déconnexion
            </GateButton>
            <GateButton type="button" variant="ghost" className="GatePressable" disabled>
              Supprimer mon compte (bientôt)
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
