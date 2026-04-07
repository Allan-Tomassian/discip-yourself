import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppScreen } from "../shared/ui/app";
import { useCoachConversationController } from "../features/coach/coachPanelController";
import CoachComposerMenu from "../features/coach/CoachComposerMenu";
import CoachWorkTray from "../features/coach/CoachWorkTray";
import { COACH_SCREEN_COPY } from "../ui/labels";
import "../features/coach/coachSurface.css";

function resolveName(profile) {
  const fullName = String(profile?.full_name || "").trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const username = String(profile?.username || "").trim();
  if (username) return username;
  return "toi";
}

export default function Coach({
  data,
  setData,
  setTab,
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
  const pageRef = useRef(null);
  const scrollRef = useRef(null);
  const dockRef = useRef(null);
  const textareaRef = useRef(null);
  const plusButtonRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const proposalRefs = useRef(new Map());
  const highlightTimeoutRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);
  const [dockHeight, setDockHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [composerMenuAnchorRect, setComposerMenuAnchorRect] = useState(null);
  const [composerMenuAnchorEl, setComposerMenuAnchorEl] = useState(null);
  const [highlightedProposalEntryId, setHighlightedProposalEntryId] = useState("");
  const safeData = data && typeof data === "object" ? data : {};
  const profileName = resolveName(safeData.profile || {});
  const controller = useCoachConversationController({
    open: true,
    data,
    setData,
    setTab,
    surfaceTab: "coach",
    onRequestClose: null,
    requestedMode,
    requestedConversationId,
    requestedPrefill,
    onOpenAssistantCreate,
    onOpenCreatedView,
    onOpenPaywall,
    canCreateAction,
    canCreateOutcome,
    isPremiumPlan,
    planLimits,
    generationWindowDays,
  });

  const syncViewport = useCallback(() => {
    if (typeof window === "undefined") return;
    setViewportHeight(Math.round(window.visualViewport?.height || window.innerHeight || 0));
  }, []);

  const scrollToBottom = useCallback((behavior = "auto") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);
  const handlePlusButtonRef = useCallback((node) => {
    plusButtonRef.current = node;
    setComposerMenuAnchorEl(node);
  }, []);

  useEffect(() => {
    syncViewport();
    if (typeof window === "undefined") return undefined;
    const viewport = window.visualViewport;
    if (!viewport) {
      window.addEventListener("resize", syncViewport);
      return () => window.removeEventListener("resize", syncViewport);
    }
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, [syncViewport]);

  useLayoutEffect(() => {
    const node = pageRef.current;
    if (!node || !viewportHeight) return;
    const rect = node.getBoundingClientRect();
    setPageHeight(Math.max(320, Math.floor(viewportHeight - rect.top - 8)));
  }, [viewportHeight]);

  useLayoutEffect(() => {
    const node = dockRef.current;
    if (!node) return;
    const measure = () => setDockHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [controller.activeWorkIntent, controller.draft, controller.error]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const minHeight = composerFocused ? 72 : 48;
    const maxHeight = composerFocused ? 136 : 56;
    textarea.style.height = "0px";
    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [composerFocused, controller.draft]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const handleScroll = () => {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 72;
    };
    handleScroll();
    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom(controller.messageEntries.length > 0 ? "smooth" : "auto");
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [dockHeight, controller.loading, controller.messageEntries.length, scrollToBottom, viewportHeight]);

  const introText = useMemo(
    () => COACH_SCREEN_COPY.introMessage.replace("{name}", profileName),
    [profileName]
  );
  const latestProposalEntry = useMemo(
    () => [...controller.messageEntries].reverse().find((entry) => entry.reply?.proposal) || null,
    [controller.messageEntries]
  );
  const canReenterStructuring = Boolean(
    controller.activeWorkIntent &&
      controller.conversationMode !== "plan" &&
      (controller.activeWorkIntent.type === "structuring" ||
        controller.activeWorkIntent.type === "quick_create")
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  return (
    <AppScreen pageId="coach" headerTitle={COACH_SCREEN_COPY.title} headerSubtitle={COACH_SCREEN_COPY.subtitle}>
      <div
        ref={pageRef}
        className="lovablePage lovableCoachPage coachSurfacePage"
        style={{
          "--coach-page-height": pageHeight ? `${pageHeight}px` : undefined,
          "--coach-composer-height": dockHeight ? `${dockHeight}px` : undefined,
        }}
      >
        <div className="coachSurfaceTopbar">
          <div className="coachSurfaceModeToggle" role="tablist" aria-label={COACH_SCREEN_COPY.composerMenuAriaLabel}>
            <button
              type="button"
              className={`coachSurfaceModeButton${controller.conversationMode === "free" ? " is-active" : ""}`}
              aria-pressed={controller.conversationMode === "free"}
              onClick={() => controller.setConversationMode("free")}
            >
              {COACH_SCREEN_COPY.chatModeLabel}
            </button>
            <button
              type="button"
              className={`coachSurfaceModeButton${controller.conversationMode === "plan" ? " is-active" : ""}`}
              aria-pressed={controller.conversationMode === "plan"}
              onClick={() => controller.setConversationMode("plan")}
            >
              {COACH_SCREEN_COPY.structuringModeLabel}
            </button>
          </div>
          {controller.loading ? (
            <div className="coachSurfaceStage lovableCoachEyebrow">
              {controller.loadingStageLabel || COACH_SCREEN_COPY.thinking}
            </div>
          ) : null}
        </div>

        <div ref={scrollRef} className="lovableCoachMessages coachSurfaceScroll">
          <div className="lovableCard lovableCoachIntro">
            <div className="lovableCoachEyebrow">{COACH_SCREEN_COPY.introEyebrow}</div>
            <p className="lovableCoachText">{introText}</p>
          </div>

          {!controller.hasMessages ? (
            <div className="lovableCoachPrompts">
              {controller.quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="lovableCoachPrompt"
                  onClick={() => {
                    stickToBottomRef.current = true;
                    controller.submitMessage(prompt);
                  }}
                  disabled={controller.loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {controller.messageEntries.map((entry) => {
            const reply = entry.reply || null;
            const isConversationReply = entry.role === "assistant" && reply?.kind === "conversation";

            return (
              <div
                key={entry.id}
                className={`lovableCard lovableCoachBubble ${entry.role === "assistant" ? "is-assistant" : "is-user"}`}
              >
                <div className="lovableCoachEyebrow">
                  {entry.role === "assistant" ? COACH_SCREEN_COPY.assistantEyebrow : COACH_SCREEN_COPY.userEyebrow}
                </div>
                <p className="lovableCoachText">{reply?.message || entry.text}</p>

                {reply?.primaryAction || reply?.secondaryAction ? (
                  <div className="lovableCoachActions">
                    {reply.primaryAction ? (
                      <button
                        type="button"
                        className="lovableCoachBubbleAction"
                        onClick={() => controller.applyAction(reply.primaryAction)}
                      >
                        {reply.primaryAction.label}
                      </button>
                    ) : null}
                    {reply.secondaryAction ? (
                      <button
                        type="button"
                        className="lovableGhostButton"
                        onClick={() => controller.applyAction(reply.secondaryAction)}
                      >
                        {reply.secondaryAction.label}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {isConversationReply && reply?.proposal ? (
                  <div
                    ref={(node) => {
                      if (node) proposalRefs.current.set(entry.id, node);
                      else proposalRefs.current.delete(entry.id);
                    }}
                    className={`lovableCard lovableCoachDraft coachSurfaceProposalTarget${
                      highlightedProposalEntryId === entry.id ? " is-highlighted" : ""
                    }`}
                  >
                    <div className="lovableCoachDraftTitle">{COACH_SCREEN_COPY.concisePlanTitle}</div>
                    <div className="lovableCoachDraftList">
                      {reply.proposal?.categoryDraft?.label || reply.proposal?.categoryDraft?.id ? (
                        <div className="lovableCoachDraftItem">
                          {`${COACH_SCREEN_COPY.draftCategoryLabel} · ${reply.proposal.categoryDraft.label || reply.proposal.categoryDraft.id}`}
                        </div>
                      ) : null}
                      {reply.proposal?.outcomeDraft?.title ? (
                        <div className="lovableCoachDraftItem">
                          {`${COACH_SCREEN_COPY.draftObjectiveLabel} · ${reply.proposal.outcomeDraft.title}`}
                        </div>
                      ) : null}
                      {(Array.isArray(reply.proposal?.actionDrafts) ? reply.proposal.actionDrafts : []).map((draftItem, index) => (
                        <div key={`${entry.id}-draft-${index}`} className="lovableCoachDraftItem">
                          {[
                            draftItem?.title || COACH_SCREEN_COPY.draftActionFallback,
                            draftItem?.oneOffDate || "",
                            draftItem?.startTime || "",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      ))}
                    </div>
                    {(Array.isArray(reply.proposal?.unresolvedQuestions) ? reply.proposal.unresolvedQuestions : []).length ? (
                      <>
                        <div className="lovableCoachDraftTitle">{COACH_SCREEN_COPY.unresolvedTitle}</div>
                        <div className="lovableCoachDraftList">
                          {reply.proposal.unresolvedQuestions.map((question, index) => (
                            <div key={`${entry.id}-question-${index}`} className="lovableCoachDraftItem">
                              {question}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <div className="lovableCoachDraftActions">
                      <button
                        type="button"
                        className="lovableCoachDraftAction"
                        disabled={reply?.createStatus === "creating" || reply?.createStatus === "created"}
                        onClick={() => controller.createFromPlanReply(entry)}
                      >
                        {reply?.createStatus === "created"
                          ? COACH_SCREEN_COPY.created
                          : reply?.createStatus === "creating"
                            ? COACH_SCREEN_COPY.creating
                            : COACH_SCREEN_COPY.create}
                      </button>
                      <button
                        type="button"
                        className="lovableCoachDraftSecondary"
                        disabled={reply?.createStatus === "creating"}
                        onClick={() => controller.openAssistantReview(entry)}
                      >
                        {COACH_SCREEN_COPY.reviewInApp}
                      </button>
                    </div>
                    {entry.draftApplyMessage ? <div className="lovableCoachError">{entry.draftApplyMessage}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {controller.loading ? (
            <div className="lovableCard lovableCoachBubble is-assistant">
              <div className="lovableCoachEyebrow">{COACH_SCREEN_COPY.assistantEyebrow}</div>
              <p className="lovableCoachText">{controller.loadingStageLabel || COACH_SCREEN_COPY.thinking}</p>
            </div>
          ) : null}
        </div>

        <div ref={dockRef} className="coachSurfaceDock">
          <CoachWorkTray
            visible={Boolean(controller.activeWorkIntent)}
            modeLabel={
              controller.conversationMode === "plan"
                ? COACH_SCREEN_COPY.structuringModeLabel
                : COACH_SCREEN_COPY.chatModeLabel
            }
            intentLabel={controller.activeWorkIntent?.label || ""}
            intentText={controller.activeWorkIntent?.prefill || ""}
            canViewDraft={Boolean(latestProposalEntry)}
            canReenterStructuring={canReenterStructuring}
            onViewDraft={() => {
              if (!latestProposalEntry?.id) return;
              proposalRefs.current.get(latestProposalEntry.id)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
              if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
              setHighlightedProposalEntryId(latestProposalEntry.id);
              highlightTimeoutRef.current = window.setTimeout(() => {
                setHighlightedProposalEntryId("");
              }, 1600);
            }}
            onReenterStructuring={() => controller.reenterStructuring()}
            onDismiss={() => controller.dismissWorkIntent()}
          />

          <div className="lovableCoachComposerWrap coachSurfaceComposerWrap">
            <div className={`lovableCard lovableCoachComposer coachSurfaceComposer${composerFocused ? " is-focused" : ""}`}>
              <button
                ref={handlePlusButtonRef}
                type="button"
                className="coachSurfaceComposerPlus"
                aria-label={COACH_SCREEN_COPY.composerPlusAriaLabel}
                onClick={() => {
                  const nextRect = plusButtonRef.current?.getBoundingClientRect?.() || null;
                  setComposerMenuAnchorRect(nextRect);
                  setComposerMenuOpen((current) => !current);
                }}
              >
                +
              </button>
              <textarea
                ref={textareaRef}
                className={`lovableCoachTextarea${composerFocused ? " is-focused" : ""}`}
                value={controller.draft}
                onChange={(event) => controller.setDraft(event.target.value)}
                onFocus={() => {
                  setComposerFocused(true);
                }}
                onBlur={() => setComposerFocused(false)}
                placeholder={COACH_SCREEN_COPY.placeholder}
                rows={1}
              />
              <button
                type="button"
                className="lovableCoachComposerSend"
                onClick={() => {
                  stickToBottomRef.current = true;
                  controller.submitMessage();
                }}
                disabled={controller.loading || !controller.draft.trim()}
                aria-label={COACH_SCREEN_COPY.sendAriaLabel}
              >
                ↗
              </button>
            </div>
            {controller.error ? <div className="lovableCoachError">{controller.error}</div> : null}
          </div>
        </div>
      </div>
      <CoachComposerMenu
        open={composerMenuOpen}
        anchorRect={composerMenuAnchorRect}
        anchorEl={composerMenuAnchorEl}
        onClose={() => setComposerMenuOpen(false)}
        onSelectStructuring={() => {
          setComposerMenuOpen(false);
          controller.startStructuringIntent();
          textareaRef.current?.focus?.();
        }}
        onSelectQuickCreate={() => {
          setComposerMenuOpen(false);
          controller.startQuickCreateIntent();
          textareaRef.current?.focus?.();
        }}
      />
    </AppScreen>
  );
}
