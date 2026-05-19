const MAIN_TAB_PAGE_IDS = Object.freeze({
  today: "today",
  objectives: "objectives",
  timeline: "timeline",
  adjust: "adjust",
});

function resolveDocument(env = {}) {
  if (env.document) return env.document;
  if (env.window?.document) return env.window.document;
  if (typeof document !== "undefined") return document;
  return null;
}

function resolveWindow(env = {}) {
  if (env.window) return env.window;
  if (typeof window !== "undefined") return window;
  return null;
}

function getDocumentScroller(doc) {
  if (!doc) return null;
  return doc.scrollingElement || doc.documentElement || doc.body || null;
}

function safeScrollTo(element, options) {
  if (!element) return false;
  if (typeof element.scrollTo === "function") {
    element.scrollTo(options);
  } else {
    element.scrollTop = Number(options?.top) || 0;
    element.scrollLeft = Number(options?.left) || 0;
  }
  return true;
}

function scrollDocumentToTop(doc, win) {
  const scroller = getDocumentScroller(doc);
  safeScrollTo(scroller, { top: 0, left: 0, behavior: "auto" });
  if (win && typeof win.scrollTo === "function") {
    win.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
}

export function resolveMainTabScrollTarget(tab, env = {}) {
  const doc = resolveDocument(env);
  if (!doc || typeof doc.querySelector !== "function") {
    return { kind: "none", element: null };
  }

  if (tab === "coach") {
    const messages = doc.querySelector('[data-page-id="coach"] .lovableCoachMessages');
    if (messages) return { kind: "bottom", element: messages };
    const coachPage = doc.querySelector('[data-page-id="coach"]');
    return { kind: coachPage ? "bottom" : "none", element: coachPage || null };
  }

  const pageId = MAIN_TAB_PAGE_IDS[tab];
  if (!pageId) return { kind: "none", element: null };

  const page = doc.querySelector(`[data-page-id="${pageId}"]`);
  if (page) return { kind: "top", element: page };
  return { kind: "top", element: getDocumentScroller(doc) };
}

export function resetMainTabScroll(tab, env = {}) {
  const doc = resolveDocument(env);
  const win = resolveWindow(env);
  const target = resolveMainTabScrollTarget(tab, { ...env, document: doc, window: win });

  if (target.kind === "bottom" && target.element) {
    const top = Math.max(0, Number(target.element.scrollHeight || 0) - Number(target.element.clientHeight || 0));
    scrollDocumentToTop(doc, win);
    safeScrollTo(target.element, { top, left: 0, behavior: "auto" });
    return target;
  }

  if (target.kind === "top") {
    scrollDocumentToTop(doc, win);
    safeScrollTo(target.element, { top: 0, left: 0, behavior: "auto" });
    return target;
  }

  return target;
}

export function scheduleMainTabScrollReset(tab, env = {}) {
  const win = resolveWindow(env);
  if (!win || typeof win.requestAnimationFrame !== "function") {
    resetMainTabScroll(tab, env);
    return () => {};
  }

  let frameA = 0;
  let frameB = 0;
  frameA = win.requestAnimationFrame(() => {
    frameB = win.requestAnimationFrame(() => {
      resetMainTabScroll(tab, env);
    });
  });

  return () => {
    win.cancelAnimationFrame?.(frameA);
    win.cancelAnimationFrame?.(frameB);
  };
}
