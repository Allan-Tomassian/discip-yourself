import { describe, expect, it } from "vitest";
import {
  canUseSessionPremiumPrepareCache,
  SESSION_GUIDANCE_PREPARE_MODEL_FALLBACK,
  SESSION_GUIDANCE_PREPARE_PROMPT_VERSION,
  SESSION_PREMIUM_PREPARE_CACHE_MAX_ENTRIES,
  buildSessionPremiumPrepareCacheKey,
  createSessionPremiumPrepareCacheEntry,
  readSessionPremiumPrepareCacheEntry,
  touchSessionPremiumPrepareCacheEntry,
  upsertSessionPremiumPrepareCacheEntry,
} from "./sessionPrepareCache";

function createPreparePayload(overrides = {}) {
  return {
    mode: "prepare",
    variant: "",
    dateKey: "2026-04-14",
    occurrenceId: "occ-1",
    actionId: "goal-1",
    actionTitle: "Circuit jambes et gainage",
    categoryId: "cat-sport",
    categoryName: "Sport",
    protocolType: "sport",
    targetDurationMinutes: 20,
    blueprintSnapshot: {
      version: 1,
      protocolType: "sport",
      why: "tenir le bloc",
      firstStep: "échauffe-toi",
      ifBlocked: "version courte",
      successDefinition: "séance tenue",
      estimatedMinutes: 20,
    },
    notes: "reste précis",
    ...overrides,
  };
}

function createPreparedRunbook(overrides = {}) {
  return {
    version: 2,
    protocolType: "sport",
    occurrenceId: "occ-1",
    actionId: "goal-1",
    dateKey: "2026-04-14",
    title: "Circuit jambes et gainage",
    categoryName: "Sport",
    objective: {
      why: "tenir un bloc cardio-force net",
      successDefinition: "le circuit est tenu sans casser la forme",
    },
    steps: [
      {
        id: "step_1",
        label: "Échauffement",
        purpose: "ouvrir les appuis",
        successCue: "souffle posé et chevilles mobiles",
        items: [
          {
            id: "step_1_item_1",
            kind: "warmup",
            label: "Montées de genoux",
            minutes: 3,
            guidance: "alterne 30 sec dynamiques puis 30 sec plus calmes pour monter en température",
            successCue: "buste haut",
            restSec: 0,
            transitionLabel: "enchaîne directement",
            execution: null,
          },
          {
            id: "step_1_item_2",
            kind: "activation",
            label: "Squats au poids du corps",
            minutes: 2,
            guidance: "2 séries de 12 reps en gardant le buste haut",
            successCue: "genoux stables",
            restSec: 0,
            transitionLabel: "prends 15 sec pour souffler",
            execution: null,
          },
        ],
      },
      {
        id: "step_2",
        label: "Bloc effort",
        purpose: "tenir le coeur utile",
        successCue: "gainage propre",
        items: [
          {
            id: "step_2_item_1",
            kind: "effort",
            label: "Fentes alternées",
            minutes: 4,
            guidance: "2 séries de 10 reps par jambe sans te précipiter",
            successCue: "appuis nets",
            restSec: 25,
            transitionLabel: "25 sec avant la planche",
            execution: {
              reps: "2 x 10/jambe",
              durationSec: null,
              tempo: null,
              deliverable: null,
              doneWhen: null,
              relaunchCue: null,
              restSec: 25,
            },
          },
          {
            id: "step_2_item_2",
            kind: "effort",
            label: "Planche avant",
            minutes: 4,
            guidance: "3 passages de 40 sec avec 20 sec de repos entre les passages",
            successCue: "bassin aligné",
            restSec: 20,
            transitionLabel: "relâche puis repars",
            execution: {
              reps: null,
              durationSec: 40,
              tempo: null,
              deliverable: null,
              doneWhen: null,
              relaunchCue: null,
              restSec: 20,
            },
          },
        ],
      },
      {
        id: "step_3",
        label: "Retour au calme",
        purpose: "faire redescendre proprement",
        successCue: "souffle ralenti",
        items: [
          {
            id: "step_3_item_1",
            kind: "cooldown",
            label: "Marche lente",
            minutes: 4,
            guidance: "marche 2 min puis allonge progressivement l’expiration",
            successCue: "rythme cardiaque en baisse",
            restSec: 0,
            transitionLabel: "puis étire doucement",
            execution: {
              reps: null,
              durationSec: 120,
              tempo: null,
              deliverable: null,
              doneWhen: null,
              relaunchCue: null,
              restSec: 0,
            },
          },
          {
            id: "step_3_item_2",
            kind: "cooldown",
            label: "Étirement quadriceps",
            minutes: 3,
            guidance: "45 sec par côté sans rebond",
            successCue: "relâchement progressif",
            restSec: 0,
            transitionLabel: "termine en secouant les jambes",
            execution: {
              reps: null,
              durationSec: 90,
              tempo: null,
              deliverable: null,
              doneWhen: null,
              relaunchCue: null,
              restSec: 0,
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createQuality(overrides = {}) {
  return {
    isPremiumReady: true,
    validationPassed: true,
    richnessPassed: true,
    reason: null,
    rejectionReason: null,
    rejectionStage: null,
    stepCount: 3,
    itemCount: 6,
    issuePaths: [],
    ...overrides,
  };
}

describe("sessionPrepareCache", () => {
  it("uses the premium cache only for premium-capable access, including founder overrides", () => {
    expect(canUseSessionPremiumPrepareCache({ canLaunchPremiumSession: false, effectiveTier: "free" })).toBe(false);
    expect(canUseSessionPremiumPrepareCache({ canLaunchPremiumSession: true, effectiveTier: "premium" })).toBe(true);
    expect(canUseSessionPremiumPrepareCache({ canLaunchPremiumSession: true, effectiveTier: "founder" })).toBe(true);
  });

  it("builds a stable cache key from the normalized blueprint signature", () => {
    const left = createPreparePayload();
    const right = createPreparePayload({
      blueprintSnapshot: {
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
        firstStep: "échauffe-toi",
        why: "tenir le bloc",
        protocolType: "sport",
        version: 1,
        ifBlocked: "version courte",
      },
    });

    expect(buildSessionPremiumPrepareCacheKey({ preparePayload: left })).toBe(
      buildSessionPremiumPrepareCacheKey({ preparePayload: right })
    );
  });

  it("reuses a valid cached premium prepare entry for the same payload", () => {
    const preparePayload = createPreparePayload();
    const entry = createSessionPremiumPrepareCacheEntry({
      preparePayload,
      preparedRunbook: createPreparedRunbook(),
      quality: createQuality(),
      requestId: "req-prepare-1",
      source: "ai_fresh",
    });
    const cache = upsertSessionPremiumPrepareCacheEntry(null, entry, { usedAt: 1000 });

    const resolved = readSessionPremiumPrepareCacheEntry({
      cacheState: cache,
      preparePayload,
    });

    expect(resolved.cacheKey).toBe(entry.cacheKey);
    expect(resolved.entry?.requestId).toBe("req-prepare-1");
    expect(resolved.entry?.source).toBe("ai_fresh");
    expect(resolved.entry?.toolPlan).toBeTruthy();
  });

  it("invalidates the cached entry when duration, blueprint, model, or prompt version changes", () => {
    const preparePayload = createPreparePayload();
    const entry = createSessionPremiumPrepareCacheEntry({
      preparePayload,
      preparedRunbook: createPreparedRunbook(),
      quality: createQuality(),
      requestId: "req-prepare-2",
      source: "ai_fresh",
    });
    const cache = upsertSessionPremiumPrepareCacheEntry(null, entry);

    expect(
      readSessionPremiumPrepareCacheEntry({
        cacheState: cache,
        preparePayload: createPreparePayload({ targetDurationMinutes: 25 }),
      }).entry
    ).toBeNull();
    expect(
      readSessionPremiumPrepareCacheEntry({
        cacheState: cache,
        preparePayload: createPreparePayload({
          blueprintSnapshot: {
            version: 1,
            protocolType: "sport",
            why: "tenir le bloc",
            firstStep: "échauffe-toi",
            ifBlocked: "version ultra courte",
            successDefinition: "séance tenue",
            estimatedMinutes: 20,
          },
        }),
      }).entry
    ).toBeNull();
    expect(
      readSessionPremiumPrepareCacheEntry({
        cacheState: cache,
        preparePayload,
        model: "gpt-5.4-alt",
      }).entry
    ).toBeNull();
    expect(
      readSessionPremiumPrepareCacheEntry({
        cacheState: cache,
        preparePayload,
        promptVersion: "session_guidance_prepare_v999",
      }).entry
    ).toBeNull();
  });

  it("rejects corrupted or non premium-ready entries", () => {
    const preparePayload = createPreparePayload();
    const degradedEntry = createSessionPremiumPrepareCacheEntry({
      preparePayload,
      preparedRunbook: createPreparedRunbook(),
      quality: createQuality({
        isPremiumReady: false,
        richnessPassed: false,
        reason: "richness_failed",
        rejectionReason: "richness_failed",
      }),
      requestId: "req-prepare-3",
    });

    expect(degradedEntry).toBeNull();
    expect(
      readSessionPremiumPrepareCacheEntry({
        cacheState: {
          version: 1,
          entriesByKey: {
            broken: {
              cacheKey: "broken",
              preparedRunbook: { version: 2, steps: [] },
              quality: createQuality(),
              requestId: "req-broken",
            },
          },
          order: ["broken"],
        },
        preparePayload,
      }).entry
    ).toBeNull();
  });

  it("keeps only the most recent cache entries and updates LRU on touch", () => {
    let cache = null;
    for (let index = 0; index < SESSION_PREMIUM_PREPARE_CACHE_MAX_ENTRIES + 3; index += 1) {
      const entry = createSessionPremiumPrepareCacheEntry({
        preparePayload: createPreparePayload({
          occurrenceId: `occ-${index}`,
          actionId: `goal-${index}`,
          dateKey: `2026-04-${String((index % 20) + 1).padStart(2, "0")}`,
        }),
        preparedRunbook: createPreparedRunbook({
          occurrenceId: `occ-${index}`,
          actionId: `goal-${index}`,
          dateKey: `2026-04-${String((index % 20) + 1).padStart(2, "0")}`,
        }),
        quality: createQuality(),
        requestId: `req-${index}`,
        source: index % 2 === 0 ? "ai_fresh" : "ai_regenerated",
      });
      cache = upsertSessionPremiumPrepareCacheEntry(cache, entry, { usedAt: 1000 + index });
    }

    expect(cache.order).toHaveLength(SESSION_PREMIUM_PREPARE_CACHE_MAX_ENTRIES);
    expect(cache.order[0]).toContain("occ-22");

    const touchedKey = cache.order[cache.order.length - 1];
    const touchedCache = touchSessionPremiumPrepareCacheEntry(cache, touchedKey, { usedAt: 9999 });

    expect(touchedCache.order[0]).toBe(touchedKey);
    expect(touchedCache.entriesByKey[touchedKey].lastUsedAt).toBe(9999);
  });

  it("uses the frontend prepare identity defaults when model metadata is omitted", () => {
    const entry = createSessionPremiumPrepareCacheEntry({
      preparePayload: createPreparePayload(),
      preparedRunbook: createPreparedRunbook(),
      quality: createQuality(),
      requestId: "req-defaults",
      model: null,
      promptVersion: null,
    });

    expect(entry?.model).toBe(SESSION_GUIDANCE_PREPARE_MODEL_FALLBACK);
    expect(entry?.promptVersion).toBe(SESSION_GUIDANCE_PREPARE_PROMPT_VERSION);
  });
});
