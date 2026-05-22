import React from "react";
import { AlertTriangle, Check, Clock3, CornerUpRight, PauseCircle } from "lucide-react";
import CommandSurface from "./CommandSurface";

const HIDDEN_STATUSES = new Set(["canceled", "cancelled", "skipped"]);
const TERMINAL_STATUSES = new Set(["done", "missed", "postponed", "blocked", "reported"]);
const RISK_STATUSES = new Set(["late", "missed"]);
const RECOVERY_STATUSES = new Set(["blocked", "reported"]);

const STATUS_META = {
  done: { tone: "done", label: "Terminé", icon: "check" },
  in_progress: { tone: "active", label: "En cours", icon: "clock" },
  active: { tone: "active", label: "En cours", icon: "clock" },
  upcoming: { tone: "upcoming", label: "À venir", icon: "" },
  planned: { tone: "upcoming", label: "À venir", icon: "" },
  late: { tone: "risk", label: "En retard", icon: "alert" },
  missed: { tone: "risk", label: "Manqué", icon: "alert" },
  blocked: { tone: "terminal", label: "Bloqué", icon: "alert" },
  reported: { tone: "terminal", label: "Signalé", icon: "alert" },
  postponed: { tone: "muted", label: "Déplacé", icon: "moved" },
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

function statusToTone(status) {
  if (RISK_STATUSES.has(status)) return "risk";
  if (RECOVERY_STATUSES.has(status)) return "terminal";
  return STATUS_META[status]?.tone || "upcoming";
}

function getCurrentStatusLabel(status) {
  if (status === "in_progress") return "En cours";
  if (status === "late") return "À traiter";
  return "Prochain";
}

function getCurrentIndex(items) {
  const activeIndex = items.findIndex((item) => item.status === "in_progress");
  if (activeIndex >= 0) return activeIndex;
  const lateIndex = items.findIndex((item) => item.status === "late");
  if (lateIndex >= 0) return lateIndex;
  return items.findIndex((item) => item.status === "upcoming" || item.status === "planned");
}

function buildTimelineViewModel({ items, timelineMode, progressLabel }) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedItems = sourceItems
    .filter((item) => item?.id && !HIDDEN_STATUSES.has(normalizeStatus(item?.status)))
    .slice(0, 6)
    .map((item) => {
      const status = normalizeStatus(item.status);
      const timeLabel = safeString(item.timeLabel) || "--:--";
      const title = safeString(item.title) || "Bloc";
      const statusLabel = statusToText(status);
      return {
        ...item,
        id: safeString(item.id),
        timeLabel,
        title,
        status,
        statusLabel,
        tone: statusToTone(status),
        isTerminal: TERMINAL_STATUSES.has(status),
        isInteractive: timelineMode !== "disabled" && timelineMode !== "empty",
        ariaLabel: `${timeLabel}. ${title}. ${statusLabel}.`,
      };
    });
  const hasReliableTimeline = normalizedItems.length > 0 && timelineMode !== "disabled" && timelineMode !== "empty";
  const currentIndex = hasReliableTimeline ? getCurrentIndex(normalizedItems) : -1;
  const safeProgressLabel = safeString(progressLabel);
  const progressSummary = hasReliableTimeline && safeProgressLabel && safeProgressLabel !== "--%" ? `${safeProgressLabel} complété` : "";

  return {
    items: normalizedItems.map((item, index) => ({
      ...item,
      isCurrent: index === currentIndex,
      progressStyle: normalizedItems.length > 1 ? { "--timeline-node-progress": `${(index / (normalizedItems.length - 1)) * 100}%` } : undefined,
    })),
    hasReliableTimeline,
    progressSummary,
    currentIndex,
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
  const viewModel = buildTimelineViewModel({ items, timelineMode, progressLabel });
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
          <div className="todayTimelineTrack" role="list" aria-label="Timeline du jour">
            <span className="todayTimelineRail" aria-hidden="true" />
            {viewModel.items.map((item) => {
              const icon = STATUS_META[item.status]?.icon || "";
              const terminalClass = item.isTerminal ? " is-terminal" : "";
              const currentClass = item.isCurrent ? " is-current" : "";
              const interactiveClass = item.isInteractive ? " is-inspectable" : "";
            return (
              <button
                key={item.id}
                type="button"
                className={`todayTimelinePoint is-${item.tone} is-status-${item.status}${terminalClass}${currentClass}${interactiveClass}`}
                onClick={() => (item.isInteractive ? onSelectItem?.(item) : undefined)}
                disabled={!item.isInteractive}
                role="listitem"
                aria-label={item.ariaLabel}
                data-status={item.status}
                data-tone={item.tone}
                data-terminal={item.isTerminal ? "true" : "false"}
                style={item.progressStyle}
              >
                <span className="todayTimelinePointText">
                  <span className="todayTimelinePointTime">{item.timeLabel}</span>
                  <span className="todayTimelinePointTitle">{item.title}</span>
                </span>
                <span className="todayTimelinePointMarker" aria-hidden="true">
                  <TimelineIcon icon={icon} />
                </span>
                <span className="todayTimelinePointStatus">{item.isCurrent ? getCurrentStatusLabel(item.status) : item.statusLabel}</span>
              </button>
            );
            })}
          </div>
        )}
      </div>
    </CommandSurface>
  );
}
