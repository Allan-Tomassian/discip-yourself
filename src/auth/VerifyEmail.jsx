import React, { useMemo, useState } from "react";
import { MailCheck } from "lucide-react";
import {
  AppTextButton,
  FeedbackMessage,
  PrimaryButton,
  SecondaryButton,
} from "../shared/ui/app";
import { UI_COPY } from "../ui/labels";
import FirstAccessShell from "../features/first-access/FirstAccessShell";
import AuthCommandSurface, { AuthSecureNote } from "../features/first-access/AuthCommandSurface";

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
    <FirstAccessShell variant="verify-email">
      <AuthCommandSurface
        data-testid="auth-verify-email-screen"
        tone="success"
        icon={MailCheck}
        eyebrow="Validation"
        title="Vérifie ton email"
        subtitle="Ouvre le lien reçu par email pour activer ton compte."
        footer={(
          <>
            <AppTextButton
              type="button"
              onClick={() => onNavigate(returnPath, { replace: true })}
            >
              Changer d’email
            </AppTextButton>
            <AuthSecureNote>Sécurisé par Discip Yourself</AuthSecureNote>
          </>
        )}
      >
        <div className="authVerifyVisual" aria-hidden="true">
          <MailCheck size={48} strokeWidth={1.5} />
        </div>

        <FeedbackMessage className="authVerifyIntro">
          {normalizedEmail
            ? `Un lien de validation a été préparé pour ${normalizedEmail}.`
            : "Ouvre le lien de validation depuis ta boîte mail."}
        </FeedbackMessage>
        <div className="authActionStack">
          <PrimaryButton
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
          </PrimaryButton>
          <SecondaryButton type="button" onClick={handleResend} disabled={!normalizedEmail || sending}>
            {sending ? "Envoi…" : UI_COPY.resendLink}
          </SecondaryButton>
        </div>

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
