import React from "react";
import { Bell, X } from "lucide-react";
import "./notifications.css";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default function InAppNudge({ nudge, onDismiss, onAction, placement = "top" }) {
  const title = safeString(nudge?.title);
  const body = safeString(nudge?.body);
  if (!title && !body) return null;
  const placementClass = placement === "home" ? " is-home" : "";

  return (
    <div className={`inAppNudgeViewport${placementClass}`} aria-live="polite" aria-atomic="true" data-testid="in-app-nudge">
      <aside className="inAppNudge" role="status">
        <span className="inAppNudge__icon" aria-hidden="true">
          <Bell size={17} strokeWidth={2} />
        </span>
        <div className="inAppNudge__copy">
          {title ? <strong className="inAppNudge__title">{title}</strong> : null}
          {body ? <span className="inAppNudge__body">{body}</span> : null}
        </div>
        <button type="button" className="inAppNudge__action" onClick={onAction}>
          {safeString(nudge?.ctaLabel) || "Ouvrir"}
        </button>
        <button type="button" className="inAppNudge__dismiss" onClick={onDismiss} aria-label="Ignorer la notification">
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </aside>
    </div>
  );
}
