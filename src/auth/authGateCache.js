import { buildLocalUserDataKey } from "../data/userDataApi";
import { hasMeaningfulFirstRunState, isFirstRunDone } from "../features/first-run/firstRunModel";
import { loadState } from "../utils/storage";

function safeParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function summarizeCachedUi(ui) {
  const safeUi = ui && typeof ui === "object" ? ui : null;
  if (!safeUi) return null;
  const firstRun = safeUi.firstRunV1 && typeof safeUi.firstRunV1 === "object" ? safeUi.firstRunV1 : null;
  const hasLegacyOnboarding = typeof safeUi.onboardingCompleted === "boolean";
  if (!firstRun && !hasLegacyOnboarding) return null;
  return {
    firstRunDone: firstRun ? isFirstRunDone(safeUi) : null,
    onboardingCompleted: hasLegacyOnboarding ? safeUi.onboardingCompleted : null,
    hasMeaningfulFirstRun: hasMeaningfulFirstRunState(firstRun),
  };
}

export function readCachedFirstRunSummary(userId) {
  if (typeof window === "undefined") return null;
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return summarizeCachedUi(loadState()?.ui);

  const cached = safeParse(window.localStorage.getItem(buildLocalUserDataKey(normalizedUserId)));
  return summarizeCachedUi(cached?.ui);
}
