import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("mobile viewport contract", () => {
  it("locks the edge-to-edge shell, dynamic bottom clearance, and mobile-safe inputs", () => {
    const indexHtml = fs.readFileSync(path.resolve(SRC_ROOT, "..", "index.html"), "utf8");
    const indexCss = readSrc("index.css");
    const app = readSrc("App.jsx");
    const authGate = readSrc("auth/AuthGate.jsx");
    const profileGate = readSrc("profile/ProfileGate.jsx");
    const lovableCss = readSrc("styles/lovable.css");

    expect(indexHtml).toContain("viewport-fit=cover");

    expect(indexCss).toContain("--topbar-bottom: calc(var(--safe-top) + 24px);");
    expect(indexCss).toContain("--bottom-fixed-stack-space: 0px;");
    expect(indexCss).toContain(".appViewportFill{");
    expect(indexCss).toContain("padding-bottom:calc(120px + max(var(--safe-bottom), var(--bottom-fixed-stack-space, 0px)));");
    expect(indexCss).toContain("padding-top: calc(var(--safe-top) + var(--navGap, 10px) + var(--page-top-gap));");

    expect(app).toContain("const bottomRailRef = useRef(null);");
    expect(app).toContain('rootStyle.setProperty("--bottom-fixed-stack-space", "0px");');
    expect(app).toContain('rootStyle.setProperty("--bottom-fixed-stack-space", `${clearSpace}px`);');
    expect(app).toContain("root.dataset.activeTab = tab;");
    expect(app).toContain("<LovableTabBar");
    expect(app).toContain('className="appViewportFill"');
    expect(app).not.toContain('minHeight: "100vh"');
    expect(authGate).not.toContain('minHeight: "100vh"');
    expect(profileGate).not.toContain('minHeight: "100vh"');

    expect(lovableCss).toContain(".lovableTabBarWrap");
    expect(lovableCss).toContain("bottom: 0;");
    expect(lovableCss).toContain('html.keyboardOpen[data-active-tab="coach"] .lovableTabBarWrap');
    expect(lovableCss).toContain('[data-page-id="coach"] .container');
    expect(lovableCss).toContain('[data-page-id="coach"] .pageContent');
    expect(lovableCss).toContain('[data-page-id="coach"] .lovableCoachPage');
    expect(lovableCss).toContain('[data-page-id="coach"] .lovableCoachMessages');
    expect(lovableCss).toContain('[data-page-id="coach"] .lovableCoachComposerWrap');
    expect(lovableCss).toContain("-webkit-text-size-adjust: 100%;");
    expect(lovableCss).toContain("@supports (-webkit-touch-callout: none)");
    expect(lovableCss).toContain("flex: 0 0 auto;");
    expect(lovableCss).toContain("padding-bottom: calc(12px + max(var(--safe-bottom), var(--bottom-fixed-stack-space, 0px), 84px));");
    expect(lovableCss).toContain('html.keyboardOpen[data-active-tab="coach"] [data-page-id="coach"] .pageContent');
  });
});
