import React, { useCallback, useMemo, useState } from "react";
import { getVisibleCategories } from "../domain/categoryVisibility";
import { resolveGoalType } from "../domain/goalType";
import { getOpenRuntimeSession, resolveRuntimeSessionGate } from "../logic/sessionRuntime";
import {
  AppChip,
  AppDateField,
  AppDialog,
  AppScreen,
  GhostButton,
  PrimaryButton,
} from "../shared/ui/app";
import { TIMELINE_SCREEN_COPY } from "../ui/labels";
import { addDaysLocal, fromLocalDateKey, getWeekdayShortLabel, normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";

const WINDOW_PAST_DAYS = 5;
const WINDOW_FUTURE_DAYS = 14;

function formatDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
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

function formatExpandedDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function sortOccurrences(left, right) {
  const leftDate = String(left?.dateKey || left?.date || "");
  const rightDate = String(right?.dateKey || right?.date || "");
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = String(left?.startTime || left?.start || "");
  const rightStart = String(right?.startTime || right?.start || "");
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function buildWindowEntries(entries, anchorDateKey) {
  const lowerBound = addDaysLocal(anchorDateKey, -WINDOW_PAST_DAYS);
  const upperBound = addDaysLocal(anchorDateKey, WINDOW_FUTURE_DAYS);
  const visible = entries.filter((entry) => {
    const dateKey = String(entry?.dateKey || "");
    return dateKey && dateKey >= lowerBound && dateKey <= upperBound;
  });
  const inOrder = visible.sort(sortOccurrences);
  const sameDay = inOrder.filter((entry) => entry.dateKey === anchorDateKey);
  const future = inOrder.filter((entry) => entry.dateKey > anchorDateKey);
  const past = inOrder.filter((entry) => entry.dateKey < anchorDateKey).reverse();
  const prioritized = [...sameDay, ...future, ...past];
  if (prioritized.length) return prioritized;

  const anchorDate = fromLocalDateKey(anchorDateKey);
  const anchorMs = anchorDate.getTime();
  return [...entries]
    .sort((left, right) => {
      const leftMs = fromLocalDateKey(left?.dateKey).getTime();
      const rightMs = fromLocalDateKey(right?.dateKey).getTime();
      const leftDelta = Math.abs(leftMs - anchorMs);
      const rightDelta = Math.abs(rightMs - anchorMs);
      if (leftDelta !== rightDelta) return leftDelta - rightDelta;
      return sortOccurrences(left, right);
    })
    .slice(0, 10);
}

function statusLabel(status) {
  if (status === "done") return TIMELINE_SCREEN_COPY.completed;
  if (status === "in_progress") return "En cours";
  if (status === "partial") return "En pause";
  if (status === "blocked") return "Bloquée";
  if (status === "reported") return "Reportée";
  return TIMELINE_SCREEN_COPY.upcoming;
}

function resolveCurrentStatus({ occurrence, groupedOccurrences = [], activeOccurrenceId = null }) {
  if (activeOccurrenceId && groupedOccurrences.some((entry) => entry.id === activeOccurrenceId)) return "in_progress";
  if (activeOccurrenceId && occurrence?.id === activeOccurrenceId) return "in_progress";
  return String(occurrence?.status || "");
}

function canGroupGoal(goal, occurrences) {
  if (!goal || resolveGoalType(goal) !== "PROCESS") return false;
  if (String(goal?.planType || "") === "ONE_OFF") return false;
  return Array.isArray(occurrences) && occurrences.length > 1;
}

function buildRecurringSummary(occurrences, todayKey) {
  const nextWeekEnd = addDaysLocal(todayKey, 6);
  const nextWeek = occurrences.filter((occurrence) => {
    const dateKey = String(occurrence?.dateKey || "");
    return dateKey >= todayKey && dateKey <= nextWeekEnd;
  });
  const weekdayLabels = Array.from(
    new Set(
      nextWeek
        .map((occurrence) => {
          const date = fromLocalDateKey(occurrence.dateKey);
          return getWeekdayShortLabel(date, "fr-FR");
        })
        .filter(Boolean)
    )
  );

  return {
    frequencyLabel: nextWeek.length
      ? `${nextWeek.length} créneau${nextWeek.length > 1 ? "x" : ""} cette semaine`
      : TIMELINE_SCREEN_COPY.recurringSummaryFallback,
    weekdayLabel: weekdayLabels.join(" "),
  };
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="5" width="16" height="15" rx="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Timeline({ data, setData, setTab, onEditItem }) {
  const safeData = data && typeof data === "object" ? data : {};
  const [expandedEntryId, setExpandedEntryId] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [categoryFilterId, setCategoryFilterId] = useState("all");
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const processGoalsById = useMemo(
    () =>
      new Map(
        goals
          .filter((goal) => resolveGoalType(goal) === "PROCESS" && categoriesById.has(goal?.categoryId || ""))
          .map((goal) => [goal.id, goal])
      ),
    [categoriesById, goals]
  );
  const todayKey = useMemo(() => todayLocalKey(), []);
  const selectedDateKey =
    normalizeLocalDateKey(safeData?.ui?.selectedDateKey || safeData?.ui?.selectedDate) || todayKey;
  const openRuntimeSession = useMemo(() => getOpenRuntimeSession(safeData), [safeData]);
  const activeOccurrenceId =
    typeof openRuntimeSession?.occurrenceId === "string" && openRuntimeSession.occurrenceId.trim()
      ? openRuntimeSession.occurrenceId
      : null;

  const occurrenceEntries = useMemo(() => {
    const rawOccurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
    const mapped = rawOccurrences
      .filter((occurrence) => occurrence && occurrence.status !== "canceled" && occurrence.status !== "skipped")
      .map((occurrence) => {
        const goal = processGoalsById.get(occurrence.goalId || "") || null;
        if (!goal) return null;
        const category = categoriesById.get(goal.categoryId || "") || null;
        const outcomeId =
          (typeof goal?.parentId === "string" && goal.parentId.trim()) ||
          (typeof goal?.outcomeId === "string" && goal.outcomeId.trim()) ||
          "";
        const outcome = outcomeId ? goalsById.get(outcomeId) || null : null;
        return {
          id: occurrence.id,
          goalId: goal.id,
          dateKey: normalizeLocalDateKey(occurrence.date) || "",
          startTime: String(occurrence.start || occurrence.slotKey || "").trim(),
          occurrence,
          goal,
          category,
          outcome,
        };
      })
      .filter(Boolean);
    return buildWindowEntries(mapped, selectedDateKey);
  }, [categoriesById, goalsById, processGoalsById, safeData.occurrences, selectedDateKey]);

  const filteredOccurrenceEntries = useMemo(() => {
    if (categoryFilterId === "all") return occurrenceEntries;
    return occurrenceEntries.filter((entry) => entry.category?.id === categoryFilterId);
  }, [categoryFilterId, occurrenceEntries]);

  const displayEntries = useMemo(() => {
    const groupedByGoal = new Map();
    for (const entry of filteredOccurrenceEntries) {
      if (!groupedByGoal.has(entry.goalId)) groupedByGoal.set(entry.goalId, []);
      groupedByGoal.get(entry.goalId).push(entry);
    }

    const seenGoalIds = new Set();
    const nextEntries = [];

    for (const entry of filteredOccurrenceEntries) {
      if (seenGoalIds.has(entry.goalId)) continue;
      const groupedOccurrences = groupedByGoal.get(entry.goalId) || [];
      if (canGroupGoal(entry.goal, groupedOccurrences)) {
        seenGoalIds.add(entry.goalId);
        const sortedGrouped = [...groupedOccurrences].sort(sortOccurrences);
        const representative =
          sortedGrouped.find((item) => item.dateKey >= selectedDateKey && item.occurrence?.status !== "done") ||
          sortedGrouped.find((item) => item.dateKey >= selectedDateKey) ||
          sortedGrouped[sortedGrouped.length - 1];
        const summary = buildRecurringSummary(sortedGrouped, selectedDateKey);
        nextEntries.push({
          id: `group:${entry.goalId}`,
          kind: "group",
          goal: entry.goal,
          category: entry.category,
          outcome: entry.outcome,
          dateKey: representative?.dateKey || entry.dateKey,
          status: resolveCurrentStatus({
            occurrence: representative?.occurrence || null,
            groupedOccurrences: sortedGrouped,
            activeOccurrenceId,
          }),
          durationMinutes:
            representative?.occurrence?.durationMinutes || entry.goal?.sessionMinutes || null,
          notes:
            String(entry.goal?.habitNotes || "").trim() ||
            String(entry.goal?.notes || "").trim() ||
            "",
          groupedOccurrences: sortedGrouped,
          categoryLabel: entry.category?.name || "",
          title: entry.goal?.title || TIMELINE_SCREEN_COPY.entryFallbackTitle,
          subtitle: [summary.frequencyLabel, summary.weekdayLabel].filter(Boolean).join(" • "),
          targetOccurrence: representative?.occurrence || null,
        });
        continue;
      }

      nextEntries.push({
        id: entry.id,
        kind: "occurrence",
        goal: entry.goal,
        category: entry.category,
        outcome: entry.outcome,
        dateKey: entry.dateKey,
        status: resolveCurrentStatus({
          occurrence: entry.occurrence,
          activeOccurrenceId,
        }),
        durationMinutes: entry.occurrence?.durationMinutes || entry.goal?.sessionMinutes || null,
        notes:
          String(entry.goal?.habitNotes || "").trim() ||
          String(entry.goal?.notes || "").trim() ||
          "",
        groupedOccurrences: [entry],
        categoryLabel: entry.category?.name || "",
        title: entry.goal?.title || entry.occurrence?.title || TIMELINE_SCREEN_COPY.entryFallbackTitle,
        subtitle: [
          Number.isFinite(entry.occurrence?.durationMinutes) ? `${entry.occurrence.durationMinutes} min` : "",
          statusLabel(resolveCurrentStatus({ occurrence: entry.occurrence, activeOccurrenceId })),
        ]
          .filter(Boolean)
          .join(" • "),
        targetOccurrence: entry.occurrence,
      });
    }

    return nextEntries;
  }, [activeOccurrenceId, filteredOccurrenceEntries, selectedDateKey]);

  const currentEntryId = useMemo(() => {
    const upcoming = displayEntries.find((entry) => String(entry?.dateKey || "") >= selectedDateKey && entry?.status !== "done");
    return upcoming?.id || displayEntries[displayEntries.length - 1]?.id || "";
  }, [displayEntries, selectedDateKey]);

  const selectedDateLabel = useMemo(() => formatExpandedDateLabel(selectedDateKey), [selectedDateKey]);
  const commitSelectedDate = useCallback(
    (nextDateKey) => {
      const normalized = normalizeLocalDateKey(nextDateKey);
      if (!normalized || typeof setData !== "function") return;
      setData((previous) => ({
        ...previous,
        ui: {
          ...(previous?.ui || {}),
          selectedDateKey: normalized,
          selectedDate: normalized,
        },
      }));
      setExpandedEntryId("");
      setCalendarOpen(false);
    },
    [setData]
  );

  const openSessionForOccurrence = useCallback(
    (occurrence, categoryId = null) => {
      if (!occurrence?.id) return;
      const gate = resolveRuntimeSessionGate(safeData, { occurrenceId: occurrence.id });
      if (gate.status !== "ready" && gate.activeSession?.occurrenceId) {
        const activeOccurrence = (Array.isArray(safeData.occurrences) ? safeData.occurrences : []).find(
          (entry) => entry?.id === gate.activeSession.occurrenceId
        ) || null;
        const activeGoal = activeOccurrence?.goalId ? goalsById.get(activeOccurrence.goalId) || null : null;
        setTab?.("session", {
          sessionCategoryId: activeGoal?.categoryId || categoryId || null,
          sessionDateKey: gate.activeSession.dateKey || activeOccurrence?.date || todayKey,
          sessionOccurrenceId: gate.activeSession.occurrenceId || null,
        });
        return;
      }

      const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
      setTab?.("session", {
        sessionCategoryId: goal?.categoryId || categoryId || null,
        sessionDateKey: occurrence.date || todayKey,
        sessionOccurrenceId: occurrence.id || null,
      });
    },
    [goalsById, safeData, setTab, todayKey]
  );

  const toggleExpanded = useCallback((entryId) => {
    setExpandedEntryId((current) => (current === entryId ? "" : entryId));
  }, []);

  return (
    <AppScreen
      pageId="timeline"
      headerTitle={TIMELINE_SCREEN_COPY.title}
      headerSubtitle={TIMELINE_SCREEN_COPY.subtitle}
      headerRight={
        <button
          type="button"
          className="lovableIconButton"
          aria-label={TIMELINE_SCREEN_COPY.calendarAriaLabel}
          onClick={() => setCalendarOpen(true)}
        >
          <CalendarIcon />
        </button>
      }
    >
      <div className="lovablePage">
        {categories.length ? (
          <div className="lovableFilterRow" aria-label={TIMELINE_SCREEN_COPY.categoryFilterLabel}>
            <AppChip active={categoryFilterId === "all"} onClick={() => setCategoryFilterId("all")}>
              {TIMELINE_SCREEN_COPY.allCategories}
            </AppChip>
            {categories.map((category) => (
              <AppChip
                key={category.id}
                active={categoryFilterId === category.id}
                onClick={() => setCategoryFilterId(category.id)}
              >
                {category.name}
              </AppChip>
            ))}
          </div>
        ) : null}

        {displayEntries.length ? (
          <div className="lovableTimelineList">
            {displayEntries.map((entry) => {
              const isComplete = entry.status === "done";
              const isCurrent = entry.id === currentEntryId;
              const expanded = entry.id === expandedEntryId;
              const targetOccurrence = entry.targetOccurrence || null;
              return (
                <div
                  key={entry.id}
                  className={`lovableTimelineItem${isComplete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`}
                >
                  <div className="lovableTimelineNode" />
                  <div className={`lovableTimelineCard${expanded ? " is-expanded" : ""}`}>
                    <button
                      type="button"
                      className="lovableTimelineCardButton"
                      onClick={() => toggleExpanded(entry.id)}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? TIMELINE_SCREEN_COPY.collapse : TIMELINE_SCREEN_COPY.expand} ${entry.title}`}
                    >
                      <div className="lovableTimelineDate">{formatDateLabel(entry.dateKey)}</div>
                      {entry.categoryLabel ? <div className="lovableTimelineCategory">{entry.categoryLabel}</div> : null}
                      <div className="lovableTimelineTitle">{entry.title}</div>
                      <div className="lovableTimelineSubtitle">{entry.subtitle}</div>
                    </button>

                    {expanded ? (
                      <div className="lovableTimelineExpand">
                        <div className="lovableTimelineExpandDate">{formatExpandedDateLabel(entry.dateKey)}</div>
                        <div className="lovableTimelineExpandMeta">
                          <div className="lovableTimelineExpandItem">
                            <span>{TIMELINE_SCREEN_COPY.inlineDuration}</span>
                            <strong>{Number.isFinite(entry.durationMinutes) ? `${entry.durationMinutes} min` : "Libre"}</strong>
                          </div>
                          <div className="lovableTimelineExpandItem">
                            <span>{TIMELINE_SCREEN_COPY.inlineStatus}</span>
                            <strong>{statusLabel(entry.status)}</strong>
                          </div>
                          <div className="lovableTimelineExpandItem">
                            <span>{TIMELINE_SCREEN_COPY.inlineCategory}</span>
                            <strong>{entry.categoryLabel || TIMELINE_SCREEN_COPY.inlineNoCategory}</strong>
                          </div>
                          <div className="lovableTimelineExpandItem">
                            <span>{TIMELINE_SCREEN_COPY.inlineObjective}</span>
                            <strong>{entry.outcome?.title || TIMELINE_SCREEN_COPY.inlineNoObjective}</strong>
                          </div>
                        </div>
                        <div className="lovableTimelineExpandItem">
                          <span>{TIMELINE_SCREEN_COPY.inlineNotes}</span>
                          <strong>{entry.notes || TIMELINE_SCREEN_COPY.inlineNoNotes}</strong>
                        </div>

                        {entry.kind === "group" ? (
                          <div className="lovableTimelineExpandBlock">
                            <div className="lovableSectionLabel">{TIMELINE_SCREEN_COPY.recurringOccurrences}</div>
                            <div className="lovableTimelineUpcomingList">
                              {entry.groupedOccurrences
                                .filter((occurrenceEntry) => String(occurrenceEntry?.dateKey || "") >= selectedDateKey)
                                .slice(0, 3)
                                .map((occurrenceEntry) => (
                                  <div key={occurrenceEntry.id} className="lovableTimelineUpcomingItem">
                                    <span>{formatExpandedDateLabel(occurrenceEntry.dateKey)}</span>
                                    <strong>{occurrenceEntry.startTime || "Heure libre"}</strong>
                                  </div>
                                ))}
                              {!entry.groupedOccurrences.some((occurrenceEntry) => String(occurrenceEntry?.dateKey || "") >= selectedDateKey) ? (
                                <div className="lovableMuted">{TIMELINE_SCREEN_COPY.recurringNoUpcoming}</div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="lovableTimelineExpandActions">
                          <GhostButton
                            type="button"
                            className="lovableTimelineAction"
                            onClick={() =>
                              onEditItem?.({
                                id: entry.goal?.id,
                                type: "PROCESS",
                                categoryId: entry.goal?.categoryId || null,
                              })
                            }
                          >
                            {TIMELINE_SCREEN_COPY.inlineEditAction}
                          </GhostButton>
                          {entry.outcome?.id ? (
                            <GhostButton
                              type="button"
                              className="lovableTimelineAction"
                              onClick={() =>
                                onEditItem?.({
                                  id: entry.outcome.id,
                                  type: "OUTCOME",
                                  categoryId: entry.outcome.categoryId || null,
                                })
                              }
                            >
                              {TIMELINE_SCREEN_COPY.inlineEditObjective}
                            </GhostButton>
                          ) : null}
                          <PrimaryButton
                            type="button"
                            className="lovableTimelineAction lovableTimelineAction--primary"
                            disabled={!targetOccurrence?.id}
                            onClick={() => openSessionForOccurrence(targetOccurrence, entry.category?.id || null)}
                          >
                            {activeOccurrenceId && targetOccurrence?.id === activeOccurrenceId
                              ? TIMELINE_SCREEN_COPY.inlineResumeSession
                              : TIMELINE_SCREEN_COPY.inlineStartSession}
                          </PrimaryButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="lovableCard lovableEmptyCard">
            <div className="lovableEmptyTitle">{TIMELINE_SCREEN_COPY.entryFallbackTitle}</div>
            <p className="lovableEmptyCopy">{TIMELINE_SCREEN_COPY.subtitle}</p>
          </div>
        )}
      </div>

      <AppDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        ariaLabel={TIMELINE_SCREEN_COPY.calendarTitle}
        maxWidth={520}
      >
        <div className="lovableTimelineCalendarDialog">
          <div className="lovableTimelineCalendarHeader">
            <div>
              <div className="lovableTimelineCalendarTitle">{TIMELINE_SCREEN_COPY.calendarTitle}</div>
              <p className="lovableMuted">{TIMELINE_SCREEN_COPY.calendarSubtitle}</p>
            </div>
            <GhostButton type="button" onClick={() => setCalendarOpen(false)}>
              Fermer
            </GhostButton>
          </div>

          <div className="lovableTimelineCalendarSection">
            <div className="lovableSectionLabel">{TIMELINE_SCREEN_COPY.selectedDateLabel}</div>
            <div className="lovableTimelineSelectedDate">{selectedDateLabel}</div>
          </div>

          <div className="lovableTimelineCalendarSection">
            <div className="lovableSectionLabel">{TIMELINE_SCREEN_COPY.selectDate}</div>
            <AppDateField
              value={selectedDateKey}
              onChange={(event) => commitSelectedDate(event.target.value)}
            />
          </div>

          <div className="lovableTimelineCalendarActions">
            <GhostButton
              type="button"
              onClick={() => commitSelectedDate(todayKey)}
              disabled={selectedDateKey === todayKey}
            >
              {TIMELINE_SCREEN_COPY.backToToday}
            </GhostButton>
          </div>
        </div>
      </AppDialog>
    </AppScreen>
  );
}
