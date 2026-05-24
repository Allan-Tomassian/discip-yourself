import { NOTIFICATION_TYPE } from "./notificationTypes";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getMinutesUntilStart(source) {
  const scheduled = Date.parse(source?.scheduledFor);
  const created = Date.parse(source?.createdAt || source?.deliveredAt);
  if (!Number.isFinite(scheduled) || !Number.isFinite(created)) return null;
  const minutes = Math.round((scheduled - created) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export function buildNotificationDisplayCopy(source = {}, { preferSourceCopy = false } = {}) {
  const type = safeString(source?.type);
  const minutesUntilStart = getMinutesUntilStart(source);
  const sourceTitle = preferSourceCopy ? safeString(source?.title) : "";
  const sourceBody = preferSourceCopy ? safeString(source?.body) : "";
  const sourceCta = preferSourceCopy ? safeString(source?.ctaLabel) : "";

  const fallback = {
    title: safeString(source?.title) || "Notification",
    body: safeString(source?.body),
    ctaLabel: safeString(source?.ctaLabel) || "Ouvrir",
  };

  if (type === NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY) {
    return {
      title: sourceTitle || "Prochain bloc",
      body: sourceBody || "Ta journée a un espace libre.",
      ctaLabel: sourceCta || "Créer",
    };
  }

  if (type === NOTIFICATION_TYPE.BLOCK_START_SOON) {
    return {
      title: sourceTitle || "Bloc bientôt prêt",
      body: sourceBody || (minutesUntilStart ? `Commence dans ${minutesUntilStart} min.` : "Commence bientôt."),
      ctaLabel: sourceCta || "Voir",
    };
  }

  if (type === NOTIFICATION_TYPE.BLOCK_START_NOW) {
    return {
      title: sourceTitle || "C’est le moment",
      body: sourceBody || "Lance ton bloc.",
      ctaLabel: sourceCta || "Démarrer",
    };
  }

  if (type === NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY) {
    return {
      title: sourceTitle || "Bloc à récupérer",
      body: sourceBody || "Passe en version courte.",
      ctaLabel: sourceCta || "Ajuster",
    };
  }

  if (type === NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY) {
    return {
      title: sourceTitle || "Bloc manqué",
      body: sourceBody || "Reprends sans dette.",
      ctaLabel: sourceCta || "Ajuster",
    };
  }

  return fallback;
}
