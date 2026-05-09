import React, { useEffect, useMemo, useState } from "react";
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

function isUnconfirmedEmailError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("email not confirmed") || message.includes("email not verified");
}

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible de se connecter.";
}

export default function Login({
  initialEmail = "",
  notice = "",
  onNavigate,
  onLoggedIn,
  onNeedsVerification,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const normalizedEmail = useMemo(() => String(email || "").trim(), [email]);
  const emailOk = isValidEmail(normalizedEmail);
  const passwordOk = String(password || "").trim().length > 0;
  const canSubmit = emailOk && passwordOk && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      await onLoggedIn(normalizedEmail, password);
    } catch (error) {
      if (isUnconfirmedEmailError(error)) {
        onNeedsVerification(normalizedEmail);
        return;
      }
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FirstAccessShell variant="login">
      <AuthCommandSurface
        data-testid="auth-login-screen"
        eyebrow="Retour au système"
        title="Reprendre le contrôle"
        subtitle="Connecte-toi avec ton email et ton mot de passe."
        footer={(
          <>
            <p className="appMetaText">
              Pas encore de compte ?{" "}
              <AppTextButton type="button" onClick={() => onNavigate("/auth/signup")}>
                Créer un compte
              </AppTextButton>
            </p>
            <AppTextButton
              type="button"
              onClick={() => onNavigate(`/auth/forgot-password?email=${encodeURIComponent(normalizedEmail)}`)}
            >
              Mot de passe oublié ?
            </AppTextButton>
            <AuthSecureNote>Connexion sécurisée</AuthSecureNote>
          </>
        )}
      >
        <form onSubmit={handleSubmit} className="authFormStack">
          <FieldGroup
            label="Email"
            htmlFor="auth-login-email"
            error={!emailOk && normalizedEmail ? "Adresse email invalide." : ""}
          >
            <AppInput
              id="auth-login-email"
              data-testid="auth-email-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@exemple.com"
              autoComplete="email"
              required
            />
          </FieldGroup>
          <FieldGroup label="Mot de passe" htmlFor="auth-login-password">
            <AppInput
              id="auth-login-password"
              data-testid="auth-password-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              required
            />
          </FieldGroup>
          <PrimaryButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
            {submitting ? "Connexion…" : "Se connecter"}
          </PrimaryButton>
        </form>

        {notice ? (
          <FeedbackMessage
            data-testid="auth-notice"
            role="status"
            tone="success"
          >
            {notice}
          </FeedbackMessage>
        ) : null}

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
