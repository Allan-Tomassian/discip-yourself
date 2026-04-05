import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

const TABS = new Set([
  "onboarding",
  "today",
  "objectives",
  "timeline",
  "insights",
  "coach",
  "create-item",
  "journal",
  "micro-actions",
  "history",
  "edit-item",
  "session",
  "category-progress",
  "category-detail",
  "account",
  "settings",
  "billing",
  "data",
  "privacy",
  "legal",
  "support",
  "faq",
]);

export function normalizeTab(t) {
  if (t === "tools") return "insights";
  if (t === "pilotage") return "insights";
  if (t === "plan") return "timeline";
  if (t === "planning") return "timeline";
  if (t === "library") return "objectives";
  if (t === "create") return "create-item";
  if (t === "preferences") return "settings";
  if (t === "subscription") return "billing";
  if (t === "terms") return "legal";
  return TABS.has(t) ? t : "today";
}

function normalizeCoachAliasRequest(historyState, fallbackMainTab = "today") {
  const safeState = historyState && typeof historyState === "object" ? historyState : {};
  const origin = safeState.origin && typeof safeState.origin === "object" ? safeState.origin : {};
  return {
    mainTab: normalizeTab(origin.mainTab || fallbackMainTab),
    mode: safeState.coachMode === "plan" ? "plan" : "free",
    conversationId:
      typeof origin.coachConversationId === "string" && origin.coachConversationId ? origin.coachConversationId : null,
  };
}

function buildPathForTab({
  tab,
  sessionCategoryId = null,
  sessionDateKey = null,
  sessionOccurrenceId = null,
  categoryProgressId = null,
  categoryDetailId = null,
  editItemId = null,
} = {}) {
  if (tab === "session") {
    return sessionOccurrenceId
      ? `/session/${encodeURIComponent(sessionOccurrenceId)}`
      : sessionCategoryId || sessionDateKey
        ? `/session?${[
            sessionCategoryId ? `cat=${encodeURIComponent(sessionCategoryId)}` : "",
            sessionDateKey ? `date=${encodeURIComponent(sessionDateKey)}` : "",
          ]
            .filter(Boolean)
            .join("&")}`
        : "/session";
  }
  if (tab === "category-progress") return categoryProgressId ? `/category/${categoryProgressId}/progress` : "/category";
  if (tab === "category-detail") return categoryDetailId ? `/category/${categoryDetailId}` : "/category";
  if (tab === "create-item") return "/create";
  if (tab === "edit-item") return editItemId ? `/edit/${encodeURIComponent(editItemId)}` : "/edit";
  if (tab === "objectives") return "/objectives";
  if (tab === "timeline") return "/timeline";
  if (tab === "insights") return "/insights";
  if (tab === "coach") return "/coach";
  if (tab === "onboarding") return "/onboarding";
  if (tab === "journal") return "/journal";
  if (tab === "micro-actions") return "/micro-actions";
  if (tab === "history") return "/history";
  if (tab === "account") return "/account";
  if (tab === "settings") return "/settings";
  if (tab === "billing") return "/billing";
  if (tab === "data") return "/data";
  if (tab === "privacy") return "/privacy";
  if (tab === "legal") return "/legal";
  if (tab === "support") return "/support";
  if (tab === "faq") return "/faq";
  return "/";
}

export function parseNavigationState(pathname, search, historyState = null) {
  const initialPath = typeof pathname === "string" ? pathname : "/";
  const initialSearch = new URLSearchParams(search || "");
  const pathParts = initialPath.split("/").filter(Boolean);
  const sessionOccurrenceId =
    pathParts[0] === "session" && pathParts[1] ? decodeURIComponent(pathParts[1] || "") : null;
  const categoryProgressId =
    pathParts[0] === "category" && pathParts[2] === "progress"
      ? decodeURIComponent(pathParts[1] || "")
      : null;
  const categoryDetailId =
    pathParts[0] === "category" && pathParts.length === 2 ? decodeURIComponent(pathParts[1] || "") : null;
  const editItemId = pathParts[0] === "edit" && pathParts[1] ? decodeURIComponent(pathParts[1] || "") : null;
  const isInsightsPath = initialPath.startsWith("/insights") || initialPath.startsWith("/pilotage") || initialPath.startsWith("/tools");
  const isTimelinePath = initialPath.startsWith("/timeline") || initialPath.startsWith("/planning") || initialPath.startsWith("/plan");
  const isObjectivesPath = initialPath.startsWith("/objectives") || initialPath.startsWith("/library");
  const coachAliasRequest = initialPath.startsWith("/coach/chat")
    ? normalizeCoachAliasRequest(historyState, "coach")
    : null;
  let initialTab = "today";
  if (initialPath.startsWith("/onboarding")) initialTab = "onboarding";
  else if (initialPath.startsWith("/create")) initialTab = "create-item";
  else if (initialPath.startsWith("/edit")) initialTab = "edit-item";
  else if (isObjectivesPath) initialTab = "objectives";
  else if (isTimelinePath) initialTab = "timeline";
  else if (isInsightsPath) initialTab = "insights";
  else if (initialPath.startsWith("/coach")) initialTab = "coach";
  else if (initialPath.startsWith("/journal")) initialTab = "journal";
  else if (initialPath.startsWith("/micro-actions")) initialTab = "micro-actions";
  else if (initialPath.startsWith("/history")) initialTab = "history";
  else if (initialPath.startsWith("/session")) initialTab = "session";
  else if (initialPath.startsWith("/account")) initialTab = "account";
  else if (initialPath.startsWith("/preferences") || initialPath.startsWith("/settings")) initialTab = "settings";
  else if (initialPath.startsWith("/subscription") || initialPath.startsWith("/billing")) initialTab = "billing";
  else if (initialPath.startsWith("/data")) initialTab = "data";
  else if (initialPath.startsWith("/privacy")) initialTab = "privacy";
  else if (initialPath.startsWith("/terms") || initialPath.startsWith("/legal")) initialTab = "legal";
  else if (initialPath.startsWith("/support")) initialTab = "support";
  else if (initialPath.startsWith("/faq")) initialTab = "faq";
  else if (categoryProgressId) initialTab = "category-progress";
  else if (categoryDetailId) initialTab = "category-detail";
  if (coachAliasRequest) initialTab = "coach";

  return {
    initialTab,
    initialCategoryDetailId: categoryDetailId,
    initialCategoryProgressId: categoryProgressId,
    initialEditItemId: editItemId,
    initialSessionCategoryId: initialSearch.get("cat") || null,
    initialSessionDateKey: initialSearch.get("date") || null,
    initialSessionOccurrenceId: sessionOccurrenceId,
    initialCoachAliasRequest: coachAliasRequest,
  };
}

function getInitialNavigationState() {
  const initialPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const initialSearch = typeof window !== "undefined" ? window.location.search : "";
  const initialHistoryState = typeof window !== "undefined" ? window.history.state : null;
  return parseNavigationState(initialPath, initialSearch, initialHistoryState);
}

export function useAppNavigation({ safeData, setData }) {
  const initial = useMemo(() => getInitialNavigationState(), []);
  const [tab, _setTab] = useState(initial.initialTab);
  const [categoryDetailId, setCategoryDetailId] = useState(initial.initialCategoryDetailId);
  const [categoryProgressId, setCategoryProgressId] = useState(initial.initialCategoryProgressId);
  const [editItemId, setEditItemId] = useState(initial.initialEditItemId);
  const [libraryCategoryId, setLibraryCategoryId] = useState(null);
  const [sessionCategoryId, setSessionCategoryId] = useState(initial.initialSessionCategoryId);
  const [sessionDateKey, setSessionDateKey] = useState(initial.initialSessionDateKey);
  const [sessionOccurrenceId, setSessionOccurrenceId] = useState(initial.initialSessionOccurrenceId);
  const [coachAliasRequest, setCoachAliasRequest] = useState(initial.initialCoachAliasRequest);
  const consumeCoachAliasRequest = useCallback(() => setCoachAliasRequest(null), []);

  const setTab = useCallback(
    (next, opts = {}) => {
      const t = normalizeTab(next);
      const nextSessionCategoryId =
        typeof opts.sessionCategoryId === "string" ? opts.sessionCategoryId : sessionCategoryId;
      const nextSessionDateKey =
        typeof opts.sessionDateKey === "string" ? opts.sessionDateKey : sessionDateKey;
      const nextSessionOccurrenceId =
        typeof opts.sessionOccurrenceId === "string"
          ? opts.sessionOccurrenceId
          : opts.sessionOccurrenceId === null
            ? null
            : sessionOccurrenceId;
      const nextCategoryProgressId =
        typeof opts.categoryProgressId === "string" ? opts.categoryProgressId : categoryProgressId;
      const nextCategoryDetailId =
        typeof opts.categoryDetailId === "string" ? opts.categoryDetailId : categoryDetailId;
      if (t === "session" && typeof opts.sessionCategoryId === "string") {
        setSessionCategoryId(opts.sessionCategoryId);
      } else if (t === "session" && opts.sessionCategoryId === null) {
        setSessionCategoryId(null);
      }
      if (t === "session" && typeof opts.sessionDateKey === "string") {
        setSessionDateKey(opts.sessionDateKey);
      } else if (t === "session" && opts.sessionDateKey === null) {
        setSessionDateKey(null);
      }
      if (t === "session" && typeof opts.sessionOccurrenceId === "string") {
        setSessionOccurrenceId(opts.sessionOccurrenceId);
      } else if (t === "session" && opts.sessionOccurrenceId === null) {
        setSessionOccurrenceId(null);
      }
      if (t === "category-progress" && typeof opts.categoryProgressId === "string") {
        setCategoryProgressId(opts.categoryProgressId);
      } else if (t === "category-progress" && opts.categoryProgressId === null) {
        setCategoryProgressId(null);
      }
      if (t === "category-detail" && typeof opts.categoryDetailId === "string") {
        setCategoryDetailId(opts.categoryDetailId);
      } else if (t === "category-detail" && opts.categoryDetailId === null) {
        setCategoryDetailId(null);
      }
      if (t === "edit-item" && typeof opts.editItemId === "string") {
        setEditItemId(opts.editItemId);
      } else if (t === "edit-item" && opts.editItemId === null) {
        setEditItemId(null);
      }
      _setTab(t);
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), lastTab: t },
      }));
      if (typeof window !== "undefined") {
        const nextPath = buildPathForTab({
          tab: t,
          sessionCategoryId: nextSessionCategoryId,
          sessionDateKey: nextSessionDateKey,
          sessionOccurrenceId: nextSessionOccurrenceId,
          categoryProgressId: nextCategoryProgressId,
          categoryDetailId: nextCategoryDetailId,
          editItemId: typeof opts.editItemId === "string" ? opts.editItemId : editItemId,
        });

        if (`${window.location.pathname}${window.location.search}` !== nextPath) {
          const state =
            t === "session"
              ? {
                  categoryId: nextSessionCategoryId || null,
                  date: nextSessionDateKey || null,
                  occurrenceId: nextSessionOccurrenceId || null,
                }
              : opts.historyState && typeof opts.historyState === "object"
                ? opts.historyState
                : {};
          window.history[opts.replace ? "replaceState" : "pushState"](state, "", nextPath);
        }
      }
    },
    [sessionCategoryId, sessionDateKey, sessionOccurrenceId, categoryProgressId, categoryDetailId, editItemId, setData]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab !== "category-detail") return;
    const nextPath = categoryDetailId ? `/category/${categoryDetailId}` : "/category";
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }, [tab, categoryDetailId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab !== "insights") return;
    if (window.location.pathname === "/tools") {
      window.history.replaceState({}, "", "/insights");
    }
  }, [tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (pathname === "/preferences") window.history.replaceState({}, "", "/settings");
    else if (pathname === "/subscription") window.history.replaceState({}, "", "/billing");
    else if (pathname === "/terms") window.history.replaceState({}, "", "/legal");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !coachAliasRequest) return;
    const nextPath = buildPathForTab({
      tab,
      sessionCategoryId,
      sessionDateKey,
      sessionOccurrenceId,
      categoryProgressId,
      categoryDetailId,
      editItemId,
    });
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.replaceState(window.history.state || {}, "", nextPath);
    }
  }, [
    categoryDetailId,
    categoryProgressId,
    coachAliasRequest,
    editItemId,
    sessionCategoryId,
    sessionDateKey,
    sessionOccurrenceId,
    tab,
  ]);

  useLayoutEffect(() => {
    const completed = Boolean(safeData?.ui?.onboardingCompleted);
    if (!completed) return;
    if (typeof window !== "undefined" && window.location.pathname !== "/")
      return;
    _setTab((cur) => (normalizeTab(cur) === "today" ? cur : "today"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePopState = () => {
      const next = parseNavigationState(window.location.pathname, window.location.search, window.history.state);
      _setTab(next.initialTab);
      setCategoryDetailId(next.initialCategoryDetailId);
      setCategoryProgressId(next.initialCategoryProgressId);
      setEditItemId(next.initialEditItemId);
      setSessionCategoryId(next.initialSessionCategoryId);
      setSessionDateKey(next.initialSessionDateKey);
      setSessionOccurrenceId(next.initialSessionOccurrenceId);
      setCoachAliasRequest(next.initialCoachAliasRequest);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return {
    tab,
    setTab,
    editItemId,
    categoryDetailId,
    setCategoryDetailId,
    categoryProgressId,
    setCategoryProgressId,
    libraryCategoryId,
    setLibraryCategoryId,
    sessionCategoryId,
    setSessionCategoryId,
    sessionDateKey,
    setSessionDateKey,
    sessionOccurrenceId,
    setSessionOccurrenceId,
    coachAliasRequest,
    consumeCoachAliasRequest,
  };
}
