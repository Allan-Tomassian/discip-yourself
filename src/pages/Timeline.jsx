import React, { useMemo } from "react";
import { getVisibleCategories } from "../domain/categoryVisibility";
import { AppScreen } from "../shared/ui/app";

function formatDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
      .format(new Date(`${dateKey}T12:00:00`))
      .toUpperCase();
  } catch {
    return dateKey;
  }
}

function sortOccurrences(left, right) {
  const leftDate = String(left?.date || "");
  const rightDate = String(right?.date || "");
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = String(left?.start || "");
  const rightStart = String(right?.start || "");
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

export default function Timeline({ data, setTab }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const todayKey = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const entries = useMemo(() => {
    return (Array.isArray(safeData.occurrences) ? safeData.occurrences : [])
      .filter((occurrence) => occurrence && occurrence.status !== "canceled" && occurrence.status !== "skipped")
      .filter((occurrence) => {
        const goal = goalsById.get(occurrence.goalId || "") || null;
        return categoriesById.has(goal?.categoryId || "");
      })
      .sort(sortOccurrences)
      .slice(-12);
  }, [categoriesById, goalsById, safeData.occurrences]);

  const currentEntryId = useMemo(() => {
    const upcoming = entries.find((entry) => entry?.status !== "done" && String(entry?.date || "") >= todayKey);
    return upcoming?.id || entries[entries.length - 1]?.id || "";
  }, [entries, todayKey]);

  return (
    <AppScreen
      pageId="timeline"
      headerTitle="Timeline"
      headerSubtitle="Your roadmap to execution"
    >
      <div className="lovablePage">
        <div className="lovableTimelineList">
          {entries.map((entry) => {
            const goal = goalsById.get(entry.goalId || "") || null;
            const category = categoriesById.get(goal?.categoryId || "") || null;
            const isComplete = entry.status === "done";
            const isCurrent = entry.id === currentEntryId;
            return (
              <div
                key={entry.id}
                className={`lovableTimelineItem${isComplete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`}
              >
                <div className="lovableTimelineNode" />
                <button
                  type="button"
                  className="lovableTimelineCard"
                  onClick={() =>
                    setTab?.("session", {
                      sessionCategoryId: category?.id || null,
                      sessionDateKey: entry.date || null,
                      sessionOccurrenceId: entry.id || null,
                    })
                  }
                >
                  <div className="lovableTimelineDate">{formatDateLabel(entry.date)}</div>
                  <div className="lovableTimelineTitle">{goal?.title || entry.title || "Execution block"}</div>
                  <div className="lovableTimelineSubtitle">
                    {[
                      category?.name || "",
                      Number.isFinite(entry.durationMinutes) ? `${entry.durationMinutes} min` : "",
                      isComplete ? "Completed" : "Upcoming",
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AppScreen>
  );
}
