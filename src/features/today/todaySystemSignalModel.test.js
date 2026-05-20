import { describe, expect, it } from "vitest";
import {
  SYSTEM_SIGNAL_SEVERITY,
  SYSTEM_SIGNAL_TYPE,
} from "../../logic/systemSignals";
import { buildTodaySystemSignalSurface } from "./todaySystemSignalModel";

const TODAY_KEY = "2026-05-20";

function signal(overrides = {}) {
  return {
    id: "signal-1",
    type: SYSTEM_SIGNAL_TYPE.MISSED_BLOCK,
    severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
    title: "Raw title",
    message: "Raw message",
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildTodaySystemSignalSurface({
    primarySystemSignal: signal(overrides.signal),
    primaryAction: { status: "planned", ...(overrides.primaryAction || {}) },
    dateKey: overrides.dateKey || TODAY_KEY,
    todayKey: overrides.todayKey || TODAY_KEY,
  });
}

describe("buildTodaySystemSignalSurface", () => {
  it("maps an attention signal to compact Today copy and the Adjust action", () => {
    expect(build()).toMatchObject({
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      tone: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      title: "Friction détectée",
      message: "Reprends sans dette avec un ajustement simple.",
      ctaLabel: "Ajuster",
      actionType: "open_adjust",
      signalType: SYSTEM_SIGNAL_TYPE.MISSED_BLOCK,
    });
  });

  it("maps critical signals without using AI action semantics", () => {
    expect(build({
      signal: {
        type: SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
        severity: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      },
      primaryAction: { status: "planned" },
    })).toMatchObject({
      tone: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      title: "Bloc critique en retard",
      ctaLabel: "Ajuster",
      actionType: "open_adjust",
    });
  });

  it("hides info-only signals and non-active dates", () => {
    expect(build({ signal: { severity: SYSTEM_SIGNAL_SEVERITY.INFO } })).toBeNull();
    expect(build({ dateKey: "2026-05-19" })).toBeNull();
  });

  it("suppresses blocked, reported, and late duplicates already carried by the primary action", () => {
    expect(build({
      signal: { type: SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK },
      primaryAction: { status: "blocked" },
    })).toBeNull();
    expect(build({
      signal: { type: SYSTEM_SIGNAL_TYPE.REPORTED_BLOCK },
      primaryAction: { status: "reported" },
    })).toBeNull();
    expect(build({
      signal: {
        type: SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
        severity: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      },
      primaryAction: { status: "late" },
    })).toBeNull();
  });

  it("keeps overload, no-next, and repeated postpone visible when the primary action looks normal", () => {
    expect(build({ signal: { type: SYSTEM_SIGNAL_TYPE.OVERLOAD } })).toMatchObject({
      title: "Surcharge détectée",
      message: "Allège avant de forcer l’exécution.",
    });
    expect(build({ signal: { type: SYSTEM_SIGNAL_TYPE.NO_NEXT_BLOCK } })).toMatchObject({
      title: "Prochain bloc flou",
    });
    expect(build({ signal: { type: SYSTEM_SIGNAL_TYPE.REPEATED_POSTPONE } })).toMatchObject({
      title: "Bloc à replacer",
      message: "Une version plus claire évite l’improvisation.",
    });
  });
});
