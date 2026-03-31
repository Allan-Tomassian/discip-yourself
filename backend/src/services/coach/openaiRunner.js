import { zodResponseFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import {
  coachChatCardPayloadSchema,
  coachConversationPayloadSchema,
  coachPayloadSchema,
} from "../../schemas/coach.js";
import {
  COACH_CHAT_MODES,
  isConversationCoachMode,
  LOCAL_ANALYSIS_SURFACES,
  LOCAL_ANALYSIS_SURFACE_POLICY,
} from "../../../../src/domain/aiPolicy.js";

const DEFAULT_OUTPUT_LOCALE = "fr-FR";
const TEXT_LIMITS = Object.freeze({
  headline: 72,
  reason: 160,
  message: 1200,
  actionLabel: 32,
  draftTitle: 96,
  question: 160,
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

  return normalized;
}

function normalizeConversationPayloadCandidate(candidate) {
  if (!isPlainObject(candidate)) return candidate;
  const normalized = { ...candidate };
  normalized.message = truncateText(normalized.message, TEXT_LIMITS.message);

  if (!("primaryAction" in normalized) || normalized.primaryAction === undefined) {
    normalized.primaryAction = null;
  } else if (normalized.primaryAction !== null) {
    normalized.primaryAction = normalizeActionCandidate(normalized.primaryAction);
  }

  if (!("secondaryAction" in normalized) || normalized.secondaryAction === undefined) {
    normalized.secondaryAction = null;
  } else if (normalized.secondaryAction !== null) {
    normalized.secondaryAction = normalizeActionCandidate(normalized.secondaryAction);
  }

  if (!("proposal" in normalized) || !isPlainObject(normalized.proposal)) {
    normalized.proposal = null;
  } else {
    const proposal = { ...normalized.proposal };
    if (!Array.isArray(proposal.actionDrafts)) proposal.actionDrafts = [];
    proposal.actionDrafts = proposal.actionDrafts
      .filter(isPlainObject)
      .map((draft) => ({
        ...draft,
        title: truncateText(draft.title, TEXT_LIMITS.draftTitle),
        categoryId: draft.categoryId ?? null,
        outcomeId: draft.outcomeId ?? null,
        priority: draft.priority ?? null,
        repeat: draft.repeat ?? null,
        oneOffDate: draft.oneOffDate ?? null,
        daysOfWeek: Array.isArray(draft.daysOfWeek)
          ? draft.daysOfWeek
              .map((day) => Number(day))
              .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
              .slice(0, 7)
          : [],
        timeMode: draft.timeMode ?? null,
        startTime: draft.startTime ?? null,
        durationMinutes: Number.isInteger(draft.durationMinutes) ? draft.durationMinutes : null,
        notes: draft.notes == null ? null : truncateText(draft.notes, 280),
      }))
      .slice(0, 6);
    proposal.categoryDraft = isPlainObject(proposal.categoryDraft)
      ? {
          mode: proposal.categoryDraft.mode || "unresolved",
          id: proposal.categoryDraft.id ?? null,
          label: proposal.categoryDraft.label == null ? null : truncateText(proposal.categoryDraft.label, TEXT_LIMITS.draftTitle),
        }
      : null;
    proposal.outcomeDraft = isPlainObject(proposal.outcomeDraft)
      ? {
          ...proposal.outcomeDraft,
          title: truncateText(proposal.outcomeDraft.title, TEXT_LIMITS.draftTitle),
          categoryId: proposal.outcomeDraft.categoryId ?? null,
          priority: proposal.outcomeDraft.priority ?? null,
          startDate: proposal.outcomeDraft.startDate ?? null,
          deadline: proposal.outcomeDraft.deadline ?? null,
          measureType: proposal.outcomeDraft.measureType ?? null,
          targetValue: Number.isFinite(proposal.outcomeDraft.targetValue) ? proposal.outcomeDraft.targetValue : null,
          notes: proposal.outcomeDraft.notes == null ? null : truncateText(proposal.outcomeDraft.notes, 280),
        }
      : null;
    proposal.unresolvedQuestions = Array.isArray(proposal.unresolvedQuestions)
      ? proposal.unresolvedQuestions
          .filter((entry) => typeof entry === "string")
          .map((entry) => truncateText(entry, TEXT_LIMITS.question))
          .slice(0, 4)
      : [];
    proposal.requiresValidation = true;
    normalized.proposal = proposal;
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
    "Always write recommendations with an explicit action verb and a concrete object.",
    "When relevant, mention a short duration or a time anchor.",
    "If the user asks to understand a recommendation or how to use the app, explain it briefly and end with one concrete next step.",
    "Avoid vague formulations such as improve health, progress in finance, or be more regular.",
    `All user-visible strings must be written in French (${locale}).`,
    "This includes headline, reason, primaryAction.label, secondaryAction.label, and rewardSuggestion.label.",
  ].join(" ");
}

function buildNowPrompt(context) {
  const focusTitle = context.focusOccurrenceSummary?.title || "Action";
  const gapCandidate = Array.isArray(context.gapSummary?.candidateActionSummaries)
    ? context.gapSummary.candidateActionSummaries[0] || null
    : null;
  const shouldUseStructureExample = Boolean(
    context.gapSummary?.hasGapToday && context.gapSummary?.selectionScope === "structure_missing"
  );
  const shouldUseGapExample = Boolean(context.gapSummary?.hasGapToday && gapCandidate && !shouldUseStructureExample);
  const examplePrimaryAction = shouldUseStructureExample
    ? {
        label: "Structurer",
        intent: "open_pilotage",
        categoryId: "cat-1",
        actionId: null,
        occurrenceId: null,
        dateKey: context.activeDate,
      }
    : shouldUseGapExample
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
    headline: shouldUseStructureExample
      ? "Structure la categorie active"
      : shouldUseGapExample
      ? `Planifie ${gapCandidate?.title || "une action"}`
      : context.isToday
        ? `Lance ${focusTitle}`
        : `Replanifie ${focusTitle}`,
    reason: shouldUseStructureExample
      ? "Clarifie l'objectif de la categorie active ou cree une premiere action exploitable."
      : shouldUseGapExample
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
    toolIntent: shouldUseStructureExample || shouldUseGapExample
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
    "The active category governs any today_recommendation.",
    "When categoryCoherence.selectionScope is cross_category, you may recommend only the proven cross-category action and you must explicitly say it contributes to categoryCoherence.contributionTargetLabel.",
    "When categoryCoherence.selectionScope is structure_missing, do not invent an action and tell the user to clarify the goal or create a first action in the active category.",
    "When gapSummary.selectionScope is cross_category, clearly say that nothing credible is available in the active category today before proposing the fallback action.",
    "When gapSummary.hasGapToday is true, mention the exact action title, say it is not yet planned today, and include a simple duration if available.",
    "Never invent a new task, an abstract task, or an action title that is not in gapSummary or focusOccurrenceSummary.",
    "When activeCategoryProfileSummary.hasProfile is true, use it to make the recommendation more specific.",
    "When activeCategoryProfileSummary.mainGoal or currentPriority is present, explicitly connect the recommendation to it.",
    "If activeCategoryProfileSummary.subject is present, you may use it as context, but keep the wording concrete and short.",
    "Never infer any sensitive fact that is not explicitly present in activeCategoryProfileSummary or the provided app data.",
    "Never mention the AI, the system, or internal diagnostics.",
    "When using resume_session, mention that a session for today is already open and name the related action if activeSessionSummary.title is available.",
    "Avoid generic advice like 'avance maintenant' without naming the action or the deterministic reason.",
    "Use concrete French wording like 'Planifie 20 min de marche aujourd’hui' instead of abstract wording.",
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
      activeCategoryLabel: context.category?.name || null,
      activeCategoryProfileSummary: context.activeCategoryProfileSummary || null,
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
      categoryCoherence: context.categoryCoherence || null,
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

function buildChatCardPrompt(context) {
  const analysisSurface =
    context.analysisSurface === LOCAL_ANALYSIS_SURFACES.PLANNING ||
    context.analysisSurface === LOCAL_ANALYSIS_SURFACES.PILOTAGE
      ? context.analysisSurface
      : LOCAL_ANALYSIS_SURFACES.GENERIC;
  const analysisPolicy =
    LOCAL_ANALYSIS_SURFACE_POLICY[analysisSurface] || LOCAL_ANALYSIS_SURFACE_POLICY[LOCAL_ANALYSIS_SURFACES.GENERIC];
  const allowedIntents = Array.isArray(analysisPolicy.allowedIntents)
    ? analysisPolicy.allowedIntents
    : ["open_today", "open_library", "open_pilotage"];
  const gapCandidate = Array.isArray(context.gapSummary?.candidateActionSummaries)
    ? context.gapSummary.candidateActionSummaries[0] || null
    : null;
  const shouldUseStructureExample = Boolean(
    context.gapSummary?.hasGapToday && context.gapSummary?.selectionScope === "structure_missing"
  );
  const validExample = {
      kind: "chat",
      headline: shouldUseStructureExample
        ? "Structure la categorie active"
        : gapCandidate
        ? `Ajoute ${gapCandidate.title}`
        : "Clarifie le prochain bloc",
    reason: shouldUseStructureExample
      ? "Clarifie l'objectif de la categorie active ou cree une premiere action exploitable."
      : gapCandidate
      ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. Programme-la en bloc court.`
      : "Choisis l'action la plus exécutable maintenant et garde la réponse très courte.",
    primaryAction: shouldUseStructureExample
      ? {
          label: "Structurer",
          intent: "open_pilotage",
          categoryId: "cat-1",
          actionId: null,
          occurrenceId: null,
          dateKey: context.activeDate,
        }
      : gapCandidate
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
    suggestedDurationMin: shouldUseStructureExample ? null : gapCandidate?.durationMin || 10,
  };

  return [
    `You are the local analysis layer for Discip-Yourself on ${analysisSurface}.`,
    "Answer the user's latest message with one very short contextual recommendation.",
    "No markdown. No prose outside JSON.",
    "Never invent actions or occurrences that are not in the context.",
    "This layer is secondary to the Coach and must stay local, concise, and non-conversational.",
    `Surface focus: ${analysisPolicy.focus || "lecture contextuelle"}.`,
    "You may answer with a concise explanation of what the local situation suggests, but still finish with one concrete next step.",
    `Use only ${allowedIntents.join(", ")} intents.`,
    "Never create or modify data.",
    "Never return draft changes, proposals, or mutation instructions.",
    "Never invent actionId or occurrenceId values. Only use ids present in the context.",
    analysisSurface === LOCAL_ANALYSIS_SURFACES.GENERIC
      ? "Prefer resume_session when a session is already open today."
      : "Prefer open_pilotage or open_today over execution shortcuts.",
    analysisSurface === LOCAL_ANALYSIS_SURFACES.GENERIC
      ? "Prefer start_occurrence when a credible occurrence can start now."
      : "Do not behave like the Coach and do not start a workflow on behalf of the user.",
    "Use open_pilotage when the best next step is to plan or replan.",
    "The active category governs the recommendation.",
    "When categoryCoherence.selectionScope is cross_category, recommend only the proven cross-category action and explicitly name the contribution to categoryCoherence.contributionTargetLabel.",
    "When categoryCoherence.selectionScope is structure_missing, do not invent an action and tell the user to clarify the goal or create a first action in the active category.",
    "When activeCategoryProfileSummary.hasProfile is true, use it to avoid generic advice and connect the answer to subject, mainGoal, or currentPriority when relevant.",
    "If relatedCategoryProfileSummaries is not empty, use them only when the user is asking globally or when the recommendation is explicitly cross-category.",
    "Never infer any sensitive fact that is not explicitly present in activeCategoryProfileSummary, relatedCategoryProfileSummaries, or the provided app data.",
    "Use a concrete action verb plus object in headline and reason.",
    "When possible, mention a short duration or timing anchor.",
    "Avoid vague formulations such as améliorer, progresser, optimiser, or être plus régulier without naming the action.",
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
      activeCategoryLabel: context.activeCategoryLabel || context.category?.name || null,
      activeCategoryProfileSummary: context.activeCategoryProfileSummary || null,
      relatedCategoryProfileSummaries: Array.isArray(context.relatedCategoryProfileSummaries)
        ? context.relatedCategoryProfileSummaries
        : [],
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
      categoryCoherence: context.categoryCoherence || null,
      categorySnapshot: context.categorySnapshot || null,
      gapSummary: context.gapSummary || null,
      dayLoadSummary: context.dayLoadSummary || null,
      planningSummary: context.planningSummary || null,
      pilotageSummary: context.pilotageSummary || null,
      analysisSurface,
      focusSelectionReason: context.focusSelectionReason || null,
      recentMessages: Array.isArray(context.recentMessages) ? context.recentMessages : [],
      latestUserMessage: context.message || "",
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

function buildFreeConversationPrompt(context) {
  const validExample = {
    kind: "conversation",
    mode: "free",
    message:
      "Tu peux repartir avec une version plus légère: choisis un seul bloc utile aujourd’hui, puis laisse le reste en attente.",
    primaryAction: {
      label: "Voir Today",
      intent: "open_today",
      categoryId: context.activeCategoryId || "cat-1",
      actionId: null,
      occurrenceId: null,
      dateKey: context.activeDate,
    },
    secondaryAction: null,
    proposal: null,
  };

  return [
    "You are the conversational Coach for Discip-Yourself.",
    "The user is talking freely and may not want to create anything yet.",
    "Reply like a real product coach, not like a generic chatbot and not like a form.",
    "Answer in natural French, short and calm, with one concrete next step when useful.",
    "Do not force creation, planning, or a CTA when the user only wants to reflect.",
    "You may suggest activating plan mode only when the user is clearly trying to structure something in the app.",
    "If the topic is outside the product scope or too sensitive, answer prudently and redirect to support or a more appropriate external help path.",
    "Use primaryAction only when a product CTA is clearly useful. Otherwise return null.",
    "Allowed product intents are open_today, open_library, open_pilotage, and open_support.",
    "Never create or modify data. Never return a proposal in free mode.",
    "No markdown. No prose outside JSON.",
    `Valid JSON example: ${JSON.stringify(validExample)}`,
    `Context: ${JSON.stringify({
      kind: "conversation",
      mode: "free",
      activeDate: context.activeDate,
      activeCategory: context.category
        ? {
            id: context.category.id || null,
            name: context.category.name || null,
          }
        : null,
      activeCategoryProfileSummary: context.activeCategoryProfileSummary || null,
      relatedCategoryProfileSummaries: Array.isArray(context.relatedCategoryProfileSummaries)
        ? context.relatedCategoryProfileSummaries
        : [],
      userAiProfile: context.userAiProfile
        ? {
            goals: context.userAiProfile.goals || [],
            time_budget_daily_min: context.userAiProfile.time_budget_daily_min || null,
            intensity_preference:
              context.userAiProfile.adaptation?.implicit_intensity || context.userAiProfile.intensity_preference || null,
            preferred_time_blocks: context.userAiProfile.preferred_time_blocks || [],
            structure_preference: context.userAiProfile.structure_preference || null,
          }
        : null,
      recentMessages: Array.isArray(context.recentMessages) ? context.recentMessages : [],
      latestUserMessage: context.message || "",
      planningSummary: context.planningSummary || null,
      pilotageSummary: context.pilotageSummary || null,
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

function buildPlanConversationPrompt(context) {
  const categoryId = context.activeCategoryId || "cat-1";
  const validExample = {
    kind: "conversation",
    mode: "plan",
    message:
      "Je te propose une structure simple: un objectif clair, puis une première action crédible cette semaine.",
    primaryAction: null,
    secondaryAction: null,
    proposal: {
      kind: "guided",
      categoryDraft: {
        mode: categoryId ? "existing" : "unresolved",
        id: categoryId,
        label: context.activeCategoryLabel || "Catégorie active",
      },
      outcomeDraft: {
        title: "Retrouver un rythme de travail stable",
        categoryId,
        priority: "prioritaire",
        startDate: context.activeDate,
        deadline: null,
        measureType: null,
        targetValue: null,
        notes: null,
      },
      actionDrafts: [
        {
          title: "Bloquer 25 min de deep work",
          categoryId,
          outcomeId: null,
          priority: "prioritaire",
          repeat: "weekly",
          oneOffDate: null,
          daysOfWeek: [1, 3, 5],
          timeMode: "FIXED",
          startTime: "09:00",
          durationMinutes: 25,
          notes: null,
        },
      ],
      unresolvedQuestions: [],
      requiresValidation: true,
    },
  };

  return [
    "You are the plan mode Coach for Discip-Yourself.",
    "The user explicitly wants to structure something that can become real objects in the app.",
    "Reply in natural French, but converge to an actionable proposal instead of staying in pure discussion.",
    "Return a proposal only for things that fit the app: category, objective, actions, rhythm, next step.",
    "Do not create or modify data. Proposal only. The user will validate explicitly later.",
    "When something important is missing, keep the proposal conservative and list the missing point in unresolvedQuestions.",
    "Use one category. Prefer the active category when it fits. If it does not fit and you are unsure, mark categoryDraft as unresolved.",
    "Keep the proposal simple. One objective and one to three actions is enough.",
    "Use kind=action for one standalone action, kind=outcome for one standalone objective, kind=guided when there is one objective plus at least one action.",
    "No markdown. No prose outside JSON.",
    `Valid JSON example: ${JSON.stringify(validExample)}`,
    `Context: ${JSON.stringify({
      kind: "conversation",
      mode: "plan",
      activeDate: context.activeDate,
      activeCategory: context.category
        ? {
            id: context.category.id || null,
            name: context.category.name || null,
          }
        : null,
      availableCategories: Array.isArray(context.availableCategories) ? context.availableCategories : [],
      actionSummaries: Array.isArray(context.actionSummaries) ? context.actionSummaries : [],
      activeCategoryProfileSummary: context.activeCategoryProfileSummary || null,
      relatedCategoryProfileSummaries: Array.isArray(context.relatedCategoryProfileSummaries)
        ? context.relatedCategoryProfileSummaries
        : [],
      userAiProfile: context.userAiProfile
        ? {
            goals: context.userAiProfile.goals || [],
            time_budget_daily_min: context.userAiProfile.time_budget_daily_min || null,
            intensity_preference:
              context.userAiProfile.adaptation?.implicit_intensity || context.userAiProfile.intensity_preference || null,
            preferred_time_blocks: context.userAiProfile.preferred_time_blocks || [],
            structure_preference: context.userAiProfile.structure_preference || null,
          }
        : null,
      recentMessages: Array.isArray(context.recentMessages) ? context.recentMessages : [],
      latestUserMessage: context.message || "",
      planningSummary: context.planningSummary || null,
      pilotageSummary: context.pilotageSummary || null,
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

function resolvePrompt(kind, context) {
  if (kind === "recovery") return buildRecoveryPrompt(context);
  if (kind === "chat") {
    if (context.chatMode === COACH_CHAT_MODES.FREE) return buildFreeConversationPrompt(context);
    if (context.chatMode === COACH_CHAT_MODES.PLAN) return buildPlanConversationPrompt(context);
    return buildChatCardPrompt(context);
  }
  return buildNowPrompt(context);
}

function resolveSchema(kind, context) {
  if (kind !== "chat") return coachPayloadSchema;
  if (isConversationCoachMode(context.chatMode)) {
    return coachConversationPayloadSchema;
  }
  return coachChatCardPayloadSchema;
}

function resolveSchemaName(kind, context) {
  if (kind !== "chat") return "coach_payload";
  if (context.chatMode === COACH_CHAT_MODES.FREE) return "coach_conversation_free_payload";
  if (context.chatMode === COACH_CHAT_MODES.PLAN) return "coach_conversation_plan_payload";
  return "coach_local_analysis_payload";
}

function normalizePayloadCandidateForKind(kind, context, candidate) {
  if (kind !== "chat") return normalizeCoachPayloadCandidate(candidate);
  if (isConversationCoachMode(context.chatMode)) {
    return normalizeConversationPayloadCandidate(candidate);
  }
  return normalizeChatPayloadCandidate(candidate);
}

export async function runOpenAiCoach({ app, kind, context }) {
  if (!app.openai || !app.config?.OPENAI_API_KEY) return null;
  const prompt = resolvePrompt(kind, context);
  const responseSchema = resolveSchema(kind, context);
  const completion = await app.openai.chat.completions.parse({
    model: app.config.OPENAI_MODEL,
    temperature: 0.2,
    response_format: zodResponseFormat(responseSchema, resolveSchemaName(kind, context)),
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

  const normalizedCandidate = normalizePayloadCandidateForKind(kind, context, candidate);
  try {
    return responseSchema.parse(normalizedCandidate);
  } catch (error) {
    throw new OpenAiModelOutputError(classifyCoachPayloadIssue(error), { cause: error });
  }
}
