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

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible de créer le compte.";
}

export default function Signup({ initialEmail = "", onNavigate, onSignedUp }) {
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
      await onSignedUp(normalizedEmail, password);
      setStatus({
        type: "success",
        message:
          "Compte créé. Vérifie ton email pour activer ton accès, même si cette adresse existe déjà.",
      });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FirstAccessShell variant="signup">
      <AuthCommandSurface
        data-testid="auth-signup-screen"
        eyebrow="Créer l’accès"
        title="Créer ton compte"
        subtitle="Un système qui te remet d’aplomb commence par un accès sécurisé."
        footer={(
          <>
            <p className="appMetaText">
              Déjà un compte ?{" "}
              <AppTextButton type="button" onClick={() => onNavigate("/auth/login")}>
                Se connecter
              </AppTextButton>
            </p>
            <AuthSecureNote>Données sécurisées. Ton système t’appartient.</AuthSecureNote>
          </>
        )}
      >
        <form onSubmit={handleSubmit} className="authFormStack">
          <FieldGroup
            label="Email"
            htmlFor="auth-signup-email"
            error={!emailOk && normalizedEmail ? "Adresse email invalide." : ""}
          >
            <AppInput
              id="auth-signup-email"
              data-testid="auth-email-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@exemple.com"
              autoComplete="email"
              required
            />
          </FieldGroup>
          <FieldGroup label="Mot de passe" htmlFor="auth-signup-password">
            <AppInput
              id="auth-signup-password"
              data-testid="auth-password-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              autoComplete="new-password"
              required
            />
          </FieldGroup>
          <PrimaryButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
            {submitting ? "Création…" : "Créer mon compte"}
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
