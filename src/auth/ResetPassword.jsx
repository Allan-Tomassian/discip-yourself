import React, { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AppInput,
  FeedbackMessage,
  FieldGroup,
  GhostButton,
  PrimaryButton,
} from "../shared/ui/app";
import FirstAccessShell from "../features/first-access/FirstAccessShell";
import AuthCommandSurface, { AuthSecureNote } from "../features/first-access/AuthCommandSurface";

const MIN_PASSWORD_LENGTH = 6;

function getErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();
  if (lower.includes("expired") || lower.includes("invalid") || lower.includes("session")) {
    return "Lien expiré ou session introuvable. Redemande un email de réinitialisation.";
  }
  if (lower.includes("weak password") || lower.includes("password") && lower.includes("short")) {
    return `Mot de passe trop court. Utilise au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return message || "Impossible de mettre à jour le mot de passe.";
}

export default function ResetPassword({ recoveryMode = false, onNavigate, onUpdatePassword }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const normalizedPassword = useMemo(() => String(password || "").trim(), [password]);
  const normalizedConfirmPassword = useMemo(
    () => String(confirmPassword || "").trim(),
    [confirmPassword]
  );
  const passwordTooShort =
    normalizedPassword.length > 0 && normalizedPassword.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch =
    normalizedConfirmPassword.length > 0 && normalizedPassword !== normalizedConfirmPassword;
  const canSubmit =
    recoveryMode &&
    normalizedPassword.length >= MIN_PASSWORD_LENGTH &&
    normalizedPassword === normalizedConfirmPassword &&
    !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      await onUpdatePassword(normalizedPassword);
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  if (!recoveryMode) {
    return (
      <FirstAccessShell variant="reset-password">
        <AuthCommandSurface
          data-testid="auth-reset-password-screen"
          tone="danger"
          icon={AlertTriangle}
          eyebrow="Lien expiré"
          title="Lien invalide"
          subtitle="Le lien de réinitialisation a expiré, est invalide ou la session de récupération est absente."
          footer={<AuthSecureNote>Sécurisé par Discip Yourself</AuthSecureNote>}
        >
          <div className="authDangerPanel">
            <div className="authDangerTitle">Lien invalide ou expiré</div>
            <div className="authDangerText">
              Redemande un email de réinitialisation pour définir un nouveau mot de passe.
            </div>
          </div>
          <GhostButton
            className="authCriticalCta"
            type="button"
            onClick={() => onNavigate("/auth/forgot-password", { replace: true })}
          >
            Demander un nouveau lien
          </GhostButton>
        </AuthCommandSurface>
      </FirstAccessShell>
    );
  }

  return (
    <FirstAccessShell variant="reset-password">
      <AuthCommandSurface
        data-testid="auth-reset-password-screen"
        eyebrow="Nouvel accès"
        title="Nouveau mot de passe"
        subtitle="Définis un nouveau mot de passe sécurisé pour protéger ton compte."
        footer={<AuthSecureNote>Sécurisé par Discip Yourself</AuthSecureNote>}
      >
        <form onSubmit={handleSubmit} className="authFormStack">
          <FieldGroup
            label="Nouveau mot de passe"
            htmlFor="auth-reset-password"
            error={passwordTooShort ? `Utilise au moins ${MIN_PASSWORD_LENGTH} caractères.` : ""}
          >
            <AppInput
              id="auth-reset-password"
              data-testid="auth-password-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nouveau mot de passe"
              autoComplete="new-password"
              required
            />
          </FieldGroup>
          <FieldGroup
            label="Confirmer le mot de passe"
            htmlFor="auth-reset-password-confirm"
            error={passwordsMismatch ? "Les mots de passe ne correspondent pas." : ""}
          >
            <AppInput
              id="auth-reset-password-confirm"
              data-testid="auth-confirm-password-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirmer le mot de passe"
              autoComplete="new-password"
              required
            />
          </FieldGroup>
          <PrimaryButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
            {submitting ? "Mise à jour…" : "Mettre à jour"}
          </PrimaryButton>
        </form>

        {status.message ? (
          <FeedbackMessage
            data-testid="auth-status"
            role={status.type === "error" ? "alert" : "status"}
            tone={status.type === "error" ? "error" : "success"}
          >
            {status.message}
          </FeedbackMessage>
        ) : null}
      </AuthCommandSurface>
    </FirstAccessShell>
  );
}
