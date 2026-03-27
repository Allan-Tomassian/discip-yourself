import React, { useEffect, useMemo, useState } from "react";
import AuthCardShell from "./AuthCardShell";
import { isValidEmail } from "./loginAvailability";
import { GateButton } from "../shared/ui/gate/Gate";
import { GateInput, GateTextButton } from "../shared/ui/gate/GateForm";

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible d’envoyer le lien de réinitialisation.";
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
          "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
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
      title="Mot de passe oublié"
      subtitle="Entre ton email pour recevoir un lien de réinitialisation."
      footer={(
        <GateTextButton
          type="button"
          onClick={() => onNavigate(`/auth/login?email=${encodeURIComponent(normalizedEmail)}`)}
        >
          Retour à la connexion
        </GateTextButton>
      )}
    >
      <form onSubmit={handleSubmit}>
        <GateInput
          data-testid="auth-email-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@exemple.com"
          autoComplete="email"
          required
        />
        <GateButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit} className="GatePressable" style={{ marginTop: 12 }}>
          {sending ? "Envoi…" : "Envoyer le lien"}
        </GateButton>
      </form>

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
