import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("top nav visual contract", () => {
  it("locks the validated icon mapping and mobile icon-only rendering", () => {
    const topNav = readSrc("components/TopNav.jsx");
    const navPills = readSrc("features/navigation/navPillUnified.css");
    const topMenuCss = readSrc("features/navigation/topMenuGate.css");
    const indexCss = readSrc("index.css");

    expect(topNav).toContain('import { BookOpen, Calendar, Compass, Home, Menu } from "lucide-react";');
    expect(topNav).toContain("navTopRef.current || topbarSurfaceRef.current || navBarRef.current || topbarRef.current");
    expect(topNav).toContain('{ id: "today", label: SURFACE_LABELS.today, icon: Home }');
    expect(topNav).toContain('{ id: "planning", label: SURFACE_LABELS.planning, icon: Calendar }');
    expect(topNav).toContain('{ id: "library", label: SURFACE_LABELS.library, icon: BookOpen }');
    expect(topNav).toContain('{ id: "pilotage", label: SURFACE_LABELS.pilotage, icon: Compass }');
    expect(topNav).toContain('aria-label={it.label}');
    expect(topNav).toContain('{!isMobileLayout ? <span className="NavPillUnifiedLabel">{it.label}</span> : null}');
    expect(topNav).toContain('NavPillUnified--iconOnly');
    expect(navPills).toContain(".NavPillUnifiedIcon");
    expect(navPills).toContain(".NavPillUnifiedLabel");
    expect(navPills).toContain(".NavPillUnified--iconOnly");
    expect(topMenuCss).toContain(".TopNavShell");
    expect(topMenuCss).toContain("padding-bottom: 4px;");
    expect(indexCss).toContain(".stickyStack{");
    expect(indexCss).toContain("position: sticky;");
    expect(indexCss).toContain("scroll-padding-top: calc(var(--topbar-bottom, var(--navOffset, 0px)) + 12px);");
  });
});
