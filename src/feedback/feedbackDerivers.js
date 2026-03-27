import { BEHAVIOR_FEEDBACK_COPY, formatContinuityDaysLabel } from "../copy/behaviorFeedbackCopy";
import {
  BEHAVIOR_FEEDBACK_KIND,
  createBehaviorCue,
  createBehaviorFeedbackSignal,
} from "./feedbackSignals";

function safeNumber(value) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function deriveBehaviorFeedbackSignal({ intent = "", payload = {} } = {}) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const categoryId = typeof safePayload.categoryId === "string" ? safePayload.categoryId : null;
  const surface = typeof safePayload.surface === "string" ? safePayload.surface : null;
  const cooldownSuffix = categoryId || surface || "global";

  switch (String(intent || "").trim()) {
    case "create_action":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.structure,
        message: BEHAVIOR_FEEDBACK_COPY.structure.addedToStructure,
        categoryId,
        surface,
        cooldownKey: `create_action:${cooldownSuffix}`,
      });
    case "create_outcome":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.structure,
        message: BEHAVIOR_FEEDBACK_COPY.structure.objectiveAdded,
        categoryId,
        surface,
        cooldownKey: `create_outcome:${cooldownSuffix}`,
      });
    case "link_action":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.structure,
        message: BEHAVIOR_FEEDBACK_COPY.structure.addedToStructure,
        categoryId,
        surface,
        cooldownKey: `link_action:${cooldownSuffix}`,
      });
    case "plan_action":
    case "reschedule_action":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.immediate,
        message: BEHAVIOR_FEEDBACK_COPY.immediate.planningUpdated,
        categoryId,
        surface,
        cooldownKey: `planning:${cooldownSuffix}`,
      });
    case "set_priority":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.structure,
        message: BEHAVIOR_FEEDBACK_COPY.structure.priorityAligned,
        categoryId,
        surface,
        cooldownKey: `priority:${cooldownSuffix}`,
      });
    case "clarify_category":
    case "create_category":
    case "update_outcome":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.structure,
        message: BEHAVIOR_FEEDBACK_COPY.structure.structureClarified,
        categoryId,
        surface,
        cooldownKey: `structure:${cooldownSuffix}`,
      });
    case "update_action":
      return createBehaviorFeedbackSignal({
        kind: safePayload.planChanged ? BEHAVIOR_FEEDBACK_KIND.immediate : BEHAVIOR_FEEDBACK_KIND.structure,
        message: safePayload.planChanged
          ? BEHAVIOR_FEEDBACK_COPY.immediate.planningUpdated
          : BEHAVIOR_FEEDBACK_COPY.immediate.actionUpdated,
        categoryId,
        surface,
        cooldownKey: `update_action:${cooldownSuffix}:${safePayload.planChanged ? "plan" : "content"}`,
      });
    case "finish_session": {
      const streakDays = safeNumber(safePayload.streakDays);
      if (streakDays >= 2) {
        return createBehaviorFeedbackSignal({
          kind: BEHAVIOR_FEEDBACK_KIND.continuity,
          message: formatContinuityDaysLabel(streakDays),
          categoryId,
          surface,
          cooldownKey: `finish_session:${cooldownSuffix}:${streakDays}`,
          priority: 32,
        });
      }
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.immediate,
        message: BEHAVIOR_FEEDBACK_COPY.immediate.progressLogged,
        categoryId,
        surface,
        cooldownKey: `finish_session:${cooldownSuffix}`,
      });
    }
    case "complete_micro_action":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.immediate,
        message: BEHAVIOR_FEEDBACK_COPY.immediate.done,
        categoryId,
        surface,
        cooldownKey: `micro:${cooldownSuffix}`,
      });
    case "apply_coach_draft":
      return createBehaviorFeedbackSignal({
        kind: BEHAVIOR_FEEDBACK_KIND.structure,
        message: BEHAVIOR_FEEDBACK_COPY.immediate.structureUpdated,
        categoryId,
        surface,
        cooldownKey: `coach_draft:${cooldownSuffix}`,
      });
    default:
      return null;
  }
}

export function deriveTodayBehaviorCue({
  disciplineSummary,
  coreProgress,
  activeCategory,
  profileSummary,
} = {}) {
  const keptDays = safeNumber(disciplineSummary?.habitDaysKept14);
  if (keptDays >= 2) {
    return createBehaviorCue({
      cueKind: "continuity",
      message: formatContinuityDaysLabel(keptDays),
    });
  }
  if (safeNumber(coreProgress?.total) > 0 && safeNumber(disciplineSummary?.ratio) >= 0.72) {
    return createBehaviorCue({
      cueKind: "continuity",
      message: BEHAVIOR_FEEDBACK_COPY.continuity.steadyRhythm,
    });
  }
  if (profileSummary?.currentPriority || activeCategory?.mainGoalId) {
    return createBehaviorCue({
      cueKind: "structure",
      message: "Aligné avec ta priorité active",
    });
  }
  return null;
}

export function derivePlanningBehaviorCue({
  planningView = "day",
  dayItems = [],
  dayMinutes = 0,
  weekBuckets = [],
  activeCategoryId = null,
} = {}) {
  const structuredDays = (Array.isArray(weekBuckets) ? weekBuckets : []).filter(
    (bucket) => Array.isArray(bucket?.items) && bucket.items.length > 0
  ).length;
  if (planningView === "week" && structuredDays >= 3) {
    return createBehaviorCue({
      cueKind: "momentum",
      message: BEHAVIOR_FEEDBACK_COPY.momentum.weekStructured,
    });
  }
  if ((Array.isArray(dayItems) ? dayItems.length : 0) > 0 && safeNumber(dayMinutes) >= 30) {
    return createBehaviorCue({
      cueKind: "momentum",
      message: "Bloc crédible en place",
    });
  }
  if ((Array.isArray(dayItems) ? dayItems.length : 0) > 0 && activeCategoryId) {
    return createBehaviorCue({
      cueKind: "structure",
      message: BEHAVIOR_FEEDBACK_COPY.momentum.planningAligned,
    });
  }
  return null;
}

export function derivePilotageBehaviorCue({
  disciplineTrend,
  constanceSummary,
  selectedCategory,
} = {}) {
  const trendLabel = disciplineTrend?.summary?.trendLabel || "";
  const currentScore = safeNumber(disciplineTrend?.summary?.currentScore);
  const activeDays = safeNumber(constanceSummary?.activeDays7);

  if (trendLabel === "hausse") {
    return createBehaviorCue({
      cueKind: "continuity",
      message: BEHAVIOR_FEEDBACK_COPY.continuity.steadyProgress,
    });
  }
  if (trendLabel === "stable" && currentScore >= 70) {
    return createBehaviorCue({
      cueKind: "continuity",
      message: BEHAVIOR_FEEDBACK_COPY.continuity.steadyRhythm,
    });
  }
  if (activeDays >= 2) {
    return createBehaviorCue({
      cueKind: "continuity",
      message: BEHAVIOR_FEEDBACK_COPY.continuity.continuityActive,
    });
  }
  if (selectedCategory?.mainGoalId) {
    return createBehaviorCue({
      cueKind: "structure",
      message: "Structure en progression",
    });
  }
  return null;
}

export function deriveSessionBehaviorCue({ viewState = "idle", plannedMinutes = 0, categoryId = null } = {}) {
  if (viewState === "running") {
    return createBehaviorCue({
      cueKind: "momentum",
      message: BEHAVIOR_FEEDBACK_COPY.momentum.structureActive,
    });
  }
  if (viewState === "paused") {
    return createBehaviorCue({
      cueKind: "momentum",
      message: BEHAVIOR_FEEDBACK_COPY.momentum.coherentBlock,
    });
  }
  if (viewState === "idle" && categoryId && safeNumber(plannedMinutes) > 0) {
    return createBehaviorCue({
      cueKind: "momentum",
      message: BEHAVIOR_FEEDBACK_COPY.momentum.blockReady,
    });
  }
  return null;
}

export function deriveLibraryBehaviorCue({
  category,
  outcomeCount = 0,
  processCount = 0,
  hasProfile = false,
} = {}) {
  if (category?.mainGoalId && safeNumber(processCount) > 0) {
    return createBehaviorCue({
      cueKind: "structure",
      message: BEHAVIOR_FEEDBACK_COPY.structure.structureCoherent,
    });
  }
  if (hasProfile || safeNumber(outcomeCount) > 0 || safeNumber(processCount) > 0) {
    return createBehaviorCue({
      cueKind: "structure",
      message: BEHAVIOR_FEEDBACK_COPY.structure.systemReadable,
    });
  }
  return null;
}
