import React, { useMemo, useRef } from "react";
import { Button, Card } from "../../components/UI";
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
  goalAccentByDate,
  goalAccent,
  accent,
  getDayDots,
  onDayOpen,
  onCommitDateKey,
  monthCursor,
  onPrevMonth,
  onNextMonth,
  monthGrid,
  selectedDayAccent,
  onAddOccurrence,
  selectedGoalId,
}) {
  const dayRailRef = useRef(null);
  const isOnToday = selectedDateKey === localTodayKey;
  const monthLabel = useMemo(() => getMonthLabelFR(monthCursor), [monthCursor]);

  return (
    <Card className="calendarCard" data-tour-id="today-calendar-card">
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
            <button
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
            </button>
            <div className="calendarSeg" role="tablist" aria-label="Affichage du calendrier">
              <button
                className={`calendarSegBtn${calendarView === "day" ? " is-active" : ""}`}
                onClick={() => onSetCalendarView("day")}
                aria-pressed={calendarView === "day"}
                data-tour-id="today-calendar-day"
                type="button"
              >
                Jour
              </button>
              <button
                className={`calendarSegBtn${calendarView === "month" ? " is-active" : ""}`}
                onClick={() => onSetCalendarView("month")}
                aria-pressed={calendarView === "month"}
                data-tour-id="today-calendar-month"
                type="button"
              >
                Mois
              </button>
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
              goalAccentByDate={goalAccentByDate}
              goalAccent={goalAccent}
              accent={accent}
              getDayDots={getDayDots}
              onDayOpen={onDayOpen}
              onCommitDateKey={onCommitDateKey}
              isActive={calendarView === "day"}
            />
          ) : (
            <div className="calendarMonthWrap">
              <div className="calendarMonthHeader">
                <Button variant="ghost" onClick={onPrevMonth} aria-label="Mois précédent">
                  ←
                </Button>
                <div className="calendarMonthTitle">{monthLabel}</div>
                <Button variant="ghost" onClick={onNextMonth} aria-label="Mois suivant">
                  →
                </Button>
              </div>
              {typeof onAddOccurrence === "function" ? (
                <div className="calendarMonthActions">
                  <Button
                    variant="ghost"
                    onClick={() => onAddOccurrence(selectedDateKey, selectedGoalId || null)}
                    data-tour-id="today-calendar-add-occurrence"
                  >
                    Ajouter
                  </Button>
                </div>
              ) : null}
              <div className="calendarMonthGrid" data-tour-id="today-calendar-month-grid">
                {WEEKDAY_LABELS_FR.map((label, idx) => (
                  <div key={`${label}-${idx}`} className="calendarWeekday">
                    {label}
                  </div>
                ))}
                {monthGrid.map((cell) => {
                  const dayKey = toLocalDateKey(cell.dateObj);
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
                        opacity: cell.inMonth ? 1 : 0.45,
                        borderColor: isSelected
                          ? selectedDayAccent
                          : goalAccentByDate.get(dayKey) || "rgba(255,255,255,.14)",
                        boxShadow: isSelected ? `0 0 0 2px ${selectedDayAccent}33` : undefined,
                      }}
                    >
                      <div className="calendarMonthDay">{cell.dayNumber}</div>
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
    </Card>
  );
}
