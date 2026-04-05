import React, { useEffect, useMemo, useRef } from "react";
import { useBehaviorFeedback } from "../feedback/BehaviorFeedbackContext";
import { AppScreen } from "../shared/ui/app";
import { useCoachConversationController } from "../features/coach/CoachPanel";

function resolveName(profile) {
  const fullName = String(profile?.full_name || "").trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const username = String(profile?.username || "").trim();
  if (username) return username;
  return "there";
}

export default function Coach({
  data,
  setData,
  setTab,
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
  const scrollRef = useRef(null);
  const safeData = data && typeof data === "object" ? data : {};
  const profileName = resolveName(safeData.profile || {});
  const controller = useCoachConversationController({
    open: true,
    data,
    setData,
    setTab,
    surfaceTab: "coach",
    onRequestClose: null,
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

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [controller.loading, controller.messageEntries.length]);

  const introText = useMemo(
    () => `Hello ${profileName}. I'm your AI coach here to help you stay clear, focused, and moving forward.\n\nWhat's on your mind today?`,
    [profileName]
  );

  return (
    <AppScreen pageId="coach" headerTitle="AI Coach" headerSubtitle="Your strategic thinking partner">
      <div className="lovablePage lovableCoachPage">
        <div ref={scrollRef} className="lovableCoachMessages">
          <div className="lovableCard lovableCoachIntro">
            <div className="lovableCoachEyebrow">Coach</div>
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
                <div className="lovableCoachEyebrow">{entry.role === "assistant" ? "Coach" : "You"}</div>
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
                    <div className="lovableCoachDraftTitle">Plan Proposed</div>
                    <div className="lovableCoachDraftList">
                      {reply.proposal?.categoryDraft?.label || reply.proposal?.categoryDraft?.id ? (
                        <div className="lovableCoachDraftItem">
                          {`Category · ${reply.proposal.categoryDraft.label || reply.proposal.categoryDraft.id}`}
                        </div>
                      ) : null}
                      {reply.proposal?.outcomeDraft?.title ? (
                        <div className="lovableCoachDraftItem">
                          {`Objective · ${reply.proposal.outcomeDraft.title}`}
                        </div>
                      ) : null}
                      {(Array.isArray(reply.proposal?.actionDrafts) ? reply.proposal.actionDrafts : []).map((draftItem, index) => (
                        <div key={`${entry.id}-draft-${index}`} className="lovableCoachDraftItem">
                          {[
                            draftItem?.title || "Action",
                            draftItem?.oneOffDate || "",
                            draftItem?.startTime || "",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      ))}
                    </div>
                    <div className="lovableCoachDraftActions">
                      <button
                        type="button"
                        className="lovableCoachDraftAction"
                        disabled={reply?.createStatus === "creating" || reply?.createStatus === "created"}
                        onClick={() => controller.createFromPlanReply(entry)}
                      >
                        {reply?.createStatus === "created"
                          ? "Created"
                          : reply?.createStatus === "creating"
                            ? "Creating..."
                            : "Create"}
                      </button>
                      <button
                        type="button"
                        className="lovableCoachDraftSecondary"
                        disabled={reply?.createStatus === "creating"}
                        onClick={() => controller.openAssistantReview(entry)}
                      >
                        Review in app
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
              <div className="lovableCoachEyebrow">Coach</div>
              <p className="lovableCoachText">{controller.loadingStageLabel || "Thinking..."}</p>
            </div>
          ) : null}
        </div>

        <div className="lovableCoachComposerWrap">
          <div className="lovableCard lovableCoachComposer">
            <textarea
              className="lovableCoachTextarea"
              value={controller.draft}
              onChange={(event) => controller.setDraft(event.target.value)}
              placeholder="Ask your coach anything..."
              rows={2}
            />
            <button
              type="button"
              className="lovableCoachComposerSend"
              onClick={() => controller.submitMessage()}
              disabled={controller.loading || !controller.draft.trim()}
              aria-label="Send"
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
