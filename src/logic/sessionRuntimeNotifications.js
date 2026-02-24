const ENABLE_RUNTIME_NOTIFICATION_STUB_LOGS =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export function emitSessionRuntimeNotificationHook(eventType, payload = {}) {
  if (!ENABLE_RUNTIME_NOTIFICATION_STUB_LOGS) return;
  try {
    // Runtime notification hook (stub): ready to swap with native/local notifications later.
    // eslint-disable-next-line no-console
    console.debug("[session-runtime:notification-hook]", {
      eventType,
      occurrenceId: payload?.occurrenceId || "",
      dateKey: payload?.dateKey || "",
      phase: payload?.runtimePhase || "",
      source: payload?.source || "runtime",
    });
  } catch (err) {
    void err;
  }
}
