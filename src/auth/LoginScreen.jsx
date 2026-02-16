import React, { useState } from "react";
import { Button, Card, Input } from "../components/UI";
import { hasSupabaseConfig, supabase } from "../infra/supabaseClient";
import { getLoginAvailability } from "./loginAvailability";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const availability = getLoginAvailability({
    supabaseReady: Boolean(supabase && hasSupabaseConfig),
    email,
    sending,
  });
  const { supabaseReady, emailOk, canSend } = availability;

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setStatus({ type: "", message: "" });

    try {
      const normalizedEmail = String(email || "").trim();
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setStatus({
        type: "success",
        message: "Email envoyé. Vérifie ta boîte mail pour te connecter.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "Impossible d'envoyer l'email.",
      });
    } finally {
      setSending(false);
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

        <form onSubmit={onSubmit}>
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
          <Button data-testid="auth-submit-button" type="submit" disabled={!canSend}>
            {sending ? "Envoi..." : "Recevoir un lien"}
          </Button>
        </form>

        {!canSend ? (
          <p
            data-testid="auth-disabled-reason"
            style={{
              margin: "12px 0 0",
              color: !supabaseReady || !emailOk ? "#EF4444" : "#64748B",
            }}
          >
            {availability.reasonMessage}
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
