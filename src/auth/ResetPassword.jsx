import React, { useMemo, useState } from "react";
import AuthCardShell from "./AuthCardShell";
import { GateButton } from "../shared/ui/gate/Gate";
import { GateInput, GateTextButton } from "../shared/ui/gate/GateForm";

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
      <AuthCardShell
        data-testid="auth-reset-password-screen"
        title="Lien invalide"
        subtitle="Le lien de réinitialisation a expiré, est invalide ou la session de récupération est absente."
        footer={(
          <GateTextButton
            type="button"
            onClick={() => onNavigate("/auth/forgot-password", { replace: true })}
          >
            Demander un nouveau lien
          </GateTextButton>
        )}
      >
        <p className="small" style={{ margin: 0 }}>
          Redemande un email de réinitialisation pour définir un nouveau mot de passe.
        </p>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      data-testid="auth-reset-password-screen"
      title="Nouveau mot de passe"
      subtitle="Définis ton nouveau mot de passe puis retourne directement dans l’app."
    >
      <form onSubmit={handleSubmit}>
        <GateInput
          data-testid="auth-password-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nouveau mot de passe"
          autoComplete="new-password"
          required
        />
        <GateInput
          data-testid="auth-confirm-password-input"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmer le mot de passe"
          autoComplete="new-password"
          required
          style={{ marginTop: 10 }}
        />
        <GateButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit} className="GatePressable" style={{ marginTop: 12 }}>
          {submitting ? "Mise à jour…" : "Mettre à jour mon mot de passe"}
        </GateButton>
      </form>

      {passwordTooShort ? (
        <p className="small2" style={{ margin: "12px 0 0", color: "#EF4444" }}>
          Utilise au moins {MIN_PASSWORD_LENGTH} caractères.
        </p>
      ) : null}

      {passwordsMismatch ? (
        <p className="small2" style={{ margin: "12px 0 0", color: "#EF4444" }}>
          Les mots de passe ne correspondent pas.
        </p>
      ) : null}

      {status.message ? (
        <p
          data-testid="auth-status"
          role={status.type === "error" ? "alert" : "status"}
          className="small2"
          style={{ margin: "12px 0 0", color: status.type === "error" ? "#EF4444" : "#10B981" }}
        >
          {status.message}
        </p>
      ) : null}
    </AuthCardShell>
  );
}
