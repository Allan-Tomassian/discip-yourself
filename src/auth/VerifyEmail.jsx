import React, { useMemo, useState } from "react";
import { Button } from "../components/UI";
import AuthCardShell from "./AuthCardShell";

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible de renvoyer l'email.";
}

export default function VerifyEmail({
  email = "",
  mode = "signup",
  onNavigate,
  onResend,
}) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const normalizedEmail = useMemo(() => String(email || "").trim(), [email]);
  const returnPath = mode === "login"
    ? `/auth/login?email=${encodeURIComponent(normalizedEmail)}`
    : `/auth/signup?email=${encodeURIComponent(normalizedEmail)}`;

  async function handleResend() {
    if (!normalizedEmail || sending) return;
    setSending(true);
    setStatus({ type: "", message: "" });
    try {
      await onResend(normalizedEmail);
      setStatus({
        type: "success",
        message: "Si cet email existe, un nouveau lien de validation vient d'etre envoye.",
      });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthCardShell
      data-testid="auth-verify-email-screen"
      title="Validation email"
      subtitle="Verifie ton email pour activer ton compte."
      footer={(
        <button
          type="button"
          onClick={() => onNavigate(returnPath, { replace: true })}
          style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer" }}
        >
          Changer email
        </button>
      )}
    >
      <p style={{ margin: "0 0 12px" }}>
        {normalizedEmail
          ? `Un lien de validation a ete prepare pour ${normalizedEmail}.`
          : "Un lien de validation doit etre ouvert depuis ta boite mail."}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <Button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = normalizedEmail
                ? `mailto:${encodeURIComponent(normalizedEmail)}`
                : "mailto:";
            }
          }}
        >
          Ouvrir email
        </Button>
        <Button type="button" variant="secondary" onClick={handleResend} disabled={!normalizedEmail || sending}>
          {sending ? "Envoi..." : "Renvoyer email"}
        </Button>
      </div>

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
