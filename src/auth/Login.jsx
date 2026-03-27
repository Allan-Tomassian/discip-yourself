import React, { useEffect, useMemo, useState } from "react";
import AuthCardShell from "./AuthCardShell";
import { isValidEmail } from "./loginAvailability";
import { GateButton } from "../shared/ui/gate/Gate";
import { GateInput, GateTextButton } from "../shared/ui/gate/GateForm";

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
        <div className="stack stackGap12">
          <p className="small2" style={{ margin: 0 }}>
            Pas encore de compte ?{" "}
            <GateTextButton type="button" onClick={() => onNavigate("/auth/signup")}>
              Créer un compte
            </GateTextButton>
          </p>
          <GateTextButton
            type="button"
            onClick={() => onNavigate(`/auth/forgot-password?email=${encodeURIComponent(normalizedEmail)}`)}
          >
            Mot de passe oublié ?
          </GateTextButton>
        </div>
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
        <GateInput
          data-testid="auth-password-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mot de passe"
          autoComplete="current-password"
          required
          style={{ marginTop: 10 }}
        />
        <GateButton data-testid="auth-submit-button" type="submit" disabled={!canSubmit} className="GatePressable" style={{ marginTop: 12 }}>
          {submitting ? "Connexion…" : "Se connecter"}
        </GateButton>
      </form>

      {!emailOk && normalizedEmail ? (
        <p className="small2" style={{ margin: "12px 0 0", color: "#EF4444" }}>Adresse email invalide.</p>
      ) : null}

      {notice ? (
        <p
          data-testid="auth-notice"
          role="status"
          className="small2"
          style={{ margin: "12px 0 0", color: "#10B981" }}
        >
          {notice}
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
