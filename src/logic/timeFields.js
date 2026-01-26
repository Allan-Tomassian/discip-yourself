const TIME_MODES = new Set(["NONE", "FIXED", "WINDOW", "SLOTS"]);

function normalizeStartTime(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : "";
}

function normalizeTimeSlots(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    const slot = normalizeStartTime(raw);
    if (!slot || seen.has(slot)) continue;
    seen.add(slot);
    out.push(slot);
  }
  return out;
}

function normalizeTimeMode(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return TIME_MODES.has(raw) ? raw : "";
}

export function normalizeTimeFields(input = {}) {
  const rawMode = normalizeTimeMode(input.timeMode);
  const reminderTime = normalizeStartTime(input.reminderTime);
  const startTime = normalizeStartTime(input.startTime);
  let slots = normalizeTimeSlots(input.timeSlots);
  let mode = rawMode;

  if (!mode) {
    if (slots.length) mode = slots.length > 1 ? "SLOTS" : "FIXED";
    else if (startTime) mode = "FIXED";
    else mode = "NONE";
    if (!startTime && reminderTime) {
      mode = "NONE";
      slots = [];
    }
  }

  if (mode === "NONE") {
    slots = [];
  } else if (mode === "FIXED") {
    const slot = normalizeStartTime(slots[0]) || startTime;
    slots = slot ? [slot] : [];
  } else if (mode === "SLOTS") {
    if (!slots.length && startTime) slots = [startTime];
  } else if (mode === "WINDOW") {
    if (!slots.length && startTime) slots = [startTime];
  }

  let finalStart = startTime;
  if (mode === "NONE") finalStart = "";
  else if (!finalStart && slots[0]) finalStart = slots[0];

  return {
    timeMode: mode || "NONE",
    timeSlots: slots,
    startTime: finalStart,
  };
}
