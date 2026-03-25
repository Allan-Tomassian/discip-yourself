import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/useAuth";
import { requestAiCoachChat } from "../../infra/aiCoachChatClient";
import { applySessionRuntimeTransition } from "../../logic/sessionRuntime";
import { applyChatDraftChanges } from "../../logic/chatDraftChanges";
import { Textarea } from "../../components/UI";
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
  clearCoachSessionReplies,
  createCoachConversation,
  getCoachSessionReplies,
  getLatestCoachConversation,
  setCoachSessionReply,
  subscribeCoachSessionReplies,
  updateCoachSessionReplyDraftStatus,
  upsertCoachConversation,
} from "./coachStorage";
import "./coach.css";

const COACH_QUICK_PROMPTS = [
  "Créer une action",
  "Structurer ma semaine",
  "Clarifier une catégorie",
  "Pourquoi cette recommandation ?",
  "Améliorer ma discipline",
];

function deriveCoachErrorMessage(result) {
  const code = String(result?.errorCode || "").trim().toUpperCase();
  if (code === "DISABLED") return "Coach indisponible sur cet appareil.";
  if (code === "UNAUTHORIZED") return "Connecte-toi pour utiliser le coach.";
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") return "Coach indisponible pour le moment.";
  if (code === "NETWORK_ERROR") return "Coach indisponible hors ligne.";
  return "Coach indisponible.";
}

function useCoachSessionReplies(conversationId) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    return subscribeCoachSessionReplies((changedConversationId) => {
      if (!conversationId || changedConversationId !== conversationId) return;
      setRevision((value) => value + 1);
    });
  }, [conversationId]);

  return useMemo(() => getCoachSessionReplies(conversationId), [conversationId, revision]);
}

export function useCoachConversationController({
  data,
  setData,
  setTab,
  surfaceTab = "today",
  onRequestClose,
}) {
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const safeData = data && typeof data === "object" ? data : {};
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingStageIndex, setLoadingStageIndex] = useState(-1);
  const loadingStages = useMemo(() => getManualAiLoadingStages("coach"), []);

  const contextSnapshot = useMemo(
    () => getCoachContextSnapshot({ data: safeData, surfaceTab }),
    [safeData, surfaceTab]
  );
  const currentConversation = useMemo(
    () => getLatestCoachConversation(safeData?.coach_conversations_v1),
    [safeData?.coach_conversations_v1]
  );
  const sessionReplies = useCoachSessionReplies(currentConversation?.id || "");
  const messageEntries = useMemo(
    () => deriveCoachMessageEntries(currentConversation, sessionReplies),
    [currentConversation, sessionReplies]
  );
  const categoriesById = useMemo(
    () => new Map((Array.isArray(safeData.categories) ? safeData.categories : []).map((category) => [category?.id, category])),
    [safeData.categories]
  );
  const goalsById = useMemo(
    () => new Map((Array.isArray(safeData.goals) ? safeData.goals : []).map((goal) => [goal?.id, goal])),
    [safeData.goals]
  );

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

  const handleNewChat = useCallback(() => {
    setError("");
    setDraft("");
    if (typeof setData !== "function") return;
    const nextConversation = createCoachConversation({
      contextSnapshot: {
        activeCategoryId: contextSnapshot.activeCategoryId,
        dateKey: contextSnapshot.selectedDateKey,
      },
    });
    setData({
      ...safeData,
      coach_conversations_v1: upsertCoachConversation(safeData.coach_conversations_v1, nextConversation),
    });
    clearCoachSessionReplies(nextConversation.id);
  }, [contextSnapshot.activeCategoryId, contextSnapshot.selectedDateKey, safeData, setData]);

  const applyAction = useCallback(
    (action) => {
      if (!action || !action.intent) return;
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
      safeData,
      setData,
      setTab,
    ]
  );

  const applyDraftProposal = useCallback(
    (entry) => {
      if (!entry?.id || !entry?.reply) return;
      const draftChanges = Array.isArray(entry.reply?.draftChanges) ? entry.reply.draftChanges : [];
      if (!draftChanges.length || !currentConversation?.id) return;
      updateCoachSessionReplyDraftStatus(currentConversation.id, entry.createdAt, {
        draftApplyStatus: "applying",
        draftApplyMessage: "",
      });

      const result = applyChatDraftChanges(safeData, draftChanges);
      setData?.(result.state);

      if (result.appliedCount > 0) {
        updateCoachSessionReplyDraftStatus(currentConversation.id, entry.createdAt, {
          draftApplyStatus: "applied",
          draftApplyMessage:
            result.appliedCount > 1 ? `${result.appliedCount} changements appliqués.` : "Brouillon appliqué.",
        });
        if (result.navigationTarget) {
          setTab?.(result.navigationTarget);
          onRequestClose?.();
        }
        return;
      }

      updateCoachSessionReplyDraftStatus(currentConversation.id, entry.createdAt, {
        draftApplyStatus: "error",
        draftApplyMessage: "Aucun changement applicable dans l'état actuel.",
      });
    },
    [currentConversation?.id, onRequestClose, safeData, setData, setTab]
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
      });
      const preparedConversation = preparedResult.conversation;
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
        assistantCreatedAt
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
          });
          return {
            ...safePrevious,
            coach_conversations_v1: nextResult.state,
          };
        });
        setCoachSessionReply(preparedConversation.id, assistantCreatedAt, result.reply);
      }

      setLoading(false);
      setError("");
    },
    [
      accessToken,
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
    messageEntries,
    quickPrompts: COACH_QUICK_PROMPTS,
    hasMessages: messageEntries.length > 0,
    categoriesById,
    goalsById,
    submitMessage,
    handleNewChat,
    applyAction,
    applyDraftProposal,
  };
}

export function CoachConversationSurface({
  controller,
  mode = "panel",
}) {
  const {
    draft,
    setDraft,
    error,
    loading,
    loadingStageLabel,
    currentConversation,
    messageEntries,
    quickPrompts,
    hasMessages,
    categoriesById,
    goalsById,
    submitMessage,
    handleNewChat,
    applyAction,
    applyDraftProposal,
  } = controller;
  const scrollRef = useRef(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [hasMessages, loading, messageEntries.length]);

  return (
    <div className={`coachSurface coachSurface--${mode}`}>
      {mode !== "panel" ? (
        <div className="coachSurfaceToolbar">
          <div className="coachSurfaceStatus">
            <span className={`coachSurfaceStatusDot${loading ? " is-loading" : ""}`} />
            <span>{loading ? loadingStageLabel || "Analyse du contexte" : "Coach prêt"}</span>
          </div>
          <GateButton variant="ghost" className="GatePressable" onClick={handleNewChat}>
            Nouveau chat
          </GateButton>
        </div>
      ) : null}

      <div ref={scrollRef} className="coachConversationScroll">
        {!hasMessages ? (
          <div className="coachConversationEmpty">
            <div className="coachConversationEmptyTitle">Pose une question courte.</div>
            <div className="coachConversationEmptyText">
              Le coach répond avec une action concrète, une explication brève ou une proposition structurée.
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

        {messageEntries.map((entry) =>
          entry.role === "assistant" && entry.reply ? (
            <div key={entry.id} className="coachMessage coachMessage--assistant">
              <div className="coachMessageCard">
                <div className="coachMessageEyebrow">Coach</div>
                <div className="coachMessageTitle">{entry.reply?.headline || "Action"}</div>
                <div className="coachMessageText">{entry.reply?.reason || entry.text}</div>
                <div className="coachMessageActions">
                  {entry.reply?.primaryAction ? (
                    <GateButton
                      className="GatePressable"
                      onClick={() =>
                        applyAction({
                          ...entry.reply.primaryAction,
                          suggestedDurationMin: entry.reply.suggestedDurationMin,
                        })
                      }
                    >
                      {renderCoachActionButtonLabel(entry.reply.primaryAction, entry.reply.suggestedDurationMin)}
                    </GateButton>
                  ) : null}
                  {entry.reply?.secondaryAction ? (
                    <GateButton variant="ghost" className="GatePressable" onClick={() => applyAction(entry.reply.secondaryAction)}>
                      {entry.reply.secondaryAction.label}
                    </GateButton>
                  ) : null}
                </div>
                {Array.isArray(entry.reply?.draftChanges) && entry.reply.draftChanges.length ? (
                  <div className="coachDraftBlock">
                    <div className="coachDraftTitle">Brouillon proposé</div>
                    <div className="coachDraftList">
                      {entry.reply.draftChanges.map((change, index) => (
                        <div key={`${entry.id}_draft_${index}`} className="coachDraftItem">
                          {describeCoachDraftChange(change, { goalsById, categoriesById })}
                        </div>
                      ))}
                    </div>
                    <div className="coachMessageActions">
                      <GateButton
                        className="GatePressable"
                        onClick={() => applyDraftProposal(entry)}
                        disabled={entry.draftApplyStatus === "applying" || entry.draftApplyStatus === "applied"}
                      >
                        {entry.draftApplyStatus === "applying"
                          ? "Application..."
                          : entry.draftApplyStatus === "applied"
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
          ) : (
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
          )
        )}

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
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex: Je suis en retard, quel est le meilleur prochain bloc ?"
          rows={3}
        />
        <div className="coachComposerFooter">
          <div className="coachComposerMeta">
            {currentConversation?.messages?.length
              ? `${currentConversation.messages.length} message${currentConversation.messages.length > 1 ? "s" : ""}`
              : "Pas d’historique pour l’instant"}
          </div>
          <div className="coachComposerActions">
            <GateButton variant="ghost" className="GatePressable" onClick={handleNewChat} disabled={loading}>
              Nouveau chat
            </GateButton>
            <GateButton className="GatePressable" onClick={() => submitMessage()} disabled={loading || !draft.trim()}>
              {loading ? "Analyse..." : "Envoyer"}
            </GateButton>
          </div>
        </div>
        {error ? <div className="coachComposerError">{error}</div> : null}
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
}) {
  const controller = useCoachConversationController({
    data,
    setData,
    setTab,
    surfaceTab,
    onRequestClose: onClose,
  });

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
                <div className="coachPanelSubtitle">
                  {controller.loading ? controller.loadingStageLabel || "Analyse du contexte" : "Conversation rapide, orientée action."}
                </div>
              </div>
              <div className="coachPanelHeaderActions">
                <GateButton variant="ghost" className="GatePressable" onClick={controller.handleNewChat} disabled={controller.loading}>
                  Nouveau chat
                </GateButton>
                <GateButton variant="ghost" className="GatePressable" onClick={() => onClose?.()}>
                  Fermer
                </GateButton>
              </div>
            </div>
            <CoachConversationSurface controller={controller} mode="panel" />
          </GatePanel>
        </div>
      </div>
    </div>,
    document.body
  );
}
