import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("MainDrawer contract", () => {
  it("delegates document scroll locking and restore behavior to AppDrawer", () => {
    const source = readSrc("components/navigation/MainDrawer.jsx");
    const appUi = readSrc("shared/ui/app/AppUI.jsx");

    expect(source).toContain("<AppDrawer");
    expect(appUi).toContain("const scrollY = typeof window !== \"undefined\" ? window.scrollY || 0 : 0;");
    expect(appUi).toContain("body.style.position = \"fixed\";");
    expect(appUi).toContain("body.style.top = `-${scrollY}px`;");
    expect(appUi).toContain("window.scrollTo(0, scrollY);");
  });

  it("uses a dedicated drawerBody scroll container inside the shared drawer shell", () => {
    const source = readSrc("components/navigation/MainDrawer.jsx");
    const appUi = readSrc("shared/ui/app/AppUI.jsx");
    const navCss = readSrc("features/navigation/topMenuGate.css");

    expect(source).toContain("className=\"drawerBody\"");
    expect(source).toContain("className=\"drawerMenuBody\"");
    expect(appUi).toContain("GateMainSectionCard");
    expect(source).toContain("interactive");
    expect(source).toContain("className=\"drawerMenuGroup\"");
    expect(source).toContain("AppHeader");
    expect(source).toContain("AppIconButton");
    expect(source).not.toContain("style={{ gap: 18 }}");
    expect(source).not.toContain("small2");
    expect(source).not.toContain("GateSection");
    expect(source).not.toContain("GateSecondarySectionCard drawerMenuSection");
    expect(navCss).toContain(".drawerBody");
    expect(navCss).toContain("overflow-y: auto;");
    expect(navCss).toContain(".drawerBackdrop");
    expect(navCss).toContain("display: flex;");
    expect(navCss).toContain("height: 100dvh;");
    expect(navCss).toContain(".drawerMenuBody");
    expect(navCss).toContain(".drawerMenuGroup");
    expect(navCss).toContain(".drawerMenuItem");
    expect(navCss).toContain("padding: var(--space-12) var(--space-16);");
    expect(navCss).not.toContain("box-shadow: none;");
  });
});
