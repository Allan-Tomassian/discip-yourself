import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppScreen } from "../shared/ui/app";
import { useCoachConversationController } from "../features/coach/coachPanelController";
import { COACH_SCREEN_COPY } from "../ui/labels";

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
  const composerRef = useRef(null);
  const textareaRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const [pageHeight, setPageHeight] = useState(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
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
    const node = composerRef.current;
    if (!node) return;
    const measure = () => setComposerHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [composerFocused, controller.draft, controller.error]);

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
  }, [composerHeight, controller.loading, controller.messageEntries.length, scrollToBottom, viewportHeight]);

  const introText = useMemo(
    () => COACH_SCREEN_COPY.introMessage.replace("{name}", profileName),
    [profileName]
  );

  return (
    <AppScreen pageId="coach" headerTitle={COACH_SCREEN_COPY.title} headerSubtitle={COACH_SCREEN_COPY.subtitle}>
      <div
        ref={pageRef}
        className="lovablePage lovableCoachPage"
        style={{
          "--coach-page-height": pageHeight ? `${pageHeight}px` : undefined,
          "--coach-composer-height": composerHeight ? `${composerHeight}px` : undefined,
        }}
      >
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
                  onClick={() => controller.submitMessage(prompt)}
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
              <p className="lovableCoachText">{controller.loadingStageLabel || COACH_SCREEN_COPY.thinking}</p>
            </div>
          ) : null}
        </div>

        <div ref={composerRef} className="lovableCoachComposerWrap">
          <div className={`lovableCard lovableCoachComposer${composerFocused ? " is-focused" : ""}`}>
            <textarea
              ref={textareaRef}
              className={`lovableCoachTextarea${composerFocused ? " is-focused" : ""}`}
              value={controller.draft}
              onChange={(event) => controller.setDraft(event.target.value)}
              onFocus={() => {
                setComposerFocused(true);
                stickToBottomRef.current = true;
                window.requestAnimationFrame(() => scrollToBottom("smooth"));
              }}
              onBlur={() => setComposerFocused(false)}
              placeholder={COACH_SCREEN_COPY.placeholder}
              rows={1}
            />
            <button
              type="button"
              className="lovableCoachComposerSend"
              onClick={() => controller.submitMessage()}
              disabled={controller.loading || !controller.draft.trim()}
              aria-label={COACH_SCREEN_COPY.sendAriaLabel}
            >
              ↗
            </button>
          </div>
          {controller.error ? <div className="lovableCoachError">{controller.error}</div> : null}
        </div>
      </div>
    </AppScreen>
  );
}
