import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { resetMainTabScroll, resolveMainTabScrollTarget, scheduleMainTabScrollReset } from "./mainTabScroll";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

function makeScrollable({ scrollHeight = 1200, clientHeight = 400 } = {}) {
  return {
    scrollHeight,
    clientHeight,
    scrollTop: 100,
    scrollLeft: 20,
    scrollTo: vi.fn(function scrollTo(options) {
      this.scrollTop = options.top;
      this.scrollLeft = options.left;
    }),
  };
}

function makeDocument(targets = {}) {
  const scroller = makeScrollable();
  return {
    scrollingElement: scroller,
    documentElement: scroller,
    body: scroller,
    querySelector: vi.fn((selector) => targets[selector] || null),
  };
}

describe("main tab scroll reset", () => {
  it("resets standard main tabs to their route top target", () => {
    const timeline = makeScrollable();
    const doc = makeDocument({ '[data-page-id="timeline"]': timeline });
    const win = { scrollTo: vi.fn() };

    const target = resetMainTabScroll("timeline", { document: doc, window: win });

    expect(target).toMatchObject({ kind: "top", element: timeline });
    expect(timeline.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("anchors Coach to the latest message area instead of stale thread scroll", () => {
    const messages = makeScrollable({ scrollHeight: 1600, clientHeight: 500 });
    const doc = makeDocument({ '[data-page-id="coach"] .lovableCoachMessages': messages });
    const win = { scrollTo: vi.fn() };

    const target = resetMainTabScroll("coach", { document: doc, window: win });

    expect(target).toMatchObject({ kind: "bottom", element: messages });
    expect(messages.scrollTo).toHaveBeenCalledWith({ top: 1100, left: 0, behavior: "auto" });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("uses Today as a special page target when available", () => {
    const today = makeScrollable();
    const doc = makeDocument({ '[data-page-id="today"]': today });

    expect(resolveMainTabScrollTarget("today", { document: doc })).toMatchObject({
      kind: "top",
      element: today,
    });
  });

  it("does not resolve internal surfaces as tab reset targets", () => {
    const doc = makeDocument();

    expect(resolveMainTabScrollTarget("session", { document: doc })).toMatchObject({
      kind: "none",
      element: null,
    });
    expect(resolveMainTabScrollTarget("edit-item", { document: doc })).toMatchObject({
      kind: "none",
      element: null,
    });
  });

  it("schedules reset after the route has rendered", () => {
    const objectives = makeScrollable();
    const doc = makeDocument({ '[data-page-id="objectives"]': objectives });
    const callbacks = [];
    const win = {
      document: doc,
      requestAnimationFrame: vi.fn((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
      cancelAnimationFrame: vi.fn(),
      scrollTo: vi.fn(),
    };

    const cancel = scheduleMainTabScrollReset("objectives", { document: doc, window: win });
    expect(objectives.scrollTo).not.toHaveBeenCalled();

    callbacks.shift()();
    callbacks.shift()();

    expect(objectives.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    cancel();
    expect(win.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("is wired only from the bottom navigation selection path", () => {
    const app = readSrc("App.jsx");
    const bottomNavStart = app.indexOf("const handleBottomNavigationSelect");
    const adjustActionStart = app.indexOf("const handleAdjustAction", bottomNavStart);
    const categoriesStart = app.indexOf("const categories", adjustActionStart);

    expect(app).toContain('import { scheduleMainTabScrollReset } from "./app/mainTabScroll";');
    expect(app).toContain("const pendingMainTabScrollResetRef = useRef(null);");
    expect(app).toContain("scheduleMainTabScrollReset(tab);");

    const bottomNavigationHandler = app.slice(bottomNavStart, adjustActionStart);
    const adjustActionHandler = app.slice(adjustActionStart, categoriesStart);

    expect(bottomNavigationHandler).toContain("pendingMainTabScrollResetRef.current = nextTab;");
    expect(adjustActionHandler).not.toContain("pendingMainTabScrollResetRef");
    expect(adjustActionHandler).not.toContain("scheduleMainTabScrollReset");
  });
});
