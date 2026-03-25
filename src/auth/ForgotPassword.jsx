import React, { useEffect, useMemo, useState } from "react";
import { Button, Input } from "../components/UI";
import AuthCardShell from "./AuthCardShell";
import { isValidEmail } from "./loginAvailability";

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible d'envoyer l'email de reinitialisation.";
}

export default function ForgotPassword({ initialEmail = "", onNavigate, onSendReset }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const normalizedEmail = useMemo(() => String(email || "").trim(), [email]);
  const canSubmit = isValidEmail(normalizedEmail) && !sending;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setStatus({ type: "", message: "" });
    try {
      await onSendReset(normalizedEmail);
      setStatus({
        type: "success",
        message:
          "Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.",
      });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthCardShell
      data-testid="auth-forgot-password-screen"
      title="Mot de passe oublie"
      subtitle="Entre ton email pour recevoir un lien de reinitialisation."
      footer={(
        <button
          type="button"
          onClick={() => onNavigate(`/auth/login?email=${encodeURIComponent(normalizedEmail)}`)}
          style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer" }}
        >
          Retour connexion
        </button>
      )}
    >
      <form onSubmit={handleSubmit}>
        <Input
          data-testid="auth-email-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@exemple.com"
          autoComplete="email"
          required
        />
        <div style={{ height: 12 }} />
        <Button data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
          {sending ? "Envoi..." : "Envoyer le lien"}
        </Button>
      </form>

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

