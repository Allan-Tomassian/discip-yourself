import React, { useState } from "react";
import { Button, Card, Input } from "../components/UI";
import {
  hasSupabaseConfig,
  supabase,
  supabaseConfigError,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  validateSupabaseUrl,
} from "../infra/supabaseClient";
import { formatSupabaseAuthError } from "./authDiagnostics";
import { getLoginAvailability, isValidEmail } from "./loginAvailability";

const DIAG_TIMEOUT_MS = 5000;

function inferProbableCause(error, { timeout = false, url = "" } = {}) {
  if (timeout || error?.name === "AbortError") return "timeout réseau (>5s)";
  if (!url) return "URL invalide ou manquante";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";

  const message = String(error?.message || "").toLowerCase();
  if (message.includes("supabase url invalid")) return "URL invalide";
  if (message.includes("failed to fetch") || message.includes("networkerror")) return "requête bloquée (CORS / extension privacy / adblock / réseau)";
  return "erreur réseau inconnue";
}

function firstLine(value) {
  return String(value || "")
    .split(/\r?\n/, 1)[0]
    .slice(0, 180)
    .trim();
}

function classifyFetchError(error) {
  const name = String(error?.name || "Error");
  const message = String(error?.message || "").trim();
  const lowered = message.toLowerCase();
  if (name === "AbortError") {
    return { label: "DNS/Network fail", detail: `${name}: timeout (>5s)` };
  }
  if (lowered.includes("cors") || lowered.includes("blocked")) {
    return { label: "CORS blocked", detail: `${name}: ${message || "CORS blocked"}` };
  }
  if (name === "TypeError" && lowered.includes("failed to fetch")) {
    return { label: "DNS/Network fail", detail: `${name}: ${message}` };
  }
  return { label: "DNS/Network fail", detail: `${name}: ${message || "Failed to fetch"}` };
}

function classifyFetchResponse(response) {
  const status = Number(response?.status || 0);
  if (response?.type === "opaque" || status === 0) {
    return "CORS blocked";
  }
  if (status === 401 || status === 403 || status >= 500) {
    return `Supabase error (${status})`;
  }
  return `HTTP ${status}`;
}

export default function LoginScreen() {
  const isDev = Boolean(import.meta.env.DEV);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [statusCode, setStatusCode] = useState(null);
  const [diagnostics, setDiagnostics] = useState({
    running: false,
    rows: [],
  });

  const supabaseReady = Boolean(supabase && hasSupabaseConfig);
  const envInvalid = Boolean(supabaseConfigError);
  const emailOk = isValidEmail(email);
  const canSend = supabaseReady && emailOk && !sending;
  const availability = getLoginAvailability({ supabaseReady, email, sending, supabaseConfigError });

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setStatus({ type: "", message: "" });
    setStatusCode(null);
    const normalizedEmail = String(email || "").trim();

    try {
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
      const diagnostic = formatSupabaseAuthError(error);
      const cause = inferProbableCause(error, { url: SUPABASE_URL });
      setStatusCode(diagnostic.statusCode);
      setStatus({
        type: "error",
        message: `${diagnostic.userMessage} Cause probable: ${cause}.`,
      });
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error("[auth] signInWithOtp failed", {
          status: diagnostic.statusCode,
          message: diagnostic.sourceMessage,
          name: error?.name || "",
          supabaseUrl: SUPABASE_URL,
          probableCause: cause,
          emailDomain: normalizedEmail.includes("@") ? normalizedEmail.split("@")[1] : "",
        });
      }
    } finally {
      setSending(false);
    }
  }

  async function runFetchDiagnostic(id, label, url, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIAG_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        ...init,
        signal: controller.signal,
      });
      const body = firstLine(await response.text()) || "(body vide)";
      return {
        id,
        title: label,
        status: classifyFetchResponse(response),
        detail: `status ${response.status} · ${body}`,
      };
    } catch (error) {
      const mapped = classifyFetchError(error);
      return {
        id,
        title: label,
        status: mapped.label,
        detail: mapped.detail,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function runNetworkDiagnostics() {
    setDiagnostics({ running: true, rows: [] });

    let validatedUrl = "";
    try {
      validatedUrl = validateSupabaseUrl(SUPABASE_URL);
    } catch (error) {
      setDiagnostics({
        running: false,
        rows: [
          {
            id: "url",
            title: "URL Supabase",
            status: "URL invalide",
            detail: error?.message || "Supabase URL invalid",
          },
        ],
      });
      return;
    }

    const healthUrl = `${validatedUrl}/auth/v1/health`;
    const restUrl = `${validatedUrl}/rest/v1/`;

    const [healthResult, restResult] = await Promise.all([
      runFetchDiagnostic("health", "Auth health", healthUrl),
      runFetchDiagnostic("rest", "REST root", restUrl, {
        headers: { apikey: SUPABASE_ANON_KEY },
      }),
    ]);

    let sessionResult = {
      id: "session",
      title: "Supabase init",
      status: "Supabase init unavailable",
      detail: supabaseConfigError || "Client Supabase non initialisé.",
    };

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          sessionResult = {
            id: "session",
            title: "Supabase init",
            status: "Supabase error",
            detail: error?.message || "getSession failed",
          };
        } else {
          sessionResult = {
            id: "session",
            title: "Supabase init",
            status: "OK",
            detail: data?.session ? "Session présente." : "Session absente (client initialisé).",
          };
        }
      }
    } catch (error) {
      sessionResult = {
        id: "session",
        title: "Supabase init",
        status: "Supabase error",
        detail: error?.message || "getSession failed",
      };
    }

    setDiagnostics({
      running: false,
      rows: [healthResult, restResult, sessionResult],
    });

    if (isDev) {
      // eslint-disable-next-line no-console
      console.info("[auth] diagnostics completed", {
        supabaseUrl: SUPABASE_URL,
        origin: typeof window !== "undefined" ? window.location.origin : "",
        rows: [healthResult, restResult, sessionResult].map((row) => ({
          id: row.id,
          status: row.status,
          detail: row.detail,
        })),
      });
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

        {envInvalid ? (
          <div
            data-testid="auth-env-help"
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #EF4444",
              background: "rgba(239,68,68,0.08)",
            }}
          >
            <p style={{ margin: 0, color: "#EF4444", fontWeight: 600 }}>
              Configuration Supabase invalide
            </p>
            <p style={{ margin: "6px 0 0" }}>
              Ouvre Supabase &gt; Project Settings &gt; API, puis renseigne `VITE_SUPABASE_URL` et
              `VITE_SUPABASE_ANON_KEY` dans `.env`.
            </p>
          </div>
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

        {statusCode ? (
          <p data-testid="auth-status-code" style={{ margin: "8px 0 0", color: "#EF4444" }}>
            Code HTTP: {statusCode}
          </p>
        ) : null}

        {isDev ? (
          <div data-testid="auth-diagnostics" style={{ marginTop: 12 }}>
            <Button
              type="button"
              variant="ghost"
              data-testid="auth-diagnostics-button"
              onClick={runNetworkDiagnostics}
              disabled={diagnostics.running}
            >
              {diagnostics.running ? "Diagnostic..." : "Diagnostic réseau"}
            </Button>
            <p data-testid="auth-runtime-url" style={{ margin: "8px 0 0", opacity: 0.8 }}>
              SUPABASE_URL: {SUPABASE_URL || "(vide)"}
            </p>
            <p data-testid="auth-runtime-origin" style={{ margin: "4px 0 0", opacity: 0.8 }}>
              Origin: {typeof window !== "undefined" ? window.location.origin : ""}
            </p>
            {diagnostics.rows.length > 0 ? (
              <div data-testid="auth-diagnostics-results" style={{ marginTop: 8 }}>
                {diagnostics.rows.map((row) => (
                  <p key={row.id} data-testid={`auth-diag-${row.id}`} style={{ margin: "6px 0 0" }}>
                    {row.title}: <strong>{row.status}</strong> · {row.detail}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
