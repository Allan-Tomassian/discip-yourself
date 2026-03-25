import React, { useEffect, useMemo, useState } from "react";
import { Button, Input } from "../components/UI";
import AuthCardShell from "./AuthCardShell";
import { isValidEmail } from "./loginAvailability";

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible de creer le compte.";
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
          "Compte cree. Verifie ton email pour activer l'acces, meme si cet email existe deja chez nous.",
      });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCardShell
      data-testid="auth-signup-screen"
      title="Creer un compte"
      subtitle="Email, mot de passe, puis validation email obligatoire avant l'app."
      footer={(
        <p style={{ margin: 0, opacity: 0.8 }}>
          Deja inscrit ?{" "}
          <button
            type="button"
            className="btnLink"
            onClick={() => onNavigate("/auth/login")}
            style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer" }}
          >
            J'ai deja un compte
          </button>
        </p>
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
          autoComplete="new-password"
          required
        />
        <div style={{ height: 12 }} />
        <Button data-testid="auth-submit-button" type="submit" disabled={!canSubmit}>
          {submitting ? "Creation..." : "Creer mon compte"}
        </Button>
      </form>

      {!emailOk && normalizedEmail ? (
        <p style={{ margin: "12px 0 0", color: "#EF4444" }}>Adresse email invalide.</p>
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
