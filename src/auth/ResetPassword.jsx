import React, { useMemo, useState } from "react";
import { Button, Input } from "../components/UI";
import AuthCardShell from "./AuthCardShell";

const MIN_PASSWORD_LENGTH = 6;

function getErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();
  if (lower.includes("expired") || lower.includes("invalid") || lower.includes("session")) {
    return "Lien expire ou session introuvable. Redemande un email de reinitialisation.";
  }
  if (lower.includes("weak password") || lower.includes("password") && lower.includes("short")) {
    return `Mot de passe trop court. Utilise au moins ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return message || "Impossible de mettre a jour le mot de passe.";
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
        subtitle="Le lien de reinitialisation est expire, invalide ou la session recovery est absente."
        footer={(
          <button
            type="button"
            onClick={() => onNavigate("/auth/forgot-password", { replace: true })}
            style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer" }}
          >
            Demander un nouveau lien
          </button>
        )}
      >
        <p style={{ margin: 0 }}>
          Redemande un email de reinitialisation pour definir un nouveau mot de passe.
        </p>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      data-testid="auth-reset-password-screen"
      title="Nouveau mot de passe"
      subtitle="Definis ton nouveau mot de passe puis retourne directement dans l'app."
    >
      <form onSubmit={handleSubmit}>
        <Input
          data-testid="auth-password-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nouveau mot de passe"
          autoComplete="new-password"
          required
        />
        <div style={{ height: 10 }} />
        <Input
          data-testid="auth-confirm-password-input"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmer le mot de passe"
          autoComplete="new-password"
          required
        />
        <div style={{ height: 12 }} />
        <Button data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
          {submitting ? "Mise a jour..." : "Mettre a jour"}
        </Button>
      </form>

      {passwordTooShort ? (
        <p style={{ margin: "12px 0 0", color: "#EF4444" }}>
          Utilise au moins {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      ) : null}

      {passwordsMismatch ? (
        <p style={{ margin: "12px 0 0", color: "#EF4444" }}>
          Les mots de passe ne correspondent pas.
        </p>
      ) : null}

      {status.message ? (
        <p
          data-testid="auth-status"
          role={status.type === "error" ? "alert" : "status"}
          style={{ margin: "12px 0 0", color: status.type === "error" ? "#EF4444" : "#10B981" }}
        >
          {status.message}
        </p>
      ) : null}
    </AuthCardShell>
  );
}
