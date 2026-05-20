import React, { useCallback, useMemo, useState } from "react";
import { getVisibleCategories } from "../domain/categoryVisibility";
import { resolveGoalType } from "../domain/goalType";
import { getOpenRuntimeSession, resolveRuntimeSessionGate } from "../logic/sessionRuntime";
import {
  AppDateField,
  AppDialog,
  AppScreen,
  CompactCategoryFilter,
} from "../shared/ui/app";
import {
  CommandBadge,
  CommandCard,
  CommandCTA,
  CommandEmptyState,
  CommandSectionHeader,
} from "../shared/ui/command";
import {
  buildTimelineDateStrip,
  getTimelineDisplayTime,
  getTimelineStatusLabel,
  isTimelineNextFocusCandidate,
  resolveTimelineExecutionStatus,
  resolveTimelineTone,
} from "./timelineDisplayModel";
import { TIMELINE_SCREEN_COPY } from "../ui/labels";
import { addDaysLocal, fromLocalDateKey, getWeekdayShortLabel, normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";
import "../features/planning/timeline.css";

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

function formatTimelineTime(entry) {
  const occurrence = entry?.targetOccurrence || entry?.occurrence || null;
  return getTimelineDisplayTime({ startTime: entry?.startTime, occurrence, goal: entry?.goal });
}

function formatDurationLabel(minutes) {
  return Number.isFinite(minutes) ? `${minutes} min` : "Libre";
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

function toDateDistance(dateKey, anchorDateKey) {
  if (!dateKey || !anchorDateKey) return Number.MAX_SAFE_INTEGER;
  return Math.abs(fromLocalDateKey(dateKey).getTime() - fromLocalDateKey(anchorDateKey).getTime());
}

function buildTimelineCategoryOptions({ categories, occurrenceEntries, anchorDateKey }) {
  const stableOrder = new Map(categories.map((category, index) => [category.id, index]));
  const metricsByCategoryId = new Map();

  for (const entry of occurrenceEntries) {
    const categoryId = entry.category?.id || "";
    if (!categoryId) continue;
    if (!metricsByCategoryId.has(categoryId)) {
      metricsByCategoryId.set(categoryId, {
        openCount: 0,
        totalCount: 0,
        nearestDistance: Number.MAX_SAFE_INTEGER,
      });
    }
    const metrics = metricsByCategoryId.get(categoryId);
    metrics.totalCount += 1;
    if (isTimelineNextFocusCandidate(entry.status)) metrics.openCount += 1;
    metrics.nearestDistance = Math.min(metrics.nearestDistance, toDateDistance(entry.dateKey, anchorDateKey));
  }

  return categories
    .map((category) => {
      const metrics = metricsByCategoryId.get(category.id) || {
        openCount: 0,
        totalCount: 0,
        nearestDistance: Number.MAX_SAFE_INTEGER,
      };
      return {
        id: category.id,
        label: category.name,
        openCount: metrics.openCount,
        totalCount: metrics.totalCount,
        nearestDistance: metrics.nearestDistance,
        stableIndex: stableOrder.get(category.id) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((left, right) => {
      if (right.openCount !== left.openCount) return right.openCount - left.openCount;
      if (right.totalCount !== left.totalCount) return right.totalCount - left.totalCount;
      if (left.nearestDistance !== right.nearestDistance) return left.nearestDistance - right.nearestDistance;
      return left.stableIndex - right.stableIndex;
    })
    .map(({ id, label }) => ({ id, label }));
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="5" width="16" height="15" rx="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Timeline({ data, setData, setTab, onEditItem, onOpenSession }) {
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
  const sessionHistory = useMemo(
    () => (Array.isArray(safeData.sessionHistory) ? safeData.sessionHistory : []),
    [safeData.sessionHistory]
  );

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
          status: resolveTimelineExecutionStatus({
            occurrence,
            activeSession: openRuntimeSession,
            activeOccurrenceId,
            sessionHistory,
            dateKey: occurrence.date,
          }),
          occurrence,
          goal,
          category,
          outcome,
        };
      })
      .filter(Boolean)
      .filter((entry) => entry.status !== "canceled" && entry.status !== "skipped");
    return buildWindowEntries(mapped, selectedDateKey);
  }, [activeOccurrenceId, categoriesById, goalsById, openRuntimeSession, processGoalsById, safeData.occurrences, selectedDateKey, sessionHistory]);

  const filteredOccurrenceEntries = useMemo(() => {
    if (categoryFilterId === "all") return occurrenceEntries;
    return occurrenceEntries.filter((entry) => entry.category?.id === categoryFilterId);
  }, [categoryFilterId, occurrenceEntries]);
  const categoryOptions = useMemo(
    () => buildTimelineCategoryOptions({ categories, occurrenceEntries, anchorDateKey: selectedDateKey }),
    [categories, occurrenceEntries, selectedDateKey]
  );

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
          sortedGrouped.find((item) => item.dateKey >= selectedDateKey && isTimelineNextFocusCandidate(item.status)) ||
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
          startTime: representative?.startTime || "",
          status:
            sortedGrouped.some((item) => item.status === "active")
              ? "active"
              : representative?.status || entry.status,
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
        startTime: entry.startTime,
        status: entry.status,
        durationMinutes: entry.occurrence?.durationMinutes || entry.goal?.sessionMinutes || null,
        notes:
          String(entry.goal?.habitNotes || "").trim() ||
          String(entry.goal?.notes || "").trim() ||
          "",
        groupedOccurrences: [entry],
        categoryLabel: entry.category?.name || "",
        title: entry.goal?.title || entry.occurrence?.title || TIMELINE_SCREEN_COPY.entryFallbackTitle,
        subtitle: getTimelineStatusLabel(entry.status),
        targetOccurrence: entry.occurrence,
      });
    }

    return nextEntries;
  }, [filteredOccurrenceEntries, selectedDateKey]);

  const currentEntryId = useMemo(() => {
    const upcoming = displayEntries.find(
      (entry) => String(entry?.dateKey || "") >= selectedDateKey && isTimelineNextFocusCandidate(entry?.status)
    );
    return upcoming?.id || displayEntries[displayEntries.length - 1]?.id || "";
  }, [displayEntries, selectedDateKey]);

  const selectedDateLabel = useMemo(() => formatExpandedDateLabel(selectedDateKey), [selectedDateKey]);
  const dateStripDays = useMemo(
    () => buildTimelineDateStrip(selectedDateKey, todayKey),
    [selectedDateKey, todayKey]
  );
  const selectedDayEntries = useMemo(
    () => filteredOccurrenceEntries.filter((entry) => entry.dateKey === selectedDateKey),
    [filteredOccurrenceEntries, selectedDateKey]
  );
  const selectedDayDurationMinutes = useMemo(
    () =>
      selectedDayEntries.reduce((total, entry) => {
        const minutes = Number(entry?.occurrence?.durationMinutes || entry?.goal?.sessionMinutes);
        return Number.isFinite(minutes) ? total + minutes : total;
      }, 0),
    [selectedDayEntries]
  );
  const nextCommandEntry = useMemo(
    () =>
      displayEntries.find(
        (entry) => String(entry?.dateKey || "") >= selectedDateKey && isTimelineNextFocusCandidate(entry?.status)
      ) ||
      null,
    [displayEntries, selectedDateKey]
  );
  const selectedDayBlockLabel = `${selectedDayEntries.length} bloc${selectedDayEntries.length > 1 ? "s" : ""}`;
  const selectedDayDurationLabel = selectedDayDurationMinutes > 0 ? `${selectedDayDurationMinutes} min` : "Durée libre";
  const nextCommandLabel = nextCommandEntry?.title || "Aucun prochain bloc";
  const nextCommandTone = nextCommandEntry
    ? resolveTimelineTone(nextCommandEntry.status, {
        isCurrent: nextCommandEntry.id === currentEntryId,
        isSelectedDay: nextCommandEntry.dateKey === selectedDateKey,
      })
    : "neutral";
  const nextCommandMeta = nextCommandEntry
    ? [
        nextCommandEntry.categoryLabel || "",
        formatTimelineTime(nextCommandEntry),
        formatDurationLabel(nextCommandEntry.durationMinutes),
      ].filter(Boolean).join(" · ")
    : "";
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
        if (typeof onOpenSession === "function") {
          onOpenSession({
            categoryId: activeGoal?.categoryId || categoryId || null,
            dateKey: gate.activeSession.dateKey || activeOccurrence?.date || todayKey,
            occurrenceId: gate.activeSession.occurrenceId || null,
          });
        } else {
          setTab?.("session", {
            sessionCategoryId: activeGoal?.categoryId || categoryId || null,
            sessionDateKey: gate.activeSession.dateKey || activeOccurrence?.date || todayKey,
            sessionOccurrenceId: gate.activeSession.occurrenceId || null,
          });
        }
        return;
      }

      const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
      if (typeof onOpenSession === "function") {
        onOpenSession({
          categoryId: goal?.categoryId || categoryId || null,
          dateKey: occurrence.date || todayKey,
          occurrenceId: occurrence.id || null,
        });
      } else {
        setTab?.("session", {
          sessionCategoryId: goal?.categoryId || categoryId || null,
          sessionDateKey: occurrence.date || todayKey,
          sessionOccurrenceId: occurrence.id || null,
        });
      }
    },
    [goalsById, onOpenSession, safeData, setTab, todayKey]
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
      <div className="timelineCommandPage lovablePage CommandMotionReveal">
        <CommandCard tone="execution" className="timelineCommandHero">
          <CommandSectionHeader
            tone="execution"
            label="PLANNING"
            title="Architecture du temps."
            subtitle="Ton temps devient ton système. Chaque bloc doit servir une direction."
          />
        </CommandCard>

        <div className="timelineDateStrip" aria-label="Sélection du jour">
          {dateStripDays.map((day) => (
            <button
              key={day.dateKey}
              type="button"
              className={`timelineDatePill${day.isSelected ? " is-selected" : ""}${day.isToday ? " is-today" : ""}`}
              aria-pressed={day.isSelected}
              onClick={() => commitSelectedDate(day.dateKey)}
            >
              <span>{day.weekday}</span>
              <strong>{day.dayNumber}</strong>
              {day.isToday ? <i aria-hidden="true" /> : null}
            </button>
          ))}
        </div>

        <CommandCard tone="neutral" density="compact" className="timelineStatusStrip">
          <div className="timelineStatusMetric">
            <span>Jour affiché</span>
            <strong>{selectedDateLabel}</strong>
          </div>
          <div className="timelineStatusMetric">
            <span>Blocs planifiés</span>
            <strong>{selectedDayBlockLabel}</strong>
          </div>
          <div className="timelineStatusMetric">
            <span>Charge</span>
            <strong>{selectedDayDurationLabel}</strong>
          </div>
          <div className="timelineStatusMetric timelineStatusMetric--wide">
            <span>Prochain bloc</span>
            <strong>{nextCommandLabel}</strong>
          </div>
        </CommandCard>

        {nextCommandEntry ? (
          <CommandCard tone={nextCommandTone} density="compact" className="timelineNextFocusCard">
            <div className="timelineNextFocusHeader">
              <CommandBadge tone={nextCommandTone}>Prochain bloc utile</CommandBadge>
              <span>{nextCommandEntry.dateKey === selectedDateKey ? "Jour affiché" : formatExpandedDateLabel(nextCommandEntry.dateKey)}</span>
            </div>
            <strong>{nextCommandEntry.title}</strong>
            <p>{nextCommandMeta}</p>
          </CommandCard>
        ) : null}

        {categories.length ? (
          <div className="timelineFilterWrap">
            <CompactCategoryFilter
              label={TIMELINE_SCREEN_COPY.categoryFilterLabel}
              options={categoryOptions}
              value={categoryFilterId}
              onChange={setCategoryFilterId}
              allLabel={TIMELINE_SCREEN_COPY.allCategories}
            />
          </div>
        ) : null}

        {displayEntries.length ? (
          <div className="lovableTimelineList">
            {displayEntries.map((entry, index) => {
              const isComplete = entry.status === "done";
              const isCurrent = entry.id === currentEntryId;
              const isSelectedDay = entry.dateKey === selectedDateKey;
              const tone = resolveTimelineTone(entry.status, { isCurrent, isSelectedDay });
              const expanded = entry.id === expandedEntryId;
              const targetOccurrence = entry.targetOccurrence || null;
              const previousEntry = displayEntries[index - 1] || null;
              const showDateSeparator = !previousEntry || previousEntry.dateKey !== entry.dateKey;
              return (
                <React.Fragment key={entry.id}>
                  {showDateSeparator ? (
                    <div className="timelineDateSeparator">
                      <span>{formatDateLabel(entry.dateKey)}</span>
                    </div>
                  ) : null}
                  <div
                    className={`lovableTimelineItem timelineCommandItem${isComplete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`}
                    data-command-tone={tone}
                  >
                    <div className="lovableTimelineNode" />
                    <CommandCard
                      tone={tone}
                      className={`lovableTimelineCard timelineCommandCard${expanded ? " is-expanded" : ""}`}
                    >
                      <button
                        type="button"
                        className="lovableTimelineCardButton"
                        onClick={() => toggleExpanded(entry.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? TIMELINE_SCREEN_COPY.collapse : TIMELINE_SCREEN_COPY.expand} ${entry.title}`}
                      >
                        <div className="timelineCardTopline">
                          <CommandBadge tone={tone} className="timelineStatusBadge">
                            {getTimelineStatusLabel(entry.status)}
                          </CommandBadge>
                        </div>
                        <div className="timelineCardMain">
                          <div className="timelineTimeRail">
                            <span>{formatTimelineTime(entry)}</span>
                          </div>
                          <div className="timelineCardBody">
                            {entry.categoryLabel ? <div className="lovableTimelineCategory">{entry.categoryLabel}</div> : null}
                            <div className="lovableTimelineTitle">{entry.title}</div>
                            <div className="lovableTimelineSubtitle">
                              {[entry.outcome?.title || "", formatDurationLabel(entry.durationMinutes), entry.subtitle].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="lovableTimelineExpand">
                        <div className="lovableTimelineExpandDate">{formatExpandedDateLabel(entry.dateKey)}</div>
                        <div className="lovableTimelineExpandMeta">
                          <div className="lovableTimelineExpandItem">
                            <span>{TIMELINE_SCREEN_COPY.inlineDuration}</span>
                            <strong>{formatDurationLabel(entry.durationMinutes)}</strong>
                          </div>
                          <div className="lovableTimelineExpandItem">
                            <span>{TIMELINE_SCREEN_COPY.inlineStatus}</span>
                            <strong>{getTimelineStatusLabel(entry.status)}</strong>
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
                                    <strong>{formatTimelineTime(occurrenceEntry)}</strong>
                                  </div>
                                ))}
                              {!entry.groupedOccurrences.some((occurrenceEntry) => String(occurrenceEntry?.dateKey || "") >= selectedDateKey) ? (
                                <div className="lovableMuted">{TIMELINE_SCREEN_COPY.recurringNoUpcoming}</div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="lovableTimelineExpandActions">
                          <CommandCTA
                            type="button"
                            variant="secondary"
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
                          </CommandCTA>
                          {entry.outcome?.id ? (
                            <CommandCTA
                              type="button"
                              variant="secondary"
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
                            </CommandCTA>
                          ) : null}
                          <CommandCTA
                            type="button"
                            className="lovableTimelineAction lovableTimelineAction--primary"
                            disabled={!targetOccurrence?.id || !isTimelineNextFocusCandidate(entry.status)}
                            onClick={() =>
                              targetOccurrence?.id && isTimelineNextFocusCandidate(entry.status)
                                ? openSessionForOccurrence(targetOccurrence, entry.category?.id || null)
                                : undefined
                            }
                          >
                            {activeOccurrenceId && targetOccurrence?.id === activeOccurrenceId
                              ? TIMELINE_SCREEN_COPY.inlineResumeSession
                              : TIMELINE_SCREEN_COPY.inlineStartSession}
                          </CommandCTA>
                        </div>
                        </div>
                      ) : null}
                    </CommandCard>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <CommandEmptyState
            label="PLANNING"
            title="Aucun bloc planifié"
            subtitle="Ton planning donne une forme à ton exécution."
            tone="neutral"
            className="timelineEmptyState"
          />
        )}
      </div>

      <AppDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        ariaLabel={TIMELINE_SCREEN_COPY.calendarTitle}
        className="timelineCalendarModal"
        maxWidth={440}
      >
        <div className="lovableTimelineCalendarDialog">
          <div className="lovableTimelineCalendarHeader">
            <div>
              <div className="lovableTimelineCalendarTitle">{TIMELINE_SCREEN_COPY.calendarTitle}</div>
              <p className="lovableMuted">{TIMELINE_SCREEN_COPY.calendarSubtitle}</p>
            </div>
            <CommandCTA type="button" variant="ghost" onClick={() => setCalendarOpen(false)}>
              Fermer
            </CommandCTA>
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
              menuClassName="timelineDatePickerMenu"
            />
          </div>

          <div className="lovableTimelineCalendarActions">
            <CommandCTA
              type="button"
              variant="secondary"
              tone="execution"
              onClick={() => commitSelectedDate(todayKey)}
              disabled={selectedDateKey === todayKey}
            >
              {TIMELINE_SCREEN_COPY.backToToday}
            </CommandCTA>
          </div>
        </div>
      </AppDialog>
    </AppScreen>
  );
}
