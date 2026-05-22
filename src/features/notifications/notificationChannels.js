import { ensureNotificationPreferences } from "./notificationPreferences";
import { NOTIFICATION_CHANNEL } from "./notificationTypes";

function normalizeVisibility(value) {
  return value === "hidden" ? "hidden" : "visible";
}

function supports(platformCapabilities, channel) {
  if (channel === NOTIFICATION_CHANNEL.IN_APP && typeof platformCapabilities?.[channel] === "undefined") return true;
  return platformCapabilities?.[channel] === true;
}

function channelEnabled(preferences, channel) {
  return preferences?.channels?.[channel] === true;
}

export function chooseNotificationChannel({ candidate, platformCapabilities = {}, appVisibility = "visible", preferences = null } = {}) {
  if (!candidate || typeof candidate !== "object") return NOTIFICATION_CHANNEL.NONE;

  const normalizedPreferences = ensureNotificationPreferences(preferences);
  if (normalizedPreferences.enabled !== true) return NOTIFICATION_CHANNEL.NONE;

  const visibility = normalizeVisibility(appVisibility);
  if (
    visibility === "visible" &&
    supports(platformCapabilities, NOTIFICATION_CHANNEL.IN_APP) &&
    channelEnabled(normalizedPreferences, NOTIFICATION_CHANNEL.IN_APP)
  ) {
    return NOTIFICATION_CHANNEL.IN_APP;
  }

  if (visibility === "hidden") {
    if (supports(platformCapabilities, NOTIFICATION_CHANNEL.PUSH) && channelEnabled(normalizedPreferences, NOTIFICATION_CHANNEL.PUSH)) {
      return NOTIFICATION_CHANNEL.PUSH;
    }
    if (
      supports(platformCapabilities, NOTIFICATION_CHANNEL.IOS_LOCAL) &&
      channelEnabled(normalizedPreferences, NOTIFICATION_CHANNEL.IOS_LOCAL)
    ) {
      return NOTIFICATION_CHANNEL.IOS_LOCAL;
    }
    if (
      supports(platformCapabilities, NOTIFICATION_CHANNEL.IOS_REMOTE) &&
      channelEnabled(normalizedPreferences, NOTIFICATION_CHANNEL.IOS_REMOTE)
    ) {
      return NOTIFICATION_CHANNEL.IOS_REMOTE;
    }
  }

  return NOTIFICATION_CHANNEL.NONE;
}
