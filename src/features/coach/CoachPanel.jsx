import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppCard,
  AppChip,
  AppIconButton,
  AppSheet,
  AppSheetContent,
  AppTextButton,
  AppTextarea,
  EmptyState,
  FeedbackMessage,
  GhostButton,
  PrimaryButton,
  StatusBadge,
} from "../../shared/ui/app";
import { toggleCoachPlanMode, useCoachConversationController } from "./coachPanelController";
import "./coach.css";

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
    submitMessage,
    handleNewChat,
    applyAction,
    openAssistantReview,
    createFromPlanReply,
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
        <div className="coachConversationRailScrim" role="presentation" onClick={() => setRailExpanded(false)} />
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
          <GhostButton size="sm" onClick={handleNewChat}>
            Nouveau chat
          </GhostButton>
        </div>
        <div className="coachConversationList">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`coachConversationItemShell${revealedArchiveId === conversation.id ? " is-archive-revealed" : ""}`}
            >
              <AppCard
                interactive
                selected={activeConversationId === conversation.id}
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
              </AppCard>
              <GhostButton size="sm" className="coachConversationArchiveButton" onClick={() => archiveConversation(conversation.id)}>
                Archiver
              </GhostButton>
            </div>
          ))}
        </div>
      </aside>
      <div className="coachSurfaceMain">
        <div className="coachSurfaceToolbar">
          <div />
          <div className="coachSurfaceToolbarActions">
            <div className="row gap8">
              <PrimaryButton
                className="coachModeToggle"
                disabled={conversationMode === "free"}
                onClick={() => setConversationMode("free")}
              >
                Discuter
              </PrimaryButton>
              <GhostButton
                className="coachModeToggle"
                onClick={() => setConversationMode(toggleCoachPlanMode(conversationMode))}
              >
                Plan
              </GhostButton>
            </div>
            {loading ? <StatusBadge className="coachSurfaceStage">{loadingStageLabel || "Analyse du contexte"}</StatusBadge> : null}
            {archivedConversation ? (
              <AppTextButton className="coachArchiveNotice" onClick={undoArchivedConversation}>
                Conversation archivée · Annuler
              </AppTextButton>
            ) : null}
          </div>
        </div>
        {conversationMode === "plan" ? (
          <div className="coachModeBadgeRow">
            <StatusBadge className="coachModeBadge">Plan</StatusBadge>
          </div>
        ) : null}

        <div ref={scrollRef} className="coachConversationScroll">
          {!hasMessages ? (
            <EmptyState
              className="coachConversationEmpty"
              title={conversationMode === "plan" ? "Décris ce que tu veux construire." : "Parle naturellement au Coach."}
              subtitle={
                conversationMode === "plan"
                  ? "Le Coach aide à transformer une intention en plan exploitable, puis à valider avant création."
                  : "Le Coach aide à clarifier un blocage, un arbitrage, un prochain pas ou une difficulté de discipline."
              }
            />
          ) : null}

          {!hasMessages ? (
            <div className="coachQuickPrompts">
              {quickPrompts.map((prompt) => (
                <AppChip
                  key={prompt}
                  className="coachQuickPrompt"
                  onClick={() => submitMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </AppChip>
              ))}
            </div>
          ) : null}

          {messageEntries.map((entry) => {
            const reply = entry.reply || null;
            const isConversationReply = entry.role === "assistant" && reply?.kind === "conversation";

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
                  <AppCard className="coachMessageBubble">
                    <div className="coachMessageEyebrow">{reply.mode === "plan" ? "Coach · Plan" : "Coach"}</div>
                    <div className="coachMessageText coachMessageText--preline">
                      {reply.message || entry.text}
                    </div>
                    {reply?.primaryAction || reply?.secondaryAction ? (
                      <div className="coachMessageActions">
                        {reply.primaryAction ? (
                          <PrimaryButton onClick={() => applyAction(reply.primaryAction)}>
                            {reply.primaryAction.label}
                          </PrimaryButton>
                        ) : null}
                        {reply.secondaryAction ? (
                          <GhostButton onClick={() => applyAction(reply.secondaryAction)}>
                            {reply.secondaryAction.label}
                          </GhostButton>
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
                              {`Objectif · ${planProposal.outcomeDraft.title}`}
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
                          <PrimaryButton onClick={() => createFromPlanReply(entry)} disabled={reply?.createStatus === "creating" || reply?.createStatus === "created"}>
                            {createLabel}
                          </PrimaryButton>
                          {typeof openAssistantReview === "function" ? (
                            <GhostButton
                              onClick={() => openAssistantReview(entry)}
                              disabled={reply?.createStatus === "creating"}
                            >
                              Revoir dans l’app
                            </GhostButton>
                          ) : null}
                        </div>
                        {entry.draftApplyMessage ? (
                          <FeedbackMessage tone={entry.draftApplyStatus === "error" ? "error" : "info"} className="coachDraftMessage">
                            {entry.draftApplyMessage}
                          </FeedbackMessage>
                        ) : null}
                      </div>
                    ) : null}
                  </AppCard>
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className={`coachMessage ${entry.role === "assistant" ? "coachMessage--assistantTranscript" : "coachMessage--user"}`}
              >
                <AppCard className="coachMessageBubble">
                  <div className="coachMessageEyebrow">{entry.role === "assistant" ? "Coach" : "Toi"}</div>
                  <div className="coachMessageText coachMessageText--preline">
                    {entry.text}
                  </div>
                </AppCard>
              </div>
            );
          })}

          {loading ? (
            <div className="coachMessage coachMessage--assistantTranscript">
              <AppCard className="coachMessageBubble coachMessageBubble--loading">
                <div className="coachMessageEyebrow">Coach</div>
                <div className="coachMessageText">{loadingStageLabel || "Analyse du contexte"}</div>
              </AppCard>
            </div>
          ) : null}
        </div>

        <div className="coachComposer">
          <AppTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              conversationMode === "plan"
                ? "Ex: Je veux structurer ce projet en objectif, actions et rythme crédible."
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
              <PrimaryButton onClick={() => submitMessage()} disabled={loading || !draft.trim()}>
                {loading ? "Analyse..." : "Envoyer"}
              </PrimaryButton>
            </div>
          </div>
          {error ? <FeedbackMessage tone="error" className="coachComposerError">{error}</FeedbackMessage> : null}
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
  const controller = useCoachConversationController({
    open,
    data,
    setData,
    setTab,
    surfaceTab,
    onRequestClose: onClose,
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

  return (
    <AppSheet open={open} onClose={onClose} className="coachPanelSheet" maxWidth={430}>
      <AppSheetContent
        title="Coach"
        subtitle="Discuter librement, puis passer en mode Plan quand tu veux construire."
        actions={(
          <div className="coachPanelHeaderActions">
            <AppIconButton
              className="coachRailHandle"
              aria-label={railExpanded ? "Masquer les conversations" : "Ouvrir les conversations"}
              onClick={() => setRailExpanded((current) => !current)}
            >
              <span />
              <span />
              <span />
            </AppIconButton>
            <GhostButton size="sm" onClick={() => onClose?.()}>
              Fermer
            </GhostButton>
          </div>
        )}
        className="coachPanelContent"
        headerClassName="coachPanelHeader"
        bodyClassName="coachPanelBody"
      >
        <CoachConversationSurface
          controller={controller}
          railExpanded={railExpanded}
          setRailExpanded={setRailExpanded}
          isDesktopLayout={isDesktopLayout}
          setIsDesktopLayout={setIsDesktopLayout}
        />
      </AppSheetContent>
    </AppSheet>
  );
}
