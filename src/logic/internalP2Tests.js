import { getDayCountsForDate } from "./calendar";
import { buildMonthGrid, WEEKDAY_LABELS_FR, WEEK_DAYS_PER_WEEK, addDays } from "../utils/dates";
import { fromLocalDateKey, toLocalDateKey } from "../utils/dateKey";
import { ensureWindowForGoal } from "./occurrencePlanner";
import { setOccurrenceStatus, upsertOccurrence } from "./occurrences";

const KEY = "2026-01-18";

function findOccurrences(occurrences, goalId, dateKey) {
  return (Array.isArray(occurrences) ? occurrences : []).filter(
    (o) => o && o.goalId === goalId && o.date === dateKey
  );
}

function countByStart(list) {
  const map = new Map();
  for (const occ of list) {
    const start = typeof occ?.start === "string" ? occ.start : "";
    if (!start) continue;
    map.set(start, (map.get(start) || 0) + 1);
  }
  return map;
}

export function runInternalP2Tests() {
  const results = [];
  let pass = true;

  console.group("P2 internal tests");

  // TEST 1: skip marks planned occurrence without duplicates.
  try {
    const state = {
      goals: [
        {
          id: "g1",
          type: "PROCESS",
          planType: "ACTION",
          status: "active",
          schedule: {},
        },
      ],
      occurrences: [
        {
          id: "o1",
          goalId: "g1",
          date: KEY,
          start: "10:00",
          status: "planned",
          durationMinutes: 30,
        },
      ],
      sessions: [],
    };
    const updated = setOccurrenceStatus("g1", KEY, "10:00", "skipped", {
      occurrences: state.occurrences,
      goals: state.goals,
    });
    const next = { ...state, occurrences: updated };
    const list = findOccurrences(next.occurrences, "g1", KEY);
    const byStart = countByStart(list);
    const occ = list.find((o) => o.start === "10:00");
    const ok =
      list.length === 1 &&
      byStart.get("10:00") === 1 &&
      occ &&
      occ.status === "skipped";
    results.push({ id: "TEST 1", pass: ok });
    if (ok) console.log("TEST 1 PASS");
    else console.error("TEST 1 FAIL", { list });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 1", pass: false, error: err });
    console.error("TEST 1 FAIL", err);
    pass = false;
  }

  // TEST 2: skip without occurrences creates a single skipped occurrence, no duplicates.
  try {
    const state = {
      goals: [
        {
          id: "g1",
          type: "PROCESS",
          planType: "ACTION",
          status: "active",
          schedule: {},
        },
      ],
      occurrences: [],
      sessions: [],
    };
    const updated = upsertOccurrence("g1", KEY, "00:00", 30, { status: "skipped" }, state);
    const list = findOccurrences(updated, "g1", KEY);
    const skipped = list.filter((o) => o.status === "skipped");
    const byStart = countByStart(skipped);
    const hasDuplicateStart = Array.from(byStart.values()).some((v) => v > 1);
    const ok = skipped.length === 1 && !hasDuplicateStart;
    results.push({ id: "TEST 2", pass: ok });
    if (ok) console.log("TEST 2 PASS");
    else console.error("TEST 2 FAIL", { list });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 2", pass: false, error: err });
    console.error("TEST 2 FAIL", err);
    pass = false;
  }

  // TEST 3: includeSkipped respected in getDayCountsForDate.
  try {
    const state = {
      occurrences: [
        { id: "p1", goalId: "g1", date: KEY, start: "09:00", status: "planned", durationMinutes: 30 },
        { id: "d1", goalId: "g2", date: KEY, start: "10:00", status: "done", durationMinutes: 30 },
        { id: "s1", goalId: "g3", date: KEY, start: "11:00", status: "skipped", durationMinutes: 30 },
      ],
    };
    const a = getDayCountsForDate(KEY, state, { includeSkipped: false });
    const b = getDayCountsForDate(KEY, state, { includeSkipped: true });
    const ok =
      a.planned === 1 &&
      a.done === 1 &&
      a.skipped === 0 &&
      b.planned === 1 &&
      b.done === 1 &&
      b.skipped >= 1;
    results.push({ id: "TEST 3", pass: ok });
    if (ok) console.log("TEST 3 PASS");
    else console.error("TEST 3 FAIL", { a, b });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 3", pass: false, error: err });
    console.error("TEST 3 FAIL", err);
    pass = false;
  }

  // TEST 4: month grid always has 7 columns worth of days (labels + cells).
  try {
    const labelsOk = WEEKDAY_LABELS_FR.length === WEEK_DAYS_PER_WEEK && WEEK_DAYS_PER_WEEK === 7;
    const grid = buildMonthGrid(new Date(2026, 0, 1));
    const ok = labelsOk && Array.isArray(grid) && grid.length % WEEK_DAYS_PER_WEEK === 0;
    results.push({ id: "TEST 4", pass: ok });
    if (ok) console.log("TEST 4 PASS");
    else console.error("TEST 4 FAIL", { labels: WEEKDAY_LABELS_FR, size: grid?.length });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 4", pass: false, error: err });
    console.error("TEST 4 FAIL", err);
    pass = false;
  }

  // TEST 5: weekly occurrences generated only on selected days.
  try {
    const startKey = "2026-01-19";
    const windowDays = 7;
    const targetDays = new Set([1, 3, 5]); // Lun, Mer, Ven
    const baseState = {
      goals: [
        {
          id: "g-week",
          type: "PROCESS",
          planType: "ACTION",
          status: "active",
          schedule: { daysOfWeek: [1, 3, 5], timeSlots: ["08:00"], durationMinutes: 30 },
        },
      ],
      occurrences: [],
    };
    const next = ensureWindowForGoal(baseState, "g-week", startKey, windowDays);
    const list = (next.occurrences || []).filter((o) => o && o.goalId === "g-week");
    let expected = 0;
    const startDate = fromLocalDateKey(startKey);
    for (let i = 0; i < windowDays; i += 1) {
      const key = toLocalDateKey(addDays(startDate, i));
      const d = new Date(`${key}T12:00:00`);
      const js = d.getDay();
      const appDow = js === 0 ? 7 : js;
      if (targetDays.has(appDow)) expected += 1;
    }
    const ok = list.length === expected && list.every((o) => typeof o.start === "string" && o.start);
    results.push({ id: "TEST 5", pass: ok });
    if (ok) console.log("TEST 5 PASS");
    else console.error("TEST 5 FAIL", { expected, list });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 5", pass: false, error: err });
    console.error("TEST 5 FAIL", err);
    pass = false;
  }

  // TEST 6: toggle updates a single occurrence only.
  try {
    const state = {
      goals: [{ id: "g1", type: "PROCESS", planType: "ACTION", status: "active" }],
      occurrences: [
        { id: "o1", goalId: "g1", date: KEY, start: "08:00", status: "planned" },
        { id: "o2", goalId: "g1", date: KEY, start: "09:00", status: "planned" },
      ],
    };
    const updated = setOccurrenceStatus("g1", KEY, "08:00", "done", {
      occurrences: state.occurrences,
      goals: state.goals,
    });
    const list = updated.filter((o) => o && o.goalId === "g1" && o.date === KEY);
    const doneCount = list.filter((o) => o.status === "done").length;
    const first = list.find((o) => o.start === "08:00");
    const second = list.find((o) => o.start === "09:00");
    const ok = doneCount === 1 && first?.status === "done" && second?.status === "planned";
    results.push({ id: "TEST 6", pass: ok });
    if (ok) console.log("TEST 6 PASS");
    else console.error("TEST 6 FAIL", { list });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 6", pass: false, error: err });
    console.error("TEST 6 FAIL", err);
    pass = false;
  }

  // TEST 7: one-off occurrence generated on selected date.
  try {
    const oneOffDate = "2026-01-21";
    const baseState = {
      goals: [
        {
          id: "g-once",
          type: "PROCESS",
          planType: "ONE_OFF",
          status: "active",
          oneOffDate,
          startAt: `${oneOffDate}T00:00`,
        },
      ],
      occurrences: [],
    };
    const next = ensureWindowForGoal(baseState, "g-once", oneOffDate, 7);
    const list = (next.occurrences || []).filter((o) => o && o.goalId === "g-once");
    const ok = list.length === 1 && list[0]?.date === oneOffDate && list[0]?.start === "00:00";
    results.push({ id: "TEST 7", pass: ok });
    if (ok) console.log("TEST 7 PASS");
    else console.error("TEST 7 FAIL", { list });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 7", pass: false, error: err });
    console.error("TEST 7 FAIL", err);
    pass = false;
  }

  // TEST 8: conflict resolution keeps slotKey aligned with start.
  try {
    const state = {
      goals: [
        { id: "g1", type: "PROCESS", planType: "ACTION", status: "active" },
        {
          id: "g2",
          type: "PROCESS",
          planType: "ACTION",
          status: "active",
          schedule: { timeSlots: ["09:00"], durationMinutes: 30 },
        },
      ],
      occurrences: [
        { id: "o1", goalId: "g1", date: KEY, start: "09:00", status: "planned", durationMinutes: 30 },
      ],
    };
    const next = ensureWindowForGoal(state, "g2", KEY, 1);
    const occ = (next.occurrences || []).find((o) => o && o.goalId === "g2" && o.date === KEY) || null;
    const ok = occ && occ.start !== "09:00" && occ.slotKey === occ.start;
    results.push({ id: "TEST 8", pass: ok });
    if (ok) console.log("TEST 8 PASS");
    else console.error("TEST 8 FAIL", { occ });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 8", pass: false, error: err });
    console.error("TEST 8 FAIL", err);
    pass = false;
  }

  // TEST 9: upsert keeps slotKey equal to start.
  try {
    const state = {
      goals: [{ id: "g1", type: "PROCESS", planType: "ACTION", status: "active" }],
      occurrences: [],
    };
    const updated = upsertOccurrence("g1", KEY, "08:00", 30, { slotKey: "09:00" }, state);
    const occ = updated.find((o) => o && o.goalId === "g1" && o.date === KEY) || null;
    const ok = occ && occ.start === "08:00" && occ.slotKey === "08:00";
    results.push({ id: "TEST 9", pass: ok });
    if (ok) console.log("TEST 9 PASS");
    else console.error("TEST 9 FAIL", { occ });
    pass = pass && ok;
  } catch (err) {
    results.push({ id: "TEST 9", pass: false, error: err });
    console.error("TEST 9 FAIL", err);
    pass = false;
  }

  console.log("P2 internal tests summary:", pass ? "PASS" : "FAIL");
  console.groupEnd();

  return { pass, results };
}
