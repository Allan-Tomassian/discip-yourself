import { buildNowContext } from "./nowContext.js";
import { safeArray } from "./shared.js";

const AI_FOUNDATION_PLANNING_TEMPLATE_ID = "ai_onboarding_planning";

function isProcessGoal(goal) {
  if (!goal || typeof goal !== "object") return false;
  const type = typeof goal.type === "string" ? goal.type.toUpperCase() : "";
  const planType = typeof goal.planType === "string" ? goal.planType.toUpperCase() : "";
  return type === "PROCESS" || planType === "ACTION" || planType === "ONE_OFF";
}

function buildAvailableCategories(data) {
  return safeArray(data?.categories)
    .filter((category) => category?.id && category.id !== "sys_inbox" && category.system !== true)
    .map((category) => ({
      id: category.id,
      name: category.name || "Categorie",
      color: category.color || null,
    }))
    .slice(0, 12);
}

function buildActionSummaries(data, activeCategoryId) {
  const categoriesById = new Map(
    safeArray(data?.categories).filter((category) => category?.id).map((category) => [category.id, category])
  );
  const summaries = safeArray(data?.goals)
    .filter(
      (goal) =>
        goal?.id &&
        goal?.categoryId &&
        goal.categoryId !== "sys_inbox" &&
        goal.templateId !== AI_FOUNDATION_PLANNING_TEMPLATE_ID &&
        isProcessGoal(goal)
    )
    .map((goal) => ({
      actionId: goal.id,
      title: goal.title || "Action",
      categoryId: goal.categoryId,
      categoryName: categoriesById.get(goal.categoryId)?.name || null,
      durationMin: Number.isFinite(goal.durationMinutes)
        ? goal.durationMinutes
        : Number.isFinite(goal.sessionMinutes)
          ? goal.sessionMinutes
          : null,
      repeat: typeof goal.repeat === "string" ? goal.repeat : null,
    }))
    .sort((left, right) => {
      const leftActive = left.categoryId === activeCategoryId ? 0 : 1;
      const rightActive = right.categoryId === activeCategoryId ? 0 : 1;
      if (leftActive !== rightActive) return leftActive - rightActive;
      return String(left.title || "").localeCompare(String(right.title || ""));
    });

  return summaries.slice(0, 12);
}

function normalizeRecentMessages(recentMessages) {
  return safeArray(recentMessages)
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
    .map((entry) => ({
      role: entry.role,
      content: typeof entry.content === "string" ? entry.content.trim().slice(0, 500) : "",
    }))
    .filter((entry) => entry.content)
    .slice(-6);
}

export function buildChatContext({
  data,
  selectedDateKey,
  activeCategoryId,
  quotaState,
  requestId,
  body,
  now = new Date(),
}) {
  const baseContext = buildNowContext({
    data,
    selectedDateKey,
    activeCategoryId,
    quotaState,
    requestId,
    trigger: "manual",
    now,
  });
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";

  return {
    ...baseContext,
    message,
    messagePreview: message ? message.slice(0, 120) : null,
    recentMessages: normalizeRecentMessages(body?.recentMessages),
    availableCategories: buildAvailableCategories(data),
    actionSummaries: buildActionSummaries(data, activeCategoryId),
  };
}
