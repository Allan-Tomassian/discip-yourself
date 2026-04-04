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
    const bottomRailCss = readSrc("features/navigation/bottomCategoryBar.css");
    const coachCss = readSrc("features/coach/coach.css");
    const overlaysCss = readSrc("shared/ui/overlays/overlays.css");
    const gatePremiumCss = readSrc("shared/ui/gate/gate-premium.css");
    const totemDockCss = readSrc("ui/totem/totemDock.css");

    expect(indexHtml).toContain("viewport-fit=cover");

    expect(indexCss).toContain("--topbar-bottom: calc(var(--safe-top) + 74px);");
    expect(indexCss).toContain("--bottom-fixed-stack-space: 0px;");
    expect(indexCss).toContain(".appViewportFill{");
    expect(indexCss).toContain("padding-bottom:calc(32px + max(var(--safe-bottom), var(--bottom-fixed-stack-space, 0px)));");
    expect(indexCss).toContain("padding-bottom: calc(40px + max(var(--safe-bottom), var(--bottom-fixed-stack-space, 0px)));");
    expect(indexCss).toContain("padding-top: calc(var(--navGap, 10px) + var(--page-top-gap));");

    expect(app).toContain("const bottomRailRef = useRef(null);");
    expect(app).toContain('rootStyle.setProperty("--bottom-fixed-stack-space", "0px");');
    expect(app).toContain('rootStyle.setProperty("--bottom-fixed-stack-space", `${clearSpace}px`);');
    expect(app).toContain('className="appViewportFill"');
    expect(app).not.toContain('minHeight: "100vh"');
    expect(authGate).not.toContain('minHeight: "100vh"');
    expect(profileGate).not.toContain('minHeight: "100vh"');

    expect(bottomRailCss).toContain("bottom: calc(var(--space-12) + var(--safe-bottom));");
    expect(bottomRailCss).toContain("bottom: calc(var(--space-8) + var(--safe-bottom));");
    expect(coachCss).toContain("bottom: calc(var(--bottom-fixed-stack-space, 0px) + var(--space-8));");
    expect(overlaysCss).not.toContain(".ios .modalBackdrop");
    expect(gatePremiumCss).toContain("@media (hover: none) and (pointer: coarse)");
    expect(gatePremiumCss).toContain("font-size: 16px;");
    expect(totemDockCss).toContain("--totem-dock-anchor-x: calc(var(--safe-right) + 20px);");
    expect(totemDockCss).toContain("--totem-anchor-top: calc(var(--topbar-bottom, calc(var(--safe-top) + 74px)) - 6px);");
  });
});
