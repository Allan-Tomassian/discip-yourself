import React, { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { GhostButton, PrimaryButton } from "../../shared/ui/app";
import { useAuth } from "../../auth/useAuth";
import {
  buildAiFirstRunWhyClarificationRequest,
  requestAiFirstRunWhyClarification,
} from "../../infra/aiFirstRunClient";
import { todayLocalKey } from "../../utils/datetime";
import {
  FIRST_RUN_WHY_INSPIRATION_CHIPS,
  getFirstRunWhyAiCta,
  getFirstRunWhyAiMode,
  resolveFirstRunWhySuggestionText,
} from "./firstRunWhyAiAssistantModel";

const REQUEST_TIMEOUT_MS = 8000;
const FAILURE_COPY =
  "Aide IA indisponible pour l’instant. Tu peux continuer en mode manuel : tes réponses suffisent pour générer un plan.";

function trimString(value, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function readRuntimeLocale() {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    return typeof locale === "string" && locale.trim() ? locale : "fr-FR";
  } catch {
    return "fr-FR";
  }
}

function readRuntimeTimezone() {
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === "string" && timeZone.trim() ? timeZone : "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter((entry) => trimString(entry, 120)) : [];
}

function SuggestionList({ label, values }) {
  const safeValues = safeArray(values).slice(0, 5);
  if (!safeValues.length) return null;
  return (
    <div className="firstRunWhyAiDetail">
      <span>{label}</span>
      <ul>
        {safeValues.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

export default function FirstRunWhyAiAssistant({
  value,
  onChange,
  onFocusTextarea,
}) {
  const auth = useAuth() || {};
  const accessToken = auth.session?.access_token || "";
  const [selectedChipId, setSelectedChipId] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const safeValue = String(value || "");
  const mode = getFirstRunWhyAiMode(safeValue);
  const selectedChip = FIRST_RUN_WHY_INSPIRATION_CHIPS.find((chip) => chip.id === selectedChipId) || null;
  const suggestionText = resolveFirstRunWhySuggestionText(result);
  const clarification = result?.clarification || {};
  const isLoading = status === "loading";
  const hasResult = status === "ready" && result;
  const hasError = status === "error";
  const showExpandedSurface = isLoading || hasResult || hasError || accepted;

  const chips = useMemo(
    () =>
      FIRST_RUN_WHY_INSPIRATION_CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`firstRunWhyInspirationChip${chip.id === selectedChipId ? " is-selected" : ""}`}
          aria-pressed={chip.id === selectedChipId}
          onClick={() => setSelectedChipId((current) => (current === chip.id ? "" : chip.id))}
        >
          {chip.label}
        </button>
      )),
    [selectedChipId]
  );

  async function handleRequest() {
    setStatus("loading");
    setAccepted(false);
    setResult(null);
    const requestMode = mode === "clarify" ? "clarify" : "inspiration";
    const requestWhyText = trimString(safeValue, 1200) || trimString(selectedChip?.prompt, 1200);

    const { payload } = await buildAiFirstRunWhyClarificationRequest({
      version: 1,
      mode: requestMode,
      whyText: requestWhyText,
      locale: readRuntimeLocale(),
      timezone: readRuntimeTimezone(),
      referenceDateKey: todayLocalKey(),
    });
    const response = await requestAiFirstRunWhyClarification({
      accessToken,
      payload,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!response?.ok || !response.payload || !resolveFirstRunWhySuggestionText(response.payload)) {
      setStatus("error");
      return;
    }
    setResult(response.payload);
    setStatus("ready");
  }

  function handleUseSuggestion({ focus = false } = {}) {
    if (!suggestionText) return;
    onChange(suggestionText);
    setAccepted(true);
    if (focus && typeof onFocusTextarea === "function") {
      window.setTimeout(() => onFocusTextarea(), 0);
    }
  }

  function handleKeepOriginal() {
    setResult(null);
    setStatus("idle");
    setAccepted(false);
  }

  return (
    <div className={`firstRunWhyAiRoot${showExpandedSurface ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="firstRunWhyAiInlineAction"
        disabled={isLoading}
        onClick={handleRequest}
        data-testid="first-run-why-ai-cta"
      >
        {isLoading ? "Analyse..." : getFirstRunWhyAiCta(safeValue)}
        <Sparkles size={13} aria-hidden="true" />
      </button>

      {showExpandedSurface ? (
        <section className={`firstRunWhyAiCard${accepted ? " is-accepted" : ""}${hasError ? " is-error" : ""}`}>
          <div className="firstRunWhyAiHeader">
            <div className="firstRunWhyAiGlyph" aria-hidden="true">
              {accepted ? <Check size={16} /> : <Sparkles size={16} />}
            </div>
            <div>
              <p className="firstRunWhyAiLabel">Assistance IA</p>
              <h3>Formuler une raison plus claire</h3>
            </div>
          </div>

          <div className="firstRunWhyAiCompact">
            <p>
              {mode === "clarify"
                ? "Garde ton intention. L’IA aide seulement à la rendre plus nette."
                : "Choisis une piste ou demande une formulation pour démarrer."}
            </p>
          </div>

          {mode === "inspiration" && (isLoading || hasResult || hasError) ? (
            <div className="firstRunWhyInspirationChips" aria-label="Pistes d’inspiration">
              {chips}
            </div>
          ) : null}

          {hasError ? (
            <p className="firstRunWhyAiFeedback is-error" role="status">
              {FAILURE_COPY}
            </p>
          ) : null}

          {accepted ? (
            <p className="firstRunWhyAiFeedback is-accepted" role="status">
              Version utilisée. Tu peux encore la modifier avant de continuer.
            </p>
          ) : null}

          {hasResult ? (
            <div className="firstRunWhyAiResult" data-testid="first-run-why-ai-suggestion">
              <div className="firstRunWhyAiClarified">
                <span>Version proposée</span>
                <p>{suggestionText}</p>
              </div>

              <div className="firstRunWhyAiDetailsGrid">
                <SuggestionList label="Intention principale" values={[clarification.primaryIntent]} />
                <SuggestionList label="Intentions secondaires" values={clarification.secondaryIntents} />
                <SuggestionList label="Points de blocage" values={clarification.frictions} />
                <SuggestionList label="Identité visée" values={[clarification.desiredIdentity]} />
                <SuggestionList label="Risques d’exécution" values={clarification.executionRisks} />
                <SuggestionList label="Domaines suggérés" values={clarification.suggestedDomains} />
              </div>

              <div className="firstRunWhyAiActions">
                <PrimaryButton onClick={() => handleUseSuggestion()} data-testid="first-run-why-ai-use">
                  Utiliser cette version
                </PrimaryButton>
                <GhostButton onClick={() => handleUseSuggestion({ focus: true })} data-testid="first-run-why-ai-edit">
                  Modifier
                </GhostButton>
                <GhostButton onClick={handleKeepOriginal} data-testid="first-run-why-ai-keep">
                  Garder ma version
                </GhostButton>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
