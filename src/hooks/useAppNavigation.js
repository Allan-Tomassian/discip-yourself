import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

const TABS = new Set([
  "today",
  "library",
  "pilotage",
  "create-goal",
  "create-outcome-next",
  "create-habit-type",
  "create-habit-oneoff",
  "create-habit-recurring",
  "create-habit-anytime",
  "create-link-outcome",
  "create-pick-category",
  "edit-item",
  "session",
  "category-progress",
  "category-detail",
  "settings",
  "privacy",
  "terms",
  "support",
]);

export function normalizeTab(t) {
  if (t === "tools" || t === "plan") return "pilotage";
  if (t === "create") return "today";
  return TABS.has(t) ? t : "today";
}

function getInitialNavigationState() {
  const initialPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const initialSearch =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const pathParts = initialPath.split("/").filter(Boolean);
  const initialCategoryProgressId =
    pathParts[0] === "category" && pathParts[2] === "progress"
      ? decodeURIComponent(pathParts[1] || "")
      : null;
  const initialCategoryDetailId =
    pathParts[0] === "category" && pathParts.length === 2 ? decodeURIComponent(pathParts[1] || "") : null;
  const isPilotagePath = initialPath.startsWith("/pilotage") || initialPath.startsWith("/tools");
  const initialTab = isPilotagePath
    ? "pilotage"
    : initialPath.startsWith("/session")
      ? "session"
      : initialPath.startsWith("/privacy")
        ? "privacy"
        : initialPath.startsWith("/terms")
          ? "terms"
          : initialPath.startsWith("/support")
            ? "support"
            : initialCategoryProgressId
              ? "category-progress"
              : initialCategoryDetailId
                ? "category-detail"
                : "today";

  return {
    initialTab,
    initialCategoryDetailId,
    initialCategoryProgressId,
    initialSessionCategoryId: initialSearch?.get("cat") || null,
    initialSessionDateKey: initialSearch?.get("date") || null,
  };
}

export function useAppNavigation({ safeData, setData }) {
  const initial = useMemo(() => getInitialNavigationState(), []);
  const [tab, _setTab] = useState(initial.initialTab);
  const [categoryDetailId, setCategoryDetailId] = useState(initial.initialCategoryDetailId);
  const [categoryProgressId, setCategoryProgressId] = useState(initial.initialCategoryProgressId);
  const [libraryCategoryId, setLibraryCategoryId] = useState(null);
  const [sessionCategoryId, setSessionCategoryId] = useState(initial.initialSessionCategoryId);
  const [sessionDateKey, setSessionDateKey] = useState(initial.initialSessionDateKey);

  const setTab = useCallback(
    (next, opts = {}) => {
      const t = normalizeTab(next);
      const nextSessionCategoryId =
        typeof opts.sessionCategoryId === "string" ? opts.sessionCategoryId : sessionCategoryId;
      const nextSessionDateKey =
        typeof opts.sessionDateKey === "string" ? opts.sessionDateKey : sessionDateKey;
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
      _setTab(t);
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), lastTab: t },
      }));
      if (typeof window !== "undefined") {
        const nextPath =
          t === "session"
            ? nextSessionCategoryId || nextSessionDateKey
              ? `/session?${[
                  nextSessionCategoryId ? `cat=${encodeURIComponent(nextSessionCategoryId)}` : "",
                  nextSessionDateKey ? `date=${encodeURIComponent(nextSessionDateKey)}` : "",
                ]
                  .filter(Boolean)
                  .join("&")}`
              : "/session"
            : t === "category-progress"
              ? nextCategoryProgressId
                ? `/category/${nextCategoryProgressId}/progress`
                : "/category"
              : t === "category-detail"
                ? nextCategoryDetailId
                  ? `/category/${nextCategoryDetailId}`
                  : "/category"
                : t === "pilotage"
                  ? "/pilotage"
                  : t === "privacy"
                    ? "/privacy"
                    : t === "terms"
                      ? "/terms"
                      : t === "support"
                        ? "/support"
                        : "/";
        if (window.location.pathname !== nextPath) {
          const state =
            t === "session"
              ? { categoryId: nextSessionCategoryId || null, date: nextSessionDateKey || null }
              : {};
          window.history.pushState(state, "", nextPath);
        }
      }
    },
    [sessionCategoryId, sessionDateKey, categoryProgressId, categoryDetailId, setData]
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

  useLayoutEffect(() => {
    const completed = Boolean(safeData?.ui?.onboardingCompleted);
    if (!completed) return;
    if (
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/session") || window.location.pathname.startsWith("/category"))
    )
      return;
    const last = normalizeTab(safeData?.ui?.lastTab);
    _setTab((cur) => (normalizeTab(cur) === last ? cur : last));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    tab,
    setTab,
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
  };
}
