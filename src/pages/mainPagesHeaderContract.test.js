import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("main pages header contract", () => {
  it("keeps the five main pages on the Lovable header structure", () => {
    const home = readSrc("pages/Home.jsx");
    const objectives = readSrc("pages/Objectives.jsx");
    const timeline = readSrc("pages/Timeline.jsx");
    const insights = readSrc("pages/Insights.jsx");
    const coach = readSrc("pages/Coach.jsx");

    expect(home).toContain('pageId="today"');
    expect(home).toContain("<TodayHeader");
    expect(home).toContain("<FloatingWelcomeLine");
    expect(home).toContain("<TodayHero");

    expect(objectives).toContain('pageId="objectives"');
    expect(objectives).toContain("headerTitle={OBJECTIVES_SCREEN_COPY.title}");

    expect(timeline).toContain('pageId="timeline"');
    expect(timeline).toContain("headerTitle={TIMELINE_SCREEN_COPY.title}");
    expect(timeline).toContain("headerSubtitle={TIMELINE_SCREEN_COPY.subtitle}");

    expect(insights).toContain('pageId="insights"');
    expect(insights).toContain("headerTitle={INSIGHTS_SCREEN_COPY.title}");
    expect(insights).toContain("headerSubtitle={INSIGHTS_SCREEN_COPY.subtitle}");

    expect(coach).toContain('pageId="coach"');
    expect(coach).toContain("headerTitle={COACH_SCREEN_COPY.title}");
  });
});
