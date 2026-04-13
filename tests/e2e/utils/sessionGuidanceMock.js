export function enablePremium(state) {
  const next = state && typeof state === "object" ? state : {};
  next.profile = {
    ...(next.profile && typeof next.profile === "object" ? next.profile : {}),
    plan: "premium",
    entitlements: {
      ...((next.profile && typeof next.profile.entitlements === "object") ? next.profile.entitlements : {}),
      premium: true,
    },
  };
  return next;
}

function buildSportRunbook({ occurrenceId, actionId, dateKey, title, categoryName }) {
  return {
    version: 2,
    protocolType: "sport",
    occurrenceId,
    actionId,
    dateKey,
    title,
    categoryName,
    objective: {
      why: "tenir un bloc cardio-force net",
      successDefinition: "le circuit est tenu sans casser la forme",
    },
    steps: [
      {
        label: "Mise en route",
        purpose: "préparer les appuis",
        successCue: "souffle posé",
        items: [
          {
            kind: "warmup",
            label: "Montées de genoux",
            minutes: 3,
            guidance: "alterne 30 sec dynamiques puis 30 sec plus calmes pour monter en température",
            successCue: "respiration stable",
          },
          {
            kind: "activation",
            label: "Squats au poids du corps",
            minutes: 2,
            guidance: "2 séries de 12 reps en gardant le buste haut",
            successCue: "genoux stables",
          },
        ],
      },
      {
        label: "Bloc force",
        purpose: "tenir le coeur utile",
        successCue: "gainage propre",
        items: [
          {
            kind: "effort",
            label: "Fentes alternées",
            minutes: 4,
            guidance: "2 séries de 10 reps par jambe sans te précipiter",
            successCue: "appuis nets",
            restSec: 25,
          },
          {
            kind: "effort",
            label: "Planche avant",
            minutes: 4,
            guidance: "3 passages de 40 sec avec 20 sec de repos entre les passages",
            successCue: "bassin aligné",
            restSec: 20,
          },
          {
            kind: "effort",
            label: "Pont fessier",
            minutes: 3,
            guidance: "2 séries de 15 reps avec montée contrôlée et pause d’une seconde en haut",
            successCue: "fessiers engagés",
            restSec: 20,
          },
        ],
      },
      {
        label: "Retour au calme",
        purpose: "faire redescendre proprement",
        successCue: "souffle revenu",
        items: [
          {
            kind: "cooldown",
            label: "Marche lente",
            minutes: 2,
            guidance: "marche en récupérant le souffle avant de t’arrêter",
            successCue: "fréquence calmée",
          },
          {
            kind: "breath",
            label: "Étirements hanches et mollets",
            minutes: 2,
            guidance: "tiens 30 sec par côté sans forcer",
            successCue: "tension relâchée",
          },
        ],
      },
    ],
  };
}

function buildDeepWorkRunbook({ occurrenceId, actionId, dateKey, title, categoryName }) {
  return {
    version: 2,
    protocolType: "deep_work",
    occurrenceId,
    actionId,
    dateKey,
    title,
    categoryName,
    objective: {
      why: "sortir une avancée visible sur le livrable",
      successDefinition: "une version réutilisable existe à la fin du bloc",
    },
    steps: [
      {
        label: "Ouverture utile",
        purpose: "rentrer dans le bon sous-sujet",
        successCue: "point d’entrée verrouillé",
        items: [
          {
            kind: "setup",
            label: "Rouvrir le plan de note",
            minutes: 3,
            guidance: "relis uniquement la section cible et note le sous-livrable attendu",
            successCue: "sous-livrable choisi",
          },
          {
            kind: "setup",
            label: "Choisir l’ordre d’attaque",
            minutes: 2,
            guidance: "liste les 2 sous-parties à traiter dans l’ordre pour éviter de repartir en vrac",
            successCue: "ordre clair",
          },
        ],
      },
      {
        label: "Production",
        purpose: "faire avancer le coeur du livrable",
        successCue: "matière exploitable créée",
        items: [
          {
            kind: "focus",
            label: "Écrire la section problème",
            minutes: 8,
            guidance: "rédige une première version complète de la section problème avec 3 points maximum",
            successCue: "section complète",
          },
          {
            kind: "focus",
            label: "Rédiger les décisions",
            minutes: 8,
            guidance: "enchaîne directement sur les décisions concrètes à garder ou à couper; si tu bloques, reformule-les d’abord en 3 puces",
            successCue: "décisions formulées",
          },
          {
            kind: "checkpoint",
            label: "Vérifier la trace finale",
            minutes: 4,
            guidance: "contrôle que la note peut être reprise telle quelle plus tard",
            successCue: "trace réutilisable",
          },
        ],
      },
      {
        label: "Clôture",
        purpose: "préparer la reprise",
        successCue: "suite explicite",
        items: [
          {
            kind: "close",
            label: "Noter le prochain sous-livrable",
            minutes: 3,
            guidance: "écris la prochaine sous-partie à ouvrir et le critère de fin associé pour reprendre sans friction",
            successCue: "reprise prête",
          },
          {
            kind: "close",
            label: "Nettoyer le contexte de travail",
            minutes: 2,
            guidance: "laisse seulement les documents utiles à la prochaine reprise",
            successCue: "contexte propre",
          },
        ],
      },
    ],
  };
}

function buildPreparedRunbook({
  protocolType = "sport",
  occurrenceId,
  actionId,
  dateKey,
  title,
  categoryName,
}) {
  if (protocolType === "deep_work") {
    return buildDeepWorkRunbook({ occurrenceId, actionId, dateKey, title, categoryName });
  }
  return buildSportRunbook({ occurrenceId, actionId, dateKey, title, categoryName });
}

export async function installSessionGuidanceMock(page, defaults = {}) {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });

  await page.route("**/ai/session-guidance", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.mode !== "prepare") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "SESSION_GUIDANCE_BACKEND_UNAVAILABLE",
          requestId: `req-session-guidance-${body.mode || "unknown"}`,
        }),
      });
      return;
    }

    const protocolType = body.protocolType || defaults.protocolType || "sport";
    const preparedRunbook = buildPreparedRunbook({
      protocolType,
      occurrenceId: body.occurrenceId || defaults.occurrenceId || "occ-guided",
      actionId: body.actionId || defaults.actionId || "goal-guided",
      dateKey: body.dateKey || defaults.dateKey || "2026-04-13",
      title: body.actionTitle || defaults.title || "Session guidée premium",
      categoryName: body.categoryName || defaults.categoryName || (protocolType === "deep_work" ? "Travail" : "Sport"),
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "session_guidance",
        mode: "prepare",
        payload: {
          preparedRunbook,
          toolPlan: null,
          quality: {
            isPremiumReady: true,
            validationPassed: true,
            richnessPassed: true,
            reason: null,
          },
        },
        meta: {
          coachVersion: "v1",
          requestId: "req-session-guidance-prepare",
          aiIntent: "session_prepare",
          quotaRemaining: 5,
          source: "ai_premium",
        },
      }),
    });
  });
}
