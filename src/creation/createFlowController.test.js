import { describe, expect, it } from "vitest";
import {
  CREATE_FLOW_MODE_ACTION,
  CREATE_FLOW_MODE_PROJECT,
  applyCreateFlowDraftMeta,
  getDefaultCreationStepForMode,
  resolveCreateFlowPresentation,
  resolveLegacyCreateRouteIntent,
} from "./createFlowController";
import { STEP_HABITS, STEP_HABIT_TYPE, STEP_OUTCOME, STEP_OUTCOME_NEXT_ACTION } from "./creationSchema";

describe("createFlowController", () => {
  it("defaults action mode to the habit type entry step", () => {
    expect(getDefaultCreationStepForMode(CREATE_FLOW_MODE_ACTION)).toBe(STEP_HABIT_TYPE);
  });

  it("opens project mode on the outcome step", () => {
    expect(getDefaultCreationStepForMode(CREATE_FLOW_MODE_PROJECT)).toBe(STEP_OUTCOME);
  });

  it("derives the modal presentation from draft step and habit type", () => {
    const presentation = resolveCreateFlowPresentation({
      draft: {
        step: STEP_HABITS,
        habitType: "ANYTIME",
        mode: "action",
      },
    });

    expect(presentation).toEqual({
      step: "habit-anytime",
      choice: "action",
    });
  });

  it("keeps outcome-next-action reachable inside the unified host", () => {
    const presentation = resolveCreateFlowPresentation({
      draft: {
        step: STEP_OUTCOME_NEXT_ACTION,
        mode: "project",
      },
    });

    expect(presentation).toEqual({
      step: "outcome-next-action",
      choice: "project",
    });
  });

  it("stores source-aware flow metadata on drafts", () => {
    const draft = applyCreateFlowDraftMeta(
      {
        step: STEP_HABIT_TYPE,
        category: { mode: "existing", id: "c1" },
      },
      { mode: "guided", source: "planning" }
    );

    expect(draft.mode).toBe("guided");
    expect(draft.sourceContext).toEqual({ source: "planning", trigger: null });
    expect(draft.status).toBe("draft");
  });

  it("maps legacy create routes to modal intents instead of page flows", () => {
    expect(resolveLegacyCreateRouteIntent("create-goal")).toMatchObject({
      baseTab: "library",
      mode: "project",
      step: STEP_OUTCOME,
    });

    expect(resolveLegacyCreateRouteIntent("create-habit-recurring")).toMatchObject({
      baseTab: "library",
      mode: "action",
      step: STEP_HABITS,
      habitType: "RECURRING",
    });
  });
});
