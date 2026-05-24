import React from "react";
import { Bell, Check, X } from "lucide-react";
import { AppSheet, AppSheetContent, GhostButton } from "../../shared/ui/app";
import "./notifications.css";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatTime(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function statusLabel(status) {
  if (status === "clicked") return "Ouverte";
  if (status === "dismissed") return "Ignorée";
  if (status === "read") return "Lue";
  return "Nouvelle";
}

export default function NotificationCenter({
  open = false,
  items = [],
  onClose,
  onAction,
}) {
  const safeItems = safeArray(items);

  return (
    <AppSheet open={open} onClose={onClose} maxWidth={420} className="notificationCenterSheet">
      <AppSheetContent
        title="Notifications"
        subtitle="Historique récent dans l’app."
        actions={
          <GhostButton type="button" size="sm" onClick={onClose} aria-label="Fermer les notifications">
            Fermer
          </GhostButton>
        }
        bodyClassName="notificationCenterBody"
      >
        {safeItems.length ? (
          <div className="notificationCenterList">
            {safeItems.map((item) => {
              const title = safeString(item.title) || "Notification";
              const body = safeString(item.body);
              const timeLabel = formatTime(item.deliveredAt);
              const routeable = item.routeable === true;
              return (
                <article
                  key={safeString(item.notificationId) || safeString(item.id)}
                  className={`notificationCenterItem is-${safeString(item.status) || "unread"}`}
                >
                  <span className="notificationCenterItemIcon" aria-hidden="true">
                    {item.status === "unread" ? <Bell size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
                  </span>
                  <div className="notificationCenterItemCopy">
                    <div className="notificationCenterItemMeta">
                      <span>{statusLabel(item.status)}</span>
                      {timeLabel ? <span>{timeLabel}</span> : null}
                    </div>
                    <strong>{title}</strong>
                    {body ? <p>{body}</p> : null}
                  </div>
                  {routeable ? (
                    <button type="button" className="notificationCenterItemAction" onClick={() => onAction?.(item)}>
                      {safeString(item.ctaLabel) || "Ouvrir"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="notificationCenterEmpty">
            <span aria-hidden="true">
              <X size={18} strokeWidth={2} />
            </span>
            <p>Aucune notification récente.</p>
          </div>
        )}
      </AppSheetContent>
    </AppSheet>
  );
}
