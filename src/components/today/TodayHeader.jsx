import React from "react";
import { Bell, ChevronRight } from "lucide-react";

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "DY";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function TodayHeader({
  dateLabel = "",
  avatarLabel = "",
  avatarUrl = "",
  onOpenProfile,
  notificationUnreadCount = 0,
  onOpenNotifications,
}) {
  const initials = getInitials(avatarLabel);
  const unreadCount = Number.isFinite(notificationUnreadCount) ? Math.max(0, Math.trunc(notificationUnreadCount)) : 0;
  const unreadLabel = unreadCount > 9 ? "9+" : unreadCount ? String(unreadCount) : "";

  return (
    <header className="todayCockpitHeader">
      <div className="todayCockpitHeaderText">
        <h1 className="todayCockpitTitle">Home</h1>
        {dateLabel ? <p className="todayCockpitDate">{dateLabel}</p> : null}
      </div>
      <div className="todayCockpitHeaderActions">
        {typeof onOpenNotifications === "function" ? (
          <button
            type="button"
            className="todayCockpitNotificationButton"
            aria-label={unreadCount ? `Ouvrir les notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Ouvrir les notifications"}
            onClick={() => onOpenNotifications()}
          >
            <Bell size={19} strokeWidth={2} aria-hidden="true" />
            {unreadLabel ? <span className="todayCockpitNotificationBadge">{unreadLabel}</span> : null}
          </button>
        ) : null}
        <button
          type="button"
          className="todayCockpitAvatarButton"
          aria-label="Ouvrir le menu du profil"
          onClick={() => onOpenProfile?.()}
        >
          <span className="todayCockpitAvatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials}</span>}
            <span className="todayCockpitAvatarStatus" aria-hidden="true" />
          </span>
          <ChevronRight size={22} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
