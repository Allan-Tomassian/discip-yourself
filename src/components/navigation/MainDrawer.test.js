import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("MainDrawer contract", () => {
  it("locks the document scroll and restores the previous position", () => {
    const source = readSrc("components/navigation/MainDrawer.jsx");

    expect(source).toContain("const scrollY = typeof window !== \"undefined\" ? window.scrollY || 0 : 0;");
    expect(source).toContain("body.style.position = \"fixed\";");
    expect(source).toContain("body.style.top = `-${scrollY}px`;");
    expect(source).toContain("window.scrollTo(0, scrollY);");
  });

  it("uses a dedicated drawerBody scroll container", () => {
    const source = readSrc("components/navigation/MainDrawer.jsx");
    const css = readSrc("index.css");
    const navCss = readSrc("features/navigation/topMenuGate.css");

    expect(source).toContain("className=\"drawerBody\"");
    expect(source).toContain("className=\"drawerMenuBody\"");
    expect(source).toContain("GateMainSectionCard");
    expect(source).toContain("GateInlineMetaCard GatePressable drawerMenuItem");
    expect(source).toContain("className=\"drawerMenuGroup\"");
    expect(source).toContain("GateIconButtonPremium GatePressable drawerMenuCloseBtn");
    expect(source).not.toContain("style={{ gap: 18 }}");
    expect(source).not.toContain("small2");
    expect(source).not.toContain("GateSection");
    expect(source).not.toContain("GateSecondarySectionCard drawerMenuSection");
    expect(css).toContain(".drawerBody{");
    expect(css).toContain("overflow-y:auto;");
    expect(css).toContain(".drawerBackdrop{");
    expect(css).toContain("display:flex;");
    expect(css).toContain("height:100dvh;");
    expect(navCss).toContain(".drawerMenuBody");
    expect(navCss).toContain(".drawerMenuGroup");
    expect(navCss).toContain(".drawerMenuItem");
    expect(navCss).toContain("padding: 14px 16px;");
    expect(navCss).not.toContain("box-shadow: none;");
    expect(navCss).not.toContain("overflow-y: auto;");
  });
});
