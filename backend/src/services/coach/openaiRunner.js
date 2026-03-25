import { zodResponseFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import { coachChatPayloadSchema, coachPayloadSchema } from "../../schemas/coach.js";

const DEFAULT_OUTPUT_LOCALE = "fr-FR";
const TEXT_LIMITS = Object.freeze({
  headline: 72,
  reason: 160,
  actionLabel: 32,
  draftTitle: 96,
});

export const MODEL_OUTPUT_ISSUE_CODE = Object.freeze({
  EMPTY_MESSAGE: "empty_message",
  MODEL_REFUSAL: "model_refusal",
  MISSING_PARSED_PAYLOAD: "missing_parsed_payload",
  MISSING_REQUIRED_FIELD: "missing_required_field",
  INVALID_PRIMARY_ACTION: "invalid_primary_action",
  INVALID_ENUM_VALUE: "invalid_enum_value",
  TEXT_LIMIT_EXCEEDED: "text_limit_exceeded",
  INVALID_REWARD_SUGGESTION: "invalid_reward_suggestion",
  SCHEMA_VALIDATION_FAILED: "schema_validation_failed",
});

class OpenAiModelOutputError extends Error {
  constructor(issueCode, options = {}) {
    super("invalid_model_output");
    this.name = "OpenAiModelOutputError";
    this.issueCode = issueCode;
    if (options.cause) this.cause = options.cause;
  }
}

export function isOpenAiModelOutputError(error) {
  return error?.message === "invalid_model_output" && typeof error?.issueCode === "string";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateText(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : value;
}

function normalizeNullableField(object, key) {
  if (!isPlainObject(object)) return object;
  if (!(key in object) || object[key] === undefined) {
    object[key] = null;
  }
  return object;
}

function normalizeActionCandidate(action) {
  if (!isPlainObject(action)) return action;
  const normalized = { ...action };
  normalized.label = truncateText(normalized.label, TEXT_LIMITS.actionLabel);
  normalizeNullableField(normalized, "categoryId");
  normalizeNullableField(normalized, "actionId");
  normalizeNullableField(normalized, "occurrenceId");
  normalizeNullableField(normalized, "dateKey");
  return normalized;
}

function normalizeDraftChangeCandidate(change) {
  if (!isPlainObject(change)) return change;
  const normalized = { ...change };
  normalized.title = typeof normalized.title === "string" ? normalized.title.slice(0, TEXT_LIMITS.draftTitle) : normalized.title;
  normalizeNullableField(normalized, "title");
  normalizeNullableField(normalized, "categoryId");
  normalizeNullableField(normalized, "actionId");
  normalizeNullableField(normalized, "occurrenceId");
  normalizeNullableField(normalized, "repeat");
  normalizeNullableField(normalized, "startTime");
  normalizeNullableField(normalized, "durationMin");
  normalizeNullableField(normalized, "dateKey");
  if (!Array.isArray(normalized.daysOfWeek)) normalized.daysOfWeek = [];
  normalized.daysOfWeek = normalized.daysOfWeek
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .slice(0, 7);
  return normalized;
}

export function normalizeCoachPayloadCandidate(candidate) {
  if (!isPlainObject(candidate)) return candidate;
  const normalized = { ...candidate };
  normalized.headline = truncateText(normalized.headline, TEXT_LIMITS.headline);
  normalized.reason = truncateText(normalized.reason, TEXT_LIMITS.reason);

  if ("primaryAction" in normalized) {
    normalized.primaryAction = normalizeActionCandidate(normalized.primaryAction);
  }

  if (!("secondaryAction" in normalized) || normalized.secondaryAction === undefined) {
    normalized.secondaryAction = null;
  } else if (normalized.secondaryAction !== null) {
    normalized.secondaryAction = normalizeActionCandidate(normalized.secondaryAction);
  }

  if (!("suggestedDurationMin" in normalized) || normalized.suggestedDurationMin === undefined) {
    normalized.suggestedDurationMin = null;
  }

  if (!("rewardSuggestion" in normalized) || normalized.rewardSuggestion == null) {
    normalized.rewardSuggestion = { kind: "none", label: null };
  } else if (isPlainObject(normalized.rewardSuggestion)) {
    normalized.rewardSuggestion = { ...normalized.rewardSuggestion };
    normalizeNullableField(normalized.rewardSuggestion, "label");
    normalized.rewardSuggestion.label = truncateText(
      normalized.rewardSuggestion.label,
      TEXT_LIMITS.actionLabel,
    );
  }

  return normalized;
}

function normalizeChatPayloadCandidate(candidate) {
  if (!isPlainObject(candidate)) return candidate;
  const normalized = { ...candidate };
  normalized.headline = truncateText(normalized.headline, TEXT_LIMITS.headline);
  normalized.reason = truncateText(normalized.reason, TEXT_LIMITS.reason);
  normalized.primaryAction = normalizeActionCandidate(normalized.primaryAction);

  if (!("secondaryAction" in normalized) || normalized.secondaryAction === undefined) {
    normalized.secondaryAction = null;
  } else if (normalized.secondaryAction !== null) {
    normalized.secondaryAction = normalizeActionCandidate(normalized.secondaryAction);
  }

  if (!("suggestedDurationMin" in normalized) || normalized.suggestedDurationMin === undefined) {
    normalized.suggestedDurationMin = null;
  }

  if (!Array.isArray(normalized.draftChanges)) {
    normalized.draftChanges = [];
  } else {
    normalized.draftChanges = normalized.draftChanges.map(normalizeDraftChangeCandidate).filter(isPlainObject).slice(0, 4);
  }

  return normalized;
}

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (isPlainObject(part) && typeof part.text === "string") return part.text;
      return "";
    })
    .join("")
    .trim();
  return text || null;
}

function extractPayloadCandidate(message) {
  if (isPlainObject(message?.parsed)) {
    return message.parsed;
  }
  const rawText = extractTextContent(message?.content);
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function classifyCoachPayloadIssue(error) {
  if (!(error instanceof ZodError)) {
    return MODEL_OUTPUT_ISSUE_CODE.SCHEMA_VALIDATION_FAILED;
  }

  for (const issue of error.issues || []) {
    const [rootKey, nestedKey] = issue.path || [];

    if (rootKey === "primaryAction" && nestedKey === "intent") {
      return MODEL_OUTPUT_ISSUE_CODE.INVALID_PRIMARY_ACTION;
    }

    if (rootKey === "rewardSuggestion") {
      return MODEL_OUTPUT_ISSUE_CODE.INVALID_REWARD_SUGGESTION;
    }

    if (issue.code === "too_big" && issue.type === "string") {
      return MODEL_OUTPUT_ISSUE_CODE.TEXT_LIMIT_EXCEEDED;
    }

    if (issue.code === "invalid_type" && issue.received === "undefined") {
      return MODEL_OUTPUT_ISSUE_CODE.MISSING_REQUIRED_FIELD;
    }

    if (issue.code === "invalid_enum_value") {
      return MODEL_OUTPUT_ISSUE_CODE.INVALID_ENUM_VALUE;
    }
  }

  return MODEL_OUTPUT_ISSUE_CODE.SCHEMA_VALIDATION_FAILED;
}

function buildSystemPrompt(locale = DEFAULT_OUTPUT_LOCALE) {
  return [
    "You are a precise execution coach.",
    "Output valid JSON only.",
    "Keep text compact and actionable.",
    `All user-visible strings must be written in French (${locale}).`,
    "This includes headline, reason, primaryAction.label, secondaryAction.label, and rewardSuggestion.label.",
  ].join(" ");
}

function buildNowPrompt(context) {
  const focusTitle = context.focusOccurrenceSummary?.title || "Action";
  const gapCandidate = Array.isArray(context.gapSummary?.candidateActionSummaries)
    ? context.gapSummary.candidateActionSummaries[0] || null
    : null;
  const shouldUseGapExample = Boolean(context.gapSummary?.hasGapToday && gapCandidate);
  const examplePrimaryAction = shouldUseGapExample
    ? {
        label: "Planifier aujourd’hui",
        intent: "open_pilotage",
        categoryId: "cat-1",
        actionId: gapCandidate?.actionId || "goal-1",
        occurrenceId: null,
        dateKey: context.activeDate,
      }
    : context.isToday
      ? {
          label: "Démarrer",
          intent: "start_occurrence",
          categoryId: "cat-1",
          actionId: "goal-1",
          occurrenceId: "occ-1",
          dateKey: context.activeDate,
        }
      : {
          label: "Replanifier",
          intent: "open_pilotage",
          categoryId: "cat-1",
          actionId: "goal-1",
          occurrenceId: "occ-1",
          dateKey: context.activeDate,
        };
  const validExample = {
    kind: "now",
    headline: shouldUseGapExample
      ? `Planifie ${gapCandidate?.title || "une action"}`
      : context.isToday
        ? `Lance ${focusTitle}`
        : `Replanifie ${focusTitle}`,
    reason: shouldUseGapExample
      ? `${gapCandidate?.title || "Cette action"} n'est pas encore planifiée aujourd'hui. Programme-la maintenant pour garder la continuité.`
      : context.isToday
        ? `${focusTitle} est l'action la plus exécutable maintenant dans le plan du jour.`
        : `${focusTitle} est prévue pour une autre date et doit être replanifiée avant exécution.`,
    primaryAction: examplePrimaryAction,
    secondaryAction: null,
    suggestedDurationMin: shouldUseGapExample
      ? gapCandidate?.durationMin || null
      : context.isToday
        ? 25
        : null,
    confidence: 0.88,
    urgency: "medium",
    uiTone: "steady",
    toolIntent: shouldUseGapExample
      ? "suggest_reschedule_option"
      : context.isToday
        ? "suggest_start_occurrence"
        : "suggest_reschedule_option",
    rewardSuggestion: {
      kind: "none",
      label: null,
    },
  };

  return [
    "You are the execution coach for Discip-Yourself.",
    "Return one short actionable recommendation for what the user should do now.",
    "No chat. No markdown. No prose outside JSON.",
    "Never invent actions or occurrences that are not in the context.",
    "Return all keys exactly once.",
    "Use null for nullable fields instead of omitting them.",
    "Use resume_session only when activeSessionForActiveDate is present.",
    "Use open_pilotage only for a deterministic schedule warning, a required replanification, or when gapSummary.hasGapToday is true.",
    "Use start_occurrence only when isToday is true and primaryAction.dateKey equals activeDate.",
    "If isToday is false, prefer open_pilotage instead of start_occurrence.",
    "Use only start_occurrence, resume_session, open_library, or open_pilotage as primaryAction.intent for now recommendations.",
    "Do not use open_today as primaryAction.intent.",
    "When using start_occurrence, headline and reason must mention the exact action title from focusOccurrenceSummary.title.",
    "When using start_occurrence, reason must mention why this action is the best now using focusSelectionReason, start time, or current executability.",
    "When using open_pilotage for replanification, headline or reason must mention the exact action title and its planned date/time from focusOccurrenceSummary.",
    "When gapSummary.hasGapToday is true, use open_pilotage with toolIntent suggest_reschedule_option and recommend planning one existing action from gapSummary.candidateActionSummaries.",
    "When gapSummary.selectionScope is active_category, choose an action from the active category first if one exists.",
    "When gapSummary.selectionScope is cross_category_fallback, clearly say that nothing credible is available in the active category today before proposing the fallback action.",
    "When gapSummary.hasGapToday is true, mention the exact action title, say it is not yet planned today, and include a simple duration if available.",
    "Never invent a new task, an abstract task, or an action title that is not in gapSummary or focusOccurrenceSummary.",
    "Never mention the AI, the system, or internal diagnostics.",
    "When using resume_session, mention that a session for today is already open and name the related action if activeSessionSummary.title is available.",
    "Avoid generic advice like 'avance maintenant' without naming the action or the deterministic reason.",
    "Allowed urgency values: low, medium, high.",
    "Allowed uiTone values: steady, direct, reset.",
    "Allowed toolIntent values: suggest_start_occurrence, suggest_resume_session, suggest_recovery_action, suggest_reschedule_option, suggest_open_library.",
    "Allowed rewardSuggestion.kind values: none, micro_action, coins_preview, light_reset.",
    "Max lengths: headline <= 72 chars, reason <= 160 chars, action labels <= 32 chars.",
    "Prefer resume_session, then start_occurrence, then open_pilotage for deterministic warning or gap-fill, then open_library.",
    `Valid JSON example: ${JSON.stringify(validExample)}`,
    `Context: ${JSON.stringify({
      kind: "now",
      activeDate: context.activeDate,
      isToday: context.isToday,
      activeCategory: context.category
        ? {
            id: context.category.id || null,
            name: context.category.name || null,
          }
        : null,
      activeSessionSummary: context.activeSessionSummary || null,
      openSessionOutsideActiveDate: context.openSessionOutsideActiveDate
        ? {
            id: context.openSessionOutsideActiveDate.id || null,
            dateKey: context.openSessionOutsideActiveDate.dateKey || null,
          }
        : null,
      futureSessionsCount: Array.isArray(context.futureSessions) ? context.futureSessions.length : 0,
      focusOccurrenceSummary: context.focusOccurrenceSummary || null,
      alternativeOccurrenceSummaries: Array.isArray(context.alternativeOccurrenceSummaries)
        ? context.alternativeOccurrenceSummaries
        : [],
      focusSelectionReason: context.focusSelectionReason || null,
      dayLoadSummary: context.dayLoadSummary || null,
      scheduleSignalSummary: context.scheduleSignalSummary || null,
      gapSummary: context.gapSummary || null,
      doneToday: context.doneToday,
      missedToday: context.missedToday,
      remainingToday: context.remainingToday,
      categoryStatus: context.categoryStatus,
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

function buildRecoveryPrompt(context) {
  return [
    "You are the recovery coach for Discip-Yourself.",
    "Return one short recovery action only.",
    "No chat. No markdown. No prose outside JSON.",
    "Never invent actions or occurrences that are not in the context.",
    "Prefer resume_session, then the smallest remaining action, then open_library.",
    `Context: ${JSON.stringify({
      kind: "recovery",
      selectedDateKey: context.selectedDateKey,
      activeCategoryId: context.activeCategoryId,
      activeSession: context.activeSession,
      dayOccurrences: context.dayOccurrences,
      missedToday: context.missedToday,
      doneToday: context.doneToday,
      plannedToday: context.plannedToday,
      remainingToday: context.remainingToday,
      discipline7d: context.discipline7d?.discipline,
      discipline14d: context.discipline14d?.discipline,
      categoryStatus: context.categoryStatus,
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

function buildChatPrompt(context) {
  const gapCandidate = Array.isArray(context.gapSummary?.candidateActionSummaries)
    ? context.gapSummary.candidateActionSummaries[0] || null
    : null;
  const validExample = {
    kind: "chat",
    headline: gapCandidate ? `Ajoute ${gapCandidate.title}` : "Clarifie le prochain bloc",
    reason: gapCandidate
      ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. Programme-la en bloc court.`
      : "Choisis l'action la plus exécutable maintenant et garde la réponse très courte.",
    primaryAction: gapCandidate
      ? {
          label: "Planifier aujourd’hui",
          intent: "open_pilotage",
          categoryId: "cat-1",
          actionId: gapCandidate.actionId || "goal-1",
          occurrenceId: null,
          dateKey: context.activeDate,
        }
      : {
          label: "Voir aujourd’hui",
          intent: "open_today",
          categoryId: "cat-1",
          actionId: null,
          occurrenceId: null,
          dateKey: context.activeDate,
    },
    secondaryAction: null,
    suggestedDurationMin: gapCandidate?.durationMin || 10,
    draftChanges: gapCandidate?.actionId
      ? [
          {
            type: "schedule_action",
            title: null,
            categoryId: context.activeCategoryId || "cat-1",
            actionId: gapCandidate.actionId || "goal-1",
            occurrenceId: null,
            repeat: "none",
            daysOfWeek: [],
            startTime: null,
            durationMin: gapCandidate?.durationMin || 20,
            dateKey: context.activeDate,
          },
        ]
      : [],
  };

  return [
    "You are the structured coach chat for Discip-Yourself.",
    "Answer the user's latest message with one very short action-oriented recommendation.",
    "No markdown. No prose outside JSON.",
    "Never invent actions or occurrences that are not in the context.",
    "Use only start_occurrence, resume_session, open_library, open_pilotage, or open_today intents.",
    "You may include draftChanges only when the user explicitly asks to create, update, schedule, reschedule, or archive something in the app.",
    "draftChanges are proposals only. They are never applied automatically.",
    "When draftChanges is not needed, return an empty array.",
    "Never invent actionId or occurrenceId values. Only use ids present in the context.",
    "For create_action, choose a categoryId from availableCategories or use the active category when present.",
    "For update_action, schedule_action, or archive_action, use one actionId from actionSummaries.",
    "For reschedule_occurrence, use one occurrenceId from focusOccurrenceSummary or alternativeOccurrenceSummaries.",
    "Prefer resume_session when a session is already open today.",
    "Prefer start_occurrence when a credible occurrence can start now.",
    "Use open_pilotage when the best next step is to plan or replan.",
    "Keep headline <= 72 chars and reason <= 160 chars.",
    "Keep draft change titles <= 96 chars.",
    "Use null instead of omitting nullable fields.",
    `Valid JSON example: ${JSON.stringify(validExample)}`,
    `Context: ${JSON.stringify({
      kind: "chat",
      activeDate: context.activeDate,
      isToday: context.isToday,
      activeCategory: context.category
        ? {
            id: context.category.id || null,
            name: context.category.name || null,
          }
        : null,
      userAiProfile: context.userAiProfile
        ? {
            goals: context.userAiProfile.goals || [],
            time_budget_daily_min: context.userAiProfile.time_budget_daily_min || null,
            intensity_preference: context.userAiProfile.adaptation?.implicit_intensity || context.userAiProfile.intensity_preference || null,
            preferred_time_blocks: context.userAiProfile.preferred_time_blocks || [],
            structure_preference: context.userAiProfile.structure_preference || null,
            suggestion_stability: context.userAiProfile.adaptation?.suggestion_stability || null,
          }
        : null,
      focusOccurrenceSummary: context.focusOccurrenceSummary || null,
      activeSessionSummary: context.activeSessionSummary || null,
      alternativeOccurrenceSummaries: Array.isArray(context.alternativeOccurrenceSummaries)
        ? context.alternativeOccurrenceSummaries
        : [],
      availableCategories: Array.isArray(context.availableCategories) ? context.availableCategories : [],
      actionSummaries: Array.isArray(context.actionSummaries) ? context.actionSummaries : [],
      gapSummary: context.gapSummary || null,
      dayLoadSummary: context.dayLoadSummary || null,
      planningSummary: context.planningSummary || null,
      pilotageSummary: context.pilotageSummary || null,
      focusSelectionReason: context.focusSelectionReason || null,
      recentMessages: Array.isArray(context.recentMessages) ? context.recentMessages : [],
      latestUserMessage: context.message || "",
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

function resolvePrompt(kind, context) {
  if (kind === "recovery") return buildRecoveryPrompt(context);
  if (kind === "chat") return buildChatPrompt(context);
  return buildNowPrompt(context);
}

function resolveSchema(kind) {
  return kind === "chat" ? coachChatPayloadSchema : coachPayloadSchema;
}

function resolveSchemaName(kind) {
  return kind === "chat" ? "coach_chat_payload" : "coach_payload";
}

function normalizePayloadCandidateForKind(kind, candidate) {
  return kind === "chat" ? normalizeChatPayloadCandidate(candidate) : normalizeCoachPayloadCandidate(candidate);
}

export async function runOpenAiCoach({ app, kind, context }) {
  if (!app.openai || !app.config?.OPENAI_API_KEY) return null;
  const prompt = resolvePrompt(kind, context);
  const responseSchema = resolveSchema(kind);
  const completion = await app.openai.chat.completions.parse({
    model: app.config.OPENAI_MODEL,
    temperature: 0.2,
    response_format: zodResponseFormat(responseSchema, resolveSchemaName(kind)),
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });
  const message = completion.choices?.[0]?.message || null;
  if (!message) {
    throw new OpenAiModelOutputError(MODEL_OUTPUT_ISSUE_CODE.EMPTY_MESSAGE);
  }
  if (message.refusal) {
    throw new OpenAiModelOutputError(MODEL_OUTPUT_ISSUE_CODE.MODEL_REFUSAL);
  }

  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw new OpenAiModelOutputError(MODEL_OUTPUT_ISSUE_CODE.MISSING_PARSED_PAYLOAD);
  }

  const normalizedCandidate = normalizePayloadCandidateForKind(kind, candidate);
  try {
    return responseSchema.parse(normalizedCandidate);
  } catch (error) {
    throw new OpenAiModelOutputError(classifyCoachPayloadIssue(error), { cause: error });
  }
}
