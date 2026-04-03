import React, { useEffect, useMemo, useState } from "react";
import AuthCardShell from "./AuthCardShell";
import { isValidEmail } from "./loginAvailability";
import {
  AppInput,
  AppTextButton,
  FeedbackMessage,
  FieldGroup,
  PrimaryButton,
} from "../shared/ui/app";

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
        <AppTextButton
          type="button"
          onClick={() => onNavigate(`/auth/login?email=${encodeURIComponent(normalizedEmail)}`)}
        >
          Retour à la connexion
        </AppTextButton>
      )}
    >
      <form onSubmit={handleSubmit} className="appSimpleStack">
        <FieldGroup label="Email" htmlFor="auth-forgot-email">
          <AppInput
            id="auth-forgot-email"
            data-testid="auth-email-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@exemple.com"
            autoComplete="email"
            required
          />
        </FieldGroup>
        <PrimaryButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
          {sending ? "Envoi…" : "Envoyer le lien"}
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
    </AuthCardShell>
  );
}
