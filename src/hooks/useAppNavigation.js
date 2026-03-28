import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

const TABS = new Set([
  "onboarding",
  "today",
  "planning",
  "library",
  "pilotage",
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
  "coach-chat",
]);

export function normalizeTab(t) {
  if (t === "tools") return "pilotage";
  if (t === "plan") return "planning";
  if (t === "create") return "create-item";
  if (t === "preferences") return "settings";
  if (t === "subscription") return "billing";
  if (t === "terms") return "legal";
  return TABS.has(t) ? t : "today";
}

function parseNavigationState(pathname, search) {
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
  const isPilotagePath = initialPath.startsWith("/pilotage") || initialPath.startsWith("/tools");
  const isPlanningPath = initialPath.startsWith("/planning") || initialPath.startsWith("/plan");
  let initialTab = "today";
  if (initialPath.startsWith("/onboarding")) initialTab = "onboarding";
  else if (initialPath.startsWith("/coach/chat")) initialTab = "coach-chat";
  else if (initialPath.startsWith("/create")) initialTab = "create-item";
  else if (initialPath.startsWith("/edit")) initialTab = "edit-item";
  else if (isPlanningPath) initialTab = "planning";
  else if (isPilotagePath) initialTab = "pilotage";
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

  return {
    initialTab,
    initialCategoryDetailId: categoryDetailId,
    initialCategoryProgressId: categoryProgressId,
    initialEditItemId: editItemId,
    initialSessionCategoryId: initialSearch.get("cat") || null,
    initialSessionDateKey: initialSearch.get("date") || null,
    initialSessionOccurrenceId: sessionOccurrenceId,
  };
}

function getInitialNavigationState() {
  const initialPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const initialSearch = typeof window !== "undefined" ? window.location.search : "";
  return parseNavigationState(initialPath, initialSearch);
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
        let nextPath = "/";
        if (t === "session") {
          nextPath = nextSessionOccurrenceId
            ? `/session/${encodeURIComponent(nextSessionOccurrenceId)}`
            : nextSessionCategoryId || nextSessionDateKey
              ? `/session?${[
                  nextSessionCategoryId ? `cat=${encodeURIComponent(nextSessionCategoryId)}` : "",
                  nextSessionDateKey ? `date=${encodeURIComponent(nextSessionDateKey)}` : "",
                ]
                  .filter(Boolean)
                  .join("&")}`
              : "/session";
        } else if (t === "category-progress") {
          nextPath = nextCategoryProgressId ? `/category/${nextCategoryProgressId}/progress` : "/category";
        } else if (t === "category-detail") {
          nextPath = nextCategoryDetailId ? `/category/${nextCategoryDetailId}` : "/category";
        } else if (t === "create-item") {
          nextPath = "/create";
        } else if (t === "edit-item") {
          nextPath = opts.editItemId ? `/edit/${encodeURIComponent(opts.editItemId)}` : "/edit";
        } else if (t === "planning") nextPath = "/planning";
        else if (t === "pilotage") nextPath = "/pilotage";
        else if (t === "onboarding") nextPath = "/onboarding";
        else if (t === "journal") nextPath = "/journal";
        else if (t === "micro-actions") nextPath = "/micro-actions";
        else if (t === "history") nextPath = "/history";
        else if (t === "account") nextPath = "/account";
        else if (t === "settings") nextPath = "/settings";
        else if (t === "billing") nextPath = "/billing";
        else if (t === "data") nextPath = "/data";
        else if (t === "privacy") nextPath = "/privacy";
        else if (t === "legal") nextPath = "/legal";
        else if (t === "support") nextPath = "/support";
        else if (t === "faq") nextPath = "/faq";
        else if (t === "coach-chat") nextPath = "/coach/chat";

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
          window.history.pushState(state, "", nextPath);
        }
      }
    },
    [sessionCategoryId, sessionDateKey, sessionOccurrenceId, categoryProgressId, categoryDetailId, setData]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab !== "category-detail") return;
    const nextPath = categoryDetailId ? `/category/${categoryDetailId}` : "/category";
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }, [tab, categoryDetailId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab !== "pilotage") return;
    if (window.location.pathname === "/tools") {
      window.history.replaceState({}, "", "/pilotage");
    }
  }, [tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (pathname === "/preferences") window.history.replaceState({}, "", "/settings");
    else if (pathname === "/subscription") window.history.replaceState({}, "", "/billing");
    else if (pathname === "/terms") window.history.replaceState({}, "", "/legal");
  }, []);

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
      const next = parseNavigationState(window.location.pathname, window.location.search);
      _setTab(next.initialTab);
      setCategoryDetailId(next.initialCategoryDetailId);
      setCategoryProgressId(next.initialCategoryProgressId);
      setEditItemId(next.initialEditItemId);
      setSessionCategoryId(next.initialSessionCategoryId);
      setSessionDateKey(next.initialSessionDateKey);
      setSessionOccurrenceId(next.initialSessionOccurrenceId);
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
  };
}
