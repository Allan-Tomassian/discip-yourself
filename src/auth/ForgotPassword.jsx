import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { isValidEmail } from "./loginAvailability";
import {
  AppInput,
  AppTextButton,
  FeedbackMessage,
  FieldGroup,
  PrimaryButton,
} from "../shared/ui/app";
import FirstAccessShell from "../features/first-access/FirstAccessShell";
import AuthCommandSurface, { AuthSecureNote } from "../features/first-access/AuthCommandSurface";

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
    <FirstAccessShell variant="forgot-password">
      <AuthCommandSurface
        data-testid="auth-forgot-password-screen"
        eyebrow="Réinitialiser l’accès"
        title="Réinitialiser l’accès"
        subtitle="Entre ton email pour recevoir un lien de réinitialisation."
        footer={(
          <>
            <AppTextButton
              type="button"
              onClick={() => onNavigate(`/auth/login?email=${encodeURIComponent(normalizedEmail)}`)}
            >
              Retour connexion
            </AppTextButton>
            <AuthSecureNote>Sécurisé par Discip Yourself</AuthSecureNote>
          </>
        )}
      >
        <form onSubmit={handleSubmit} className="authFormStack">
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
          <div className="authSecurityCard">
            <ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" />
            <div>
              <strong>Sécurisé et privé</strong>
              <span>Ton email ne sera jamais partagé. Nous t’enverrons simplement un lien.</span>
            </div>
          </div>
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
      </AuthCommandSurface>
    </FirstAccessShell>
  );
}
