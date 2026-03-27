import React, { useMemo, useState } from "react";
import AuthCardShell from "./AuthCardShell";
import { GateButton } from "../shared/ui/gate/Gate";
import { GateTextButton } from "../shared/ui/gate/GateForm";
import { UI_COPY } from "../ui/labels";

function getErrorMessage(error) {
  return String(error?.message || "").trim() || "Impossible de renvoyer le lien.";
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
        message: "Si cet email existe, un nouveau lien de validation vient d’être envoyé.",
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
      title="Valide ton email"
      subtitle="Ouvre le lien reçu par email pour activer ton compte."
      footer={(
        <GateTextButton
          type="button"
          onClick={() => onNavigate(returnPath, { replace: true })}
        >
          Changer d’email
        </GateTextButton>
      )}
    >
      <p className="small" style={{ margin: "0 0 12px" }}>
        {normalizedEmail
          ? `Un lien de validation a été préparé pour ${normalizedEmail}.`
          : "Ouvre le lien de validation depuis ta boîte mail."}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <GateButton
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = normalizedEmail
                ? `mailto:${encodeURIComponent(normalizedEmail)}`
                : "mailto:";
            }
          }}
        >
          {UI_COPY.openMailbox}
        </GateButton>
        <GateButton type="button" variant="secondary" className="GatePressable" onClick={handleResend} disabled={!normalizedEmail || sending}>
          {sending ? "Envoi…" : UI_COPY.resendLink}
        </GateButton>
      </div>

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
