import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BEHAVIOR_FEEDBACK_COPY } from "../copy/behaviorFeedbackCopy";
import { BEHAVIOR_FEEDBACK_MOTION } from "./feedbackSignals";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

function flattenStrings(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((entry) => flattenStrings(entry));
}

describe("behavior feedback contract", () => {
  it("mounts a single shared provider and host in App", () => {
    const source = readSrc("App.jsx");

    expect(source).toContain("BehaviorFeedbackProvider");
    expect(source).toContain("BehaviorFeedbackHost");
  });

  it("keeps the feedback layer UI-only and detached from persisted reward systems", () => {
    const providerSource = readSrc("feedback/BehaviorFeedbackContext.jsx");
    const deriversSource = readSrc("feedback/feedbackDerivers.js");

    expect(providerSource).not.toContain("setData");
    expect(providerSource).not.toContain("useUserData");
    expect(providerSource).not.toContain("localStorage");
    expect(deriversSource).not.toMatch(/\b(walletV1|totemV1|rewardedAds|leaderboard|xp|rewards)\b/i);
    expect(readSrc("feedback/BehaviorFeedbackContext.jsx")).not.toMatch(/data\.ui\./);
  });

  it("keeps motion short and non-intrusive", () => {
    expect(BEHAVIOR_FEEDBACK_MOTION.enterMs).toBeLessThanOrEqual(300);
    expect(BEHAVIOR_FEEDBACK_MOTION.exitMs).toBeLessThanOrEqual(300);
    expect(BEHAVIOR_FEEDBACK_MOTION.visibleMs).toBeGreaterThanOrEqual(1900);
    expect(BEHAVIOR_FEEDBACK_MOTION.visibleMs).toBeLessThanOrEqual(2200);
  });

  it("keeps copy calm and non-gamified", () => {
    const strings = flattenStrings(BEHAVIOR_FEEDBACK_COPY);
    const joined = strings.join(" | ");

    expect(strings.length).toBeGreaterThan(0);
    expect(joined).not.toMatch(/[😀🙏🚀⭐🏆🎉🔥]/u);
    expect(joined).not.toMatch(/leaderboard|points?|score global|badge/i);
    expect(joined).not.toContain("!");
  });
});
