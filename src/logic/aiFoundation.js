import { uid } from "../utils/helpers";
import { addDaysLocal, minutesToTimeStr, parseTimeToMinutes, toLocalDateKey } from "../utils/datetime";
import { ensureWindowFromScheduleRules } from "./occurrencePlanner";
import { upsertOccurrence } from "./occurrences";
import { migrate, normalizeCategory, normalizeGoal } from "./state";
import {
  USER_AI_CATEGORY_META,
  USER_AI_TIME_BLOCK_WINDOWS,
  createDefaultUserAiProfile,
  normalizeUserAiProfile,
} from "../domain/userAiProfile";

const ORGANIZATION_TEMPLATE_ID = "ai_onboarding_planning";

const USER_AI_ACTION_TEMPLATES = Object.freeze({
  health: [
    { key: "primary", title: "Marcher 20 min", durationMinutes: 20, planningKind: "primary" },
    { key: "secondary", title: "Etirements 10 min", durationMinutes: 10, planningKind: "secondary" },
  ],
  business: [
    { key: "primary", title: "Travail prioritaire 30 min", durationMinutes: 30, planningKind: "primary" },
    { key: "secondary", title: "Clarifier prochaine etape 10 min", durationMinutes: 10, planningKind: "review" },
  ],
  learning: [
    { key: "primary", title: "Apprendre 25 min", durationMinutes: 25, planningKind: "primary" },
    { key: "secondary", title: "Prendre notes 10 min", durationMinutes: 10, planningKind: "review" },
  ],
  productivity: [
    { key: "primary", title: "Planifier journee 10 min", durationMinutes: 10, planningKind: "review" },
    { key: "secondary", title: "Revoir priorites 5 min", durationMinutes: 5, planningKind: "review" },
  ],
  personal: [
    { key: "primary", title: "Rangement rapide 15 min", durationMinutes: 15, planningKind: "secondary" },
    { key: "secondary", title: "Message important 10 min", durationMinutes: 10, planningKind: "secondary" },
  ],
  finance: [
    { key: "primary", title: "Revoir budget 15 min", durationMinutes: 15, planningKind: "review" },
    { key: "secondary", title: "Categoriser depenses 10 min", durationMinutes: 10, planningKind: "review" },
  ],
});

const BUDGET_TEMPLATES = Object.freeze({
  30: [10, 20],
  60: [10, 30, 20],
  90: [10, 35, 25, 20],
  120: [10, 35, 30, 25, 20],
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampTemplateDurations(budget) {
  const numericBudget = Number(budget);
  return Array.isArray(BUDGET_TEMPLATES[numericBudget]) ? [...BUDGET_TEMPLATES[numericBudget]] : [...BUDGET_TEMPLATES[60]];
}

function ensureOnboardingPlanningGoal({ nowIso, todayKey, categoryId, order, plannedBlock = null, goalId = uid() }) {
  const isPlanned = isPlainObject(plannedBlock);
  return normalizeGoal(
    {
      id: goalId,
      categoryId,
      title: "Planifier journee",
      type: "PROCESS",
      planType: "ACTION",
      status: "active",
      templateId: ORGANIZATION_TEMPLATE_ID,
      repeat: "daily",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      timeMode: isPlanned && plannedBlock.timeType === "fixed" ? "FIXED" : "NONE",
      anytimeFlexible: false,
      activeFrom: todayKey,
      activeTo: addDaysLocal(todayKey, 29),
      createdAt: nowIso,
      updatedAt: nowIso,
      durationMinutes: 10,
      sessionMinutes: 10,
      startTime: isPlanned && plannedBlock.timeType === "fixed" ? plannedBlock.start : "",
      reminderWindowStart: isPlanned ? plannedBlock.windowStart || "" : "",
      reminderWindowEnd: isPlanned ? plannedBlock.windowEnd || "" : "",
    },
    order
  );
}

function createGoalFromTemplate({ categoryId, template, todayKey, nowIso, order, plannedBlock = null }) {
  const isPlanned = isPlainObject(plannedBlock);
  const scheduleSeed = isPlanned
    ? {
        repeat: "daily",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        timeMode: plannedBlock.timeType === "fixed" ? "FIXED" : "NONE",
        anytimeFlexible: false,
        reminderWindowStart: plannedBlock.windowStart || "",
        reminderWindowEnd: plannedBlock.windowEnd || "",
        startTime: plannedBlock.timeType === "fixed" ? plannedBlock.start : "",
      }
    : {
        repeat: "daily",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        timeMode: "NONE",
        anytimeFlexible: true,
        reminderWindowStart: "",
        reminderWindowEnd: "",
        startTime: "",
      };

  return normalizeGoal(
    {
      id: uid(),
      categoryId,
      title: template.title,
      type: "PROCESS",
      planType: "ACTION",
      status: "active",
      templateId: `ai_${template.key}`,
      repeat: scheduleSeed.repeat,
      daysOfWeek: scheduleSeed.daysOfWeek,
      timeMode: scheduleSeed.timeMode,
      anytimeFlexible: scheduleSeed.anytimeFlexible,
      startTime: scheduleSeed.startTime,
      reminderWindowStart: scheduleSeed.reminderWindowStart,
      reminderWindowEnd: scheduleSeed.reminderWindowEnd,
      activeFrom: todayKey,
      activeTo: addDaysLocal(todayKey, 29),
      createdAt: nowIso,
      updatedAt: nowIso,
      durationMinutes: template.durationMinutes,
      sessionMinutes: template.durationMinutes,
    },
    order
  );
}

function buildTimeBlockSequence(preferredTimeBlocks, blockCount) {
  const safeBlocks = Array.isArray(preferredTimeBlocks) && preferredTimeBlocks.length ? preferredTimeBlocks : ["morning"];
  const sequence = [];
  for (let index = 0; index < blockCount; index += 1) {
    sequence.push(safeBlocks[index % safeBlocks.length]);
  }
  return sequence;
}

function resolveTimeType({ intensityPreference, structurePreference, blockIndex }) {
  if (intensityPreference === "light") return "window";
  if (structurePreference === "simple") return "window";
  if (structurePreference === "structured") return blockIndex === 0 ? "fixed" : "window";
  return "fixed";
}

function computeFixedStart({ blockId, durationMinutes, counters }) {
  const blockWindow = USER_AI_TIME_BLOCK_WINDOWS[blockId] || USER_AI_TIME_BLOCK_WINDOWS.morning;
  const anchorMinutes = parseTimeToMinutes(blockWindow.anchor);
  const windowEndMinutes = parseTimeToMinutes(blockWindow.windowEnd);
  const currentCount = Number.isFinite(counters[blockId]) ? counters[blockId] : 0;
  const proposedStart = anchorMinutes + currentCount;
  const safeDuration = Math.max(5, Math.round(durationMinutes || 5));
  if (!Number.isFinite(anchorMinutes) || !Number.isFinite(windowEndMinutes)) {
    return { start: "", windowStart: blockWindow.windowStart, windowEnd: blockWindow.windowEnd };
  }
  if (proposedStart + safeDuration > windowEndMinutes) {
    return { start: "", windowStart: blockWindow.windowStart, windowEnd: blockWindow.windowEnd };
  }
  counters[blockId] = currentCount + safeDuration + 15;
  return {
    start: minutesToTimeStr(proposedStart),
    windowStart: blockWindow.windowStart,
    windowEnd: blockWindow.windowEnd,
  };
}

function buildPlannedBlocks({ profile, todayKey }) {
  const normalizedProfile = normalizeUserAiProfile(profile);
  const durations = clampTemplateDurations(normalizedProfile.time_budget_daily_min);
  const blockIds = buildTimeBlockSequence(normalizedProfile.preferred_time_blocks, durations.length);
  const counters = {};
  return durations.map((durationMinutes, index) => {
    const blockId = blockIds[index];
    const timeType = resolveTimeType({
      intensityPreference: normalizedProfile.intensity_preference,
      structurePreference: normalizedProfile.structure_preference,
      blockIndex: index,
    });
    const placement = computeFixedStart({ blockId, durationMinutes, counters });
    return {
      index,
      dateKey: todayKey,
      durationMinutes,
      blockId,
      timeType: timeType === "fixed" && placement.start ? "fixed" : "window",
      start: placement.start,
      windowStart: placement.windowStart,
      windowEnd: placement.windowEnd,
    };
  });
}

function sortTemplatesForIntensity(entries, intensityPreference) {
  const isLight = intensityPreference === "light";
  const isIntense = intensityPreference === "intense";
  return [...entries].sort((left, right) => {
    if (left.template.planningKind !== right.template.planningKind) {
      if (isLight) {
        const leftScore = left.template.planningKind === "secondary" || left.template.planningKind === "review" ? 0 : 1;
        const rightScore = right.template.planningKind === "secondary" || right.template.planningKind === "review" ? 0 : 1;
        if (leftScore !== rightScore) return leftScore - rightScore;
      }
      if (isIntense) {
        const leftScore = left.template.planningKind === "primary" ? 0 : 1;
        const rightScore = right.template.planningKind === "primary" ? 0 : 1;
        if (leftScore !== rightScore) return leftScore - rightScore;
      }
    }
    if (left.template.durationMinutes !== right.template.durationMinutes) {
      return isLight
        ? left.template.durationMinutes - right.template.durationMinutes
        : right.template.durationMinutes - left.template.durationMinutes;
    }
    return String(left.template.title).localeCompare(String(right.template.title));
  });
}

function assignBlocksToTemplates({ categories, templatesByCategory, planningGoal, profile, todayKey }) {
  const normalizedProfile = normalizeUserAiProfile(profile);
  const blocks = buildPlannedBlocks({ profile: normalizedProfile, todayKey });
  const blockAssignments = [];
  const categoryOrder = categories.map((category) => category.goalId);
  const cycleIndexes = new Map(categoryOrder.map((goalId) => [goalId, 0]));
  const byCategorySorted = new Map(
    templatesByCategory.map(({ goalId, entries }) => [goalId, sortTemplatesForIntensity(entries, normalizedProfile.intensity_preference)])
  );

  if (blocks.length) {
    blockAssignments.push({
      ...blocks[0],
      templateEntry: {
        categoryId: planningGoal.categoryId,
        goalId: planningGoal.id,
        template: {
          key: "planning",
          title: planningGoal.title,
          durationMinutes: 10,
          planningKind: "review",
        },
      },
      isOrganizationBlock: true,
    });
  }

  for (let blockIndex = 1; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const categoryGoalId = categoryOrder[(blockIndex - 1) % Math.max(1, categoryOrder.length)] || categories[0]?.goalId;
    const entries = byCategorySorted.get(categoryGoalId) || [];
    const nextIndex = cycleIndexes.get(categoryGoalId) || 0;
    const entry = entries[nextIndex % Math.max(1, entries.length)] || entries[0] || null;
    cycleIndexes.set(categoryGoalId, nextIndex + 1);
    if (!entry) continue;
    blockAssignments.push({
      ...block,
      templateEntry: entry,
      isOrganizationBlock: false,
    });
  }

  return blockAssignments;
}

function buildWindowOccurrencePatch({ block }) {
  return {
    start: "00:00",
    slotKey: "00:00",
    timeType: "window",
    noTime: true,
    windowStartAt: `${block.dateKey}T${block.windowStart || "00:00"}`,
    windowEndAt: `${block.dateKey}T${block.windowEnd || "23:59"}`,
    startAt: "",
    endAt: "",
  };
}

function buildFixedOccurrencePatch({ block }) {
  const safeStart = block.start || "08:00";
  const startMinutes = parseTimeToMinutes(safeStart);
  const safeDuration = Math.max(5, Math.round(block.durationMinutes || 5));
  const endMinutes = Number.isFinite(startMinutes) ? startMinutes + safeDuration : null;
  return {
    start: safeStart,
    slotKey: safeStart,
    timeType: "fixed",
    noTime: false,
    startAt: `${block.dateKey}T${safeStart}`,
    endAt: Number.isFinite(endMinutes) ? `${block.dateKey}T${minutesToTimeStr(endMinutes)}` : "",
    windowStartAt: "",
    windowEndAt: "",
  };
}

function applyPlannedOccurrences({ state, assignments, todayKey }) {
  const seededGoalIds = new Set(assignments.map((assignment) => assignment.templateEntry?.goalId || null).filter(Boolean));
  let nextOccurrences = Array.isArray(state.occurrences)
    ? state.occurrences.filter((occurrence) => {
        if (!occurrence || occurrence.date !== todayKey) return true;
        if (!seededGoalIds.has(occurrence.goalId)) return true;
        return occurrence.status !== "planned";
      })
    : [];
  const goals = Array.isArray(state.goals) ? state.goals : [];

  assignments.forEach((assignment) => {
    const goalId = assignment.templateEntry?.goalId || null;
    if (!goalId) return;
    const occurrencePatch =
      assignment.timeType === "fixed"
        ? buildFixedOccurrencePatch({ block: assignment })
        : buildWindowOccurrencePatch({ block: assignment });
    nextOccurrences = upsertOccurrence(
      goalId,
      todayKey,
      occurrencePatch.start,
      assignment.durationMinutes,
      {
        ...occurrencePatch,
        durationMinutes: assignment.durationMinutes,
        status: "planned",
      },
      { occurrences: nextOccurrences, goals }
    );
  });

  return {
    ...state,
    occurrences: nextOccurrences,
  };
}

function buildCategorySeed({ goalIds, nowIso }) {
  return goalIds.map((goalId, index) => {
    const meta = USER_AI_CATEGORY_META[goalId] || USER_AI_CATEGORY_META.health;
    return normalizeCategory(
      {
        id: uid(),
        name: meta.label,
        color: meta.color,
        createdAt: nowIso,
      },
      index
    );
  });
}

export function buildInitialAiFoundationState(state, rawProfile, now = new Date()) {
  const baseState = isPlainObject(state) ? state : {};
  const nowIso = now.toISOString();
  const todayKey = toLocalDateKey(now);
  const profile = createDefaultUserAiProfile({
    ...rawProfile,
    created_at: nowIso,
    updated_at: nowIso,
  });
  const categorySeeds = buildCategorySeed({ goalIds: profile.goals, nowIso });
  const firstCategoryId = categorySeeds[0]?.id || null;
  const planningGoal = ensureOnboardingPlanningGoal({
    nowIso,
    todayKey,
    categoryId: firstCategoryId,
    order: 0,
  });

  const templateEntries = [];
  const goals = [];
  let order = 1;
  for (const category of categorySeeds) {
    const goalId = Object.keys(USER_AI_CATEGORY_META).find((key) => USER_AI_CATEGORY_META[key].label === category.name) || null;
    const templates = USER_AI_ACTION_TEMPLATES[goalId] || [];
    templates.forEach((template) => {
      templateEntries.push({
        categoryId: category.id,
        categoryGoalId: goalId,
        template,
      });
    });
  }

  const groupedTemplates = categorySeeds.map((category) => {
    const goalId = Object.keys(USER_AI_CATEGORY_META).find((key) => USER_AI_CATEGORY_META[key].label === category.name) || null;
    const entries = templateEntries
      .filter((entry) => entry.categoryId === category.id)
      .map((entry) => ({
        ...entry,
        goalId: null,
      }));
    return {
      categoryId: category.id,
      goalId,
      entries,
    };
  });

  const preliminaryAssignments = assignBlocksToTemplates({
    categories: groupedTemplates.map((group) => ({ goalId: group.goalId })),
    templatesByCategory: groupedTemplates,
    planningGoal,
    profile,
    todayKey,
  });

  const assignmentsByTemplateKey = new Map();
  preliminaryAssignments.forEach((assignment) => {
    const templateKey = assignment.templateEntry?.template?.key || null;
    const categoryGoalId = assignment.templateEntry?.categoryGoalId || null;
    const assignmentKey = categoryGoalId && templateKey ? `${categoryGoalId}:${templateKey}` : templateKey;
    if (!assignmentKey) return;
    const current = assignmentsByTemplateKey.get(assignmentKey) || [];
    current.push(assignment);
    assignmentsByTemplateKey.set(assignmentKey, current);
  });

  const groupedTemplatesWithGoals = groupedTemplates.map((group) => {
    const entries = group.entries.map((entry) => {
      const assignmentKey = `${group.goalId}:${entry.template.key}`;
      const plannedAssignments = assignmentsByTemplateKey.get(assignmentKey) || [];
      const goal = createGoalFromTemplate({
        categoryId: group.categoryId,
        template: entry.template,
        todayKey,
        nowIso,
        order,
        plannedBlock: plannedAssignments[0] || null,
      });
      order += 1;
      goals.push(goal);
      return {
        ...entry,
        goalId: goal.id,
      };
    });
    return {
      ...group,
      entries,
    };
  });

  const assignments = assignBlocksToTemplates({
    categories: groupedTemplatesWithGoals.map((group) => ({ goalId: group.goalId })),
    templatesByCategory: groupedTemplatesWithGoals,
    planningGoal,
    profile,
    todayKey,
  });
  const scheduledPlanningGoal = ensureOnboardingPlanningGoal({
    nowIso,
    todayKey,
    categoryId: firstCategoryId,
    order: 0,
    plannedBlock: assignments[0] || null,
    goalId: planningGoal.id,
  });

  const nextStateBase = migrate({
    ...baseState,
    user_ai_profile: profile,
    categories: categorySeeds,
    goals: [scheduledPlanningGoal, ...goals],
    scheduleRules: [],
    occurrences: [],
    ui: {
      ...(baseState.ui || {}),
      onboardingCompleted: true,
      onboardingSeenVersion: 3,
      onboardingStep: 5,
      selectedCategoryId: firstCategoryId,
      selectedDate: todayKey,
      selectedDateKey: todayKey,
      selectedCategoryByView: {
        ...(baseState.ui?.selectedCategoryByView || {}),
        home: firstCategoryId,
        library: firstCategoryId,
        plan: firstCategoryId,
        pilotage: firstCategoryId,
      },
      showPlanStep: false,
    },
  });

  const plannedGoalIds = new Set(
    assignments
      .map((assignment) => assignment.templateEntry?.goalId || null)
      .filter(Boolean)
  );
  plannedGoalIds.add(scheduledPlanningGoal.id);

  let nextState = ensureWindowFromScheduleRules(
    nextStateBase,
    todayKey,
    todayKey,
    Array.from(plannedGoalIds),
    now
  );
  nextState = applyPlannedOccurrences({
    state: nextState,
    assignments,
    todayKey,
  });

  return migrate({
    ...nextState,
    user_ai_profile: {
      ...profile,
      updated_at: nowIso,
    },
  });
}

export function isAiFoundationPlanningGoal(goal) {
  return goal?.templateId === ORGANIZATION_TEMPLATE_ID;
}

export function hasUserAiProfile(state) {
  return Boolean(state?.user_ai_profile && createDefaultUserAiProfile(state.user_ai_profile).goals.length > 0);
}
