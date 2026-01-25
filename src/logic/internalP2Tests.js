import { getDayCountsForDate } from "./calendar";
import { setOccurrencesStatusForGoalDate, upsertOccurrence } from "./occurrences";

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
    const updated = setOccurrencesStatusForGoalDate("g1", KEY, "skipped", {
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

  console.log("P2 internal tests summary:", pass ? "PASS" : "FAIL");
  console.groupEnd();

  return { pass, results };
}
