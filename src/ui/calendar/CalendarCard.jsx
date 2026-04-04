import React, { useMemo, useRef } from "react";
import { AppCard, AppChip, GhostButton } from "../../shared/ui/app";
import DayRail from "./DayRail";
import { getMonthLabelFR, WEEKDAY_LABELS_FR } from "../../utils/dates";
import { toLocalDateKey } from "../../utils/dateKey";
import "../../features/calendar/calendar.css";

export default function CalendarCard({
  drag = false,
  setActivatorNodeRef,
  listeners,
  attributes,
  selectedDateKey,
  selectedDateLabel,
  localTodayKey,
  calendarView,
  onSetCalendarView,
  calendarPaneKey,
  calendarPanePhase,
  plannedByDate,
  doneByDate,
  accentByDate,
  selectedAccent,
  accent,
  getDayDots,
  onDayOpen,
  onCommitDateKey,
  monthCursor,
  onPrevMonth,
  onNextMonth,
  selectedDayAccent,
  onAddOccurrence,
  addActionContext,
}) {
  const dayRailRef = useRef(null);
  const isOnToday = selectedDateKey === localTodayKey;
  const monthLabel = useMemo(() => getMonthLabelFR(monthCursor), [monthCursor]);
  const monthCells = useMemo(() => {
    if (!(monthCursor instanceof Date) || Number.isNaN(monthCursor.getTime())) return [];
    const year = monthCursor.getFullYear();
    const monthIndex = monthCursor.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDow = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // 0..6 => L..D
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) {
      cells.push({ placeholder: true, id: `head-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        placeholder: false,
        key: toLocalDateKey(new Date(year, monthIndex, day)),
        dayNumber: day,
      });
    }
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailing; i += 1) {
      cells.push({ placeholder: true, id: `tail-${i}` });
    }
    return cells;
  }, [monthCursor]);

  return (
    <AppCard className="calendarCard" data-tour-id="today-calendar-card">
      <div className="calendarCardBody">
        <div className="calendarHeader">
          <div className="calendarTitleRow">
            {drag ? (
              <button
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                className="dragHandle"
                aria-label="Réorganiser"
              >
                ⋮⋮
              </button>
            ) : null}
            <div>
              <div className="cardSectionTitle">Calendrier</div>
              <div className="calendarSubtitle" aria-live="polite" aria-atomic="true">
                {selectedDateLabel || "—"}
              </div>
            </div>
          </div>
          <div className="calendarActions">
            <GhostButton
              className="calendarTodayBtn"
              onClick={() => {
                onDayOpen(localTodayKey);
                if (calendarView === "day") {
                  requestAnimationFrame(() => dayRailRef.current?.scrollToKey(localTodayKey));
                }
              }}
              aria-label="Revenir à aujourd’hui"
              data-tour-id="today-calendar-today"
              disabled={isOnToday}
              type="button"
            >
              <span className="calendarTodayIcon" aria-hidden="true">
                ⟳
              </span>
              Aujourd’hui
            </GhostButton>
            <div className="calendarSeg" role="tablist" aria-label="Affichage du calendrier">
              <AppChip
                className="calendarSegBtn"
                active={calendarView === "day"}
                onClick={() => onSetCalendarView("day")}
                aria-pressed={calendarView === "day"}
                data-tour-id="today-calendar-day"
                type="button"
              >
                Jour
              </AppChip>
              <AppChip
                className="calendarSegBtn"
                active={calendarView === "month"}
                onClick={() => onSetCalendarView("month")}
                aria-pressed={calendarView === "month"}
                data-tour-id="today-calendar-month"
                type="button"
              >
                Mois
              </AppChip>
            </div>
          </div>
        </div>

        <div key={calendarPaneKey} className={`calendarPane ${calendarPanePhase}`}>
          {calendarView === "day" ? (
            <DayRail
              ref={dayRailRef}
              selectedDateKey={selectedDateKey}
              localTodayKey={localTodayKey}
              plannedByDate={plannedByDate}
              doneByDate={doneByDate}
              accentByDate={accentByDate}
              selectedAccent={selectedAccent}
              accent={accent}
              getDayDots={getDayDots}
              onDayOpen={onDayOpen}
              onCommitDateKey={onCommitDateKey}
              isActive={calendarView === "day"}
            />
          ) : (
            <div className="calendarMonthWrap">
              <div className="calendarMonthHeader">
                <GhostButton type="button" size="sm" className="calendarMonthNavBtn" onClick={onPrevMonth} aria-label="Mois précédent">
                  ←
                </GhostButton>
                <div className="calendarMonthTitle">{monthLabel}</div>
                <GhostButton type="button" size="sm" className="calendarMonthNavBtn" onClick={onNextMonth} aria-label="Mois suivant">
                  →
                </GhostButton>
              </div>
              {typeof onAddOccurrence === "function" ? (
                <div className="calendarMonthActions">
                  <GhostButton
                    type="button"
                    size="sm"
                    className="calendarMonthAddBtn"
                    onClick={() => onAddOccurrence(selectedDateKey, addActionContext?.actionId || null)}
                    data-tour-id="today-calendar-add-occurrence"
                  >
                    Ajouter
                  </GhostButton>
                </div>
              ) : null}
              <div className="calendarMonthGrid" data-tour-id="today-calendar-month-grid">
                {WEEKDAY_LABELS_FR.map((label, idx) => (
                  <div key={`${label}-${idx}`} className="calendarWeekday">
                    {label}
                  </div>
                ))}
                {monthCells.map((cell, idx) => {
                  if (cell?.placeholder) {
                    return (
                      <div
                        key={`placeholder-${cell.id || idx}`}
                        className="calendarMonthCell calendarMonthCellPlaceholder"
                        aria-hidden="true"
                      />
                    );
                  }
                  const dayKey = cell?.key || "";
                  const plannedCount = plannedByDate.get(dayKey) || 0;
                  const doneCount = doneByDate.get(dayKey) || 0;
                  const isSelected = dayKey === selectedDateKey;
                  const isToday = dayKey === localTodayKey;
                  const plannedLabel = plannedCount
                    ? `${plannedCount} planifié${plannedCount > 1 ? "s" : ""}`
                    : "0 planifié";
                  const doneLabel = doneCount ? `${doneCount} fait${doneCount > 1 ? "s" : ""}` : "0 fait";
                  const ariaLabel = `${dayKey} · ${plannedLabel} · ${doneLabel}${isToday ? " · Aujourd’hui" : ""}`;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      className={`calendarMonthCell${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                      data-datekey={dayKey}
                      data-planned={plannedCount}
                      data-done={doneCount}
                      aria-label={ariaLabel}
                      aria-pressed={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => onDayOpen(dayKey)}
                      style={{
                        "--calendarMonthCellBorder":
                          isSelected ? selectedDayAccent : accentByDate.get(dayKey) || "var(--border-subtle)",
                        "--calendarMonthCellRing": isSelected ? `${selectedDayAccent}33` : "transparent",
                      }}
                    >
                      <div className="calendarMonthDay">{cell.dayNumber || ""}</div>
                      <div className="calendarMonthMeta">
                        {plannedCount ? `${plannedCount} planifié` : ""}
                        {plannedCount && doneCount ? " · " : ""}
                        {doneCount ? `${doneCount} fait` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppCard>
  );
}
