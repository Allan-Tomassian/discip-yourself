import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BottomNavigation from "./BottomNavigation";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("bottom navigation command DA contract", () => {
  it("keeps canonical labels, route ids, and compatibility selectors", () => {
    const source = readSrc("components/navigation/BottomNavigation.jsx");

    expect(source).toContain('id: "objectives"');
    expect(source).toContain('id: "timeline"');
    expect(source).toContain('id: "today"');
    expect(source).toContain('id: "coach"');
    expect(source).toContain('id: "adjust"');
    expect(source).toContain('label: "Objectifs"');
    expect(source).toContain('label: "Planning"');
    expect(source).toContain('label: "Home"');
    expect(source).toContain('label: "Coach IA"');
    expect(source).toContain('label: "Ajuster"');
    expect(source).toContain("lovableTabButton");
    expect(source).toContain("is-home");
    expect(source).toContain("is-ai");
    expect(source).toContain("has-signal");
    expect(source).toContain("data-nav-tab={tab.id}");
    expect(source).toContain("CommandBottomNavigation");
    expect(source).toContain("CommandBottomNavigation__bar");
  });

  it("maps Home to execution green, Coach IA to AI purple, and other tabs to neutral", () => {
    const css = readSrc("styles/lovable.css");

    expect(css).toContain(".lovableTabButton.is-home");
    expect(css).toContain("var(--command-execution");
    expect(css).toContain(".lovableTabButton.is-ai");
    expect(css).toContain("var(--command-ai");
    expect(css).toContain("var(--command-neutral");
    expect(css).toContain(".lovableTabBar::before");
    expect(css).toContain("backdrop-filter: blur(22px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the fixed wrapper structural and the dock bar as the single glass layer", () => {
    const css = readSrc("styles/lovable.css");
    const wrapperStart = css.indexOf(".lovableTabBarWrap {");
    const wrapperEnd = css.indexOf("html[data-active-tab=\"today\"] .lovableTabBarWrap", wrapperStart);
    const wrapperCss = css.slice(wrapperStart, wrapperEnd);
    const barStart = css.indexOf(".lovableTabBar {");
    const barEnd = css.indexOf(".lovableTabBar::before", barStart);
    const barCss = css.slice(barStart, barEnd);

    expect(wrapperCss).toContain("position: fixed;");
    expect(wrapperCss).toContain("pointer-events: none;");
    expect(wrapperCss).toContain("background: transparent;");
    expect(wrapperCss).not.toContain("border-top");
    expect(wrapperCss).not.toContain("box-shadow");
    expect(wrapperCss).not.toContain("backdrop-filter");
    expect(css).not.toContain(".lovableTabBarWrap::before");
    expect(barCss).toContain("backdrop-filter: blur(22px)");
    expect(barCss).toContain("box-shadow:");
    expect(css).toContain(".lovableTabBar::before");
  });

  it("uses the Concept 2 home state and a local neural Coach icon direction", () => {
    const source = readSrc("components/navigation/BottomNavigation.jsx");
    const css = readSrc("styles/lovable.css");
    const html = renderToStaticMarkup(React.createElement(BottomNavigation, { activeTab: "coach" }));

    expect(source).toContain("function CoachNavIcon");
    expect(source).toContain("lovableCoachNavIcon");
    expect(source).not.toContain("BrainCircuit");
    expect(html).toContain("lovableCoachNavIcon");
    expect(css).toContain(".lovableTabButton.is-home.is-active::after");
    expect(css).toContain("border-radius: 19px");
    expect(css).toContain(".lovableTabButton.is-ai.is-active");
  });

  it("renders an unobtrusive Ajuster signal dot without changing labels or adding a number badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(BottomNavigation, {
        activeTab: "today",
        signalBadges: {
          adjust: {
            severity: "attention",
            label: "Signal d’ajustement disponible",
            signalType: "blocked_block",
          },
        },
      })
    );

    expect(html).toContain("Objectifs");
    expect(html).toContain("Planning");
    expect(html).toContain("Home");
    expect(html).toContain("Coach IA");
    expect(html).toContain("Ajuster");
    expect(html).toContain("Ajuster — Signal d’ajustement disponible");
    expect(html).toContain("lovableTabSignalDot is-attention");
    expect(html).toContain("has-signal");
    expect(html).not.toContain(">1<");
  });

  it("does not render a signal dot when no badge model is passed", () => {
    const html = renderToStaticMarkup(React.createElement(BottomNavigation, { activeTab: "today" }));

    expect(html).not.toContain("lovableTabSignalDot");
  });

  it("defines the badge with attention and critical tokens, not AI purple", () => {
    const css = readSrc("styles/lovable.css");
    const badgeStart = css.indexOf(".lovableTabSignalDot");
    const badgeEnd = css.indexOf(".lovableTabButtonLabel", badgeStart);
    const badgeCss = css.slice(badgeStart, badgeEnd);

    expect(badgeCss).toContain("var(--command-attention");
    expect(badgeCss).toContain("var(--command-critical");
    expect(badgeCss).not.toContain("var(--command-ai");
  });
});
