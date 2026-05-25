import React from "react";
import { AlertTriangle, Check, Clock3, CornerUpRight, PauseCircle } from "lucide-react";
import CommandSurface from "./CommandSurface";

const HIDDEN_STATUSES = new Set(["canceled", "cancelled", "skipped"]);
const TERMINAL_STATUSES = new Set(["done", "missed", "postponed", "blocked", "reported"]);
const RISK_STATUSES = new Set(["late", "missed"]);
const RECOVERY_STATUSES = new Set(["blocked", "reported"]);
const PROBLEM_STATUSES = new Set(["missed", "late", "blocked", "reported"]);
const UPCOMING_STATUSES = new Set(["upcoming", "planned"]);
const MAX_VISIBLE_TIMELINE_ITEMS = 3;

const STATUS_META = {
  done: { tone: "done", label: "Terminé", shortLabel: "Terminé", icon: "check" },
  in_progress: { tone: "active", label: "En cours", shortLabel: "En cours", icon: "clock" },
  active: { tone: "active", label: "En cours", shortLabel: "En cours", icon: "clock" },
  upcoming: { tone: "upcoming", label: "À venir", shortLabel: "Prochain", icon: "" },
  planned: { tone: "upcoming", label: "À venir", shortLabel: "Prochain", icon: "" },
  late: { tone: "risk", label: "En retard", shortLabel: "En retard", icon: "alert" },
  missed: { tone: "risk", label: "Manqué", shortLabel: "Manqué", icon: "alert" },
  blocked: { tone: "terminal", label: "Bloqué", shortLabel: "À reprendre", icon: "alert" },
  reported: { tone: "terminal", label: "Signalé", shortLabel: "À reprendre", icon: "alert" },
  postponed: { tone: "muted", label: "Déplacé", shortLabel: "Déplacé", icon: "moved" },
};

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value) {
  const status = safeString(value).toLowerCase();
  if (status === "active") return "in_progress";
  return status || "upcoming";
}

function statusToText(status) {
  return STATUS_META[status]?.label || "À venir";
}

function statusToShortText(status) {
  return STATUS_META[status]?.shortLabel || statusToText(status);
}

function statusToTone(status) {
  if (RISK_STATUSES.has(status)) return "risk";
  if (RECOVERY_STATUSES.has(status)) return "terminal";
  return STATUS_META[status]?.tone || "upcoming";
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }
  return -1;
}

function addVisibleIndex(indexes, index) {
  if (index < 0 || indexes.includes(index) || indexes.length >= MAX_VISIBLE_TIMELINE_ITEMS) return indexes;
  return [...indexes, index];
}

function resolveAnchorIndex(items) {
  const activeIndex = items.findIndex((item) => item.status === "in_progress");
  if (activeIndex >= 0) return activeIndex;
  const problemIndex = items.findIndex((item) => PROBLEM_STATUSES.has(item.status));
  if (problemIndex >= 0) return problemIndex;
  const upcomingIndex = items.findIndex((item) => UPCOMING_STATUSES.has(item.status));
  if (upcomingIndex >= 0) return upcomingIndex;
  if (items.every((item) => item.status === "done")) return Math.max(0, items.length - 1);
  return 0;
}

function selectVisibleIndexes(items, anchorIndex) {
  if (items.length <= MAX_VISIBLE_TIMELINE_ITEMS) {
    return items.map((_, index) => index);
  }
  if (items.every((item) => item.status === "done")) {
    return items.slice(-MAX_VISIBLE_TIMELINE_ITEMS).map((_, index) => items.length - MAX_VISIBLE_TIMELINE_ITEMS + index);
  }

  let indexes = [anchorIndex];
  const pastIndex = findLastIndex(
    items,
    (item, index) => index < anchorIndex && !UPCOMING_STATUSES.has(item.status)
  );
  indexes = addVisibleIndex(indexes, pastIndex);

  const nextIndex = items.findIndex((item, index) => index > anchorIndex && UPCOMING_STATUSES.has(item.status));
  indexes = addVisibleIndex(indexes, nextIndex);

  let distance = 1;
  while (indexes.length < MAX_VISIBLE_TIMELINE_ITEMS && distance < items.length) {
    indexes = addVisibleIndex(indexes, anchorIndex - distance);
    indexes = addVisibleIndex(indexes, anchorIndex + distance);
    distance += 1;
  }

  return indexes.sort((a, b) => a - b);
}

function buildSummary({ anchorItem, allDone, hiddenCount }) {
  let text = "Ta journée reste structurée.";
  if (allDone) {
    text = "Journée complétée.";
  } else if (anchorItem?.status === "in_progress") {
    text = `${anchorItem.title} est en cours.`;
  } else if (anchorItem?.status === "missed") {
    text = "Un bloc est manqué. Reprends sans dette.";
  } else if (anchorItem?.status === "late") {
    text = "Un bloc est en retard. Ajuste le prochain pas.";
  } else if (RECOVERY_STATUSES.has(anchorItem?.status)) {
    text = "Un bloc demande une reprise simple.";
  } else if (UPCOMING_STATUSES.has(anchorItem?.status)) {
    text = `${anchorItem.title} est le prochain bloc.`;
  } else if (anchorItem?.status === "postponed") {
    text = "Un bloc a été déplacé.";
  }

  return {
    text,
    extraLabel: hiddenCount > 0 ? `+${hiddenCount} bloc${hiddenCount > 1 ? "s" : ""}` : "",
  };
}

function buildTimelineV2ViewModel({ items, timelineMode, progressLabel }) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedItems = sourceItems
    .filter((item) => item?.id && !HIDDEN_STATUSES.has(normalizeStatus(item?.status)))
    .map((item, sourceIndex) => {
      const status = normalizeStatus(item.status);
      const timeLabel = safeString(item.timeLabel) || "--:--";
      const title = safeString(item.title) || "Bloc";
      const statusLabel = statusToText(status);
      const shortStatusLabel = statusToShortText(status);
      return {
        ...item,
        id: safeString(item.id),
        sourceIndex,
        timeLabel,
        title,
        status,
        statusLabel,
        shortStatusLabel,
        tone: statusToTone(status),
        isTerminal: TERMINAL_STATUSES.has(status),
        isInteractive: timelineMode !== "disabled" && timelineMode !== "empty",
        ariaLabel: `${timeLabel}. ${title}. ${statusLabel}.`,
      };
    });
  const hasReliableTimeline = normalizedItems.length > 0 && timelineMode !== "disabled" && timelineMode !== "empty";
  const safeProgressLabel = safeString(progressLabel);
  const progressSummary = hasReliableTimeline && safeProgressLabel && safeProgressLabel !== "--%" ? `${safeProgressLabel} complété` : "";
  const anchorIndex = hasReliableTimeline ? resolveAnchorIndex(normalizedItems) : -1;
  const visibleIndexes = hasReliableTimeline ? selectVisibleIndexes(normalizedItems, anchorIndex) : [];
  const visibleAnchorIndex = visibleIndexes.indexOf(anchorIndex);
  const anchorItem = normalizedItems[anchorIndex] || null;
  const allDone = hasReliableTimeline && normalizedItems.every((item) => item.status === "done");
  const hiddenCount = Math.max(0, normalizedItems.length - visibleIndexes.length);
  const summary = hasReliableTimeline ? buildSummary({ anchorItem, allDone, hiddenCount }) : { text: "", extraLabel: "" };
  const nowPosition =
    visibleAnchorIndex < 0
      ? "50%"
      : visibleIndexes.length <= 1
        ? "50%"
        : `${(visibleAnchorIndex / (visibleIndexes.length - 1)) * 100}%`;

  return {
    items: visibleIndexes.map((itemIndex, visibleIndex) => {
      const item = normalizedItems[itemIndex];
      return {
        ...item,
        visibleIndex,
        isAnchor: itemIndex === anchorIndex,
        isCurrent: itemIndex === anchorIndex,
        showStatusLabel: itemIndex === anchorIndex || PROBLEM_STATUSES.has(item.status) || item.status === "postponed",
      };
    }),
    hasReliableTimeline,
    progressSummary,
    anchorIndex,
    hiddenCount,
    summary,
    nowPosition,
    visibleCount: visibleIndexes.length,
    showPlaceholder: !hasReliableTimeline,
    placeholderTitle: timelineMode === "disabled" ? "Données indisponibles" : "Planning à structurer",
  };
}

function TimelineIcon({ icon }) {
  if (icon === "check") return <Check size={12} strokeWidth={2.4} />;
  if (icon === "alert") return <AlertTriangle size={12} strokeWidth={2.2} />;
  if (icon === "clock") return <Clock3 size={12} strokeWidth={2.2} />;
  if (icon === "moved") return <CornerUpRight size={12} strokeWidth={2.2} />;
  return null;
}

export default function TodayTimeline({
  state = "neutral",
  tone = "neutral",
  motionIntensity = "normal",
  timelineMode = "normal",
  items = [],
  progressLabel = "--%",
  onSelectItem,
}) {
  const viewModel = buildTimelineV2ViewModel({ items, timelineMode, progressLabel });
  const className = [
    "todayTimelineCard",
    state ? `today-state-${state}` : "",
    tone ? `today-tone-${tone}` : "",
    motionIntensity ? `today-motion-${motionIntensity}` : "",
    timelineMode ? `is-timeline-${timelineMode}` : "",
    !viewModel.hasReliableTimeline ? "has-placeholder-timeline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <CommandSurface className={className} tone="timeline" data-testid="today-timeline-card" data-tour-id="today-timeline-card">
      <div className="todayTimelineBackdrop" aria-hidden="true" />
      <div className="todayTimelineHeader">
        <span>Timeline du jour</span>
        {viewModel.progressSummary ? <em>{viewModel.progressSummary}</em> : null}
      </div>

      <div className="todayTimelineViewport">
        {viewModel.showPlaceholder ? (
          <div className="todayTimelinePlaceholder" data-testid="today-timeline-placeholder">
            <span className="todayTimelinePlaceholderIcon" aria-hidden="true">
              <PauseCircle size={15} strokeWidth={2} />
            </span>
            <span>{viewModel.placeholderTitle}</span>
          </div>
        ) : (
          <div
            className="todayTimelineTrack"
            role="list"
            aria-label="Timeline du jour"
            data-visible-count={viewModel.visibleCount}
            style={{ "--timeline-now-position": viewModel.nowPosition }}
          >
            <span className="todayTimelineRail" aria-hidden="true" />
            <span className="todayTimelineNowTick" aria-hidden="true" />
            {viewModel.items.map((item) => {
              const icon = STATUS_META[item.status]?.icon || "";
              const terminalClass = item.isTerminal ? " is-terminal" : "";
              const currentClass = item.isCurrent ? " is-current" : "";
              const anchorClass = item.isAnchor ? " is-anchor" : "";
              const interactiveClass = item.isInteractive ? " is-inspectable" : "";
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`todayTimelinePoint is-${item.tone} is-status-${item.status}${terminalClass}${currentClass}${anchorClass}${interactiveClass}`}
                  onClick={() => (item.isInteractive ? onSelectItem?.(item) : undefined)}
                  disabled={!item.isInteractive}
                  role="listitem"
                  aria-label={item.ariaLabel}
                  data-status={item.status}
                  data-tone={item.tone}
                  data-terminal={item.isTerminal ? "true" : "false"}
                  data-anchor={item.isAnchor ? "true" : "false"}
                  data-current={item.isCurrent ? "true" : "false"}
                  data-launchable="false"
                >
                  <span className="todayTimelinePointText">
                    <span className="todayTimelinePointTime">{item.timeLabel}</span>
                    <span className="todayTimelinePointTitle">{item.title}</span>
                  </span>
                  <span className="todayTimelinePointMarker" aria-hidden="true">
                    <TimelineIcon icon={icon} />
                  </span>
                  {item.showStatusLabel ? <span className="todayTimelinePointStatus">{item.shortStatusLabel}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {viewModel.hasReliableTimeline ? (
        <div className="todayTimelineSummary">
          <span>{viewModel.summary.text}</span>
          {viewModel.summary.extraLabel ? <em>{viewModel.summary.extraLabel}</em> : null}
        </div>
      ) : null}
    </CommandSurface>
  );
}
