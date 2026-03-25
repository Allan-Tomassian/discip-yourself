import React, { useEffect, useMemo, useState } from "react";
import { Button, Input } from "../components/UI";
import AuthCardShell from "./AuthCardShell";
import { isValidEmail } from "./loginAvailability";

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
    <AuthCardShell
      data-testid="auth-login-screen"
      title="Connexion"
      subtitle="Connecte-toi avec ton email et ton mot de passe."
      footer={(
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Pas encore de compte ?{" "}
            <button
              type="button"
              onClick={() => onNavigate("/auth/signup")}
              style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer" }}
            >
              Creer un compte
            </button>
          </p>
          <button
            type="button"
            onClick={() => onNavigate(`/auth/forgot-password?email=${encodeURIComponent(normalizedEmail)}`)}
            style={{
              justifySelf: "start",
              background: "none",
              border: 0,
              padding: 0,
              color: "var(--accent)",
              cursor: "pointer",
            }}
          >
            Mot de passe oublie ?
          </button>
        </div>
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
        <div style={{ height: 10 }} />
        <Input
          data-testid="auth-password-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mot de passe"
          autoComplete="current-password"
          required
        />
        <div style={{ height: 12 }} />
        <Button data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
          {submitting ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      {!emailOk && normalizedEmail ? (
        <p style={{ margin: "12px 0 0", color: "#EF4444" }}>Adresse email invalide.</p>
      ) : null}

      {notice ? (
        <p
          data-testid="auth-notice"
          role="status"
          style={{ margin: "12px 0 0", color: "#10B981" }}
        >
          {notice}
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
