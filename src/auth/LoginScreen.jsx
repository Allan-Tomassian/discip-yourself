import React, { useMemo, useState } from "react";
import { Button, Card, Input } from "../components/UI";
import { supabase } from "../infra/supabaseClient";
import { isValidEmail } from "./loginAvailability";

const OTP_CODE_RE = /^[0-9]{6}$/;

function normalizeErrorMessage(error, fallback) {
  const message = String(error?.message || "").trim();
  return message || fallback;
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const normalizedEmail = useMemo(() => String(email || "").trim(), [email]);
  const normalizedCode = useMemo(() => String(code || "").trim(), [code]);
  const emailOk = isValidEmail(normalizedEmail);
  const codeOk = OTP_CODE_RE.test(normalizedCode);

  const canRequestCode = emailOk && !sendingCode && !verifyingCode;
  const canVerifyCode = codeRequested && emailOk && codeOk && !sendingCode && !verifyingCode;

  async function onRequestCode(event) {
    event.preventDefault();
    if (!canRequestCode) return;

    setStatus({ type: "", message: "" });
    setSendingCode(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
      });
      if (error) throw error;

      setCodeRequested(true);
      setStatus({
        type: "success",
        message: "Code envoyé. Vérifie ta boîte mail puis saisis le code ci-dessous.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: normalizeErrorMessage(error, "Impossible d'envoyer le code OTP."),
      });
    } finally {
      setSendingCode(false);
    }
  }

  async function onVerifyCode(event) {
    event.preventDefault();
    if (!canVerifyCode) return;

    setStatus({ type: "", message: "" });
    setVerifyingCode(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: "email",
      });
      if (error) throw error;

      setStatus({ type: "success", message: "Connecté." });

      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.assign("/");
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: normalizeErrorMessage(error, "Code invalide ou expiré."),
      });
    } finally {
      setVerifyingCode(false);
    }
  }

  return (
    <div
      data-testid="auth-login-screen"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <Card style={{ width: "100%", maxWidth: 420, padding: 20 }}>
        <h1 style={{ margin: "0 0 12px" }}>Connexion</h1>
        <p style={{ margin: "0 0 16px", opacity: 0.8 }}>Connecte-toi pour accéder à l’application.</p>

        <form onSubmit={onRequestCode}>
          <Input
            data-testid="auth-email-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@exemple.com"
            autoComplete="email"
            required
          />
          <div style={{ height: 12 }} />
          <Button data-testid="auth-submit-button" type="submit" disabled={!canRequestCode}>
            {sendingCode ? "Envoi..." : "Recevoir un code"}
          </Button>
        </form>

        {codeRequested ? (
          <form onSubmit={onVerifyCode} style={{ marginTop: 12 }}>
            <Input
              data-testid="auth-code-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Code à 6 chiffres"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            <div style={{ height: 12 }} />
            <Button data-testid="auth-verify-button" type="submit" disabled={!canVerifyCode}>
              {verifyingCode ? "Vérification..." : "Vérifier le code"}
            </Button>
          </form>
        ) : null}

        {!emailOk ? (
          <p data-testid="auth-disabled-reason" style={{ margin: "12px 0 0", color: "#EF4444" }}>
            Adresse email invalide.
          </p>
        ) : null}

        {codeRequested && !codeOk && code.length > 0 ? (
          <p data-testid="auth-code-reason" style={{ margin: "12px 0 0", color: "#EF4444" }}>
            Le code doit contenir 6 chiffres.
          </p>
        ) : null}

        {status.message ? (
          <p
            data-testid="auth-status"
            role={status.type === "error" ? "alert" : "status"}
            style={{
              margin: "12px 0 0",
              color: status.type === "error" ? "#EF4444" : "#10B981",
            }}
          >
            {status.message}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

