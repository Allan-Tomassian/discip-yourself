import { initialData } from "../../../src/logic/state.js";
import { LS_KEY } from "../../../src/utils/storage.js";

function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysKey(baseKey, days) {
  const [yyyy, mm, dd] = String(baseKey || "").split("-").map((v) => Number(v));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
  const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function buildBaseState({ withContent = false } = {}) {
  const data = initialData();
  const today = toDateKey(new Date());
  const tomorrow = addDaysKey(today, 1);
  const inTwoDays = addDaysKey(today, 2);

  data.ui.onboardingCompleted = true;
  data.ui.showPlanStep = false;
  data.ui.selectedDate = today;

  data.categories = [
    { id: "sys_inbox", name: "Général", color: "#64748B", isSystem: true },
    { id: "cat_business", name: "Business", color: "#0EA5E9" },
    { id: "cat_empty", name: "Vide", color: "#22C55E" },
  ];
  data.ui.categoryRailOrder = ["cat_business", "cat_empty", "sys_inbox"];
  data.ui.selectedCategoryId = "cat_business";
  data.ui.selectedCategoryByView = {
    home: "cat_business",
    library: "cat_business",
    plan: "cat_business",
    pilotage: "cat_business",
  };

  if (withContent) {
    data.goals = [
      {
        id: "goal_proj",
        categoryId: "cat_business",
        title: "Projet Seed",
        type: "OUTCOME",
        planType: "STATE",
        status: "active",
        startDate: today,
        deadline: inTwoDays,
        priority: "secondaire",
      },
      {
        id: "goal_action",
        categoryId: "cat_business",
        title: "Action Seed",
        type: "PROCESS",
        planType: "ONE_OFF",
        status: "active",
        oneOffDate: today,
        timeMode: "FIXED",
        startTime: "09:00",
        timeSlots: ["09:00"],
        reminderTime: "08:00",
      },
    ];
    data.habits = [
      {
        id: "habit_legacy",
        categoryId: "cat_business",
        title: "Habitude Legacy Seed",
        cadence: "WEEKLY",
        target: 1,
      },
    ];
    data.occurrences = [
      {
        id: "occ_1",
        goalId: "goal_action",
        date: today,
        start: "09:00",
        slotKey: "09:00",
        status: "planned",
      },
      {
        id: "occ_2",
        goalId: "habit_legacy",
        date: tomorrow,
        start: "00:00",
        slotKey: "00:00",
        status: "planned",
        noTime: true,
      },
    ];
    data.reminders = [
      {
        id: "rem_1",
        goalId: "goal_action",
        time: "08:00",
        windowStart: "",
        windowEnd: "",
      },
      {
        id: "rem_2",
        goalId: "habit_legacy",
        time: "12:00",
        windowStart: "",
        windowEnd: "",
      },
    ];
  }

  return data;
}

export async function seedState(page, state) {
  await page.addInitScript(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: LS_KEY, data: state }
  );
}

export async function getState(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, LS_KEY);
}

export function getTodayKey() {
  return toDateKey(new Date());
}

export function getDateKeyInDays(days) {
  return addDaysKey(toDateKey(new Date()), days);
}
