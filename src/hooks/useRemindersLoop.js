import { useEffect, useMemo, useRef, useState } from "react";
import { getDueReminders, playReminderSound, sendReminderNotification } from "../logic/reminders";

export function useRemindersLoop({ data, dataRef }) {
  const [activeReminder, setActiveReminder] = useState(null);
  const lastReminderRef = useRef({});
  const activeReminderRef = useRef(activeReminder);

  useEffect(() => {
    activeReminderRef.current = activeReminder;
  }, [activeReminder]);

  const reminderFingerprint = useMemo(() => {
    const reminders = Array.isArray(data?.reminders) ? data.reminders : [];
    const goals = Array.isArray(data?.goals) ? data.goals : [];
    const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
    const reminderSig = reminders
      .map((r) => {
        const days = Array.isArray(r?.days) ? r.days.join(",") : "";
        return `${r?.id || ""}:${r?.goalId || ""}:${r?.time || ""}:${r?.enabled === false ? 0 : 1}:${days}:${
          r?.channel || ""
        }`;
      })
      .sort()
      .join("|");
    const scheduleSig = goals
      .filter((g) => (g?.type || g?.kind || "").toString().toUpperCase() === "PROCESS")
      .map((g) => {
        const slots = Array.isArray(g?.schedule?.timeSlots) ? g.schedule.timeSlots.join(",") : "";
        const days = Array.isArray(g?.schedule?.daysOfWeek) ? g.schedule.daysOfWeek.join(",") : "";
        const enabled = g?.schedule?.remindersEnabled ? 1 : 0;
        return `${g?.id || ""}:${slots}:${days}:${enabled}`;
      })
      .sort()
      .join("|");
    const occurrenceSig = occurrences
      .map((o) => `${o?.id || ""}:${o?.goalId || ""}:${o?.date || ""}:${o?.start || ""}:${o?.status || ""}`)
      .sort()
      .join("|");
    return `${reminderSig}||${scheduleSig}||${occurrenceSig}`;
  }, [data?.reminders, data?.goals, data?.occurrences]);

  useEffect(() => {
    lastReminderRef.current = {};
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (isDev && typeof window !== "undefined" && window.__debugReminders) {
      // eslint-disable-next-line no-console
      console.debug("[reminders] cache cleared");
    }
  }, [reminderFingerprint]);

  useEffect(() => {
    const id = setInterval(() => {
      const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
      const debug = isDev && typeof window !== "undefined" && window.__debugReminders;
      if (activeReminderRef.current) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.debug("[reminders] skipped: active reminder");
        }
        return;
      }
      const current = dataRef.current;
      if (!current || typeof current !== "object") return;
      const now = new Date();
      const due = getDueReminders(current, now, lastReminderRef.current);
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug("[reminders] tick", { now: now.toISOString(), due: due.length });
      }
      if (!due.length) return;
      const reminder = due[0];
      const goal = (current.goals || []).find((g) => g.id === reminder.goalId) || null;
      const habit = !goal ? (current.habits || []).find((h) => h.id === reminder.goalId) || null : null;
      const soundEnabled = Boolean(current?.ui?.soundEnabled);
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug("[reminders] dispatch", {
          goalId: reminder.goalId,
          id: reminder.id,
          source: reminder.__source || "unknown",
          time: reminder.time,
        });
      }
      setActiveReminder({ reminder, goal, habit });
      if (soundEnabled) playReminderSound();
      if ((reminder.channel || "IN_APP") === "NOTIFICATION") {
        sendReminderNotification(reminder, goal?.title || habit?.title || "");
      }
    }, 30000);
    return () => clearInterval(id);
  }, [dataRef]);

  return { activeReminder, setActiveReminder };
}
