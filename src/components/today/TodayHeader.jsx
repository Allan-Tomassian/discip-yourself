import React from "react";
import { ChevronRight } from "lucide-react";

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
}) {
  const initials = getInitials(avatarLabel);

  return (
    <header className="todayCockpitHeader">
      <div className="todayCockpitHeaderText">
        <h1 className="todayCockpitTitle">Today</h1>
        {dateLabel ? <p className="todayCockpitDate">{dateLabel}</p> : null}
      </div>
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
    </header>
  );
}
