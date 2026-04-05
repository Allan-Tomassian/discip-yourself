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
    expect(home).toContain("headerSubtitle={headerDateLabel}");
    expect(home).toContain("greetingPeriod");

    expect(objectives).toContain('pageId="objectives"');
    expect(objectives).toContain('headerTitle="Objectives"');

    expect(timeline).toContain('pageId="timeline"');
    expect(timeline).toContain('headerTitle="Timeline"');
    expect(timeline).toContain('headerSubtitle="Your roadmap to execution"');

    expect(insights).toContain('pageId="insights"');
    expect(insights).toContain('headerTitle="Insights"');
    expect(insights).toContain('headerSubtitle="Your trajectory this week"');

    expect(coach).toContain('pageId="coach"');
    expect(coach).toContain('headerTitle="AI Coach"');
  });
});
