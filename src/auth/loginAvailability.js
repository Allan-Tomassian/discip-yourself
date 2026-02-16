const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  const email = String(value || "").trim();
  return EMAIL_RE.test(email);
}

export function getLoginAvailability({ supabaseReady, email, sending, supabaseConfigError = "" } = {}) {
  const ready = Boolean(supabaseReady);
  const busy = Boolean(sending);
  const emailOk = isValidEmail(email);
  const canSend = ready && emailOk && !busy;
  const configMessage =
    String(supabaseConfigError || "").trim()
    || "Configuration Supabase manquante. Renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";

  if (!ready) {
    return {
      supabaseReady: ready,
      emailOk,
      sending: busy,
      canSend,
      reasonKey: "supabase_missing",
      reasonMessage: configMessage,
    };
  }

  if (busy) {
    return {
      supabaseReady: ready,
      emailOk,
      sending: busy,
      canSend,
      reasonKey: "sending",
      reasonMessage: "Envoi en cours...",
    };
  }

  if (!emailOk) {
    return {
      supabaseReady: ready,
      emailOk,
      sending: busy,
      canSend,
      reasonKey: "email_invalid",
      reasonMessage: "Adresse email invalide.",
    };
  }

  return {
    supabaseReady: ready,
    emailOk,
    sending: busy,
    canSend,
    reasonKey: "",
    reasonMessage: "",
  };
}
