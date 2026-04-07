import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { requestAiCoachChat } from "../../infra/aiCoachChatClient";
import { deriveAiUnavailableMessage } from "../../infra/aiTransportDiagnostics";
import { applySessionRuntimeTransition, resolveRuntimeSessionGate } from "../../logic/sessionRuntime";
import { COACH_SCREEN_COPY } from "../../ui/labels";
import { commitPreparedCreatePlan, prepareCreateCommit } from "../create-item/createItemCommit";
import { getManualAiLoadingStages } from "../manualAi/loadingStages";
import { getCoachContextSnapshot } from "./coachContextAdapter";
import {
  deriveCoachMessageEntries,
  findCoachOccurrence,
} from "./coachConversationModel";
import {
  appendCoachConversationMessages,
  buildAssistantTranscriptText,
  buildCoachConversationMessage,
  buildRecentMessagesFromConversation,
  createCoachConversation,
  ensureCoachConversationsState,
  getCoachConversationById,
  getLatestCoachConversation,
  removeCoachConversation,
  updateCoachConversationMessage,
  updateCoachConversationMode,
  updateCoachConversationUseCase,
  upsertCoachConversation,
} from "./coachStorage";

const COACH_QUICK_PROMPTS = [
  "Aide-moi à clarifier ma journée",
  "Je bloque sur ma discipline",
  "Aide-moi à arbitrer mes priorités",
  "Construis mon plan de vie",
  "Analyse mes statistiques",
];

const COACH_PLAN_PROMPTS = [
  "Construis mon plan de vie",
  "Structure mon travail",
  "Ajoute une routine santé",
  "Organise mon alimentation",
  "Clarifie ma vie personnelle",
];

function normalizeCoachUseCase(value, fallback = "general") {
  if (value === "life_plan") return "life_plan";
  if (value === "stats_review") return "stats_review";
  return fallback === "life_plan" || fallback === "stats_review" ? fallback : "general";
}

function deriveCoachUseCase(message, currentUseCase = "general", currentMode = "free") {
  const normalizedMessage = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    normalizedMessage.includes("plan de vie") ||
    normalizedMessage.includes("routine") ||
    normalizedMessage.includes("alimentation") ||
    normalizedMessage.includes("sante") ||
    normalizedMessage.includes("sport") ||
    normalizedMessage.includes("travail") ||
    normalizedMessage.includes("vie personnelle")
  ) {
    return "life_plan";
  }
  if (
    normalizedMessage.includes("stat") ||
    normalizedMessage.includes("analyse") ||
    normalizedMessage.includes("tendance") ||
    normalizedMessage.includes("completion") ||
    normalizedMessage.includes("momentum")
  ) {
    return "stats_review";
  }
  if (currentMode === "plan" && currentUseCase === "general") return "life_plan";
  return normalizeCoachUseCase(currentUseCase, "general");
}

function deriveCoachErrorMessage(result) {
  return deriveAiUnavailableMessage(result, {
    disabled: "Coach indisponible sur cet appareil.",
    unauthorized: "Connecte-toi pour utiliser le coach.",
    rateLimited: "Coach indisponible pour le moment.",
    offline: "Coach indisponible hors ligne.",
    corsPrivateOrigin: "Coach indisponible sur cette origine de test.",
    networkUnknown: "Coach indisponible pour le moment.",
    fallback: "Coach indisponible.",
  });
}

export function normalizeCoachRequestedMode(value) {
  return value === "plan" ? "plan" : "free";
}

export function toggleCoachPlanMode(currentMode) {
  return normalizeCoachRequestedMode(currentMode) === "plan" ? "free" : "plan";
}

export function buildCoachRequestedModeIntentKey({
  openCycle = 0,
  requestedConversationId = null,
  requestedMode = "free",
} = {}) {
  const safeCycle = Number.isInteger(openCycle) && openCycle > 0 ? openCycle : 0;
  if (!safeCycle) return "";
  return `${safeCycle}:${requestedConversationId || ""}:${normalizeCoachRequestedMode(requestedMode)}`;
}

export function shouldApplyCoachRequestedMode({
  open = false,
  openCycle = 0,
  requestedConversationId = null,
  currentConversationId = null,
  requestedMode = "free",
  lastAppliedIntentKey = "",
} = {}) {
  const normalizedMode = normalizeCoachRequestedMode(requestedMode);
  if (!open) {
    return { shouldApply: false, intentKey: "", normalizedMode };
  }
  const intentKey = buildCoachRequestedModeIntentKey({
    openCycle,
    requestedConversationId,
    requestedMode: normalizedMode,
  });
  if (!intentKey) {
    return { shouldApply: false, intentKey, normalizedMode };
  }
  if (requestedConversationId && currentConversationId !== requestedConversationId) {
    return { shouldApply: false, intentKey, normalizedMode };
  }
  if (intentKey === lastAppliedIntentKey) {
    return { shouldApply: false, intentKey, normalizedMode };
  }
  return { shouldApply: true, intentKey, normalizedMode };
}

export function normalizeCoachRequestedPrefill(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCoachWorkIntentType(value) {
  if (value === "structuring") return "structuring";
  if (value === "quick_create") return "quick_create";
  if (value === "contextual") return "contextual";
  return null;
}

function buildCoachWorkIntentLabel(type) {
  if (type === "structuring") return COACH_SCREEN_COPY.structuringModeLabel;
  if (type === "quick_create") return COACH_SCREEN_COPY.quickCreateLabel;
  if (type === "contextual") return COACH_SCREEN_COPY.contextualIntentLabel;
  return "";
}

function buildCoachWorkIntent({
  type = null,
  label = "",
  prefill = "",
  preferredMode = "free",
  source = "",
  seededDraftPrefill = "",
  draftTouchedSinceSeed = false,
} = {}) {
  const normalizedType = normalizeCoachWorkIntentType(type);
  if (!normalizedType) return null;
  const normalizedPrefill = normalizeCoachRequestedPrefill(prefill);
  const normalizedSeed = normalizeCoachRequestedPrefill(seededDraftPrefill);
  return {
    type: normalizedType,
    label: normalizeCoachRequestedPrefill(label) || buildCoachWorkIntentLabel(normalizedType),
    prefill: normalizedPrefill,
    preferredMode: normalizeCoachRequestedMode(preferredMode),
    source: source === "requested_prefill" ? "requested_prefill" : "composer_menu",
    seededDraftPrefill: normalizedSeed || null,
    draftTouchedSinceSeed: Boolean(draftTouchedSinceSeed),
  };
}

export function buildStructuringIntentTransition({ draft = "" } = {}) {
  const normalizedDraft = normalizeCoachRequestedPrefill(draft);
  const fallbackPrefill = normalizeCoachRequestedPrefill(COACH_SCREEN_COPY.structuringPrefill);
  const shouldSeedDraft = !normalizedDraft;
  return {
    nextMode: "plan",
    nextDraft: shouldSeedDraft ? fallbackPrefill : normalizedDraft,
    shouldSeedDraft,
    intent: buildCoachWorkIntent({
      type: "structuring",
      prefill: fallbackPrefill,
      preferredMode: "plan",
      source: "composer_menu",
      seededDraftPrefill: shouldSeedDraft ? fallbackPrefill : "",
      draftTouchedSinceSeed: false,
    }),
  };
}

export function buildQuickCreateIntentTransition({ draft = "" } = {}) {
  const normalizedDraft = normalizeCoachRequestedPrefill(draft);
  const fallbackPrefill = normalizeCoachRequestedPrefill(COACH_SCREEN_COPY.quickCreatePrefill);
  const shouldSeedDraft = !normalizedDraft;
  return {
    nextMode: "plan",
    nextDraft: shouldSeedDraft ? fallbackPrefill : normalizedDraft,
    shouldSeedDraft,
    intent: buildCoachWorkIntent({
      type: "quick_create",
      prefill: fallbackPrefill,
      preferredMode: "plan",
      source: "composer_menu",
      seededDraftPrefill: shouldSeedDraft ? fallbackPrefill : "",
      draftTouchedSinceSeed: false,
    }),
  };
}

export function shouldClearDraftOnDismissWorkIntent({ activeWorkIntent = null, draft = "" } = {}) {
  const normalizedDraft = normalizeCoachRequestedPrefill(draft);
  return Boolean(
    activeWorkIntent?.seededDraftPrefill &&
      !activeWorkIntent?.draftTouchedSinceSeed &&
      normalizedDraft === activeWorkIntent.seededDraftPrefill
  );
}

export function buildDismissWorkIntentTransition({ activeWorkIntent = null, draft = "" } = {}) {
  const shouldClearDraft = shouldClearDraftOnDismissWorkIntent({ activeWorkIntent, draft });
  return {
    nextMode: "free",
    nextDraft: shouldClearDraft ? "" : normalizeCoachRequestedPrefill(draft),
    shouldClearDraft,
  };
}

export function buildCoachRequestedPrefillIntentKey({
  openCycle = 0,
  requestedConversationId = null,
  requestedPrefill = "",
} = {}) {
  const safeCycle = Number.isInteger(openCycle) && openCycle > 0 ? openCycle : 0;
  const normalizedPrefill = normalizeCoachRequestedPrefill(requestedPrefill);
  if (!safeCycle || !normalizedPrefill) return "";
  return `${safeCycle}:${requestedConversationId || ""}:${normalizedPrefill}`;
}

export function shouldApplyCoachRequestedPrefill({
  open = false,
  openCycle = 0,
  requestedConversationId = null,
  currentConversationId = null,
  requestedPrefill = "",
  draft = "",
  lastAppliedIntentKey = "",
} = {}) {
  const normalizedPrefill = normalizeCoachRequestedPrefill(requestedPrefill);
  if (!open || !normalizedPrefill || normalizeCoachRequestedPrefill(draft)) {
    return { shouldApply: false, intentKey: "", normalizedPrefill };
  }
  const intentKey = buildCoachRequestedPrefillIntentKey({
    openCycle,
    requestedConversationId,
    requestedPrefill: normalizedPrefill,
  });
  if (!intentKey) {
    return { shouldApply: false, intentKey, normalizedPrefill };
  }
  if (requestedConversationId && currentConversationId !== requestedConversationId) {
    return { shouldApply: false, intentKey, normalizedPrefill };
  }
  if (intentKey === lastAppliedIntentKey) {
    return { shouldApply: false, intentKey, normalizedPrefill };
  }
  return { shouldApply: true, intentKey, normalizedPrefill };
}

export function useCoachConversationController({
  open = false,
  data,
  setData,
  setTab,
  surfaceTab = "today",
  onRequestClose,
  requestedMode = "free",
  requestedConversationId = null,
  requestedPrefill = "",
  onOpenAssistantCreate,
  onOpenCreatedView,
  onOpenPaywall,
  canCreateAction = true,
  canCreateOutcome = true,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
}) {
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const safeData = data && typeof data === "object" ? data : {};
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationMode, setConversationMode] = useState(normalizeCoachRequestedMode(requestedMode));
  const [conversationUseCase, setConversationUseCase] = useState("general");
  const [loadingStageIndex, setLoadingStageIndex] = useState(-1);
  const [archivedConversation, setArchivedConversation] = useState(null);
  const [activeWorkIntent, setActiveWorkIntent] = useState(null);
  const archiveTimeoutRef = useRef(null);
  const lastAppliedRequestedModeIntentRef = useRef("");
  const lastAppliedRequestedPrefillIntentRef = useRef("");
  const wasOpenRef = useRef(Boolean(open));
  const [openCycle, setOpenCycle] = useState(() => (open ? 1 : 0));
  const loadingStages = useMemo(() => getManualAiLoadingStages("coach"), []);

  const contextSnapshot = useMemo(
    () => getCoachContextSnapshot({ data: safeData, surfaceTab }),
    [safeData, surfaceTab]
  );
  const conversations = useMemo(
    () => ensureCoachConversationsState(safeData?.coach_conversations_v1).conversations,
    [safeData?.coach_conversations_v1]
  );
  const latestConversation = conversations[0] || null;
  const [activeConversationId, setActiveConversationId] = useState(latestConversation?.id || "");
  useEffect(() => {
    if (!conversations.length) {
      if (activeConversationId) setActiveConversationId("");
      return;
    }
    if (activeConversationId && conversations.some((conversation) => conversation.id === activeConversationId)) {
      return;
    }
    setActiveConversationId(latestConversation?.id || "");
  }, [activeConversationId, conversations, latestConversation?.id]);
  const currentConversation = useMemo(
    () =>
      getCoachConversationById(safeData?.coach_conversations_v1, activeConversationId) ||
      latestConversation ||
      getLatestCoachConversation(safeData?.coach_conversations_v1),
    [activeConversationId, latestConversation, safeData?.coach_conversations_v1]
  );
  const messageEntries = useMemo(() => deriveCoachMessageEntries(currentConversation), [currentConversation]);
  const categoriesById = useMemo(
    () => new Map((Array.isArray(safeData.categories) ? safeData.categories : []).map((category) => [category?.id, category])),
    [safeData.categories]
  );

  useEffect(() => {
    const nextMode = currentConversation?.mode || normalizeCoachRequestedMode(requestedMode);
    setConversationMode(nextMode);
  }, [currentConversation?.id, currentConversation?.mode, requestedMode]);

  useEffect(() => {
    const nextUseCase = normalizeCoachUseCase(currentConversation?.useCase, "general");
    setConversationUseCase(nextUseCase);
  }, [currentConversation?.id, currentConversation?.useCase]);

  useEffect(() => {
    setActiveWorkIntent((current) => {
      if (!current?.seededDraftPrefill || current.draftTouchedSinceSeed) return current;
      return normalizeCoachRequestedPrefill(draft) === current.seededDraftPrefill
        ? current
        : {
            ...current,
            draftTouchedSinceSeed: true,
          };
    });
  }, [draft]);

  useEffect(() => {
    if (!requestedConversationId) return;
    if (!conversations.some((conversation) => conversation.id === requestedConversationId)) return;
    if (activeConversationId === requestedConversationId) return;
    setActiveConversationId(requestedConversationId);
  }, [activeConversationId, conversations, requestedConversationId]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setOpenCycle((current) => current + 1);
    }
    if (!open && wasOpenRef.current) {
      lastAppliedRequestedModeIntentRef.current = "";
      lastAppliedRequestedPrefillIntentRef.current = "";
    }
    wasOpenRef.current = Boolean(open);
  }, [open]);

  useEffect(() => {
    const modeSync = shouldApplyCoachRequestedMode({
      open,
      openCycle,
      requestedConversationId,
      currentConversationId: currentConversation?.id || null,
      requestedMode,
      lastAppliedIntentKey: lastAppliedRequestedModeIntentRef.current,
    });
    if (!modeSync.shouldApply) return;
    setConversationMode(modeSync.normalizedMode);
    if (!currentConversation?.id) return;
    lastAppliedRequestedModeIntentRef.current = modeSync.intentKey;
    if (typeof setData !== "function" || currentConversation.mode === modeSync.normalizedMode) return;
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      return {
        ...safePrevious,
        coach_conversations_v1: updateCoachConversationMode(safePrevious.coach_conversations_v1, {
          conversationId: currentConversation.id,
          mode: modeSync.normalizedMode,
        }),
      };
    });
  }, [currentConversation?.id, currentConversation?.mode, open, openCycle, requestedConversationId, requestedMode, setData]);

  useEffect(() => {
    const prefillSync = shouldApplyCoachRequestedPrefill({
      open,
      openCycle,
      requestedConversationId,
      currentConversationId: currentConversation?.id || null,
      requestedPrefill,
      draft,
      lastAppliedIntentKey: lastAppliedRequestedPrefillIntentRef.current,
    });
    if (!prefillSync.shouldApply) return;
    setDraft(prefillSync.normalizedPrefill);
    lastAppliedRequestedPrefillIntentRef.current = prefillSync.intentKey;
    setActiveWorkIntent(
      buildCoachWorkIntent({
        type: "contextual",
        prefill: prefillSync.normalizedPrefill,
        preferredMode: requestedMode,
        source: "requested_prefill",
        seededDraftPrefill: prefillSync.normalizedPrefill,
        draftTouchedSinceSeed: false,
      })
    );
  }, [currentConversation?.id, draft, open, openCycle, requestedConversationId, requestedMode, requestedPrefill]);

  useEffect(() => {
    if (!loading) {
      setLoadingStageIndex(-1);
      return undefined;
    }
    setLoadingStageIndex(0);
    if (loadingStages.length <= 1) return undefined;
    const intervalId = globalThis.setInterval(() => {
      setLoadingStageIndex((current) => {
        const safeCurrent = Number.isFinite(current) ? current : 0;
        if (safeCurrent >= loadingStages.length - 1) return safeCurrent;
        return safeCurrent + 1;
      });
    }, 1200);
    return () => globalThis.clearInterval(intervalId);
  }, [loading, loadingStages]);

  const loadingStageLabel =
    loading && loadingStages.length
      ? loadingStages[Math.max(0, Math.min(loadingStageIndex, loadingStages.length - 1))]
      : "";

  const handleConversationModeChange = useCallback(
    (nextMode) => {
      const normalizedMode = nextMode === "plan" ? "plan" : "free";
      setConversationMode(normalizedMode);
      if (!currentConversation?.id || typeof setData !== "function") return;
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        return {
          ...safePrevious,
          coach_conversations_v1: updateCoachConversationMode(safePrevious.coach_conversations_v1, {
            conversationId: currentConversation.id,
            mode: normalizedMode,
          }),
        };
      });
    },
    [currentConversation?.id, setData]
  );

  const startStructuringIntent = useCallback(() => {
    const transition = buildStructuringIntentTransition({ draft });
    handleConversationModeChange(transition.nextMode);
    if (transition.shouldSeedDraft) setDraft(transition.nextDraft);
    setActiveWorkIntent(transition.intent);
    setError("");
  }, [draft, handleConversationModeChange]);

  const startQuickCreateIntent = useCallback(() => {
    const transition = buildQuickCreateIntentTransition({ draft });
    handleConversationModeChange(transition.nextMode);
    if (transition.shouldSeedDraft) setDraft(transition.nextDraft);
    setActiveWorkIntent(transition.intent);
    setError("");
  }, [draft, handleConversationModeChange]);

  const dismissWorkIntent = useCallback(() => {
    const transition = buildDismissWorkIntentTransition({ activeWorkIntent, draft });
    handleConversationModeChange(transition.nextMode);
    if (transition.shouldClearDraft) setDraft("");
    setActiveWorkIntent(null);
  }, [activeWorkIntent, draft, handleConversationModeChange]);

  const reenterStructuring = useCallback(() => {
    handleConversationModeChange("plan");
  }, [handleConversationModeChange]);

  const handleConversationUseCaseChange = useCallback(
    (nextUseCase) => {
      const normalizedUseCase = normalizeCoachUseCase(nextUseCase, conversationUseCase);
      setConversationUseCase(normalizedUseCase);
      if (!currentConversation?.id || typeof setData !== "function") return;
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        return {
          ...safePrevious,
          coach_conversations_v1: updateCoachConversationUseCase(safePrevious.coach_conversations_v1, {
            conversationId: currentConversation.id,
            useCase: normalizedUseCase,
          }),
        };
      });
    },
    [conversationUseCase, currentConversation?.id, setData]
  );

  const handleNewChat = useCallback(() => {
    setError("");
    setDraft("");
    setActiveWorkIntent(null);
    if (typeof setData !== "function") return;
    const nextConversation = createCoachConversation({
      mode: conversationMode,
      useCase: conversationUseCase,
      contextSnapshot: {
        activeCategoryId: contextSnapshot.activeCategoryId,
        dateKey: contextSnapshot.selectedDateKey,
      },
    });
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      return {
        ...safePrevious,
        coach_conversations_v1: upsertCoachConversation(safePrevious.coach_conversations_v1, nextConversation),
      };
    });
    setActiveConversationId(nextConversation.id);
  }, [contextSnapshot.activeCategoryId, contextSnapshot.selectedDateKey, conversationMode, conversationUseCase, setData]);

  useEffect(() => {
    return () => {
      if (archiveTimeoutRef.current) {
        window.clearTimeout(archiveTimeoutRef.current);
      }
    };
  }, []);

  const archiveConversation = useCallback(
    (conversationId) => {
      if (!conversationId || typeof setData !== "function") return;
      const archived = getCoachConversationById(safeData?.coach_conversations_v1, conversationId);
      if (!archived) return;
      if (archiveTimeoutRef.current) window.clearTimeout(archiveTimeoutRef.current);
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        return {
          ...safePrevious,
          coach_conversations_v1: removeCoachConversation(safePrevious.coach_conversations_v1, conversationId),
        };
      });
      setArchivedConversation({
        conversation: archived,
        label: String(
          Array.isArray(archived?.messages) ? archived.messages[archived.messages.length - 1]?.text || "" : ""
        )
          .trim()
          .slice(0, 72) || "Nouveau chat",
      });
      archiveTimeoutRef.current = window.setTimeout(() => {
        setArchivedConversation(null);
      }, 5000);
    },
    [safeData?.coach_conversations_v1, setData]
  );

  const undoArchivedConversation = useCallback(() => {
    if (!archivedConversation?.conversation || typeof setData !== "function") return;
    if (archiveTimeoutRef.current) window.clearTimeout(archiveTimeoutRef.current);
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      return {
        ...safePrevious,
        coach_conversations_v1: upsertCoachConversation(
          safePrevious.coach_conversations_v1,
          archivedConversation.conversation
        ),
      };
    });
    setActiveConversationId(archivedConversation.conversation.id);
    setArchivedConversation(null);
  }, [archivedConversation, setData]);

  const applyAction = useCallback(
    (action) => {
      if (!action || !action.intent) return;
      if (action.intent === "continue_coach") {
        setConversationMode("plan");
        setConversationUseCase((current) => normalizeCoachUseCase(current, "life_plan"));
        return;
      }
      if (action.intent === "open_created_view") {
        if (action.viewTarget) {
          onOpenCreatedView?.(action.viewTarget);
          onRequestClose?.();
          return;
        }
        if (action.categoryId) {
          setTab?.("objectives");
          onRequestClose?.();
        }
        return;
      }
      if (action.intent === "open_library") {
        setTab?.("objectives");
        onRequestClose?.();
        return;
      }
      if (action.intent === "open_pilotage") {
        setTab?.("insights");
        onRequestClose?.();
        return;
      }
      if (action.intent === "open_today") {
        setTab?.("today");
        onRequestClose?.();
        return;
      }
      if (action.intent === "open_support") {
        setTab?.("support");
        onRequestClose?.();
        return;
      }
      if (action.intent === "resume_session") {
        setTab?.("session", {
          sessionCategoryId: action.categoryId || contextSnapshot.activeCategoryId || null,
          sessionDateKey: action.dateKey || contextSnapshot.selectedDateKey,
        });
        onRequestClose?.();
        return;
      }
      if (action.intent !== "start_occurrence") return;

      const occurrence = findCoachOccurrence(safeData, action, contextSnapshot.selectedDateKey);
      if (!occurrence?.id) return;
      const gate = resolveRuntimeSessionGate(safeData, { occurrenceId: occurrence.id });
      if (gate.status !== "ready" && gate.activeSession?.occurrenceId) {
        const activeOccurrence = Array.isArray(safeData.occurrences)
          ? safeData.occurrences.find((entry) => entry?.id === gate.activeSession.occurrenceId) || null
          : null;
        const activeGoal = activeOccurrence?.goalId
          ? Array.isArray(safeData.goals)
            ? safeData.goals.find((goal) => goal?.id === activeOccurrence.goalId) || null
            : null
          : null;
        setTab?.("session", {
          sessionCategoryId: activeGoal?.categoryId || contextSnapshot.activeCategoryId || null,
          sessionDateKey: gate.activeSession.dateKey || activeOccurrence?.date || contextSnapshot.selectedDateKey,
          sessionOccurrenceId: gate.activeSession.occurrenceId || null,
        });
        onRequestClose?.();
        return;
      }
      const occurrenceGoal = Array.isArray(safeData.goals)
        ? safeData.goals.find((goal) => goal?.id === occurrence.goalId) || null
        : null;
      setData?.((previous) =>
        applySessionRuntimeTransition(previous, {
          type: "start",
          occurrenceId: occurrence.id,
          dateKey: occurrence.date || action.dateKey || contextSnapshot.selectedDateKey,
          objectiveId: null,
          habitIds: occurrence.goalId ? [occurrence.goalId] : action.actionId ? [action.actionId] : [],
        })
      );
      setTab?.("session", {
        sessionCategoryId: occurrenceGoal?.categoryId || action.categoryId || contextSnapshot.activeCategoryId || null,
        sessionDateKey: occurrence.date || action.dateKey || contextSnapshot.selectedDateKey,
      });
      onRequestClose?.();
    },
    [
      contextSnapshot.activeCategoryId,
      contextSnapshot.selectedDateKey,
      onRequestClose,
      onOpenCreatedView,
      safeData,
      setData,
      setTab,
    ]
  );

  const openAssistantReview = useCallback(
    (entry) => {
      if (!entry?.reply?.proposal || typeof onOpenAssistantCreate !== "function" || !currentConversation?.id) return;
      onOpenAssistantCreate({
        sourceSurface: "coach",
        conversationId: currentConversation.id,
        proposal: entry.reply.proposal,
      });
    },
    [currentConversation?.id, onOpenAssistantCreate]
  );

  const createFromPlanReply = useCallback(
    async (entry) => {
      if (!entry?.id || !entry?.createdAt || !entry?.reply?.proposal || !currentConversation?.id || typeof setData !== "function") {
        return;
      }

      const preparedCommit = prepareCreateCommit({
        state: safeData,
        kind: entry.reply.proposal.kind || "assistant",
        actionDraft: entry.reply.proposal.actionDrafts?.[0] || null,
        outcomeDraft: entry.reply.proposal.outcomeDraft || null,
        additionalActionDrafts: entry.reply.proposal.actionDrafts?.slice(1) || [],
        canCreateAction,
        canCreateOutcome,
        isPremiumPlan,
        planLimits,
      });

      if (!preparedCommit.ok) {
        if (preparedCommit.kind === "paywall") onOpenPaywall?.(preparedCommit.message);
        setData((previous) => {
          const safePrevious = previous && typeof previous === "object" ? previous : {};
          return {
            ...safePrevious,
            coach_conversations_v1: updateCoachConversationMessage(safePrevious.coach_conversations_v1, {
              conversationId: currentConversation.id,
              messageCreatedAt: entry.createdAt,
              update: (message) => ({
                ...message,
                coachReply: {
                  ...(message?.coachReply || entry.reply),
                  createStatus: "error",
                  createMessage: preparedCommit.message || "Création indisponible pour le moment.",
                },
              }),
            }),
          };
        });
        return;
      }

      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        return {
          ...safePrevious,
          coach_conversations_v1: updateCoachConversationMessage(safePrevious.coach_conversations_v1, {
            conversationId: currentConversation.id,
            messageCreatedAt: entry.createdAt,
            update: (message) => ({
              ...message,
              coachReply: {
                ...(message?.coachReply || entry.reply),
                createStatus: "creating",
                createMessage: "",
              },
            }),
          }),
        };
      });

      await new Promise((resolve) => window.setTimeout(resolve, 0));

      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        const commitResult = commitPreparedCreatePlan(safePrevious, preparedCommit.plan, {
          generationWindowDays,
          isPremiumPlan,
        });
        const categoryLabel =
          (Array.isArray(commitResult.state?.categories)
            ? commitResult.state.categories.find((category) => category?.id === commitResult.createdCategoryId)?.name
            : null) ||
          "ta catégorie";
        const summaryBits = [];
        if (commitResult.createdOutcomeId) summaryBits.push("1 objectif");
        if (commitResult.createdActionIds.length) {
          summaryBits.push(
            `${commitResult.createdActionIds.length} action${commitResult.createdActionIds.length > 1 ? "s" : ""}`
          );
        }
        const summaryText = `Créé dans ${categoryLabel}.\n${summaryBits.join(" · ") || "Structure créée."}`;
        const createdAt = new Date().toISOString();
        const coachWithStatus = updateCoachConversationMessage(commitResult.state.coach_conversations_v1, {
          conversationId: currentConversation.id,
          messageCreatedAt: entry.createdAt,
          update: (message) => ({
            ...message,
            coachReply: {
              ...(message?.coachReply || entry.reply),
              createStatus: "created",
              createMessage: "Créé dans l’app.",
              viewTarget: commitResult.viewTarget,
            },
          }),
        });
        const successMessage = buildCoachConversationMessage("assistant", summaryText, createdAt, {
          kind: "conversation",
          mode: "plan",
          message: summaryText,
          primaryAction: {
            intent: "open_created_view",
            label: "Voir",
            categoryId: commitResult.createdCategoryId || null,
            actionId:
              commitResult.createdActionIds.length === 1 && !commitResult.createdOutcomeId
                ? commitResult.createdActionIds[0]
                : commitResult.createdOutcomeId || null,
            viewTarget: commitResult.viewTarget,
          },
          secondaryAction: {
            intent: "continue_coach",
            label: "Continuer",
          },
          proposal: null,
          createStatus: "created",
          createMessage: "",
          viewTarget: commitResult.viewTarget,
        });
        const appendedConversation = appendCoachConversationMessages(coachWithStatus, {
          conversationId: currentConversation.id,
          messages: successMessage ? [successMessage] : [],
          contextSnapshot: {
            activeCategoryId: commitResult.createdCategoryId || contextSnapshot.activeCategoryId,
            dateKey: contextSnapshot.selectedDateKey,
          },
          mode: "plan",
          useCase: currentConversation?.useCase || conversationUseCase,
        });
        return {
          ...commitResult.state,
          coach_conversations_v1: appendedConversation.state,
        };
      });
    },
    [
      canCreateAction,
      canCreateOutcome,
      contextSnapshot.activeCategoryId,
      contextSnapshot.selectedDateKey,
      currentConversation?.id,
      currentConversation?.useCase,
      generationWindowDays,
      isPremiumPlan,
      onOpenPaywall,
      planLimits,
      safeData,
      setData,
      conversationUseCase,
    ]
  );

  const submitMessage = useCallback(
    async (nextValue = null) => {
      const message = typeof nextValue === "string" ? nextValue.trim() : draft.trim();
      if (!message || loading || typeof setData !== "function") return;
      const effectiveMode = conversationMode === "plan" ? "plan" : "free";
      const effectiveUseCase = deriveCoachUseCase(message, conversationUseCase, effectiveMode);
      setConversationUseCase(effectiveUseCase);

      const userMessage = buildCoachConversationMessage("user", message);
      if (!userMessage) return;

      const preparedResult = appendCoachConversationMessages(safeData.coach_conversations_v1, {
        conversationId: currentConversation?.id || null,
        messages: [userMessage],
        contextSnapshot: {
          activeCategoryId: contextSnapshot.activeCategoryId,
          dateKey: contextSnapshot.selectedDateKey,
        },
        mode: effectiveMode,
        useCase: effectiveUseCase,
      });
      const preparedConversation = preparedResult.conversation;
      setActiveConversationId(preparedConversation?.id || "");
      setData({
        ...safeData,
        coach_conversations_v1: preparedResult.state,
      });

      setDraft("");
      setError("");
      setLoading(true);

      const result = await requestAiCoachChat({
        accessToken,
        payload: {
          selectedDateKey: contextSnapshot.selectedDateKey,
          activeCategoryId: contextSnapshot.activeCategoryId,
          mode: effectiveMode,
          locale: "fr-FR",
          useCase: effectiveUseCase,
          message,
          recentMessages: buildRecentMessagesFromConversation(preparedConversation),
        },
      });

      if (!result.ok || !result.reply || !preparedConversation?.id) {
        setError(deriveCoachErrorMessage(result));
        setLoading(false);
        return;
      }

      const assistantCreatedAt = new Date().toISOString();
      const assistantMessage = buildCoachConversationMessage(
        "assistant",
        buildAssistantTranscriptText(result.reply),
        assistantCreatedAt,
        result.reply
      );
      if (assistantMessage) {
        setData((previous) => {
          const safePrevious = previous && typeof previous === "object" ? previous : {};
          const nextResult = appendCoachConversationMessages(safePrevious.coach_conversations_v1, {
            conversationId: preparedConversation.id,
            messages: [assistantMessage],
            contextSnapshot: {
              activeCategoryId: contextSnapshot.activeCategoryId,
              dateKey: contextSnapshot.selectedDateKey,
            },
            mode: result.reply?.kind === "conversation" ? result.reply.mode : effectiveMode,
            useCase: effectiveUseCase,
          });
          return {
            ...safePrevious,
            coach_conversations_v1: nextResult.state,
          };
        });
      }

      setLoading(false);
      setError("");
    },
    [
      accessToken,
      conversationMode,
      conversationUseCase,
      contextSnapshot.activeCategoryId,
      contextSnapshot.selectedDateKey,
      currentConversation?.id,
      draft,
      loading,
      safeData,
      setData,
    ]
  );

  return {
    draft,
    setDraft,
    error,
    loading,
    loadingStageLabel,
    currentConversation,
    conversations,
    activeConversationId,
    setActiveConversationId,
    messageEntries,
    quickPrompts:
      conversationMode === "plan"
        ? COACH_PLAN_PROMPTS
        : COACH_QUICK_PROMPTS,
    conversationMode,
    setConversationMode: handleConversationModeChange,
    activeWorkIntent,
    startStructuringIntent,
    startQuickCreateIntent,
    dismissWorkIntent,
    reenterStructuring,
    conversationUseCase,
    setConversationUseCase: handleConversationUseCaseChange,
    hasMessages: messageEntries.length > 0,
    categoriesById,
    submitMessage,
    handleNewChat,
    applyAction,
    openAssistantReview,
    createFromPlanReply,
    archiveConversation,
    archivedConversation,
    undoArchivedConversation,
  };
}
