import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/useAuth";
import { requestAiCoachChat } from "../../infra/aiCoachChatClient";
import { deriveAiUnavailableMessage } from "../../infra/aiTransportDiagnostics";
import { applySessionRuntimeTransition } from "../../logic/sessionRuntime";
import { applyChatDraftChanges, buildCreationProposalFromDraftChanges } from "../../logic/chatDraftChanges";
import { commitPreparedCreatePlan, prepareCreateCommit } from "../create-item/createItemCommit";
import { GateButton, GatePanel } from "../../shared/ui/gate/Gate";
import { getManualAiLoadingStages } from "../manualAi/loadingStages";
import { getCoachContextSnapshot } from "./coachContextAdapter";
import {
  describeCoachDraftChange,
  deriveCoachMessageEntries,
  findCoachOccurrence,
  renderCoachActionButtonLabel,
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
  upsertCoachConversation,
} from "./coachStorage";
import { useBehaviorFeedback } from "../../feedback/BehaviorFeedbackContext";
import { deriveBehaviorFeedbackSignal } from "../../feedback/feedbackDerivers";
import { resolveMainTabForSurface } from "../../app/routeOrigin";
import "./coach.css";

const COACH_QUICK_PROMPTS = [
  "J’hésite sur mon prochain pas",
  "Je bloque sur une catégorie",
  "Aide-moi à arbitrer",
  "Clarifie ce qui compte aujourd’hui",
  "Je manque de discipline en ce moment",
];

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

function formatConversationTimestamp(updatedAt) {
  if (!updatedAt) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(updatedAt));
  } catch {
    return "";
  }
}

function buildConversationPreview(conversation) {
  const lastMessage = Array.isArray(conversation?.messages)
    ? conversation.messages[conversation.messages.length - 1] || null
    : null;
  const text = String(lastMessage?.text || "").trim();
  if (!text) return "Nouveau chat";
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
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

export function useCoachConversationController({
  open = false,
  data,
  setData,
  setTab,
  surfaceTab = "today",
  onRequestClose,
  emitBehaviorFeedback,
  requestedMode = "free",
  requestedConversationId = null,
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
  const [loadingStageIndex, setLoadingStageIndex] = useState(-1);
  const [archivedConversation, setArchivedConversation] = useState(null);
  const archiveTimeoutRef = useRef(null);
  const lastAppliedRequestedModeIntentRef = useRef("");
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
  const goalsById = useMemo(
    () => new Map((Array.isArray(safeData.goals) ? safeData.goals : []).map((goal) => [goal?.id, goal])),
    [safeData.goals]
  );

  useEffect(() => {
    const nextMode = currentConversation?.mode || normalizeCoachRequestedMode(requestedMode);
    setConversationMode(nextMode);
  }, [currentConversation?.id, currentConversation?.mode, requestedMode]);

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

  const handleNewChat = useCallback(() => {
    setError("");
    setDraft("");
    if (typeof setData !== "function") return;
    const nextConversation = createCoachConversation({
      mode: conversationMode,
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
  }, [contextSnapshot.activeCategoryId, contextSnapshot.selectedDateKey, conversationMode, setData]);

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
        label: buildConversationPreview(archived),
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
        return;
      }
      if (action.intent === "open_created_view") {
        if (action.viewTarget) {
          onOpenCreatedView?.(action.viewTarget);
          onRequestClose?.();
          return;
        }
        if (action.categoryId) {
          setTab?.("library");
          onRequestClose?.();
        }
        return;
      }
      if (action.intent === "open_library") {
        setTab?.("library");
        onRequestClose?.();
        return;
      }
      if (action.intent === "open_pilotage") {
        setTab?.("pilotage");
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
      setConversationMode,
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
      generationWindowDays,
      isPremiumPlan,
      onOpenPaywall,
      planLimits,
      safeData,
      setData,
    ]
  );

  const applyDraftProposal = useCallback(
    (entry) => {
      if (!entry?.id || !entry?.reply) return;
      const draftChanges = Array.isArray(entry.reply?.draftChanges) ? entry.reply.draftChanges : [];
      if (!draftChanges.length || !currentConversation?.id) return;
      setData?.((previous) => {
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

      const proposal = buildCreationProposalFromDraftChanges(safeData, draftChanges, {
        sourceContext: {
          mainTab: resolveMainTabForSurface(surfaceTab, "today"),
          sourceSurface: "coach",
          categoryId: contextSnapshot.activeCategoryId || null,
          dateKey: contextSnapshot.selectedDateKey || null,
          coachConversationId: currentConversation.id,
        },
      });
      if (proposal && typeof onOpenAssistantCreate === "function") {
        setData?.((previous) => {
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
                  createStatus: "created",
                  createMessage: "Proposition ouverte pour validation.",
                },
              }),
            }),
          };
        });
        onOpenAssistantCreate({
          sourceSurface: "coach",
          conversationId: currentConversation.id,
          proposal,
        });
        return;
      }

      const result = applyChatDraftChanges(safeData, draftChanges);
      setData?.(result.state);

      if (result.appliedCount > 0) {
        setData?.((previous) => {
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
                  createStatus: "created",
                  createMessage:
                    result.appliedCount > 1 ? `${result.appliedCount} changements appliqués.` : "Brouillon appliqué.",
                },
              }),
            }),
          };
        });
        emitBehaviorFeedback?.(
          deriveBehaviorFeedbackSignal({
            intent: "apply_coach_draft",
            payload: {
              surface: "coach",
              categoryId: contextSnapshot.activeCategoryId || null,
            },
          })
        );
        if (result.navigationTarget) {
          setTab?.(result.navigationTarget);
          onRequestClose?.();
        }
        return;
      }

      setData?.((previous) => {
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
                createMessage: "Aucun changement applicable dans l'état actuel.",
              },
            }),
          }),
        };
      });
    },
    [contextSnapshot.activeCategoryId, contextSnapshot.selectedDateKey, currentConversation?.id, onOpenAssistantCreate, safeData, setData, setTab, surfaceTab]
  );

  const submitMessage = useCallback(
    async (nextValue = null) => {
      const message = typeof nextValue === "string" ? nextValue.trim() : draft.trim();
      if (!message || loading || typeof setData !== "function") return;

      const userMessage = buildCoachConversationMessage("user", message);
      if (!userMessage) return;

      const preparedResult = appendCoachConversationMessages(safeData.coach_conversations_v1, {
        conversationId: currentConversation?.id || null,
        messages: [userMessage],
        contextSnapshot: {
          activeCategoryId: contextSnapshot.activeCategoryId,
          dateKey: contextSnapshot.selectedDateKey,
        },
        mode: conversationMode,
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
          mode: conversationMode === "plan" ? "plan" : "free",
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
            mode: result.reply?.kind === "conversation" ? result.reply.mode : conversationMode,
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
        ? ["Transformer une idée en plan", "Créer une première action", "Clarifier mes priorités", "Organiser un chantier", "Structurer un projet flou"]
        : COACH_QUICK_PROMPTS,
    conversationMode,
    setConversationMode: handleConversationModeChange,
    hasMessages: messageEntries.length > 0,
    categoriesById,
    goalsById,
    submitMessage,
    handleNewChat,
    applyAction,
    openAssistantReview,
    createFromPlanReply,
    applyDraftProposal,
    archiveConversation,
    archivedConversation,
    undoArchivedConversation,
  };
}

export function CoachConversationSurface({
  controller,
  railExpanded: railExpandedProp,
  setRailExpanded: setRailExpandedProp,
  isDesktopLayout: isDesktopLayoutProp,
  setIsDesktopLayout: setIsDesktopLayoutProp,
}) {
  const {
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
    quickPrompts,
    conversationMode,
    setConversationMode,
    hasMessages,
    categoriesById,
    goalsById,
    submitMessage,
    handleNewChat,
    applyAction,
    openAssistantReview,
    createFromPlanReply,
    applyDraftProposal,
    archiveConversation,
    archivedConversation,
    undoArchivedConversation,
  } = controller;
  const scrollRef = useRef(null);
  const [internalIsDesktopLayout, setInternalIsDesktopLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 901px)").matches : false
  );
  const [internalRailExpanded, setInternalRailExpanded] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 901px)").matches : false
  );
  const [revealedArchiveId, setRevealedArchiveId] = useState("");
  const swipeStartRef = useRef({ id: "", x: 0 });
  const railSwipeStartRef = useRef(0);
  const isDesktopLayout = typeof isDesktopLayoutProp === "boolean" ? isDesktopLayoutProp : internalIsDesktopLayout;
  const setIsDesktopLayout = setIsDesktopLayoutProp || setInternalIsDesktopLayout;
  const railExpanded = typeof railExpandedProp === "boolean" ? railExpandedProp : internalRailExpanded;
  const setRailExpanded = setRailExpandedProp || setInternalRailExpanded;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [hasMessages, loading, messageEntries.length]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 901px)");
    const syncLayout = (matches) => {
      setIsDesktopLayout(matches);
      if (matches) setRailExpanded(true);
    };
    syncLayout(mediaQuery.matches);
    const handleChange = (event) => syncLayout(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  const handleSelectConversation = useCallback(
    (conversationId) => {
      setActiveConversationId(conversationId);
      if (!isDesktopLayout) setRailExpanded(false);
      setRevealedArchiveId("");
    },
    [isDesktopLayout, setActiveConversationId]
  );

  const handleConversationPointerStart = useCallback(
    (conversationId, event) => {
      if (isDesktopLayout || event.pointerType === "mouse") return;
      swipeStartRef.current = { id: conversationId, x: event.clientX };
    },
    [isDesktopLayout]
  );

  const handleConversationPointerEnd = useCallback(
    (conversationId, event) => {
      if (isDesktopLayout || event.pointerType === "mouse") return;
      const currentSwipe = swipeStartRef.current;
      swipeStartRef.current = { id: "", x: 0 };
      if (currentSwipe.id !== conversationId) return;
      const deltaX = event.clientX - currentSwipe.x;
      if (deltaX <= -36) {
        setRevealedArchiveId(conversationId);
      } else if (deltaX >= 20 && revealedArchiveId === conversationId) {
        setRevealedArchiveId("");
      }
    },
    [isDesktopLayout, revealedArchiveId]
  );

  const handleRailPointerDown = useCallback(
    (event) => {
      if (isDesktopLayout || event.pointerType === "mouse") return;
      railSwipeStartRef.current = event.clientX;
    },
    [isDesktopLayout]
  );

  const handleRailPointerUp = useCallback(
    (event) => {
      if (isDesktopLayout || event.pointerType === "mouse") return;
      const deltaX = event.clientX - railSwipeStartRef.current;
      railSwipeStartRef.current = 0;
      if (deltaX <= -36) {
        setRailExpanded(false);
      }
    },
    [isDesktopLayout, setRailExpanded]
  );

  return (
    <div
      className={[
        "coachSurface coachSurface--panel",
        railExpanded ? "is-rail-open" : "is-rail-closed",
        isDesktopLayout ? "is-desktop" : "is-mobile",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!isDesktopLayout && railExpanded ? (
        <button
          type="button"
          className="coachConversationRailScrim"
          aria-label="Fermer la liste des conversations"
          onClick={() => setRailExpanded(false)}
        />
      ) : null}
      <aside
        className={`coachConversationRail${railExpanded ? " is-open" : ""}`}
        onPointerDown={handleRailPointerDown}
        onPointerUp={handleRailPointerUp}
      >
        <div className="coachConversationRailHeader">
          <div className="coachConversationRailMeta">
            {conversations.length ? `${conversations.length} conversation${conversations.length > 1 ? "s" : ""}` : "Aucun échange"}
          </div>
          <GateButton variant="ghost" className="GatePressable" onClick={handleNewChat}>
            Nouveau chat
          </GateButton>
        </div>
        <div className="coachConversationList">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`coachConversationItemShell${revealedArchiveId === conversation.id ? " is-archive-revealed" : ""}`}
            >
              <button
                type="button"
                className={`coachConversationItem${activeConversationId === conversation.id ? " is-active" : ""}`}
                onClick={() => handleSelectConversation(conversation.id)}
                onPointerDown={(event) => handleConversationPointerStart(conversation.id, event)}
                onPointerUp={(event) => handleConversationPointerEnd(conversation.id, event)}
              >
                <div className="coachConversationItemTop">
                  <div className="coachConversationItemTitle">
                    {conversation.messages.length ? `Conversation ${formatConversationTimestamp(conversation.updatedAt)}` : "Nouveau chat"}
                  </div>
                  <div className="coachConversationItemMeta">{formatConversationTimestamp(conversation.updatedAt)}</div>
                </div>
                <div className="coachConversationItemPreview">{buildConversationPreview(conversation)}</div>
              </button>
              <GateButton
                variant="ghost"
                className="GatePressable coachConversationArchiveButton"
                onClick={() => archiveConversation(conversation.id)}
              >
                Archiver
              </GateButton>
            </div>
          ))}
        </div>
      </aside>
      <div className="coachSurfaceMain">
        <div className="coachSurfaceToolbar">
          <div />
          <div className="coachSurfaceToolbarActions">
            <div className="row gap8">
              <GateButton
                variant={conversationMode === "free" ? undefined : "ghost"}
                className="GatePressable"
                onClick={() => setConversationMode("free")}
              >
                Discuter
              </GateButton>
              <GateButton
                variant={conversationMode === "plan" ? undefined : "ghost"}
                className="GatePressable"
                onClick={() => setConversationMode(toggleCoachPlanMode(conversationMode))}
              >
                Plan
              </GateButton>
            </div>
            {loading ? <div className="coachSurfaceStage">{loadingStageLabel || "Analyse du contexte"}</div> : null}
            {archivedConversation ? (
              <button type="button" className="coachArchiveNotice" onClick={undoArchivedConversation}>
                Conversation archivée · Annuler
              </button>
            ) : null}
          </div>
        </div>
        {conversationMode === "plan" ? (
          <div className="coachModeBadgeRow">
            <span className="coachModeBadge">Plan</span>
          </div>
        ) : null}

        <div ref={scrollRef} className="coachConversationScroll">
          {!hasMessages ? (
            <div className="coachConversationEmpty">
              <div className="coachConversationEmptyTitle">
                {conversationMode === "plan" ? "Décris ce que tu veux construire." : "Parle naturellement au Coach."}
              </div>
              <div className="coachConversationEmptyText">
                {conversationMode === "plan"
                  ? "Le Coach aide à transformer une intention en plan exploitable, puis à valider avant création."
                  : "Le Coach aide à clarifier un blocage, un arbitrage, un prochain pas ou une difficulté de discipline."}
              </div>
            </div>
          ) : null}

          {!hasMessages ? (
            <div className="coachQuickPrompts">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="coachQuickPrompt"
                  onClick={() => submitMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {messageEntries.map((entry) => {
            const reply = entry.reply || null;
            const isConversationReply = entry.role === "assistant" && reply?.kind === "conversation";
            const isLegacyReply = entry.role === "assistant" && reply?.kind === "chat";

            if (isConversationReply) {
              const planProposal = reply?.proposal || null;
              const proposalActions = Array.isArray(planProposal?.actionDrafts) ? planProposal.actionDrafts : [];
              const unresolvedQuestions = Array.isArray(planProposal?.unresolvedQuestions)
                ? planProposal.unresolvedQuestions
                : [];
              const hasProposal = Boolean(planProposal && (planProposal?.outcomeDraft?.title || proposalActions.length));
              const createLabel =
                reply?.createStatus === "creating"
                  ? "Création..."
                  : reply?.createStatus === "created"
                    ? "Créé"
                    : "Créer";
              return (
                <div key={entry.id} className="coachMessage coachMessage--assistantTranscript">
                  <div className="coachMessageBubble">
                    <div className="coachMessageEyebrow">{reply.mode === "plan" ? "Coach · Plan" : "Coach"}</div>
                    <div className="coachMessageText" style={{ whiteSpace: "pre-line" }}>
                      {reply.message || entry.text}
                    </div>
                    {reply?.primaryAction || reply?.secondaryAction ? (
                      <div className="coachMessageActions">
                        {reply.primaryAction ? (
                          <GateButton className="GatePressable" onClick={() => applyAction(reply.primaryAction)}>
                            {reply.primaryAction.label}
                          </GateButton>
                        ) : null}
                        {reply.secondaryAction ? (
                          <GateButton variant="ghost" className="GatePressable" onClick={() => applyAction(reply.secondaryAction)}>
                            {reply.secondaryAction.label}
                          </GateButton>
                        ) : null}
                      </div>
                    ) : null}
                    {hasProposal ? (
                      <div className="coachDraftBlock">
                        <div className="coachDraftTitle">Plan proposé</div>
                        <div className="coachDraftList">
                          {planProposal?.categoryDraft?.label || planProposal?.categoryDraft?.id ? (
                            <div className="coachDraftItem">
                              {`Catégorie · ${planProposal.categoryDraft.label || planProposal.categoryDraft.id}`}
                            </div>
                          ) : null}
                          {planProposal?.outcomeDraft?.title ? (
                            <div className="coachDraftItem">
                              {`Direction · ${planProposal.outcomeDraft.title}`}
                            </div>
                          ) : null}
                          {proposalActions.map((draftItem, index) => (
                            <div key={`${entry.id}_plan_${index}`} className="coachDraftItem">
                              {[
                                draftItem?.title || "Action",
                                draftItem?.categoryId ? categoriesById.get(draftItem.categoryId)?.name || draftItem.categoryId : null,
                                draftItem?.oneOffDate || null,
                                draftItem?.startTime || null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          ))}
                        </div>
                        {unresolvedQuestions.length ? (
                          <>
                            <div className="coachDraftTitle">À confirmer</div>
                            <div className="coachDraftList">
                              {unresolvedQuestions.map((question, index) => (
                                <div key={`${entry.id}_question_${index}`} className="coachDraftItem">
                                  {question}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                        <div className="coachMessageActions">
                          <GateButton
                            className="GatePressable"
                            onClick={() => createFromPlanReply(entry)}
                            disabled={reply?.createStatus === "creating" || reply?.createStatus === "created"}
                          >
                            {createLabel}
                          </GateButton>
                          {typeof openAssistantReview === "function" ? (
                            <GateButton
                              variant="ghost"
                              className="GatePressable"
                              onClick={() => openAssistantReview(entry)}
                              disabled={reply?.createStatus === "creating"}
                            >
                              Revoir dans l’app
                            </GateButton>
                          ) : null}
                        </div>
                        {entry.draftApplyMessage ? (
                          <div className={`coachDraftMessage${entry.draftApplyStatus === "error" ? " is-error" : ""}`}>
                            {entry.draftApplyMessage}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            if (isLegacyReply) {
              return (
                <div key={entry.id} className="coachMessage coachMessage--assistant">
                  <div className="coachMessageCard">
                    <div className="coachMessageEyebrow">Coach</div>
                    <div className="coachMessageTitle">{reply?.headline || "Action"}</div>
                    <div className="coachMessageText">{reply?.reason || entry.text}</div>
                    <div className="coachMessageActions">
                      {reply?.primaryAction ? (
                        <GateButton
                          className="GatePressable"
                          onClick={() =>
                            applyAction({
                              ...reply.primaryAction,
                              suggestedDurationMin: reply.suggestedDurationMin,
                            })
                          }
                        >
                          {renderCoachActionButtonLabel(reply.primaryAction, reply.suggestedDurationMin)}
                        </GateButton>
                      ) : null}
                      {reply?.secondaryAction ? (
                        <GateButton variant="ghost" className="GatePressable" onClick={() => applyAction(reply.secondaryAction)}>
                          {reply.secondaryAction.label}
                        </GateButton>
                      ) : null}
                    </div>
                    {Array.isArray(reply?.draftChanges) && reply.draftChanges.length ? (
                      <div className="coachDraftBlock">
                        <div className="coachDraftTitle">Brouillon proposé</div>
                        <div className="coachDraftList">
                          {reply.draftChanges.map((change, index) => (
                            <div key={`${entry.id}_draft_${index}`} className="coachDraftItem">
                              {describeCoachDraftChange(change, { goalsById, categoriesById })}
                            </div>
                          ))}
                        </div>
                        <div className="coachMessageActions">
                          <GateButton
                            className="GatePressable"
                            onClick={() => applyDraftProposal(entry)}
                            disabled={entry.draftApplyStatus === "creating" || entry.draftApplyStatus === "created"}
                          >
                            {entry.draftApplyStatus === "creating"
                              ? "Application..."
                              : entry.draftApplyStatus === "created"
                                ? "Appliqué"
                                : "Appliquer le brouillon"}
                          </GateButton>
                        </div>
                        {entry.draftApplyMessage ? (
                          <div className={`coachDraftMessage${entry.draftApplyStatus === "error" ? " is-error" : ""}`}>
                            {entry.draftApplyMessage}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className={`coachMessage ${entry.role === "assistant" ? "coachMessage--assistantTranscript" : "coachMessage--user"}`}
              >
                <div className="coachMessageBubble">
                  <div className="coachMessageEyebrow">{entry.role === "assistant" ? "Coach" : "Toi"}</div>
                  <div className="coachMessageText" style={{ whiteSpace: "pre-line" }}>
                    {entry.text}
                  </div>
                </div>
              </div>
            );
          })}

          {loading ? (
            <div className="coachMessage coachMessage--assistantTranscript">
              <div className="coachMessageBubble coachMessageBubble--loading">
                <div className="coachMessageEyebrow">Coach</div>
                <div className="coachMessageText">{loadingStageLabel || "Analyse du contexte"}</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="coachComposer">
          <textarea
            className="GateTextareaPremium"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              conversationMode === "plan"
                ? "Ex: Je veux structurer ce projet en direction, actions et rythme crédible."
                : "Ex: J’hésite sur mon prochain pas utile aujourd’hui."
            }
            rows={3}
          />
          <div className="coachComposerFooter">
            <div className="coachComposerMeta">
              {currentConversation?.messages?.length
                ? `${currentConversation.messages.length} message${currentConversation.messages.length > 1 ? "s" : ""}`
                : "Pas d’historique pour l’instant"}
            </div>
            <div className="coachComposerActions">
              <GateButton className="GatePressable" onClick={() => submitMessage()} disabled={loading || !draft.trim()}>
                {loading ? "Analyse..." : "Envoyer"}
              </GateButton>
            </div>
          </div>
          {error ? <div className="coachComposerError">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function CoachPanel({
  open = false,
  onClose,
  data,
  setData,
  setTab,
  surfaceTab = "today",
  requestedMode = "free",
  requestedConversationId = null,
  onOpenAssistantCreate,
  onOpenCreatedView,
  onOpenPaywall,
  canCreateAction = true,
  canCreateOutcome = true,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
}) {
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const controller = useCoachConversationController({
    open,
    data,
    setData,
    setTab,
    surfaceTab,
    onRequestClose: onClose,
    emitBehaviorFeedback,
    requestedMode,
    requestedConversationId,
    onOpenAssistantCreate,
    onOpenCreatedView,
    onOpenPaywall,
    canCreateAction,
    canCreateOutcome,
    isPremiumPlan,
    planLimits,
    generationWindowDays,
  });
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 901px)").matches : false
  );
  const [railExpanded, setRailExpanded] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 901px)").matches : false
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const { body, documentElement } = document;
    const scrollY = typeof window !== "undefined" ? window.scrollY || 0 : 0;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousHtmlOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      documentElement.style.overflow = previousHtmlOverflow;
      if (typeof window !== "undefined") {
        window.scrollTo(0, scrollY);
      }
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 901px)");
    const syncLayout = (matches) => {
      setIsDesktopLayout(matches);
      if (matches) setRailExpanded(true);
    };
    syncLayout(mediaQuery.matches);
    const handleChange = (event) => syncLayout(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modalBackdrop coachPanelBackdrop"
      onClick={() => onClose?.()}
      role="presentation"
      style={{ zIndex: 1800 }}
    >
      <div
        className="coachPanelOuter GateGlassOuter"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coachPanelClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            className="coachPanel GateGlassContent GateSurfacePremium GateCardPremium"
            role="dialog"
            aria-modal="true"
            aria-label="Coach"
          >
            <div className="coachPanelHeader">
              <div className="coachPanelHeaderText">
                <div className="coachPanelTitle">Coach</div>
                <div className="coachPanelSubtitle">Discuter librement, puis passer en mode Plan quand tu veux construire.</div>
              </div>
              <div className="coachPanelHeaderActions">
                <button
                  type="button"
                  className="coachRailHandle"
                  aria-label={railExpanded ? "Masquer les conversations" : "Ouvrir les conversations"}
                  onClick={() => setRailExpanded((current) => !current)}
                >
                  <span />
                  <span />
                  <span />
                </button>
                <GateButton variant="ghost" className="GatePressable" onClick={() => onClose?.()}>
                  Fermer
                </GateButton>
              </div>
            </div>
        <CoachConversationSurface
          controller={controller}
          railExpanded={railExpanded}
          setRailExpanded={setRailExpanded}
          isDesktopLayout={isDesktopLayout}
          setIsDesktopLayout={setIsDesktopLayout}
        />
      </GatePanel>
        </div>
      </div>
    </div>,
    document.body
  );
}
