import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppScreen } from "../shared/ui/app";
import CoachComposerMenu from "../features/coach/CoachComposerMenu";
import { useCoachConversationController } from "../features/coach/coachPanelController";
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
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const textareaRef = useRef(null);
  const plusButtonRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingInitialBottomSyncRef = useRef(true);
  const [composerFocused, setComposerFocused] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [composerMenuAnchorEl, setComposerMenuAnchorEl] = useState(null);
  const [composerMenuAnchorRect, setComposerMenuAnchorRect] = useState(null);
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
  const activeConversationKey = controller.activeConversationId || "__coach-empty__";

  const scrollToBottom = useCallback((behavior = "auto") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const minHeight = 48;
    const maxHeight = 136;
    textarea.style.height = "0px";
    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [controller.draft]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    if (composerFocused) {
      root.dataset.coachComposerFocused = "true";
    } else {
      delete root.dataset.coachComposerFocused;
    }
    return () => {
      delete root.dataset.coachComposerFocused;
    };
  }, [composerFocused]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    if (composerMenuOpen) {
      root.dataset.coachComposerMenuOpen = "true";
    } else {
      delete root.dataset.coachComposerMenuOpen;
    }
    return () => {
      delete root.dataset.coachComposerMenuOpen;
    };
  }, [composerMenuOpen]);

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
    pendingInitialBottomSyncRef.current = true;
    stickToBottomRef.current = true;
  }, [activeConversationKey]);

  useLayoutEffect(() => {
    if (!pendingInitialBottomSyncRef.current) return undefined;
    const node = scrollRef.current;
    if (!node) return undefined;
    let frameA = 0;
    let frameB = 0;
    let settleTimer = 0;
    let observer = null;

    const finalize = () => {
      stickToBottomRef.current = true;
      pendingInitialBottomSyncRef.current = false;
    };

    const scheduleBottomSync = () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
      window.clearTimeout(settleTimer);
      frameA = window.requestAnimationFrame(() => {
        frameB = window.requestAnimationFrame(() => {
          scrollToBottom("auto");
          settleTimer = window.setTimeout(finalize, 120);
        });
      });
    };

    scheduleBottomSync();

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (!pendingInitialBottomSyncRef.current) return;
        scheduleBottomSync();
      });
      observer.observe(node);
    }

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
      window.clearTimeout(settleTimer);
      observer?.disconnect();
    };
  }, [activeConversationKey, controller.hasMessages, controller.loading, controller.messageEntries.length, scrollToBottom]);

  useLayoutEffect(() => {
    if (pendingInitialBottomSyncRef.current || !stickToBottomRef.current) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom(controller.messageEntries.length > 0 ? "smooth" : "auto");
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [controller.loading, controller.messageEntries.length, scrollToBottom]);

  const introText = useMemo(
    () => COACH_SCREEN_COPY.introMessage.replace("{name}", profileName),
    [profileName]
  );

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const handleCloseComposerMenu = useCallback(() => {
    setComposerMenuOpen(false);
    setComposerMenuAnchorEl(null);
    setComposerMenuAnchorRect(null);
  }, []);

  const handleSelectStructuring = useCallback(() => {
    handleCloseComposerMenu();
    controller.startStructuringIntent();
    focusComposer();
  }, [controller, focusComposer, handleCloseComposerMenu]);

  const handleSelectQuickCreate = useCallback(() => {
    handleCloseComposerMenu();
    controller.startQuickCreateIntent();
    focusComposer();
  }, [controller, focusComposer, handleCloseComposerMenu]);

  const handleToggleComposerMenu = useCallback(() => {
    if (composerMenuOpen) {
      handleCloseComposerMenu();
      return;
    }

    const node = plusButtonRef.current;
    if (!node) return;

    setComposerMenuAnchorEl(node);
    setComposerMenuAnchorRect(node.getBoundingClientRect());
    setComposerMenuOpen(true);
  }, [composerMenuOpen, handleCloseComposerMenu]);

  return (
    <AppScreen pageId="coach" headerTitle={COACH_SCREEN_COPY.title} headerSubtitle={COACH_SCREEN_COPY.subtitle}>
      <div className="lovablePage lovableCoachPage">
        <div ref={scrollRef} className="lovableCoachMessages">
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
                <p className="lovableCoachText coachSurfaceMessageText">{entry.displayText}</p>

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
                  <div className="lovableCard lovableCoachDraft">
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
              <p className="lovableCoachText coachSurfaceMessageText">
                {controller.loadingStageLabel || COACH_SCREEN_COPY.thinking}
              </p>
            </div>
          ) : null}
        </div>

        <div ref={composerRef} className="lovableCoachComposerWrap">
          <div className={`lovableCard lovableCoachComposer${composerFocused ? " is-focused" : ""}`}>
            <button
              ref={plusButtonRef}
              type="button"
              className="coachSurfaceComposerPlus"
              aria-label={COACH_SCREEN_COPY.composerPlusAriaLabel}
              aria-haspopup="menu"
              aria-expanded={composerMenuOpen}
              onClick={handleToggleComposerMenu}
            >
              +
            </button>
            <textarea
              ref={textareaRef}
              className={`lovableCoachTextarea${composerFocused ? " is-focused" : ""}`}
              value={controller.draft}
              onChange={(event) => controller.setDraft(event.target.value)}
              onFocus={() => setComposerFocused(true)}
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
          <CoachComposerMenu
            open={composerMenuOpen}
            anchorRect={composerMenuAnchorRect}
            anchorEl={composerMenuAnchorEl}
            onClose={handleCloseComposerMenu}
            onSelectStructuring={handleSelectStructuring}
            onSelectQuickCreate={handleSelectQuickCreate}
          />
          {controller.error ? <div className="lovableCoachError">{controller.error}</div> : null}
        </div>
      </div>
    </AppScreen>
  );
}
